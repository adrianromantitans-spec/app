"""Auth logo motion/handoff in Chromium or Safari/WebKit with local Auth fixtures.
NEXO_URL=http://127.0.0.1:3050/app/ python tests/auth_intro_motion_browser.py
NEXO_BROWSER=webkit NEXO_URL=http://127.0.0.1:3050/app/ python tests/auth_intro_motion_browser.py
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
namespace={};exec(Path(__file__).with_name('auth_browser.py').read_text().split('with sync_playwright() as p:')[0],namespace)
BASE=namespace['BASE']
instrument="""window.__targetReads=0;
const originalRect=Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect=function(...args){if(window.__flight&&this.closest('#app')&&this.matches('.brand,.split-word'))window.__targetReads++;return originalRect.apply(this,args);};
const animate=Element.prototype.animate;
Element.prototype.animate=function(frames,options){const a=animate.call(this,frames,options);if(this.classList.contains('brand')&&options.duration===1161){window.__flight=a;window.__flightFrames=frames;a.pause();}return a;};"""
with sync_playwright() as p:
 webkit=os.environ.get('NEXO_BROWSER')=='webkit'
 browser=p.webkit.launch(headless=True) if webkit else p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [320,393,440,768,1440]:
  for stage in ['welcome','acceso','registro']:
   c,_=namespace['context'](browser);c.add_init_script(instrument)
   page=c.new_page();page.set_viewport_size({'width':width,'height':852});page.emulate_media(reduced_motion='no-preference');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+('' if stage=='welcome' else '#'+stage));page.wait_for_function('()=>!!window.__flight')
   assert page.evaluate('window.__flight.effect.getTiming().duration')==1161
   assert page.locator('.brand-intro-host .word-z').evaluate('(el)=>getComputedStyle(el).animationName')=='z-rise'
   assert page.locator('.brand-intro-host .word-z').evaluate('(el)=>el.getAnimations()[0].effect.getTiming().duration')==1550
   frames=page.evaluate('window.__flightFrames');assert all(set(f)=={'transform'} for f in frames),frames
   page.wait_for_timeout(100);page.evaluate('window.__targetReads=0');page.wait_for_timeout(180)
   assert page.evaluate('window.__targetReads')<=2,'Stationary handoff must not measure the target every frame'
   samples=page.evaluate('''()=>[0,250,650,1160.99].map(t=>{window.__flight.currentTime=t;const brand=document.querySelector('.brand-intro-host .brand'),s=getComputedStyle(brand),r=brand.getBoundingClientRect();return {font:s.fontSize,spacing:s.letterSpacing,left:s.left,top:s.top,x:r.x,y:r.y};})''')
   assert all(all(s[k]==samples[0][k] for k in ['font','spacing','left','top']) for s in samples),samples
   assert samples[0]['x']!=samples[-1]['x'] or samples[0]['y']!=samples[-1]['y'] or stage=='welcome'
   result=page.evaluate('''()=>{const target=document.querySelector('#app .auth-header .brand .split-word'),fly=document.querySelector('.brand-intro-host .split-word'),a=target.getBoundingClientRect(),b=fly.getBoundingClientRect();window.__main=document.querySelector('#app main');return ['x','y','width','height'].map(k=>Math.abs(a[k]-b[k]));}''')
   assert max(result)<1,(width,stage,result)
   # Safari toolbar/viewport repositioning must not jump the paused flying text.
   if width==393 and stage=='acceso':
    page.evaluate("window.__flight.currentTime=500;window.__before=document.querySelector('.brand-intro-host .split-word').getBoundingClientRect().toJSON();document.querySelector('#app .auth-header').style.transform='translateY(13px)';window.visualViewport.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(80)
    delta=page.evaluate("(()=>{const a=window.__before,b=document.querySelector('.brand-intro-host .split-word').getBoundingClientRect();return Math.max(...['x','y','width','height'].map(k=>Math.abs(a[k]-b[k])));})()")
    assert delta<.1,delta
    # An asynchronous render can replace the real target while flight is active.
    page.evaluate("const old=document.querySelector('#app .auth-header .brand'),next=old.cloneNode(true);next.style.removeProperty('visibility');old.replaceWith(next)")
    page.wait_for_timeout(80)
   page.evaluate('window.__flight.finish()');expect(page.locator('.brand-intro-host')).to_have_count(0)
   assert page.evaluate('window.__main===document.querySelector("#app main")')
   assert not page.locator('#app').evaluate('(e)=>e.inert')
   assert page.locator('#app .auth-header .brand').evaluate('(e)=>getComputedStyle(e).visibility')=='visible'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   print('PASS', 'webkit' if webkit else 'chromium',width,stage,'transform-only, stable metrics, exact landing and cleanup',flush=True);c.close()
 for stage in ['welcome','acceso']:
  c,_=namespace['context'](browser);page=c.new_page();page.goto(BASE+('' if stage=='welcome' else '#'+stage));expect(page.locator('.brand-intro-host')).to_have_count(0)
  expect(page.locator('.entry-login' if stage=='welcome' else '#account-form')).to_be_visible();assert not page.locator('#app').evaluate('(e)=>e.inert');c.close()
 print('PASS reduced motion keeps direct usable access',flush=True)
 browser.close()
