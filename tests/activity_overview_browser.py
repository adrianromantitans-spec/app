"""Activity dashboard: real ledger fixtures, audit history, payment actions and local APIs only."""
import importlib.util,json,os,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3068/app/')
OUT=Path('work/activity-overview');OUT.mkdir(parents=True,exist_ok=True)
def fulfill(route,value,status=200):route.fulfill(content_type='application/json',status=status,body=json.dumps(value))
def open_activity(page):
 page.locator('.reference-dock [data-route=activity]').click()
 expect(page.locator('.activity-overview')).to_be_visible();expect(page.locator('[data-action=show-history]')).to_be_visible()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in filter(None,os.environ.get('ACTIVITY_TEST_LOCALES','es,en,ro').split(',')):
  c,rows=shots.context(b,lang);events=[];pending=[];errors=[]
  c.route('**/rest/v1/divzplit_history*',lambda r:fulfill(r,events if rows[0]['id'] in r.request.url else []))
  c.route('**/rest/v1/divzplit_payment_requests*',lambda r:fulfill(r,pending if rows[0]['id'] in r.request.url else []))
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible();open_activity(page)
  assert page.locator('.concept-stat').nth(0).locator('strong').inner_text().replace('\u00a0',' ').strip() in {'478,00 €','€ 478.00','478,00 EUR'},page.locator('.concept-stat').nth(0).inner_text()
  amount_font=page.locator('.concept-stat').nth(0).locator('.stat-number').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)');assert amount_font>=16
  expect(page.locator('.concept-event')).to_have_count(5)
  expect(page.locator('.concept-stat').nth(2).locator('strong')).to_have_text('0')
  expect(page.locator('.concept-ok')).not_to_have_class(__import__('re').compile('is-pending'))
  page.locator('[data-activity-mode=people]').click();expect(page.locator('[data-activity-mode=people]')).to_have_attribute('aria-pressed','true')
  own=page.locator('[data-activity-segment=you]');own.click();expect(own).to_have_attribute('aria-pressed','true');assert '280' in page.locator('.concept-ring-center strong').inner_text()
  # A background refresh must retain the chosen chart mode and selected contributor.
  page.wait_for_timeout(8300);expect(page.locator('[data-activity-mode=people]')).to_have_attribute('aria-pressed','true');expect(page.locator('[data-activity-segment=you]')).to_have_attribute('aria-pressed','true')
  page.locator('[data-activity-segment=you]').click();assert '478' in page.locator('.concept-ring-center strong').inner_text()
  page.locator('[data-activity-mode=categories]').click()
  for width in [320,393,432,760,1280]:
   page.set_viewport_size({'width':width,'height':936});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(lang,width)
  page.set_viewport_size({'width':393,'height':852});page.evaluate('scrollTo(0,0)');page.screenshot(path=str(OUT/(lang+'-activity.png')),full_page=True)
  # Existing payment/history actions remain available and lead to their existing dialogs.
  page.locator('[data-action=show-history]').click();expect(page.locator('.history-dialog')).to_be_visible();page.keyboard.press('Escape')
  page.locator('[data-action=show-recorded-payments]').click();expect(page.locator('.payment-list-dialog[data-kind=recorded]')).to_be_visible();page.keyboard.press('Escape')
  pending.append({'id':str(uuid.uuid4()),'group_id':rows[0]['id'],'from_id':shots.MEMBERS[1]['id'],'to_id':shots.OWNER,'amount':3350,'currency':'EUR','status':'pending','created_at':'2026-11-05T12:00:00Z'})
  events.extend([{'id':str(uuid.uuid4()),'kind':'expenses.added','actor_name':'Nora','created_at':'2026-11-05T13:00:00Z','currency':'EUR','after_data':{'title':'Dinner <b>group</b>','amount':8600,'payer':shots.MEMBERS[1]['id']},'before_data':None}])
  page.reload();expect(page.locator('.home-balance')).to_be_visible();open_activity(page)
  expect(page.locator('.concept-stat').nth(2).locator('strong')).to_have_text('1');expect(page.locator('.concept-ok')).to_have_class(__import__('re').compile('is-pending'))
  expect(page.locator('.concept-event')).to_have_count(1);assert 'Dinner <b>group</b>' in page.locator('.concept-event').inner_text();assert page.locator('.concept-event b').count()==0
  page.locator('.concept-ok').click();expect(page.locator('[data-payment-response=confirm]')).to_be_visible();expect(page.locator('[data-payment-response=reject]')).to_be_visible();page.keyboard.press('Escape')
  # Change to a different group's ledger; no amounts, pending counts or segment selection leak.
  page.locator('[data-activity-mode=people]').click();page.locator('[data-activity-segment=you]').click();page.locator('[data-group-select]').select_option(rows[1]['id'])
  expect(page.locator('.concept-ring-center strong')).to_contain_text('978');expect(page.locator('.concept-stat').nth(2).locator('strong')).to_have_text('0');assert page.locator('[data-activity-segment][aria-pressed=true]').count()==0
  # Empty ledgers and zero-decimal currency remain valid, with an accessible empty graph.
  rows[1]['document'].update({'expenses':[],'currency':'ISK'});page.reload();expect(page.locator('.home-balance')).to_be_visible();open_activity(page)
  expect(page.locator('.concept-event')).to_have_count(0);assert page.locator('.concept-ring').evaluate('(e)=>!getComputedStyle(e).backgroundImage.includes("NaN")')
  assert '0' in page.locator('.concept-stat').nth(0).inner_text();assert 'ISK' in page.locator('.concept-stat').nth(0).inner_text() or 'kr' in page.locator('.concept-stat').nth(0).inner_text()
  assert not errors,errors;c.close();print('PASS',lang,'real totals and shares, chart controls, refresh persistence, actual audit timeline, pending and payment/history dialogs, group isolation, empty ISK ledger, mobile/desktop widths',flush=True)
 # Loading and failed requests must not claim that there are no pending payments.
 c,rows=shots.context(b,'es');held=[];page=c.new_page();page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible();c.route('**/rest/v1/divzplit_payment_requests*',lambda r:held.append(r));page.locator('.reference-dock [data-route=groups]').click();page.locator('.group-card').nth(2).click();expect(page.locator('.home-balance')).to_be_visible();page.locator('.reference-dock [data-route=activity]').click();expect(page.locator('.concept-stat').nth(2).locator('strong')).to_have_text('—');expect(page.locator('.concept-ok')).to_have_count(0);expect(page.locator('.activity-panel .content-skeleton')).to_have_count(3)
 c.unroute('**/rest/v1/divzplit_payment_requests*')
 for route in held:fulfill(route,{'message':'Fixture unavailable'},503)
 expect(page.locator('.activity-error').first).to_be_visible();expect(page.locator('.concept-stat').nth(2).locator('strong')).to_have_text('—');expect(page.locator('.concept-ok')).to_have_count(0);c.close();b.close();print('PASS unknown and failed loading retain truthful pending state')
