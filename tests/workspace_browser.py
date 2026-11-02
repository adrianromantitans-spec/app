"""Approved sidebar design, semantic balance states and navigation with local account fixtures."""
import os
from pathlib import Path
exec(Path('tests/personal_browser.py').read_text().split('from datetime import datetime')[0].replace('http://127.0.0.1:3003/',os.environ.get('NEXO_URL','http://127.0.0.1:3010/')))
group['document'].update({'type':'Convivencia','currency':'EUR','name':'Nuestro piso'})
group['document']['expenses'][0]['title']='Compra semanal'
requests.append({'id':str(uuid.uuid4()),'group_id':GID,'from_id':FRIEND,'to_id':OWNER,'amount':1850,'currency':'EUR','status':'pending'})
group['document']['expenses'].append(dict(group['document']['expenses'][0],id='second',title='Internet',amount=8500))
group_rows[:]=[group]
def route(page,name):
 page.locator('[data-action="workspace-menu"]').click();page.locator('.navigation-drawer [data-route="'+name+'"]').click();page.wait_for_timeout(100)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es-ES','en-GB','ro-RO']:
  c,page=context(b,OWNER,lang)
  expect(page.locator('.balance-stat')).to_have_attribute('data-balance-state','credit')
  expect(page.locator('.balance-status-sign')).to_have_text('+')
  assert page.locator('.home-recent .expense-row').count()==2
  assert page.locator('.home-shortcuts,.home-shopping-entry,.home-upcoming').count()==0
  assert page.locator('.stat-amount').evaluate('(e)=>getComputedStyle(e).color')=='rgb(255, 255, 255)'
  credit_color=page.locator('.balance-status').evaluate('(e)=>getComputedStyle(e).backgroundColor')
  gradient=page.locator('.balance-stat').evaluate('(e)=>getComputedStyle(e).backgroundImage')
  for width in [320,393,430,760]:
   page.set_viewport_size({'width':width,'height':852})
   menu=page.locator('[data-action="workspace-menu"]');menu.click()
   drawer=page.locator('.navigation-drawer');expect(drawer).to_be_visible()
   box=drawer.bounding_box();assert box['x']==0 and box['width']<=310
   assert page.locator('#app').evaluate('(e)=>e.inert')
   page.keyboard.press('Escape');expect(drawer).to_have_count(0)
   expect(menu).to_have_attribute('aria-expanded','false')
   for target in ['expenses','activity','tasks','polls','budget','groups','profile']:
    route(page,'expenses' if target=='activity' else target)
    if target=='activity':page.locator('.finance-sections [data-route="activity"]').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(lang,width,target)
    assert not page.locator('#app').evaluate('(e)=>e.inert')
   route(page,'home')
   button=page.locator('.mobile-quick-add .nav-add');expect(button).to_be_visible();assert button.bounding_box()['height']>=44
  page.set_viewport_size({'width':393,'height':852})
  if lang=='es-ES':
   page.screenshot(path='work/workspace-credit.png',full_page=False)
   page.locator('[data-action="workspace-menu"]').click();page.screenshot(path='work/workspace-drawer.png',full_page=False);page.keyboard.press('Escape')
  route(page,'shopping');expect(page.locator('.shopping-page')).to_be_visible();assert page.locator('.shopping-modal').count()==0
  page.locator('.back-to-home').click();expect(page.locator('.personal-home')).to_be_visible()
  page.locator('.mobile-quick-add .nav-add').click();page.locator('.quick-add-modal [data-action="new-expense"]').click();expect(page.locator('#expense-form [name="payer"]')).to_have_value('you');page.keyboard.press('Escape')
  page.locator('.home-group-picker').click();expect(page.locator('[data-group-mode="travel"]')).to_be_visible();page.keyboard.press('Escape')
  if lang=='es-ES':
   page.locator('.home-attention').click();page.locator('[data-payment-response="confirm"]').click();page.locator('[data-resolve-payment="confirm"]').click()
   page.locator('[data-action="close-modal"]').first.click();expect(page.locator('.stat-number')).to_contain_text('74,00')
  page.set_viewport_size({'width':1280,'height':900});expect(page.locator('.workspace-sidebar')).to_be_visible();expect(page.locator('.mobile-menu-trigger')).not_to_be_visible()
  if lang=='es-ES':page.screenshot(path='work/workspace-desktop.png',full_page=False)
  c.close()
  c,page=context(b,FRIEND,lang)
  expect(page.locator('.balance-stat')).to_have_attribute('data-balance-state','debt');expect(page.locator('.balance-status-sign')).to_have_text('−')
  assert page.locator('.balance-status').evaluate('(e)=>getComputedStyle(e).backgroundColor')!=credit_color
  assert page.locator('.balance-stat').evaluate('(e)=>getComputedStyle(e).backgroundImage')==gradient
  if lang=='es-ES':page.screenshot(path='work/workspace-debt.png',full_page=False)
  c.close()
 group['document']['expenses']=[];group['document']['payments']=[]
 c,page=context(b,OWNER);expect(page.locator('.balance-stat')).to_have_attribute('data-balance-state','settled');expect(page.locator('.balance-status-sign')).to_have_text('✓');expect(page.locator('.stat-number')).to_contain_text('0,00');c.close()
 assert saves==[] and not errors,(saves,errors)
 b.close()
print('PASS: purple balance with distinct credit/debt/zero labels and signs, drawer destinations, full shopping page, focus/dismissal, safe widths, unchanged ledger and ES/EN/RO')
