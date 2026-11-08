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
   if width<=760:
    for route in ['home','groups','activity','profile']:expect(page.locator('.reference-dock button[data-route='+route+']')).to_be_visible()
    expect(page.locator('.reference-dock button')).to_have_count(4)
    expect(page.locator('.home-reference-action')).to_have_count(3)
   page.locator('[data-action=choose-group]:visible').first.click();expect(page.locator('.home-group-option')).to_have_count(3);page.keyboard.press('Escape')
  page.set_viewport_size({'width':393,'height':852})
  page.locator('.home-reference-action[data-action=new-expense]').click();expect(page.locator('#expense-form')).to_be_visible();page.keyboard.press('Escape')
  page.locator('.home-reference-action[data-route=shopping]').click();expect(page.locator('.shopping-row')).to_have_count(4)
  page.locator('.reference-dock button[data-route=home]').click()
  page.locator('.home-reference-action[data-route=polls]').click();expect(page.locator('.poll-card')).to_have_count(1)
  page.locator('.reference-dock button[data-route=activity]').click();expect(page.locator('.activity-panel').first).to_be_visible()
  page.locator('.reference-dock button[data-route=groups]').click();expect(page.locator('.group-card')).to_have_count(3)
  page.locator('.reference-dock button[data-route=profile]').click();expect(page.locator('.account-page')).to_be_visible()
  for action in ['language-settings','privacy-export-full','delete-account']:expect(page.locator('.account-page [data-action='+action+']')).to_be_visible()
  expect(page.locator('.account-page a[href="mailto:support@divzplit.com"]')).to_be_visible()
  page.locator('[data-action=language-settings]').click();expect(page.locator('.language-option')).to_have_count(4);page.keyboard.press('Escape')
  if lang=='es':page.screenshot(path='/workspace/preview/visual-86/account.png',full_page=True)
  page.locator('.reference-dock button[data-route=home]').click();expect(page.locator('.home-balance')).to_be_visible()
  for route in ['tasks','polls','shopping','budget']:
   if page.locator('.back-to-home:visible').count():page.locator('.back-to-home').click()
   page.locator('[data-action=workspace-menu]').click()
   expect(page.locator('.navigation-drawer [data-route='+route+']')).to_be_visible()
   page.locator('.navigation-drawer [data-route='+route+']').click()
   if route in ['tasks','polls']:
    expect(page.locator('.poll-card' if route=='polls' else '.task-row')).to_have_count(1 if route=='polls' else 3)
   elif route=='shopping':expect(page.locator('.shopping-row')).to_have_count(4)
   else:expect(page.locator('.budget-card')).to_be_visible()
  assert not errors,errors
  context.close();print('PASS',lang,'purple balance, four recent rows, six widths, existing dock controls, full menu, language/export/delete/contact and planning/shopping/budget routes.',flush=True)
 browser.close()
