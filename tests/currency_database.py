"""Currency migration and permissions on an isolated local PostgreSQL database."""
from pathlib import Path
exec(Path('tests/database_test.py').read_text().split('sql("""')[0])
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222'
def create(currency=None):
 fields={'name':'Currency test','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':10000,'requestId':str(uuid.uuid4())}
 if currency is not None:fields['currency']=currency
 return json.loads(rpc('nexo_create_group',[document(fields)],OWNER))
legacy=create();gid=legacy['id']
sql("update public.nexo_groups set document=document-'currency' where id="+literal(gid)+';',role=None)
legacy=json.loads(sql('select to_jsonb(g) from public.nexo_groups g where id='+literal(gid)+';',OWNER))
snapshot=sql('select document from public.nexo_groups where id='+literal(gid)+';',OWNER)
for _ in range(2):sql((ROOT/'supabase/currencies.sql').read_text(),role=None)
assert snapshot==sql('select document from public.nexo_groups where id='+literal(gid)+';',OWNER)
assert rpc('divzplit_currency_support',[],OWNER)=='t'
assert 'currency' not in legacy['document']
# Existing groups without a currency keep EUR and can still be edited.
doc=legacy['document'];doc['name']='Legacy EUR';legacy=save(legacy,doc,OWNER)
invite=json.loads(rpc('nexo_create_invite',[literal(gid)+'::uuid'],OWNER))
rpc('nexo_join_group',[literal(invite['token'])],FRIEND)
row=json.loads(sql('select to_jsonb(g) from public.nexo_groups g where id='+literal(gid)+';',OWNER))
doc=row['document'];doc['currency']='RON'
save(row,doc,FRIEND,'NEXO_OWNER')
row=save(row,doc,OWNER);assert row['document']['currency']=='RON'
# Unsupported currencies are rejected; changing an empty group back is explicit.
doc=row['document'];doc['currency']='USD';save(row,doc,OWNER,'NEXO_CURRENCY')
doc['currency']='RON';doc['expenses']=[{'id':str(uuid.uuid4()),'title':'Dinner','payer':OWNER,'createdBy':OWNER,'participants':[OWNER,FRIEND],'date':'2026-10-30','amount':1001,'category':'Comida'}]
row=save(row,doc,OWNER)
doc=row['document'];doc['currency']='EUR';save(row,doc,OWNER,'NEXO_CURRENCY_LOCKED')
# Deleting the expense and switching units in one request cannot reinterpret the ledger.
doc['expenses']=[];save(row,doc,OWNER,'NEXO_CURRENCY_LOCKED')
ron=create('RON');assert ron['document']['currency']=='RON'
eur=create();assert eur['document']['currency']=='EUR'
try:create('USD');raise AssertionError('USD accepted')
except AssertionError as e:assert 'NEXO_CURRENCY' in str(e),e
for id in [gid,ron['id'],eur['id']]:sql('delete from public.nexo_groups where id='+literal(id)+';',role=None)
print('PASS: currency upgrade preserves legacy data, accepts EUR/RON and rejects unsupported currencies')
print('PASS: only owners can change empty groups; groups with existing expenses cannot change currency')
