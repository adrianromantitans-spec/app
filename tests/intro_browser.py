"""Original letter assembly; pixel-aligned handoff into the real rendered screen."""
from pathlib import Path
import importlib.util
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for signed_in in [False,True]:
  for width in [320,393,768,1440]:
   c,seen=shots.context(browser,'es',viewport={'width':width,'height':852}) if signed_in else context(browser)
   page=c.new_page();page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':width,'height':852});page.goto(BASE)
   expect(page.locator('.brand-intro-host')).to_be_visible();expect(page.locator('.brand-intro-host')).to_have_css('background-color','rgba(0, 0, 0, 0)')
   expect(page.locator('.brand-intro-host .split-word')).to_have_text('DivZplit.')
   assert page.locator('.brand-intro-host .word-z').evaluate('(el)=>getComputedStyle(el).animationName')=='z-rise'
   assert page.locator('.brand-intro-host img,.brand-intro-host svg').count()==0
   assert 'Conectando con tu espacio' not in page.locator('body').inner_text()
   page.wait_for_function("()=>document.querySelector('.brand-intro-host .brand')?.getAnimations().some(a=>a.effect.getTiming().duration===1161)")
   before=page.evaluate('''()=>{
    window.handoffMain=document.querySelector('#app #main');
    const host=document.querySelector('.brand-intro-host');
    for(const a of document.getAnimations().filter(a=>a.effect.getTiming().duration===1161&&host.contains(a.effect.target))){a.pause();a.currentTime=1160.99;}
    const visible=[...document.querySelectorAll('#app .mobile-logo,#app .workspace-sidebar .brand,#app .auth-header .brand')].find(el=>el.getClientRects().length&&el.getBoundingClientRect().width>0);
    const text=visible.querySelector('.split-word'),r=text.getBoundingClientRect(),f=host.querySelector('.split-word').getBoundingClientRect();
    return {target:{x:r.x,y:r.y,width:r.width,height:r.height},flying:{x:f.x,y:f.y,width:f.width,height:f.height}};
   }''')
   assert max(abs(before['target'][k]-before['flying'][k]) for k in ['x','y','width','height'])<1,(signed_in,width,before)
   page.evaluate("for(const a of document.getAnimations().filter(a=>a.effect.getTiming().duration===1161))a.finish()")
   expect(page.locator('.brand-intro-host')).to_have_count(0)
   assert page.evaluate('window.handoffMain===document.querySelector("#app #main")'),'The finished screen must not be rebuilt at handoff'
   assert not page.locator('#app').evaluate('(el)=>el.inert')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if signed_in:expect(page.locator('.home-balance')).to_be_visible()
   else:expect(page.locator('#account-form')).to_be_visible()
   c.close()
  print('PASS pixel-aligned handoff without replacing the real screen:', 'session' if signed_in else 'login',flush=True)
 c,seen=context(browser);held=[]
 token={'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_at':int(__import__('time').time())+3600}
 c.add_init_script('try{localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps(token))+');}catch{}')
 c.route('**/__auth_fixture/auth/v1/user',lambda route:held.append(route))
 page=c.new_page();page.emulate_media(reduced_motion='no-preference');page.goto(BASE)
 expect(page.locator('.brand-intro-host')).to_be_visible();expect(page.locator('.brand-intro-host')).to_have_css('background-color','rgba(0, 0, 0, 0)');page.wait_for_timeout(3100)
 expect(page.locator('.brand-intro-curtain')).to_have_css('opacity','1')
 assert page.locator('#account-form,.workspace-sidebar,.session-check').count()==0 and held
 for route in held:route.fulfill(content_type='application/json',body=json.dumps(USER))
 expect(page.locator('.brand-intro-host')).to_have_count(0);expect(page.locator('.workspace-sidebar')).to_be_visible();c.close()
 c,seen=context(browser);page=c.new_page();page.goto(BASE);expect(page.locator('#account-form')).to_be_visible();assert page.locator('.brand-intro-host').count()==0;c.close()
 assert not errors,errors
 browser.close();print('PASS slow session holds the original centre before flying to the actual app; reduced motion stays direct.')
