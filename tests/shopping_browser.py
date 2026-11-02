"""Shopping UI with two accounts and real PostgreSQL shopping/checkout RPCs."""
from pathlib import Path
import subprocess
import os
prefix=Path('tests/personal_browser.py').read_text().split('from datetime import datetime')[0].replace('http://127.0.0.1:3003/',os.environ.get('NEXO_URL','http://127.0.0.1:3007/'))
prefix=prefix.replace("  elif path.endswith('/nexo_save_group'):",'''  elif path.endswith('/divzplit_shopping_list'):fulfill(route,dbcall('divzplit_shopping_list',[q(data['p_id'])],actor))
  elif path.endswith('/divzplit_shopping_action'):
   result=dbcall('divzplit_shopping_action',[q(data['p_id']),q(data['p_action']),q(json.dumps(data['p_item']))+'::jsonb'],actor);fulfill(route,result)
  elif path.endswith('/divzplit_shopping_checkout'):
   result=dbcall('divzplit_shopping_checkout',[q(data['p_id']),str(data['p_version']),q(json.dumps(data['p_document']))+'::jsonb',q(data['p_expense_id']),'array['+','.join(q(i) for i in data['p_items'])+']::uuid[]'],actor)
   if 'document' in result:group.update(result)
   fulfill(route,result)
  elif path.endswith('/nexo_save_group'):''')
exec(prefix)
def q(v):return "'"+str(v).replace("'","''")+"'"
def dbcall(name,args,actor):
 r=subprocess.run(['docker','--host=unix:///var/run/docker.sock','exec','-i','nexo-postgres-tests','psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAq'],input='set role authenticated;set request.jwt.claim.sub='+q(actor)+';select public.'+name+'('+','.join(args)+');',capture_output=True,text=True)
 assert r.returncode==0,r.stderr
 return json.loads(r.stdout)
group=dbcall('nexo_create_group',[q(json.dumps({'name':'Nuestro piso','type':'Convivencia','emoji':'🏠','place':'','date':'','endDate':'','currency':'EUR','budget':0,'requestId':str(uuid.uuid4())}))+'::jsonb'],OWNER);GID=group['id']
invite=dbcall('nexo_create_invite',[q(GID)],OWNER);group=dbcall('nexo_join_group',[q(invite['token'])],FRIEND);group_rows[:]=[group]
def shopping(page):
 if page.locator('.shopping-page').count():return
 page.locator('[data-action="workspace-menu"]').click();page.locator('.navigation-drawer [data-route="shopping"]').click()
def home(page):
 if page.locator('.back-to-home:visible').count():
  page.locator('.back-to-home').click();page.wait_for_timeout(100);return
 if page.locator('.workspace-sidebar:visible').count():
  page.locator('.workspace-sidebar [data-route="home"]').click();page.wait_for_timeout(100);return
 page.locator('[data-action="workspace-menu"]').click();page.locator('.navigation-drawer [data-route="home"]').click();page.wait_for_timeout(100)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 co,owner=context(b,OWNER);cf,friend=context(b,FRIEND)
 shopping(owner);expect(owner.locator('.shopping-empty')).to_be_visible()
 expect(owner.locator('[data-shopping-action="checkout"]')).to_be_disabled()
 for title,quantity in [('Leche <b>entera</b>','2 litros'),('Pan','1 barra')]:
  owner.locator('[data-shopping-action="add"]').click();f=owner.locator('#shopping-item-form');f.locator('[name="title"]').fill(title);f.locator('[name="quantity"]').fill(quantity);f.locator('[type="submit"]').click()
  expect(owner.locator('.shopping-row')).to_have_count(1 if title.startswith('Leche') else 2)
 assert owner.locator('.shopping-product b').count()==0
 owner.locator('[data-shopping-action="edit"]').first.click();owner.locator('#shopping-item-form [name="title"]').fill('Leche entera');owner.locator('#shopping-item-form [type="submit"]').click();expect(owner.locator('.shopping-product').first).to_contain_text('Leche entera')
 before=json.loads(json.dumps(group['document']))
 shopping(friend);expect(friend.locator('.shopping-row')).to_have_count(2)
 assert friend.locator('[data-shopping-action="edit"]').count()==0
 friend.locator('[data-shopping-check]').first.check();expect(friend.locator('.shopping-bought .shopping-row')).to_have_count(1)
 assert group['document']==before
 # Another device sees the check, and cancelling checkout creates no expense.
 owner.locator('[data-shopping-action="refresh"]').click();expect(owner.locator('.shopping-bought .shopping-row')).to_have_count(1)
 owner.locator('[data-shopping-action="checkout"]').click();expect(owner.locator('#expense-form [name="amount"]')).to_have_value('')
 owner.keyboard.press('Escape');assert group['document']==before
 shopping(owner);owner.locator('[data-shopping-action="checkout"]').click()
 expect(owner.locator('#expense-form [name="payer"]')).to_have_value('you')
 owner.locator('#expense-form [name="amount"]').fill('10.01');owner.locator('#expense-form [type="submit"]').click();expect(owner.locator('#expense-form')).to_have_count(0)
 assert len(group['document']['expenses'])==1 and group['document']['expenses'][0]['amount']==1001
 home(owner)
 expect(owner.locator('.balance-stat .stat-number')).to_contain_text('5,00')
 shopping(owner);expect(owner.locator('.shopping-product [data-shopping-action="expense"]')).to_have_count(1)
 expect(owner.locator('[data-shopping-action="checkout"]')).to_be_disabled()
 owner.locator('[data-shopping-action="expense"]').click();expect(owner.locator('#modal-title')).to_contain_text('Leche')
 owner.keyboard.press('Escape');shopping(owner)
 for width in [320,393,430,768]:
  owner.set_viewport_size({'width':width,'height':852});assert owner.evaluate('document.documentElement.scrollWidth<=innerWidth')
 owner.set_viewport_size({'width':393,'height':852});owner.wait_for_timeout(4600);owner.evaluate('document.activeElement.blur()');owner.screenshot(path='work/shopping-list.png',full_page=True)
 owner.locator('[data-shopping-action="clear"]').click();owner.locator('[data-shopping-action="confirm"]').click();expect(owner.locator('.shopping-row')).to_have_count(1)
 assert len(group['document']['expenses'])==1
 home(owner);owner.wait_for_timeout(4600);owner.evaluate('document.activeElement.blur()');owner.screenshot(path='work/shopping-home.png',full_page=True)
 for lang,expected in [('en-GB','Shopping list'),('ro-RO','Lista de cumpărături')]:
  c,page=context(b,OWNER,lang);shopping(page);expect(page.locator('.shopping-page h1')).to_have_text(expected);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');c.close()
 # Before the SQL update, only this optional section is gated.
 c,page=context(b,OWNER)
 c.route('**/rest/v1/rpc/divzplit_shopping_list',lambda r:r.fulfill(status=404,content_type='application/json',body='{"code":"PGRST202"}'))
 shopping(page);expect(page.locator('.shopping-items [role="alert"]')).to_contain_text('no está activada')
 expect(page.locator('[data-shopping-action="add"]')).to_be_disabled()
 page.locator('.back-to-home').click();page.locator('.mobile-nav .nav-add').click();page.locator('.quick-add-modal [data-action="new-expense"]').click();expect(page.locator('#expense-form')).to_be_visible();c.close()
 assert not errors,errors
 co.close();cf.close();b.close()
print('PASS: two-account shopping, quantities, safe titles, shared checks, cancellation, exact-cent atomic checkout, linked expense, clearing preserves ledger, ES/EN/RO and mobile/tablet')
