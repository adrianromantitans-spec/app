"""Local browser/Turnstile/broker fixtures. No provider or production requests.
Start server.mjs; NEXO_URL=http://127.0.0.1:3047/app/ python tests/google_broker_browser.py
"""
from pathlib import Path
import base64,hashlib,json
from urllib.parse import urlencode,urlsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
namespace={};exec(Path(__file__).with_name('auth_browser.py').read_text().split('with sync_playwright() as p:')[0],namespace)
BASE=namespace['BASE'];ROOT=BASE.removesuffix('app/');USER=namespace['USER']
FLOW='11111111-1111-4111-8111-111111111111';OTHER='22222222-2222-4222-8222-222222222222';CODE='C'*43
CALLBACK='https://nexo-test.supabase.co/functions/v1/google-broker/callback'

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  for mode in ['success','injected','failure','cancel','legacy','native','native-substitute']:
   c,seen=namespace['context'](browser,enabled=True);calls={'begin':[],'complete':[]};errors=[]
   c.add_init_script('try{localStorage.setItem("divzplit-language",'+json.dumps(lang)+')}catch{}')
   config={'url':'https://nexo-test.supabase.co','publishableKey':'sb_publishable_fixture','oauthProtection':{'enabled':False,'siteKey':'0x4AAAAAAGIzOswUgGy61ea9'},'googleBroker':{'enabled':mode!='legacy'}}
   c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig='+json.dumps(config)+';'))
   c.route('https://challenges.cloudflare.com/turnstile/v0/api.js?**',lambda r:r.fulfill(content_type='text/javascript',body="window.turnstile={render(host,options){host.setAttribute('data-widget-ready','true');setTimeout(()=>options.callback('fictional-widget-token'),0);return 'fixture';},remove(){}};"))
   def begin(r):
    data=r.request.post_data_json;calls['begin'].append(data)
    assert data['token']=='fictional-widget-token' and data['redirectTo']==ROOT
    args={'client_id':'fixture.apps.googleusercontent.com','redirect_uri':CALLBACK,'response_type':'code','scope':'openid email profile','state':'S'*43,'nonce':'a'*64,'code_challenge':'G'*43,'code_challenge_method':'S256','access_type':'online','prompt':'select_account'}
    r.fulfill(content_type='application/json',body=json.dumps({'authorizeUrl':'https://accounts.google.com/o/oauth2/v2/auth?'+urlencode(args),'flowId':OTHER if mode=='native-substitute' else FLOW}))
   c.route('**/__auth_fixture/functions/v1/google-broker/begin',begin)
   def google(r):
    assert 'code_verifier' not in r.request.url
    r.fulfill(status=302,headers={'Location':CALLBACK+'?state='+('S'*43)+'&code=fixture-google-code'},body='')
   c.route('https://accounts.google.com/o/oauth2/v2/auth?**',google)
   def callback(r):
    args={'broker_error':'cancelled'} if mode=='cancel' else {'broker_code':CODE}
    args['broker_flow']=OTHER if mode=='injected' else FLOW
    r.fulfill(status=303,headers={'Location':ROOT+'?'+urlencode(args)},body='')
   c.route(CALLBACK+'?**',callback)
   def complete(r):
    data=r.request.post_data_json;calls['complete'].append(data)
    assert data['code']==CODE and data['flowId']==FLOW and data['redirectTo']==ROOT
    challenge=base64.urlsafe_b64encode(hashlib.sha256(data['verifier'].encode()).digest()).decode().rstrip('=')
    assert challenge==calls['begin'][0]['codeChallenge']
    r.fulfill(status=400 if mode=='failure' else 200,content_type='application/json',body=json.dumps({'error_code':'broker_completion'} if mode=='failure' else {'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_in':3600,'user':USER}))
   c.route('**/__auth_fixture/functions/v1/google-broker/complete',complete)
   page=c.new_page();page.set_default_timeout(15000);page.on('pageerror',lambda e:errors.append(str(e)))
   if mode.startswith('native'):
    page.goto(ROOT+'google-login/#'+urlencode({'ticket':'T'*43,'challenge':'A'*43,'flow':FLOW,'lang':lang}))
    if mode=='native-substitute':expect(page.locator('#status')).not_to_be_empty();assert not calls['complete']
    else:expect(page.locator('#toast')).not_to_be_empty();assert not calls['complete'] # No native-owned PKCE in this browser.
    assert calls['begin'][0]['launchTicket']=='T'*43
   else:
    page.goto(BASE);button=page.get_by_role('button',name={'es':'Continuar con Google','en':'Continue with Google','ro':'Continuă cu Google'}[lang],exact=True);expect(button).to_be_enabled();button.click()
    form=page.locator('#oauth-consent-form');form.locator('[name=ageBand]').select_option('16_or_over');form.locator('[name=acceptTerms]').check();form.locator('[type=submit]').click()
    if mode in ['success','legacy']:
     expect(page.locator('.account-empty')).to_be_visible();assert len(calls['complete'])==(mode=='success')
     if mode=='legacy':assert not calls['begin'] and len(seen['exchange'])==1
    else:
     expect(page.locator('#toast')).not_to_be_empty();assert len(calls['complete'])==(mode=='failure')
     assert page.evaluate('localStorage.getItem("nexo-session-v1:nexo-test.supabase.co")') is None
     if mode=='cancel':expect(page.locator('#toast')).to_contain_text({'es':'cancelado','en':'cancelled','ro':'anulat'}[lang])
   assert 'broker_code=' not in page.url and 'broker_flow=' not in page.url and 'ticket=' not in page.url
   assert not errors,errors
   print('PASS',lang,mode,flush=True);c.close()
 browser.close()
