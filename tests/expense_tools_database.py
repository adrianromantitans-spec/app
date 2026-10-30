"""Custom split and group deletion security on an isolated local PostgreSQL database."""
from pathlib import Path
exec(Path('tests/database_test.py').read_text().split('sql("""')[0])
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';STRANGER='33333333-3333-4333-8333-333333333333'
sql('''create schema if not exists storage;
create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table if not exists storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
grant usage on all sequences in schema storage to authenticated;''',role=None)
sql((ROOT/'supabase/receipts.sql').read_text(),role=None)
for _ in range(2):sql((ROOT/'supabase/expense-tools.sql').read_text(),role=None)
assert rpc('divzplit_expense_tools_support',[],OWNER)=='t'
fields={'name':'Delete test','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':10000,'currency':'RON','requestId':str(uuid.uuid4())}
row=json.loads(rpc('nexo_create_group',[document(fields)],OWNER));gid=row['id']
invite=json.loads(rpc('nexo_create_invite',[literal(gid)+'::uuid'],OWNER));rpc('nexo_join_group',[literal(invite['token'])],FRIEND)
def current():return json.loads(sql('select to_jsonb(g) from public.nexo_groups g where id='+literal(gid)+';',OWNER))
row=current();doc=row['document']
e={'id':str(uuid.uuid4()),'title':'Custom dinner','payer':OWNER,'createdBy':OWNER,'participants':[OWNER,FRIEND],'date':'2026-10-30','amount':1001,'category':'Comida','split':{'mode':'percent','values':{OWNER:7500,FRIEND:2500}}}
doc['expenses']=[e];row=save(row,doc,OWNER)
for invalid in [{'mode':'percent','values':{OWNER:5000,FRIEND:4999}}, {'mode':'amounts','values':{OWNER:1000,FRIEND:0}}, {'mode':'shares','values':{OWNER:1,STRANGER:1}}, {'mode':'shares','values':{OWNER:1.5,FRIEND:1}}, {'mode':'shares','values':{OWNER:0,FRIEND:1}}]:
 bad=__import__('copy').deepcopy(row['document']);bad['expenses'][0]['split']=invalid;save(row,bad,OWNER,'NEXO_SPLIT')
doc=__import__('copy').deepcopy(row['document']);doc['expenses'][0]['title']='Attempted foreign edit';save(row,doc,FRIEND,'NEXO_FORBIDDEN')
doc['expenses'][0]['title']='Edited by author';doc['expenses'][0]['amount']=2001;row=save(row,doc,OWNER)
rpc('nexo_delete_group',[literal(gid)+'::uuid',str(row['version'])],FRIEND,'NEXO_OWNER')
rpc('nexo_delete_group',[literal(gid)+'::uuid',str(row['version']-1)],OWNER,'NEXO_CONFLICT')
assert current()['document']['expenses'][0]['amount']==2001
paths=[gid+'/'+actor+'/'+str(uuid.uuid4())+'.jpg' for actor in [OWNER,FRIEND]]
for path,actor in zip(paths,[OWNER,FRIEND]):sql("insert into storage.objects(bucket_id,name) values('divzplit-receipts',"+literal(path)+");",actor)
assert rpc('nexo_delete_group',[literal(gid)+'::uuid',str(row['version'])],OWNER)=='t'
assert rpc('nexo_delete_group',[literal(gid)+'::uuid',str(row['version'])],OWNER)=='t'
rpc('nexo_delete_group',[literal(gid)+'::uuid',str(row['version'])],FRIEND,'NEXO_FORBIDDEN')
assert sql('select count(*) from public.nexo_groups where id='+literal(gid)+';',OWNER)=='0'
for table,column in [('nexo_members','group_id'),('nexo_invites','group_id')]:assert sql('select count(*) from public.'+table+' where '+column+'='+literal(gid)+';',role=None)=='0'
rpc('nexo_join_group',[literal(invite['token'])],FRIEND,'NEXO_INVITE')
save(row,row['document'],OWNER,'NEXO_FORBIDDEN')
assert sql('select count(*) from public.nexo_deleted_groups;',FRIEND)=='0'
assert sql('select count(*) from storage.objects;',FRIEND)=='0'
assert sql('select count(*) from storage.objects;',OWNER)=='2'
assert rpc('divzplit_finish_group_cleanup',[literal(gid)+'::uuid'],OWNER)=='f'
rpc('divzplit_finish_group_cleanup',[literal(gid)+'::uuid'],FRIEND,'NEXO_FORBIDDEN')
sql('delete from storage.objects;',FRIEND);assert sql('select count(*) from storage.objects;',OWNER)=='2'
sql('delete from storage.objects;',OWNER)
assert rpc('divzplit_finish_group_cleanup',[literal(gid)+'::uuid'],OWNER)=='t'
assert sql('select public.divzplit_deleted_receipt_access('+literal(paths[0])+');',OWNER)=='f'
# Reusing a deleted group ID cannot expose future private objects to an old owner.
rpc('nexo_create_group',[document(fields)],OWNER,'NEXO_FORBIDDEN')
assert rpc('nexo_delete_group',[literal(gid)+'::uuid',str(row['version'])],OWNER)=='t'
print('PASS: custom splits are validated on the server; only expense author/owner may edit')
print('PASS: group deletion is owner-only, revision-checked and idempotent; invitations and memberships are removed')
print('PASS: former members lose ticket access immediately; only the deleting owner can finish private-file cleanup')
