"""Eight real group members: simplify, reserve a sent payment, then confirm it."""
import os,subprocess
from pathlib import Path
prefix=Path('tests/personal_browser.py').read_text().split('from datetime import datetime')[0]
a=prefix.index("  elif path.endswith('/divzplit_request_payment'):");b=prefix.index("  elif path.endswith('/divzplit_clear_history'):",a)
prefix=prefix[:a]+'''  elif path.endswith('/divzplit_request_payment'):
   result=dbcall('divzplit_request_payment',[q(data['p_id']),str(data['p_version']),q(data['p_request_id']),q(data['p_to']),str(data['p_amount']),q(data['p_currency'])],actor)
   requests.append(result);fulfill(route,result)
  elif path.endswith('/divzplit_respond_payment'):
   result=dbcall('divzplit_respond_payment',[q(data['p_id']),q(data['p_request_id']),q(data['p_action'])],actor);group.update(result)
   next(r for r in requests if r['id']==data['p_request_id'])['status']='confirmed';fulfill(route,result)
'''+prefix[b:]
exec(prefix)
def q(v):return "'"+str(v).replace("'","''")+"'"
def sql(text,actor=None):
 lead='set role authenticated;set request.jwt.claim.sub='+q(actor)+';' if actor else ''
 r=subprocess.run(['docker','--host=unix:///var/run/docker.sock','exec','-i','nexo-postgres-tests','psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAq'],input=lead+text,text=True,capture_output=True)
 assert r.returncode==0,r.stderr
 return r.stdout.strip()
def dbcall(name,args,actor):return json.loads(sql('select public.'+name+'('+','.join(args)+');',actor))
ids=[str(uuid.uuid4()) for _ in range(8)];OWNER=ids[0];FRIEND=ids[1]
for i,actor in enumerate(ids):sql('insert into auth.users values ('+q(actor)+','+q(json.dumps({'display_name':['Ana','Luis','Carla','Pablo','Marta','Dani','Sara','Vivien'][i]}))+'::jsonb)')
group=dbcall('nexo_create_group',[q(json.dumps({'name':'Los ocho','type':'Convivencia','emoji':'🏠','currency':'RON','requestId':str(uuid.uuid4())}))+'::jsonb'],OWNER);GID=group['id']
for actor in ids[1:]:
 invite=dbcall('nexo_create_invite',[q(GID)],OWNER);group=dbcall('nexo_join_group',[q(invite['token'])],actor)
values=[-800,-700,-500,-400,400,500,700,800];debt=[max(0,-v) for v in values];credit=[max(0,v) for v in values]
for d in range(8):
 for c in range(8):
  amount=min(debt[d],credit[c])
  if amount:group['document']['expenses'].append({'id':str(uuid.uuid4()),'title':'Gasto del grupo','amount':amount,'payer':ids[c],'participants':[ids[d]],'category':'Otros','date':'2026-11-02','createdBy':OWNER});debt[d]-=amount;credit[c]-=amount
group=dbcall('nexo_save_group',[q(GID),str(group['version']),q(json.dumps(group['document']))+'::jsonb'],OWNER);group_rows[:]=[group]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,page=context(b,OWNER);original=copy.deepcopy(group)
 page.locator('[data-action="settlements"]').click();expect(page.locator('.settlement-list .settlement-row')).to_have_count(4)
 expect(page.locator('.settlement-summary')).to_contain_text('De 7 a 4 transferencias')
 toggle=page.locator('[data-action="toggle-simplify"]');expect(toggle).to_have_attribute('aria-pressed','true')
 toggle.click();expect(page.locator('.settlement-list .settlement-row')).to_have_count(7)
 toggle.click();expect(page.locator('.settlement-list .settlement-row')).to_have_count(4)
 assert group==original and not saves
 for width in [320,393,430,768]:
  page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':393,'height':852});page.locator('.modal').evaluate('(e)=>e.scrollTop=0');page.screenshot(path='work/simplified-eight-members.png',full_page=False)
 expect(page.locator('[data-settle]')).to_have_count(1)
 page.locator('[data-settle]').click();page.locator('[data-confirm-payment]').click();expect(page.locator('#toast')).to_contain_text('para confirmar')
 assert group['document']['payments']==[] and len(requests)==1 and requests[0]['amount']==800
 page.locator('[data-action="settlements"]').click();expect(page.locator('.settlement-list .settlement-row')).to_have_count(3)
 expect(page.locator('.settlement-pending-note')).to_contain_text('1 pago pendiente')
 expect(page.locator('[data-settle]')).to_have_count(0);page.keyboard.press('Escape')
 receiver=requests[0]['to_id'];co,other=context(b,receiver)
 other.locator('.home-attention').click();other.locator('[data-payment-response="confirm"]').click();other.locator('[data-resolve-payment="confirm"]').click()
 expect(other.locator('#toast')).to_contain_text('Pago confirmado')
 assert len(group['document']['payments'])==1
 assert sql('select public.divzplit_member_balance('+q(json.dumps(group['document']))+'::jsonb,'+q(OWNER)+')')=='0'
 assert sql('select public.divzplit_member_balance('+q(json.dumps(group['document']))+'::jsonb,'+q(receiver)+')')=='0'
 co.close();c.close()
 for language,label in [('en-GB','Simplify payments'),('ro-RO','Simplifică plățile')]:
  c,page=context(b,OWNER,language);page.locator('[data-action="settlements"]').click();expect(page.locator('[data-action="toggle-simplify"]')).to_contain_text(label);c.close()
 assert not errors,errors
 b.close()
print('PASS: 8 members, 7-to-4 transfer reduction, toggle without saves, pending-payment reservation, real recipient confirmation, exact balances and ES/EN/RO')
