"""Local CAPTCHA/signup fixtures; no real accounts, email, Cloudflare or Auth writes.
NEXO_URL=http://127.0.0.1:3048/app/ python tests/auth_captcha_browser.py
"""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
namespace={};exec(Path(__file__).with_name('auth_browser.py').read_text().split('with sync_playwright() as p:')[0],namespace)
BASE=namespace['BASE'];ROOT=BASE.removesuffix('app/')
with sync_playwright() as p:
 webkit=os.environ.get('NEXO_BROWSER')=='webkit'
 browser=p.webkit.launch(headless=True) if webkit else p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for device in (['iphone'] if webkit else ['desktop','iphone','android-web']):
  for lang in ['es','en','ro']:
   for mode in ['success','cancel','reject']:
    class DeviceBrowser:
     def new_context(self,**options):
      if device!='desktop':options.update(is_mobile=True,has_touch=True,user_agent=p.devices['iPhone 13' if device=='iphone' else 'Pixel 5']['user_agent'])
      return browser.new_context(**options)
    c,seen=namespace['context'](DeviceBrowser());calls=[];errors=[]
    c.add_init_script('try{localStorage.setItem("divzplit-language",'+json.dumps(lang)+')}catch{}')
    c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig='+json.dumps({'url':'https://nexo-test.supabase.co','publishableKey':'sb_publishable_fixture','oauthProtection':{'enabled':False,'siteKey':'0x4AAAAAAGIzOswUgGy61ea9'}})+';'))
    def widget(r):
     r.fulfill(content_type='text/javascript',body="window.turnstile={render(host,options){if(options.action!=='email_auth')throw Error('Wrong action');host.setAttribute('data-widget-ready','true');"+("" if mode=='cancel' else "setTimeout(()=>options.callback('fictional-captcha-token'),0);")+"return 'fixture';},remove(){}};")
    c.route('https://challenges.cloudflare.com/turnstile/v0/api.js?**',widget)
    def signup(r):
     data=r.request.post_data_json;calls.append(data);assert 'fictional-captcha-token' not in r.request.url
     valid=data.get('gotrue_meta_security',{}).get('captcha_token')=='fictional-captcha-token' and mode!='reject'
     r.fulfill(status=200 if valid else 400,content_type='application/json',body=json.dumps({'user':{'id':'pending'}} if valid else {'error_code':'captcha_failed','msg':'captcha protection: request disallowed (no captcha_token found)'}))
    c.route('**/__auth_fixture/auth/v1/signup?**',signup)
    page=c.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_viewport_size({'width':390 if device=='iphone' else 360 if device=='android-web' else 1280,'height':844})
    # NEXO_BROWSER=webkit exercises the Safari engine with an iPhone profile.
    page.goto(BASE+'#registro');form=page.locator('#account-form');expect(form).to_be_visible()
    form.locator('[name=name]').fill('Alex');form.locator('[name=email]').fill('new@example.test');form.locator('[name=password]').fill('fictional-password');form.locator('[name=ageBand]').select_option('16_or_over');form.locator('[name=acceptTerms]').check();form.locator('[type=submit]').click()
    if mode=='cancel':
     dialog=page.locator('.auth-captcha-dialog');expect(dialog.locator('[data-widget-ready]')).to_have_count(1);dialog.get_by_role('button').click();expect(form.locator('.form-error')).not_to_be_empty();assert len(calls)==1
    elif mode=='reject':
     expect(form.locator('.form-error')).to_contain_text('CAPTCHA');assert len(calls)==2
    else:
     expect(page.locator('#signup-code-form')).to_be_visible();assert len(calls)==2
     assert calls[1]=={**calls[0],'gotrue_meta_security':{'captcha_token':'fictional-captcha-token'}}
    assert page.locator('.auth-captcha-dialog').count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    print('PASS',device,lang,mode,flush=True);c.close()
 # Hosted CAPTCHA page used inside the Android native dialog.
 for lang in ['es','en','ro']:
  c=browser.new_context();c.route('https://challenges.cloudflare.com/turnstile/v0/api.js?**',lambda r:r.fulfill(content_type='text/javascript',body="window.turnstile={render(host,options){setTimeout(()=>options.callback('native-proof'),0);return 'fixture';},remove(){}};"))
  page=c.new_page();page.goto(ROOT+'auth-challenge/#nonce='+('A'*43)+'&lang='+lang)
  expect(page.locator('#title')).to_have_text({'es':'Verifica que eres una persona','en':'Verify you are human','ro':'Confirmă că ești o persoană'}[lang])
  page.wait_for_function("() => window.divzplitCaptcha?.status === 'ready'")
  assert page.evaluate('window.divzplitCaptcha')=={'nonce':'A'*43,'status':'ready','token':'native-proof'}
  assert '#' not in page.url and page.evaluate('localStorage.length')==0
  print('PASS native challenge',lang,flush=True);c.close()
 browser.close()
