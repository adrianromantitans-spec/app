"""Navigation geometry regression with fictional accounts; no production requests."""
import importlib.util, os
from playwright.sync_api import sync_playwright, expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py')
shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3062/app/')
with sync_playwright() as p:
 for name in ['webkit','chromium']:
  browser=p.webkit.launch(headless=True) if name=='webkit' else p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width in [320,393,440]:
   class MobileBrowser:
    def new_context(self,**kwargs):
     kwargs.update(is_mobile=True,has_touch=True,user_agent=('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' if name=='webkit' else 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'))
     return browser.new_context(**kwargs)
   context,_=shots.context(MobileBrowser(),'en',{'width':width,'height':852})
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("""window.pageAnimations=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.id==='main')window.pageAnimations.push(frames);return original.call(this,frames,options)};""")
   page.goto(BASE);expect(page.locator('.dock-effects-enabled')).to_be_visible();page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(250)
   for route in ['groups','activity','profile','home']:
    page.locator('.reference-dock [data-route='+route+']').tap()
    for i in range(4):
     geometry=page.evaluate("""()=>({scale:visualViewport.scale,x:visualViewport.offsetLeft,scrollX,transform:getComputedStyle(document.querySelector('#main')).transform,width:document.documentElement.clientWidth})""")
     assert geometry['scale']==1 and geometry['x']==0 and geometry['scrollX']==0,geometry
     if name=='webkit':assert geometry['transform']=='none',geometry
     page.wait_for_timeout(45)
    expect(page.locator('.reference-dock [data-route='+route+']')).to_have_attribute('aria-current','page')
   frames=page.evaluate('window.pageAnimations');assert frames, 'Navigation must exercise real transitions'
   if name=='webkit':assert all('transform' not in frame for animation in frames for frame in animation),frames
   else:assert any('transform' in frame for animation in frames for frame in animation),'Android web motion must stay unchanged'
   page.emulate_media(reduced_motion='reduce');before=len(frames);page.locator('.reference-dock [data-route=groups]').tap();assert len(page.evaluate('window.pageAnimations'))==before
   assert not errors,errors
   print('PASS',name,width,'all routes: fixed scale/offset, platform motion and reduced motion')
   context.close()
  browser.close()
