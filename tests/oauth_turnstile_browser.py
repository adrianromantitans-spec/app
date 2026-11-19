"""Opt-in Google preflight UI/PKCE tests using local Auth and widget fixtures.
Never contacts Google/Cloudflare/Supabase or creates accounts. Start the dev server.
NEXO_URL=http://127.0.0.1:3045/app/ python tests/oauth_turnstile_browser.py
"""
from pathlib import Path
import json,os
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright,expect
# Reuse only the local transport/PKCE fixture, not its older page assumptions.
namespace={};exec(Path(__file__).with_name('auth_browser.py').read_text().split('with sync_playwright() as p:')[0],namespace)
BASE=namespace['BASE'];make_context=namespace['context']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  for mode in ['disabled','success','reject','outage','rate','expired','cancel','badurl']:
   c,seen=make_context(browser,enabled=True);c.add_init_script('localStorage.setItem("divzplit-language",'+json.dumps(lang)+')');calls={'scripts':0,'preflight':0}
   enabled=mode!='disabled'
   c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig='+json.dumps({'url':'https://nexo-test.supabase.co','publishableKey':'sb_publishable_fixture','oauthProtection':{'enabled':enabled,'siteKey':'0x4AAAAAAGIzOswUgGy61ea9'}})+';'))
   def script(r):
    calls['scripts']+=1
    r.fulfill(content_type='text/javascript',body="""window.__widget={removed:0};window.turnstile={ready(){throw Error('Remove async/defer before using turnstile.ready()');},render(host,options){window.__widget.options=options;host.setAttribute('data-widget-ready','true');"""+("" if mode=='cancel' else "setTimeout(()=>options['expired-callback'](),0);" if mode=='expired' else "setTimeout(()=>options.callback('fictional-widget-token'),0);")+"return 'widget';},remove(){window.__widget.removed++;}};")
   c.route('https://challenges.cloudflare.com/turnstile/v0/api.js?**',script)
   def verify(r):
    calls['preflight']+=1;body=r.request.post_data_json;assert set(body)=={'token','codeChallenge','redirectTo'} and body['token']=='fictional-widget-token';assert body['redirectTo']==BASE.removesuffix('app/')
    url='https://nexo-test.supabase.co/auth/v1/authorize?'+urlencode({'provider':'google','redirect_to':body['redirectTo'],'code_challenge':body['codeChallenge'],'code_challenge_method':'s256'})
    status={'reject':400,'outage':503,'rate':429}.get(mode,200);r.fulfill(status=status,content_type='application/json',body=json.dumps({'authorizeUrl':'https://evil.example/' if mode=='badurl' else url} if status==200 else {'error':'challenge_invalid'}))
   c.route('**/__auth_fixture/functions/v1/oauth-turnstile',verify)
   page=c.new_page();page.set_viewport_size({'width':360 if mode in ['cancel','success'] else 1280,'height':740});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
   google={'es':'Continuar con Google','en':'Continue with Google','ro':'Continuă cu Google'}[lang];button=page.get_by_role('button',name=google,exact=True);expect(button).to_be_enabled();button.click();form=page.locator('#oauth-consent-form');form.locator('[name=ageBand]').select_option('16_or_over');form.locator('[name=acceptTerms]').check();form.locator('[type=submit]').click()
   if mode in ['disabled','success']:
    expect(page.locator('.account-empty')).to_be_visible();assert len(seen['oauth'])==1 and len(seen['exchange'])==1
    assert calls['scripts']==(1 if enabled else 0) and calls['preflight']==(1 if enabled else 0)
   elif mode=='cancel':
    expect(page.locator('[data-widget-ready]')).to_have_count(1);page.locator('[data-action=close-modal]').first.click();expect(form).to_have_count(0);assert not seen['oauth'] and calls['preflight']==0
    page.get_by_role('button',name=google,exact=True).click();expect(page.locator('#oauth-consent-form')).to_be_visible();assert page.evaluate('window.__widget.removed')==1
   else:
    error=form.locator('.form-error');expect(error).not_to_be_empty();assert not seen['oauth'];assert calls['preflight']==(0 if mode=='expired' else 1)
    expected={'es':'Demasiados intentos. Espera un minuto y vuelve a intentarlo.','en':'Too many attempts. Wait a minute and try again.','ro':'Prea multe încercări. Așteaptă un minut și încearcă din nou.'} if mode=='rate' else {'es':'No se ha podido verificar el acceso. Vuelve a intentarlo.','en':'Access could not be verified. Please try again.','ro':'Accesul nu a putut fi verificat. Încearcă din nou.'}
    expect(error).to_have_text(expected[lang]);assert page.evaluate('sessionStorage.getItem("nexo-session-v1:nexo-test.supabase.co:oauth")') is None
   assert not errors,errors;print('PASS',lang,mode,flush=True);c.close()
 browser.close()
