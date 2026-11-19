"""Local signup locale/cache regression; no live email or account writes.
Run the existing dev server, then: python scripts/check-signup-language.py
Requires the same Playwright setup as capture-landing.py.
"""
import importlib.util,json,os,tempfile,re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixtures',ROOT/'scripts/capture-landing.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
out=Path(tempfile.mkdtemp(prefix='divzplit-signup-locale-'))
base=os.environ.get('NEXO_URL','http://127.0.0.1:3003/app/')
stale_i18n=re.sub(r'translations.js\?v=[^\"\']+', 'translations.js?v=fixture-stale', (ROOT/'i18n.js').read_text())
stale_keys=['Confirma tu correo','Introduce el código del correo para confirmar tu cuenta y entrar.','Si el correo puede registrarse, recibirás un código. Revisa también spam.','Si el correo puede registrarse, hemos enviado otro código. Revisa también spam.','Vuelve a crear tu cuenta para solicitar un código.','Espera un minuto antes de reenviar el código.']
stale_catalog='\n'.join(line for line in (ROOT/'translations.js').read_text().splitlines() if not any(line.lstrip().startswith(json.dumps(key,ensure_ascii=False)+':') for key in stale_keys))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  for viewport in [{'width':360,'height':640},{'width':1280,'height':850}]:
   c,rows=f.context(b,lang,viewport);c.add_init_script('localStorage.removeItem("nexo-session-v1:nexo-test.supabase.co");localStorage.setItem("divzplit-language",'+json.dumps(lang)+')');calls=[]
   c.route('**/i18n.js?v=language-90',lambda r:r.fulfill(content_type='text/javascript',body=stale_i18n));c.route('**/translations.js?v=fixture-stale',lambda r:r.fulfill(content_type='text/javascript',body=stale_catalog))
   def auth(route):
    path=urlsplit(route.request.url).path
    if path in ['/auth/v1/signup','/auth/v1/verify','/auth/v1/resend']:
     data=route.request.post_data_json;calls.append((path,data))
     if path=='/auth/v1/verify':
      assert data['type']=='signup' and data['email']=='alex@example.test',data
      if data['token']=='000000':route.fulfill(status=403,content_type='application/json',body=json.dumps({'error_code':'otp_expired'}));return
      result={'access_token':'local-otp-fixture','refresh_token':'local-refresh-fixture','user':{'id':f.OWNER,'email':'alex@example.test','email_confirmed_at':'2026-11-19T10:00:00Z','user_metadata':{'notification_intro_pending':False}}}
     else:result={'user':{'id':'pending'}}
     route.fulfill(content_type='application/json',body=json.dumps(result));return
    route.fallback()
   c.route('https://nexo-test.supabase.co/**',auth)
   page=c.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.goto(base+'#registro');form=page.locator('#account-form');expect(form).to_be_visible();expect(form.locator('button[type=submit]')).to_be_enabled()
   form.locator('[name=name]').fill('Alex');form.locator('[name=email]').fill('alex@example.test');form.locator('[name=password]').fill('Fixture-Password-2026');form.locator('[name=ageBand]').select_option('16_or_over');form.locator('[name=acceptTerms]').check();form.locator('[type=submit]').click()
   otp=page.locator('#signup-code-form');expect(otp).to_be_visible();expect(page.locator('.auth-card h2')).to_have_text({'es':'Confirma tu correo','en':'Confirm your email','ro':'Confirmă adresa de e-mail'}[lang]);expect(page.locator('input[type=password]')).to_have_count(0);assert calls[0][1]['data']['language']==lang
   otp.locator('[value=resend]').click();expect(otp.locator('.form-error')).to_have_text({'es':'Espera un minuto antes de reenviar el código.','en':'Wait one minute before resending the code.','ro':'Așteaptă un minut înainte de a retrimite codul.'}[lang]);assert len(calls)==1
   otp.locator('[name=code]').fill('000000');otp.locator('[type=submit]').first.click();expect(otp.locator('.form-error')).to_have_text({'es':'El código no es válido o ha caducado. Solicita uno nuevo.','en':'The code is invalid or has expired. Request a new one.','ro':'Codul nu este valid sau a expirat. Solicită unul nou.'}[lang]);expect(otp).to_be_visible()
   page.screenshot(path=str(out/f'{lang}-{viewport["width"]}-code.png'))
   otp.locator('[name=code]').fill('123456');otp.locator('[type=submit]').first.click();expect(page.locator('.home-balance')).to_be_visible();assert not errors,errors
   assert len(calls)==3,calls
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
   print('PASS',lang,viewport['width'],'signup → invalid/retry → confirmed session, no second password',flush=True);c.close()
 b.close()
