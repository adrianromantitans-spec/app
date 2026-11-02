"""A compact glass add button replaces the bottom bar and yields to the drawer."""
import os
from pathlib import Path
exec(Path('tests/personal_browser.py').read_text().split('from datetime import datetime')[0])
group['document'].update({'type':'Convivencia','currency':'EUR','name':'Nuestro piso'});group_rows[:]=[group]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for language in ['es-ES','en-GB','ro-RO']:
  c,page=context(b,OWNER,language);fab=page.locator('.mobile-quick-add .nav-add')
  for width in [320,393,430,760,1280]:
   page.set_viewport_size({'width':width,'height':852});expect(fab).to_be_visible()
   assert page.locator('.mobile-nav,.floating-expense-action').count()==0
   box=fab.bounding_box();assert box['width']==60 and box['height']==60 and box['x']>=width-90 and box['y']+box['height']<=830
   if width<=760:
    for method in ['escape','button','backdrop','route','group']:
     page.locator('[data-action="workspace-menu"]').click();expect(fab).to_be_hidden()
     assert page.locator('#app').evaluate('(e)=>e.inert')
     if method=='escape':page.keyboard.press('Escape')
     elif method=='button':page.locator('.navigation-drawer [data-action="close-modal"]').click()
     elif method=='backdrop':page.locator('.navigation-overlay').click(position={'x':width-12,'y':100})
     elif method=='route':page.locator('.navigation-drawer [data-route="tasks"]').click()
     else:
      page.locator('.navigation-drawer [data-action="choose-group"]').click();expect(fab).to_be_visible();page.keyboard.press('Escape')
     expect(fab).to_be_visible()
   fab.click();expect(page.locator('.quick-add-modal')).to_be_visible();expect(fab).to_have_attribute('aria-expanded','true')
   page.locator('.quick-add-modal [data-action="new-expense"]').click();expect(page.locator('#expense-form')).to_be_visible()
   expect(page.locator('#expense-form [name="payer"]')).to_have_value('you')
   page.keyboard.press('Escape');expect(fab).to_have_attribute('aria-expanded','false')
   assert not page.locator('body').evaluate('(e)=>e.classList.contains("workspace-menu-open")')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':393,'height':852})
  page.locator('[data-action="workspace-menu"]').click();page.locator('.navigation-drawer [data-route="home"]').click();page.wait_for_timeout(120)
  if language=='es-ES':page.screenshot(path='work/floating-glass-add.png',full_page=False)
  c.close()
 assert not errors,errors
 b.close()
print('PASS: compact glass add button, no bottom bar, drawer hide/restore, quick actions, default payer, mobile/desktop and ES/EN/RO')
