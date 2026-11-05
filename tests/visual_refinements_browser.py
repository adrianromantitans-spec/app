"""Real UI with local fixtures: group switch, recent rows, polls, shopping and mobile engines."""
import importlib.util,os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=shots.BASE
with sync_playwright() as p:
 for engine in ['chromium']+(['webkit'] if os.environ.get('DIVZPLIT_TEST_WEBKIT')=='1' else []):
  browser=getattr(p,engine).launch(**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if engine=='chromium' else ({'executable_path':os.environ['DIVZPLIT_WEBKIT_EXECUTABLE']} if os.environ.get('DIVZPLIT_WEBKIT_EXECUTABLE') else {})))
  c,rows=shots.context(browser,'es');errors=[];page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def click(locator):locator.click()
  def escape():page.keyboard.press('Escape')
  shopping=[{'id':f'dddddddd-dddd-4ddd-8ddd-ddddddddddd{j}','title':title,'quantity':'1','bought':j==3,'created_by':shots.OWNER,'expense_id':None,'version':1} for j,title in enumerate(shots.DEMO_TEXT['es']['shopping'])]
  writes=[]
  c.route('**/rest/v1/rpc/divzplit_shopping_list',lambda route:route.fulfill(content_type='application/json',body=json.dumps(shopping)))
  def shopping_action(route):
   data=json.loads(route.request.post_data);assert data['p_action']=='check';writes.append('shopping')
   item=next(i for i in shopping if i['id']==data['p_item']['id']);item['bought']=data['p_item']['bought'];item['version']+=1
   route.fulfill(content_type='application/json',body=json.dumps(shopping))
  c.route('**/rest/v1/rpc/divzplit_shopping_action',shopping_action)
  def save_group(route):
   data=json.loads(route.request.post_data);row=next(r for r in rows if r['id']==data['p_id']);row['document']=data['p_document'];row['version']+=1;writes.append('vote')
   route.fulfill(content_type='application/json',body=json.dumps(row))
  c.route('**/rest/v1/rpc/nexo_save_group',save_group)
  # Unsorted dates, including a future-entered old expense: chronological order wins.
  for item,date in zip(rows[0]['document']['expenses'],['2026-10-01','2026-11-04','2026-11-02','2026-11-05','2026-11-03']):item['date']=date
  page.goto(BASE);expect(page.locator('.home-recent .expense-row')).to_have_count(4)
  assert page.locator('.home-recent .expense-description strong').all_text_contents()==[shots.COPY['es'][key] for key in ['breakfast','tram','museum','stay']]
  assert page.locator('.topbar .brand-logo,.workspace-sidebar .brand-logo,.brand-intro-curtain').count()==0
  for width in [320,375,393,430,768,1440]:
   page.set_viewport_size({'width':width,'height':852})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(engine,width)
   click(page.locator('.home-group-picker'));expect(page.locator('.home-group-option')).to_have_count(3);assert page.locator('.home-modes,[data-group-mode]').count()==0
   escape();expect(page.locator('.modal-overlay')).to_have_count(0)
  page.set_viewport_size({'width':393,'height':852})
  click(page.locator('.home-group-picker'));click(page.locator('.home-group-option[data-group="'+rows[1]['id']+'"]'))
  expect(page.locator('.home-recent .expense-row')).to_have_count(2);expect(page.locator('.home-recent')).to_contain_text(shots.COPY['es']['rent']);assert shots.COPY['es']['breakfast'] not in page.locator('.home-recent').inner_text()
  click(page.locator('.home-recent [data-route=expenses]'));expect(page.locator('.expense-list')).to_be_visible()
  def navigate(route):
   if page.locator('.back-to-home:visible').count():click(page.locator('.back-to-home'))
   click(page.locator('[data-action=workspace-menu]'));click(page.locator('.navigation-drawer [data-route='+route+']'))
  navigate('shopping');expect(page.locator('.shopping-row')).to_have_count(4)
  page.locator('[data-shopping-check]').first.check();expect(page.locator('.shopping-bought .shopping-row')).to_have_count(2)
  assert writes==['shopping']
  click(page.locator('[data-shopping-action=add]'));expect(page.locator('#shopping-item-form')).to_be_visible();escape()
  navigate('polls');click(page.locator('[data-show-planning=polls]'));expect(page.locator('.poll-option')).to_have_count(3);expect(page.locator('.poll-option.chosen')).to_have_attribute('data-option','0');click(page.locator('.poll-option[data-option="2"]'));expect(page.locator('.poll-option.chosen')).to_have_attribute('data-option','2');assert writes==['shopping','vote'];assert rows[1]['document']['polls'][0]['votes'][shots.OWNER]=='2';escape()
  navigate('tasks');click(page.locator('[data-show-planning=tasks]'));expect(page.locator('.task-row')).to_have_count(3)
  assert not errors,errors
  c.close()
  browser.close();print('PASS',engine,'four ordered real recent rows, group isolation, clean selector, text header, expenses, shopping, polls and tasks at phone/tablet/desktop widths.',flush=True)
