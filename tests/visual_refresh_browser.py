"""Real app appearance and unchanged routes; local fictional transport only."""
import importlib.util,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=shots.BASE
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  context,rows=shots.context(browser,lang);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible()
  for width in [320,393,430,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(lang,width)
   expect(page.locator('.home-recent .expense-row')).to_have_count(4)
   colors=page.locator('.home-balance').evaluate('(e)=>({background:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).color})')
   assert 'linear-gradient' in colors['background'] and colors['color']=='rgb(255, 255, 255)',colors
   expect(page.locator('.home-greeting')).to_have_count(0)
   expect(page.locator('.home-recent .category-emoji').first).to_be_visible()
   expect(page.locator('.home-recent .reference-category')).to_have_count(0)
   assert page.locator('.balance-status').evaluate('(e)=>getComputedStyle(e).color')=='rgb(18, 85, 60)'
   if width<=760:
    expect(page.locator('.mobile-menu-trigger[data-action=workspace-menu]')).to_be_hidden()
    dock=page.locator('.reference-dock').bounding_box();add=page.locator('.nav-add').bounding_box()
    assert abs(add['x']+add['width']/2-width/2)<1
    assert dock['y']<=add['y'] and add['y']+add['height']<=dock['y']+dock['height']
    assert page.locator('.reference-dock').evaluate('(e)=>getComputedStyle(e).backdropFilter')!='none'
    for route in ['home','groups','activity','profile']:expect(page.locator('.reference-dock button[data-route='+route+']')).to_be_visible()
    expect(page.locator('.reference-dock button')).to_have_count(4)
    expect(page.locator('.home-reference-action')).to_have_count(3)
   page.locator('[data-action=choose-group]:visible').first.click();expect(page.locator('.home-group-option')).to_have_count(3);page.keyboard.press('Escape')
  page.set_viewport_size({'width':393,'height':852})
  expect(page.locator('.home-reference-action[data-action=new-expense]')).to_have_count(0)
  page.locator('.home-reference-action[data-route=tasks]').click();expect(page.locator('.task-row')).to_have_count(3)
  page.locator('.reference-dock button[data-route=home]').click()
  page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-expense]').click();expect(page.locator('#expense-form')).to_be_visible();page.keyboard.press('Escape')
  page.locator('.home-reference-action[data-route=shopping]').click();expect(page.locator('.shopping-row')).to_have_count(4)
  page.locator('.reference-dock button[data-route=home]').click()
  page.locator('.home-reference-action[data-route=polls]').click();expect(page.locator('.poll-card')).to_have_count(1)
  page.locator('.reference-dock button[data-route=activity]').click();expect(page.locator('.activity-panel').first).to_be_visible()
  page.locator('.reference-dock button[data-route=groups]').click();expect(page.locator('.group-card')).to_have_count(3)
  page.locator('.reference-dock button[data-route=profile]').click();expect(page.locator('.account-page')).to_be_visible()
  for action in ['language-settings','privacy-export-full','delete-account']:expect(page.locator('.account-page [data-action='+action+']')).to_be_visible()
  expect(page.locator('.account-page a[href="mailto:support@divzplit.com"]')).to_be_visible()
  page.locator('[data-action=language-settings]').click();expect(page.locator('.language-option')).to_have_count(4);page.keyboard.press('Escape')
  if lang=='es':page.screenshot(path='/workspace/preview/visual-87/account.png',full_page=True)
  page.locator('.reference-dock button[data-route=home]').click();expect(page.locator('.home-balance')).to_be_visible()
  for route in ['tasks','polls','shopping','budget']:
   if page.locator('.back-to-home:visible').count():page.locator('.back-to-home').click()
   page.locator('.reference-dock [data-route=home]').click()
   if route in ['tasks','polls','shopping']:page.locator('.home-reference-action[data-route='+route+']').click()
   else:
    page.set_viewport_size({'width':1024,'height':852});page.locator('.workspace-sidebar [data-route='+route+']').click();page.set_viewport_size({'width':393,'height':852})
   if route in ['tasks','polls']:
    expect(page.locator('.poll-card' if route=='polls' else '.task-row')).to_have_count(1 if route=='polls' else 3)
   elif route=='shopping':expect(page.locator('.shopping-row')).to_have_count(4)
   else:expect(page.locator('.budget-card')).to_be_visible()
  # Make only the local fixture owe money; business logic must still derive the state.
  for expense in rows[0]['document']['expenses']:expense['payer']=shots.MEMBERS[1]['id']
  page.reload();expect(page.locator('.home-balance')).to_have_attribute('data-balance-state','debt')
  assert page.locator('.balance-status').evaluate('(e)=>getComputedStyle(e).color')=='rgb(162, 33, 60)'
  assert page.locator('.balance-status-sign').evaluate("(e)=>getComputedStyle(e,'::after').content").strip('"')=='↓'
  if lang=='es':page.screenshot(path='/workspace/preview/visual-87/debt.png')
  assert not errors,errors
  context.close();print('PASS',lang,'purple balance, four recent rows, six widths, existing dock controls, full menu, language/export/delete/contact and planning/shopping/budget routes.',flush=True)
 browser.close()
