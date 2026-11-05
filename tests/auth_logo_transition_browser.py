"""The moving wordmark and final auth header keep identical typography and geometry.
Uses local Auth fixtures; AUTH_LOGO_ENGINES=chromium,webkit enables both engines.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
ns={}
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0].replace('http://127.0.0.1:3000/app/','http://127.0.0.1:3003/app/'),ns)
with sync_playwright() as p:
 for engine in os.environ.get('AUTH_LOGO_ENGINES','chromium').split(','):
  browser=getattr(p,engine).launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if engine=='chromium' else {}))
  for route in ['#registro','#acceso']:
   for width in map(int,os.environ.get('AUTH_LOGO_WIDTHS','320,393,768,1440').split(',')):
    c,seen=ns['context'](browser);page=c.new_page();page.set_viewport_size({'width':width,'height':852});page.emulate_media(reduced_motion='no-preference')
    if width==1440:
     page.goto(ns['BASE'].removesuffix('app/'))
     page.locator('.hero-actions [data-app-link="signup"]' if route=='#registro' else '.nav-login').click()
    else:page.goto(ns['BASE']+route)
    page.wait_for_function("()=>document.querySelector('.brand-intro-host .brand')?.getAnimations().some(a=>a.effect.getTiming().duration===1161)")
    before=page.evaluate('''()=>{
     const host=document.querySelector('.brand-intro-host');
     for(const a of host.getAnimations({subtree:true})){a.pause();a.currentTime=a.effect.getTiming().duration===1161?1160.999:a.effect.getTiming().duration;}
     window.authHandoffMain=document.querySelector('#app #main');
     const snapshot=(el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},font:s.fontFamily,weight:s.fontWeight,size:s.fontSize,spacing:s.letterSpacing,lineHeight:s.lineHeight,color:s.color,z:getComputedStyle(el.querySelector('.word-z')).color,dot:getComputedStyle(el.querySelector('.word-period')).color};};
     return {moving:snapshot(host.querySelector('.split-word')),target:snapshot(document.querySelector('#app .auth-header .brand .split-word'))};
    }''')
    assert all(before['moving'][k]==before['target'][k] for k in ['font','weight','size','spacing','lineHeight','color','z','dot']),(engine,route,width,before)
    assert max(abs(before['moving']['rect'][k]-before['target']['rect'][k]) for k in ['x','y','width','height'])<1,(engine,route,width,before)
    page.evaluate("document.querySelector('.brand-intro-host').getAnimations({subtree:true}).filter(a=>a.effect.getTiming().duration===1161).forEach(a=>a.finish())")
    expect(page.locator('.brand-intro-host')).to_have_count(0)
    after=page.locator('#app .auth-header .brand .split-word').bounding_box()
    assert max(abs(before['moving']['rect'][k]-after[k]) for k in ['x','y','width','height'])<1,(engine,route,width,before,after)
    assert page.evaluate('window.authHandoffMain===document.querySelector("#app #main")')
    assert not page.locator('#app').evaluate('(e)=>e.inert')
    expect(page.locator('#account-form')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    c.close()
   print('PASS:',engine,route,'wordmark remains identical across handoff at tested screen widths',flush=True)
  for route in ['#registro','#acceso']:
   c,seen=ns['context'](browser);page=c.new_page();page.goto(ns['BASE']+route)
   expect(page.locator('#account-form')).to_be_visible();expect(page.locator('.brand-intro-host')).to_have_count(0);c.close()
  assert not ns['errors'],ns['errors'];browser.close()
