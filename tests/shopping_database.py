"""Real PostgreSQL tests: shared shopping permissions and atomic expense conversion."""
from pathlib import Path
exec(Path('tests/fx_database.py').read_text().split("sql((ROOT/'supabase/exchange-rates.sql')")[0])
sql((ROOT/'supabase/shopping.sql').read_text(),role=None)
OWNER,FRIEND,OTHER=[str(uuid.uuid4()) for _ in range(3)]
for actor in [OWNER,FRIEND,OTHER]:sql('insert into auth.users values ('+literal(actor)+",'{}')",role=None)
row=json.loads(rpc('nexo_create_group',[document({'name':'Compras','type':'Convivencia','emoji':'🏠','requestId':str(uuid.uuid4())})],OWNER));gid=row['id']
invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER));rpc('nexo_join_group',[literal(invite['token'])],FRIEND)
def latest():return json.loads(sql('select row_to_json(g) from public.nexo_groups g where id='+literal(gid),OWNER))
def listing(actor=OWNER):return json.loads(rpc('divzplit_shopping_list',[literal(gid)],actor))
def action(op,item={},actor=OWNER,fail=None):return rpc('divzplit_shopping_action',[literal(gid),literal(op),document(item)],actor,fail)
def add(title='Leche',actor=OWNER):
 i={'id':str(uuid.uuid4()),'title':title,'quantity':'2 litros'};action('add',i,actor);return next(x for x in listing() if x['id']==i['id'])
def check(i,actor=OWNER):action('check',dict(i,bought=True),actor);return next(x for x in listing() if x['id']==i['id'])
def expense_doc(row,eid):
 d=json.loads(json.dumps(row['document']));d['expenses'].insert(0,{'id':eid,'title':'Compra de casa','amount':1001,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-11-02','createdBy':OWNER});return d
def checkout(row,doc,eid,items,actor=OWNER,fail=None):
 return rpc('divzplit_shopping_checkout',[literal(gid),str(row['version']),document(doc),literal(eid),'array['+','.join(literal(i) for i in items)+']::uuid[]'],actor,fail)
i=add();assert listing(FRIEND)==listing()
action('add',{'id':i['id'],'title':i['title'],'quantity':i['quantity']});assert len(listing())==1
sql('select * from public.divzplit_shopping_items',OWNER,fail='permission denied')
rpc('divzplit_shopping_list',[literal(gid)],OTHER,'NEXO_FORBIDDEN')
action('add',{'id':str(uuid.uuid4()),'title':'<b>Huevo</b>','quantity':''},OTHER,'NEXO_FORBIDDEN')
action('edit',dict(i,title='Otra cosa'),FRIEND,'NEXO_FORBIDDEN')
action('add',{'id':str(uuid.uuid4()),'title':' ','quantity':''},fail='NEXO_SHOPPING_FIELDS')
action('clear',actor=FRIEND,fail='NEXO_OWNER')
before=latest();i=check(i,FRIEND);assert latest()==before
# Stale changes cannot undo another member's edit.
action('check',dict(i,version=i['version']-1,bought=False),fail='NEXO_SHOPPING_CHANGED')
row=latest();eid=str(uuid.uuid4());d=expense_doc(row,eid)
checkout(row,d,eid,[i['id']],OTHER,'NEXO_FORBIDDEN')
forged=json.loads(json.dumps(d));forged['name']='Tampered'
checkout(row,forged,eid,[i['id']],fail='NEXO_SHOPPING_FIELDS');assert latest()==row
checkout(row,d,eid,[i['id'],i['id']],fail='NEXO_SHOPPING_FIELDS')
result=json.loads(checkout(row,d,eid,[i['id']]));assert result['document']['expenses'][0]['amount']==1001
retry=json.loads(checkout(row,d,eid,[i['id']]));assert retry==result and len(retry['document']['expenses'])==1
linked=listing()[0];assert linked['expense_id']==eid
action('check',dict(linked,bought=False),FRIEND,'NEXO_SHOPPING_LINKED')
checkout(result,expense_doc(result,str(uuid.uuid4())),str(uuid.uuid4()),[i['id']],fail='NEXO_SHOPPING_CHANGED')
# Pending products cannot enter the ledger, and invalid expenses roll back links.
pending=add('Pan');badid=str(uuid.uuid4());checkout(result,expense_doc(result,badid),badid,[pending['id']],fail='NEXO_SHOPPING_CHANGED')
pending=check(pending);row=latest();bad=expense_doc(row,badid);bad['expenses'][0]['amount']=0
checkout(row,bad,badid,[pending['id']],fail='Invalid expense')
assert latest()==row and next(x for x in listing() if x['id']==pending['id'])['expense_id'] is None
# Two tabs purchasing the same product: one expense only, even with different IDs.
def purchase(_):
 eid=str(uuid.uuid4());args=[literal(gid),str(row['version']),document(expense_doc(row,eid)),literal(eid),'array['+literal(pending['id'])+']::uuid[]']
 return subprocess.run(DOCKER+['exec','-i',CONTAINER,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAq'],input="set role authenticated;set request.jwt.claim.sub='"+OWNER+"';select public.divzplit_shopping_checkout("+','.join(args)+');',text=True,capture_output=True)
with ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(purchase,range(2)))
assert sum(r.returncode==0 for r in out)==1 and len(latest()['document']['expenses'])==2
before=latest();action('clear');assert not listing() and latest()==before
kept=add('Arroz');sql((ROOT/'supabase/shopping.sql').read_text(),role=None);assert latest()==before and listing()[0]['id']==kept['id']
sql('insert into public.divzplit_shopping_items(id,group_id,title,created_by) select gen_random_uuid(),'+literal(gid)+",'Producto',"+literal(OWNER)+' from generate_series(1,199)',role=None)
action('add',{'id':str(uuid.uuid4()),'title':'Extra','quantity':''},fail='NEXO_SHOPPING_LIMIT')
sql('delete from public.nexo_groups where id='+literal(gid),role=None)
print('PASS: shopping membership, role restrictions, field validation, stale edits, zero financial impact, atomic checkout, lost-response retry, concurrent purchase and nonfinancial clearing')
