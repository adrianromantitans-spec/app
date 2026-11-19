"""Local startup regression, with intercepted Auth/REST only; no live accounts.
Run the dev server, then: python scripts/check-guest-session.py
Uses the same Playwright setup as capture-landing.py.
"""
import importlib.util,json,os,time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixtures',ROOT/'scripts/capture-landing.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3003/app/')
KEY='nexo-session-v1:nexo-test.supabase.co'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  for mode in ['guest','user403','user401','refresh403','refresh400','network','server500','group403']:
   c,rows=f.context(b,lang);calls=[];recovered=False
   if mode=='guest':c.add_init_script('localStorage.removeItem('+json.dumps(KEY)+')')
   elif mode.startswith('refresh'):c.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps({'access_token':'local-fixture','refresh_token':'local-refresh','expires_at':0}))+')')
   def api(r):
    path=urlsplit(r.request.url).path;calls.append(path)
    if path=='/auth/v1/token' and 'grant_type=password' in r.request.url:
     r.fulfill(content_type='application/json',body=json.dumps({'access_token':'local-signin-fixture','refresh_token':'local-refresh-fixture','expires_at':int(time.time())+3600}));return
    if not recovered and (path=='/auth/v1/user' or path=='/auth/v1/token'):
     if mode=='network':r.abort();return
     status={'user403':403,'user401':401,'refresh403':403,'refresh400':400,'server500':500}.get(mode)
     if status:
      r.fulfill(status=status,content_type='application/json',body=json.dumps({'error_code':'refresh_token_not_found' if mode.startswith('refresh') else 'user_banned'}));return
    if path=='/rest/v1/nexo_groups' and mode=='group403':r.fulfill(status=403,content_type='application/json',body=json.dumps({'code':'42501'}));return
    r.fallback()
   c.route('https://nexo-test.supabase.co/**',api);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'#acceso')
   if mode=='group403':
    expect(page.locator('#account-form')).to_have_count(0);expect(page.locator('#toast')).to_contain_text({'es':'No tienes acceso a este grupo.','en':'You do not have access to this group.','ro':'Nu ai acces la acest grup.'}[lang]);assert '/rest/v1/nexo_groups' in calls
   else:
    form=page.locator('#account-form');expect(form).to_be_visible();expect(form.locator('[type=submit]')).to_be_enabled();assert not any(path.startswith('/rest/') for path in calls),calls
    if mode in ['network','server500']:
     expect(page.locator('#toast')).not_to_be_empty();assert page.evaluate('localStorage.getItem('+json.dumps(KEY)+')') is not None
     assert not any(word in page.locator('#toast').inner_text().lower() for word in ['group','grupo','grup']),page.locator('#toast').inner_text()
    else:
     expect(page.locator('#toast')).to_be_empty();assert page.evaluate('localStorage.getItem('+json.dumps(KEY)+')') is None
     if mode=='user403':
      recovered=True;form=page.locator('#account-form');form.locator('[name=email]').fill('alex@example.test');form.locator('[name=password]').fill('Fixture-password-2026');form.locator('[type=submit]').click();expect(page.locator('.home-balance')).to_be_visible()
   assert not errors,errors;print('PASS',lang,mode,flush=True);c.close()
 b.close()
