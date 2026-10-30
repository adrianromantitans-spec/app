"""Storage RLS tests on an isolated PostgreSQL container; no Supabase access."""
from pathlib import Path
exec(Path('tests/database_test.py').read_text().split('sql("""')[0])
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';STRANGER='33333333-3333-4333-8333-333333333333'
sql('''create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
grant usage on all sequences in schema storage to authenticated;''',role=None)
for _ in range(2):sql((ROOT/'supabase/receipts.sql').read_text(),role=None)
row=json.loads(rpc('nexo_create_group',[document({'name':'Tickets','type':'Convivencia','emoji':'🏠','place':'','date':'','endDate':'','budget':10000,'requestId':str(uuid.uuid4())})],OWNER));gid=row['id']
invite=json.loads(rpc('nexo_create_invite',[literal(gid)+'::uuid'],OWNER))
rpc('nexo_join_group',[literal(invite['token'])],FRIEND)
path=gid+'/'+OWNER+'/'+str(uuid.uuid4())+'.jpg'
friendpath=gid+'/'+FRIEND+'/'+str(uuid.uuid4())+'.jpg'
def insert(path,actor,fail=None):return sql("insert into storage.objects(bucket_id,name) values('divzplit-receipts',"+literal(path)+");",actor,fail=fail)
insert(path,OWNER)
assert sql('select count(*) from storage.objects;',OWNER)=='1'
assert sql('select count(*) from storage.objects;',FRIEND)=='1'
assert sql('select count(*) from storage.objects;',STRANGER)=='0'
insert(gid+'/'+STRANGER+'/'+str(uuid.uuid4())+'.jpg',STRANGER,'row-level security')
insert(path,FRIEND,'row-level security')
insert(friendpath,FRIEND)
insert(gid+'/'+OWNER+'/../../other.jpg',OWNER,'row-level security')
assert sql('delete from storage.objects where name='+literal(path)+' returning id;',FRIEND)==''
# Shared expenses accept optional metadata; non-authors cannot stop someone else's series.
row=json.loads(sql('select to_jsonb(g) from public.nexo_groups g where id='+literal(gid)+';',OWNER))
doc=row['document'];eid=str(uuid.uuid4())
doc['expenses']=[{'id':eid,'title':'Internet','amount':4000,'payer':OWNER,'participants':[OWNER,FRIEND],'createdBy':OWNER,'date':'2026-01-31','category':'Otros','receipt':{'path':path},'recurrence':{'frequency':'monthly','nextDate':'2026-02-28','anchorDay':31,'active':True}}]
row=save(row,doc,OWNER);doc=row['document'];doc['expenses'][0]['recurrence']['active']=False
save(row,doc,FRIEND,'NEXO_FORBIDDEN')
sql('delete from storage.objects where name='+literal(friendpath)+';',OWNER)
assert sql('select count(*) from storage.objects;',OWNER)=='1'
sql('delete from public.nexo_members where group_id='+literal(gid)+' and user_id='+literal(FRIEND)+';',role=None)
assert sql('select count(*) from storage.objects;',FRIEND)=='0'
print('PASS: private receipts are member-only; paths cannot be spoofed; only uploader/owner can delete')
print('PASS: existing database accepts recurrence/ticket metadata and protects other authors schedules')

sql('delete from public.nexo_groups where id='+literal(gid)+';',role=None)
