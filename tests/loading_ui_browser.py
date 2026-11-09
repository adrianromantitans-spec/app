"""Slow-network loading feedback with original local fixtures; no real users or writes."""
import importlib.util,json,os,re,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3063/app/')
OUT=Path(os.environ.get('LOADING_PREVIEW_OUT','work/loading-ui'));OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
REV='75753eedf31102a6b2cacf548a98b062dd861bcd'
def old(name):return subprocess.check_output(['git','show',REV+':'+name]).decode()
def wait_held(page,items,count=1):
 expect(page.locator('html')).to_be_visible()
 for _ in range(40):
  if len(items)>=count:return
  page.wait_for_timeout(25)
 raise AssertionError('Expected held fixture request')
def route(page,name):
 if page.locator('.reference-dock [data-route='+name+']').count():page.locator('.reference-dock [data-route='+name+']').click();return
 if page.locator('.back-to-home:visible').count():page.locator('.back-to-home').click()
 page.mouse.move(4,300);page.mouse.down();page.mouse.move(150,300,steps=10);page.mouse.up();expect(page.locator('.navigation-drawer')).to_be_visible();page.locator('.navigation-drawer #modal-title').click();page.locator('.navigation-drawer [data-route='+name+']').click()
intervals="window.__loadingIntervals=[];window.setInterval=(fn,ms)=>{window.__loadingIntervals.push({fn,ms});return 0}"
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 # Completed views remain identical to the actual previous application, not a mockup.
 images=[]
 for previous in [True,False]:
  c,_=shots.context(browser,'es');c.add_init_script(intervals)
  if previous:
   c.route('**/app.js?*',lambda r:r.fulfill(content_type='text/javascript',body=old('app.js')))
   c.route('**/notifications.js?*',lambda r:r.fulfill(content_type='text/javascript',body=old('notifications.js')))
  page=c.new_page();page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible();page.evaluate('document.fonts.ready');page.wait_for_timeout(220)
  images.append(page.screenshot());c.close()
 assert images[0]==images[1],'The completed home view changed'
 print('PASS completed home matches previous version pixel for pixel',flush=True)
 for lang in ['es','en','ro']:
  c,rows=shots.context(browser,lang);c.add_init_script(intervals);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible()
  held=[];page.route('**/rpc/divzplit_shopping_list',lambda r:held.append(r))
  page.locator('.home-reference-action[data-route=shopping]').click();expect(page.locator('.shopping-items .content-skeleton')).to_be_visible();wait_held(page,held)
  # Catalog copy is supplied by the original language engine; placeholders expose only one status.
  expect(page.locator('.shopping-items .content-skeleton')).to_have_attribute('role','status');expect(page.locator('.skeleton-shapes')).to_have_attribute('aria-hidden','true')
  assert page.locator('.shopping-items .content-skeleton').inner_text().strip()
  expect(page.locator('.shopping-row')).to_have_count(0)
  if lang=='es':page.screenshot(path=str(OUT/'shopping-skeleton.png'))
  held.pop().fallback();expect(page.locator('.shopping-row')).to_have_count(4);expect(page.locator('.shopping-items .content-skeleton')).to_have_count(0)
  # The checkout label/icon must stay white against the purple action, and still open the original form.
  checkout=page.locator('[data-shopping-action=checkout]');expect(checkout).to_be_enabled()
  assert checkout.evaluate('(el)=>getComputedStyle(el).color')=='rgb(255, 255, 255)'
  assert checkout.inner_text().strip() and checkout.locator('.icon').count()==1
  checkout.scroll_into_view_if_needed()
  if lang=='en':page.screenshot(path=str(OUT/'shopping-checkout.png'))
  checkout.click();expect(page.locator('#expense-form')).to_be_visible();expect(page.locator('.shopping-checkout-note')).to_be_visible();page.keyboard.press('Escape')
  # Refresh preserves existing rows instead of replacing them with a skeleton.
  page.locator('[data-shopping-action=refresh]').click();wait_held(page,held);expect(page.locator('.content-refresh')).to_be_visible();expect(page.locator('.shopping-row')).to_have_count(4);expect(page.locator('.content-skeleton')).to_have_count(0)
  held.pop().fallback();expect(page.locator('.content-refresh')).to_have_count(0)
  # Errors and original retry behavior remain visible and clear busy feedback.
  page.locator('[data-shopping-action=refresh]').click();wait_held(page,held);held.pop().fulfill(status=503,content_type='application/json',body='{"message":"Fixture request failed"}')
  expect(page.locator('.shopping-items [role=alert]')).not_to_be_empty();expect(page.locator('.content-refresh')).to_have_count(0);expect(page.locator('.content-skeleton')).to_have_count(0)
  page.locator('[data-shopping-action=refresh]').click();wait_held(page,held);held.pop().fallback();expect(page.locator('.shopping-row')).to_have_count(4)
  # A stale response from a previous group cannot overwrite the next screen.
  page.locator('[data-shopping-action=refresh]').click();wait_held(page,held);route(page,'groups');page.locator('.group-card').nth(1).click();expect(page.locator('.home-group-copy')).to_contain_text(shots.COPY[lang]['home']);page.wait_for_timeout(220);expect(page.locator('.content-refresh')).to_have_count(0);held.pop().fallback();expect(page.locator('.home-balance')).to_be_visible();expect(page.locator('.shopping-items')).to_have_count(0);expect(page.locator('.content-refresh')).to_have_count(0)
  # Background sync shows a small header indicator, never the old dark busy toast.
  reads=[];page.route('**/rest/v1/nexo_groups*',lambda r:reads.append(r));page.evaluate("()=>{window.__loadingIntervals.find(x=>x.ms===8000).fn()}")
  wait_held(page,reads);expect(page.locator('.content-refresh')).to_be_visible();expect(page.locator('.home-balance')).to_be_visible();page.locator('.reference-dock [data-route=activity]').click();expect(page.locator('.home-balance')).to_be_visible();expect(page.locator('#toast')).not_to_have_class(re.compile('visible'))
  if lang=='es':page.screenshot(path=str(OUT/'background-refresh.png'))
  reads.pop().fallback();expect(page.locator('.content-refresh')).to_have_count(0)
  page.unroute('**/rest/v1/nexo_groups*');route(page,'activity');expect(page.locator('.activity-panel')).to_have_count(3)
  # Cold per-group activity uses skeleton controls, then original panels and buttons.
  requests=[];page.route('**/rest/v1/divzplit_payment_requests*',lambda r:requests.append(r));route(page,'groups');page.locator('.group-card').nth(2).click();wait_held(page,requests);route(page,'activity');expect(page.locator('.activity-panel .content-skeleton')).to_have_count(3)
  if lang=='es':page.screenshot(path=str(OUT/'activity-skeleton.png'))
  for request in requests[:]:request.fallback()
  requests.clear();page.unroute('**/rest/v1/divzplit_payment_requests*');expect(page.locator('.activity-panel .content-skeleton')).to_have_count(0);expect(page.locator('[data-action=show-history]')).to_be_visible()
  # History and exchange dialogs show placeholders only while requests are pending.
  page.route('**/rest/v1/divzplit_payment_requests*',lambda r:requests.append(r));page.locator('[data-action=show-history]').click();expect(page.locator('.history-dialog .content-skeleton')).to_be_visible();wait_held(page,requests)
  requests.pop().fallback();page.unroute('**/rest/v1/divzplit_payment_requests*');expect(page.locator('.history-dialog .content-skeleton')).to_have_count(0);page.keyboard.press('Escape')
  # Exchange-rate and notification loads use the same real state and clear on success/error.
  route(page,'home');page.locator('[data-action=settlements]').click();expect(page.locator('.fx-disclosure')).to_be_visible()
  page.locator('.fx-disclosure>summary').click();quotes=[];page.route('**/functions/v1/exchange-rates*',lambda r:quotes.append(r));page.locator('[data-fx-target]').select_option('USD');expect(page.locator('.fx-panel .content-skeleton')).to_be_visible();wait_held(page,quotes)
  quotes.pop().fallback();expect(page.locator('.fx-detail')).to_be_visible();expect(page.locator('.fx-panel .content-skeleton')).to_have_count(0);page.keyboard.press('Escape')
  inbox=[];page.route('**/rpc/divzplit_notification_inbox',lambda r:inbox.append(r));page.locator('.notification-bell').click();expect(page.locator('.notification-dialog .content-skeleton')).to_be_visible();wait_held(page,inbox);inbox.pop().fallback();expect(page.locator('.notification-dialog .content-skeleton')).to_have_count(0);page.keyboard.press('Escape')
  page.locator('.notification-bell').click();wait_held(page,inbox);inbox.pop().fulfill(status=503,content_type='application/json',body='{"message":"Fixture notification failed"}');expect(page.locator('.notification-dialog [role=alert]')).not_to_be_empty();expect(page.locator('.notification-dialog .content-skeleton')).to_have_count(0);page.keyboard.press('Escape')
  assert not errors,errors;c.close();print('PASS',lang,'skeleton/read success, retained refresh data, error/retry, stale-response guards, background busy indicator and cold activity/history',flush=True)
 # Mutations use the existing RPC, validation, IDs and duplicate-submit guard.
 ns={};exec(Path('tests/planning_browser.py').read_text().split('with sync_playwright() as p:')[0].replace('http://127.0.0.1:3003/app/',BASE),ns)
 ns['group']['document']['currency']='EUR'
 class NoIntervals:
  def new_context(self,**kwargs):c=browser.new_context(**kwargs);c.add_init_script(intervals);return c
 c,page=ns['context'](NoIntervals(),ns['OWNER'],locale='es-ES');saves=[];page.route('**/rpc/nexo_save_group',lambda r:saves.append(r))
 def expense(title):
  page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-expense]').click();f=page.locator('#expense-form');f.locator('[name=amount]').fill('10');f.locator('[name=title]').fill(title);return f
 form=expense('Fixture save');entity=form.get_attribute('data-entity-id');button=form.locator('[type=submit]');button.click();wait_held(page,saves);expect(button).to_have_class(re.compile('is-loading'));expect(button).to_have_attribute('aria-busy','true');button.click();assert len(saves)==1
 payload=json.loads(saves[0].request.post_data);assert any(e['id']==entity for e in payload['p_document']['expenses'])
 page.screenshot(path=str(OUT/'saving.png'))
 saves.pop().fallback();expect(page.locator('#expense-form')).to_have_count(0);assert len(ns['group']['document']['expenses'])==2;expect(page.locator('#toast')).to_have_class(re.compile('success'))
 form=expense('Fixture retry');entity=form.get_attribute('data-entity-id');button=form.locator('[type=submit]');button.click();wait_held(page,saves);expect(button).to_have_class(re.compile('is-loading'));saves.pop().fulfill(status=500,content_type='application/json',body='{"message":"Fixture save failed"}')
 expect(form.locator('.form-error')).not_to_be_empty();expect(button).not_to_have_class(re.compile('is-loading|has-saved'));expect(button).to_be_enabled();assert form.get_attribute('data-entity-id')==entity;assert len(ns['group']['document']['expenses'])==2
 button.click();wait_held(page,saves);assert any(e['id']==entity for e in json.loads(saves[0].request.post_data)['p_document']['expenses']);saves.pop().fallback();expect(page.locator('#expense-form')).to_have_count(0);assert len(ns['group']['document']['expenses'])==3;assert len({e['id'] for e in ns['group']['document']['expenses']})==3
 assert not ns['errors'],ns['errors'];c.close();print('PASS original save RPC payloads, one submission, success, error recovery and same-ID retry with no duplicates',flush=True)
 browser.close()
