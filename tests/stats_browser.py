"""Summary currencies stay whole; debit/credit indicators follow real balances."""
import json,subprocess
from playwright.sync_api import sync_playwright,expect
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {seed} from './model.js';console.log(JSON.stringify(seed()))"],text=True))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for language in ['es-ES','en-GB','ro-RO']:
  for currency in ['EUR','RON']:
   for balance,payer in [('is-owed','marta'),('is-credit','you'),('is-settled',None)]:
    state=json.loads(json.dumps(seed));g=state['groups'][0];state['activeGroup']=g['id'];g['currency']=currency
    g['expenses']=[dict(g['expenses'][0],amount=123456,payer=payer)] if payer else []
    c=b.new_context(locale=language,reduced_motion='reduce',viewport={'width':402,'height':874})
    c.add_init_script('localStorage.setItem("nexo-local-v1",'+json.dumps(json.dumps(state))+')')
    c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
    page=c.new_page();page.goto('http://127.0.0.1:3000/')
    page.locator('[data-action=demo]').click()
    expect(page.locator('.balance-stat')).to_have_class('stat-card balance-stat '+balance)
    if payer:
     colors=page.locator('.balance-stat').evaluate('el=>[getComputedStyle(el.querySelector("strong")).color,getComputedStyle(el.querySelector(".stat-icon")).color,getComputedStyle(el.querySelector("svg")).transform]')
     expected='rgb(193, 61, 81)' if balance=='is-owed' else 'rgb(57, 127, 101)'
     assert colors[:2]==[expected,expected],colors
     assert colors[2]==('matrix(0, 1, -1, 0, 0, 0)' if balance=='is-owed' else 'matrix(0, -1, 1, 0, 0, 0)'),colors
    for width in [320,375,390,402,440,768,1440]:
     page.set_viewport_size({'width':width,'height':874})
     for card in page.locator('.stat-card').all():
      assert card.evaluate('el=>el.scrollWidth<=el.clientWidth'),(language,currency,width)
     for code in page.locator('.stat-currency').all():
      assert code.evaluate('el=>{const r=document.createRange();r.selectNodeContents(el);return r.getClientRects().length===1;}'),(language,currency,width)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(language,currency,width)
    if language=='es-ES' and currency=='RON' and balance=='is-owed':
     page.set_viewport_size({'width':402,'height':874});page.screenshot(path='work/stats-ron-debt.png',full_page=True)
    c.close()
 b.close()
print('PASS: EUR/RON stay whole at 320–1440px in ES/EN/RO; debt is red/down, credit green/up and zero neutral')
