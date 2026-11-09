"""Real mobile dock gestures and scroll behavior, with local fictional API fixtures."""
import importlib.util,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3062/app/')
OUT=Path(os.environ.get('DOCK_PREVIEW_OUT','work/dock-effects'));OUT.mkdir(parents=True,exist_ok=True)
def settled(page):page.evaluate('document.fonts.ready');page.wait_for_timeout(180)
def center(locator):
 b=locator.bounding_box();return (b['x']+b['width']/2,b['y']+b['height']/2)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 # Identical resting pixels, including the current card, header and tab positions.
 images=[]
 for effects in [False,True]:
  c,_=shots.context(browser,'es')
  if not effects:
   c.route('**/dock-effects.js?*',lambda r:r.fulfill(content_type='text/javascript',body=''))
   c.route('**/dock-effects.css?*',lambda r:r.fulfill(content_type='text/css',body=''))
  page=c.new_page();page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible();settled(page);images.append(page.screenshot());(OUT/('rest-on.png' if effects else 'rest-off.png')).write_bytes(images[-1]);print('REST',effects,page.locator('.reference-dock').bounding_box(),page.locator('.nav-add').bounding_box(),flush=True);c.close()
 assert images[0]==images[1],'Resting UI changed beyond the requested motion'
 print('PASS unchanged resting appearance pixel for pixel',flush=True)
 for lang in ['es','en','ro']:
  c,_=shots.context(browser,lang);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
  expect(page.locator('#app')).to_have_class(__import__('re').compile('dock-effects-enabled'));page.emulate_media(reduced_motion='no-preference');settled(page)
  expected={'es':'Planes','en':'Plans','ro':'Planuri'}[lang];expect(page.locator('.reference-dock [data-route=groups]')).to_have_text(expected)
  page.evaluate("window.dockRoutes=[];document.addEventListener('click',e=>{const b=e.target.closest('.reference-dock > button[data-route]');if(b)window.dockRoutes.push(b.dataset.route)})")
  start=center(page.locator('.reference-dock [data-route=home]'));finish=center(page.locator('.reference-dock [data-route=groups]'))
  page.mouse.move(*start);page.mouse.down();page.mouse.move(*finish,steps=12);expect(page.locator('.dock-glass-lens')).to_be_visible();page.wait_for_timeout(120)
  expect(page.locator('.dock-glass-lens')).to_have_attribute('aria-hidden','true');assert page.locator('.dock-glass-lens').evaluate('(e)=>e.inert')
  assert page.locator('.dock-glass-lens [data-route],.dock-glass-lens [data-action],.dock-glass-lens button').count()==0
  if lang=='es':page.screenshot(path=str(OUT/'lens.png'))
  page.mouse.up();expect(page.locator('.group-card')).to_have_count(3);settled(page)
  assert page.evaluate('window.dockRoutes')==['groups'],'A drag triggered duplicate or wrong navigation'
  # Continuous real wheel movement contracts the dock. Idle restores it.
  full=page.locator('.reference-dock').bounding_box()['width']
  page.mouse.move(200,400)
  for _ in range(7):page.mouse.wheel(0,90);page.wait_for_timeout(65)
  page.wait_for_function("()=>document.querySelector('.reference-dock').getBoundingClientRect().width<90")
  compact=page.locator('.reference-dock').bounding_box();add=page.locator('.nav-add').bounding_box()
  assert compact['x']<=add['x'] and add['x']+add['width']<=compact['x']+compact['width']
  assert all(page.locator('.reference-dock > button').evaluate_all('(items)=>items.map(e=>e.inert)'))
  expect(page.locator('.nav-add')).to_be_visible()
  if lang=='es':page.screenshot(path=str(OUT/'compact.png'))
  page.wait_for_function('(width)=>document.querySelector(".reference-dock").getBoundingClientRect().width>=width-.2',arg=full)
  assert not any(page.locator('.reference-dock > button').evaluate_all('(items)=>items.map(e=>e.inert)'))
  if lang=='es':page.screenshot(path=str(OUT/'expanded.png'))
  # Existing +, modal fields, keyboard links and translations still work.
  page.locator('.nav-add').click();expect(page.locator('.quick-add-modal')).to_be_visible();expect(page.locator('.quick-sections')).to_have_count(0)
  expect(page.locator('#app')).not_to_have_class(__import__('re').compile('dock-effects-enabled'))
  page.locator('.quick-add-modal [data-action=new-expense]').click();expect(page.locator('#expense-form')).to_be_visible();page.keyboard.press('Escape')
  expect(page.locator('#app')).to_have_class(__import__('re').compile('dock-effects-enabled'))
  settled(page);page.mouse.move(200,400)
  for _ in range(7):page.mouse.wheel(0,-70);page.wait_for_timeout(65)
  page.wait_for_function("()=>document.querySelector('.reference-dock').getBoundingClientRect().width<90")
  page.wait_for_function('(width)=>document.querySelector(".reference-dock").getBoundingClientRect().width>=width-.2',arg=full)
  page.locator('.reference-dock [data-route=profile]').focus();page.keyboard.press('Enter');expect(page.locator('.account-page')).to_be_visible()
  expect(page.locator('[data-action=language-settings]')).to_be_visible();expect(page.locator('[data-action=privacy-export-full]')).to_be_visible();expect(page.locator('[data-action=delete-account]')).to_be_visible()
  # Releasing outside the bar cancels selection.
  start=center(page.locator('.reference-dock [data-route=profile]'));page.mouse.move(*start);page.mouse.down();page.mouse.move(120,200,steps=10);page.mouse.up();expect(page.locator('.account-page')).to_be_visible()
  page.wait_for_function("()=>document.querySelector('.dock-glass-lens').hidden")
  page.locator('.reference-dock [data-route=groups]').click();expect(page.locator('.group-card')).to_have_count(3);page.emulate_media(reduced_motion='reduce');settled(page)
  page.mouse.move(200,400)
  for _ in range(4):page.mouse.wheel(0,100);page.wait_for_timeout(65)
  assert abs(page.locator('.reference-dock').bounding_box()['width']-full)<.2,'Reduced motion must keep navigation stable'
  for width in [320,430,760,1024,1440]:
   page.set_viewport_size({'width':width,'height':852});settled(page);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width>760:
    expect(page.locator('.reference-dock')).to_be_hidden();expect(page.locator('.workspace-sidebar')).to_be_visible();assert page.locator('.dock-glass-lens').count()==0
   else:expect(page.locator('.nav-add')).to_be_visible()
  assert not errors,errors;c.close();print('PASS',lang,'one drag/one route, lens isolation, scroll contraction/idle expansion, + and modals, keyboard, cancel, reduced motion, resize and desktop',flush=True)
 browser.close()
