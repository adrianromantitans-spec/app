"""Native Chromium touch regression for the mobile dock; only fictional local fixtures."""
import importlib.util,os,time
from playwright.sync_api import sync_playwright,expect
s=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 class TouchBrowser:
  def new_context(self,**kwargs):kwargs.update(is_mobile=True,has_touch=True);return b.new_context(**kwargs)
 c,_=m.context(TouchBrowser(),'es');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(os.environ.get('NEXO_URL','http://127.0.0.1:3062/app/'));expect(page.locator('.dock-effects-enabled')).to_be_visible();page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(200)
 page.evaluate("window.touchRoutes=[];document.addEventListener('click',e=>{const b=e.target.closest('.reference-dock>[data-route]');if(b)window.touchRoutes.push(b.dataset.route)})")
 def center(q):r=page.locator(q).bounding_box();return r['x']+r['width']/2,r['y']+r['height']/2
 session=c.new_cdp_session(page)
 def touch(kind,x=None,y=None):session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if x is None else [{'x':x,'y':y,'id':1,'force':1}]})
 x,y=center('.reference-dock [data-route=home]');tx,ty=center('.reference-dock [data-route=groups]');touch('touchStart',x,y)
 for i in range(1,13):touch('touchMove',x+(tx-x)*i/12,y);page.wait_for_timeout(25)
 touch('touchEnd');expect(page.locator('.group-card')).to_have_count(3);assert page.evaluate('window.touchRoutes')==['groups']
 page.wait_for_timeout(200);touch('touchStart',200,650)
 for i in range(1,11):touch('touchMove',200,650-40*i);page.wait_for_timeout(45)
 touch('touchEnd');page.wait_for_function("()=>document.querySelector('.reference-dock').getBoundingClientRect().width<90")
 assert page.evaluate('scrollY')>100;page.wait_for_function("()=>document.querySelector('.reference-dock').getBoundingClientRect().width>356")
 x,y=center('.nav-add');page.touchscreen.tap(x,y);expect(page.locator('.quick-add-modal')).to_be_visible();assert not errors,errors
 print('PASS native Chromium touch: one drag/one route, vertical pan + inertia, idle restore and ordinary + tap')
 c.close();b.close()
