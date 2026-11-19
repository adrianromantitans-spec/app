"""Own-account deletion on disposable PostgreSQL, including managed Storage DELETE protection.
Never use production. NEXO_TEST_CONTAINER must refer to an isolated test container.
"""
from pathlib import Path
exec(Path('tests/database_test.py').read_text().split('OWNER=')[0])
sql("""
do $$ begin
 if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;
 if not exists(select from pg_roles where rolname='anon') then create role anon nologin;end if;
 if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key,email text unique,phone text,encrypted_password text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb,banned_until timestamptz,confirmation_token text,recovery_token text,email_change text,email_change_token_new text,email_change_token_current text);
alter table auth.users add column if not exists email text unique,add column if not exists phone text,add column if not exists encrypted_password text,add column if not exists email_confirmed_at timestamptz,add column if not exists raw_app_meta_data jsonb,add column if not exists banned_until timestamptz,add column if not exists confirmation_token text,add column if not exists recovery_token text,add column if not exists email_change text,add column if not exists email_change_token_new text,add column if not exists email_change_token_current text;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table if not exists auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
create table if not exists auth.identities(id uuid primary key,user_id uuid references auth.users(id));
create table if not exists auth.refresh_tokens(id bigserial primary key,user_id text);
""",role=None)
sql((ROOT/'supabase/schema.sql').read_text(),role=None)
sql((ROOT/'supabase/native-push.sql').read_text(),role=None)
sql("""
create schema if not exists storage;
create table if not exists storage.objects(id uuid primary key,bucket_id text,name text);
create or replace function storage.protect_delete() returns trigger language plpgsql as $$begin raise exception using errcode='42501',message='Direct deletion from storage tables is not allowed. Use the Storage API instead.';end$$;
drop trigger if exists managed_storage_delete_guard on storage.objects;
create trigger managed_storage_delete_guard before delete on storage.objects for each statement execute function storage.protect_delete();
""",role=None)
sql((ROOT/'supabase/account-deletion.sql').read_text(),role=None)
sql((ROOT/'supabase/account-deletion.sql').read_text(),role=None)
OWNER,FRIEND,STRANGER=[str(uuid.uuid4()) for _ in range(3)]
for actor in [OWNER,FRIEND,STRANGER]:
 sql('insert into auth.users(id,email,encrypted_password,raw_user_meta_data) values('+literal(actor)+','+literal(actor+'@example.invalid')+",'fixture-password',"+document({'display_name':'Deletion fixture'})+')',role=None)
 sql('insert into auth.sessions values('+literal(str(uuid.uuid4()))+','+literal(actor)+');insert into auth.identities values('+literal(str(uuid.uuid4()))+','+literal(actor)+');insert into auth.refresh_tokens(user_id) values('+literal(actor)+')',role=None)
def create(actor,name):return json.loads(rpc('nexo_create_group',[document({'name':name,'type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':0,'currency':'EUR','requestId':str(uuid.uuid4())})],actor))
solo=create(OWNER,'Solo deletion fixture');shared=create(OWNER,'Shared deletion fixture');other=create(STRANGER,'Untouched stranger')
invite=json.loads(rpc('nexo_create_invite',[literal(shared['id'])],OWNER));shared=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
# One real expense and pending request must not become a confirmed payment on deletion.
doc=shared['document'];doc['expenses']=[{'id':'fixture-expense','title':'Preserve shared expense','amount':1000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Otros','date':'2026-11-19','createdBy':OWNER}];shared=save(shared,doc,OWNER)
payment_id=str(uuid.uuid4());rpc('divzplit_request_payment',[literal(shared['id']),str(shared['version']),literal(payment_id),literal(OWNER),'500',literal('EUR')],FRIEND)
receipt=str(uuid.uuid4());sql('insert into storage.objects values('+literal(receipt)+",'divzplit-receipts',"+literal(solo['id']+'/receipt.jpg')+')',role=None)
before=sql('select document from public.nexo_groups where id='+literal(shared['id']),role=None)
stranger=sql('select document from public.nexo_groups where id='+literal(other['id']),role=None)
result=json.loads(rpc('divzplit_delete_account',[],OWNER))
assert result['deleted'] is True
assert result['receipt_cleanup_pending_groups']>=1
assert sql('select count(*) from public.nexo_groups where id='+literal(solo['id']),role=None)=='0'
assert sql('select count(*) from storage.objects where id='+literal(receipt),role=None)=='1','Storage metadata must wait for Storage API cleanup'
assert sql('select cleaned_at is null from public.nexo_deleted_groups where id='+literal(solo['id']),role=None)=='t'
assert sql('select owner_id from public.nexo_groups where id='+literal(shared['id']),role=None)==FRIEND
remaining=json.loads(sql('select document from public.nexo_groups where id='+literal(shared['id']),FRIEND));original=json.loads(before)
for key in ['expenses','payments','tasks','polls']:assert remaining[key]==original[key],key
assert next(m for m in remaining['members'] if m['id']==OWNER)['name']=='Cuenta eliminada'
assert sql('select count(*) from public.nexo_members where user_id='+literal(OWNER),role=None)=='0'
assert sql('select public.nexo_is_member('+literal(shared['id'])+')',OWNER)=='f'
assert sql('select count(*) from public.nexo_groups where id='+literal(shared['id']),OWNER)=='0','Cached JWT must lose group read access'
assert sql('select status from public.divzplit_payment_requests where id='+literal(payment_id),role=None)=='cancelled'
assert sql('select document from public.nexo_groups where id='+literal(other['id']),role=None)==stranger
for table in ['sessions','identities','refresh_tokens']:assert sql('select count(*) from auth.'+table+' where user_id::text='+literal(OWNER),role=None)=='0'
assert sql('select email from auth.users where id='+literal(OWNER),role=None).endswith('@users.divzplit.invalid')
assert sql('select banned_until>now() from auth.users where id='+literal(OWNER),role=None)=='t'
replacement=str(uuid.uuid4());sql('insert into auth.users(id,email,raw_user_meta_data) values('+literal(replacement)+','+literal(OWNER+'@example.invalid')+",'{}'::jsonb)",role=None)
# A surviving JWT cannot regain group access via a new group or a valid invite.
failed_fields={'name':'Must not create','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':0,'currency':'EUR','requestId':str(uuid.uuid4())}
rpc('nexo_create_group',[document(failed_fields)],OWNER,fail='NEXO_FORBIDDEN')
renewed=json.loads(rpc('nexo_create_invite',[literal(shared['id'])],FRIEND))
rpc('nexo_join_group',[literal(renewed['token'])],OWNER,fail='NEXO_FORBIDDEN')
assert json.loads(rpc('divzplit_delete_account',[],OWNER))['deleted'] is True,'Own-account retry must be safe'
sql('select public.divzplit_delete_account()',role='anon',fail='permission denied')
rpc('divzplit_delete_account',[],None,fail='NEXO_FORBIDDEN')
# After deletion, the final active member can leave without transferring ownership to a deleted user.
assert json.loads(rpc('divzplit_delete_account',[],FRIEND))['deleted'] is True
assert sql('select count(*) from public.nexo_groups where id='+literal(shared['id']),role=None)=='0'
# Older deployments kept memberships for deleted users: never transfer to them.
legacy_owner,legacy_member=[str(uuid.uuid4()) for _ in range(2)]
for actor in [legacy_owner,legacy_member]:sql('insert into auth.users(id,raw_user_meta_data) values('+literal(actor)+",'{}'::jsonb)",role=None)
legacy=create(legacy_owner,'Legacy deleted member');link=json.loads(rpc('nexo_create_invite',[literal(legacy['id'])],legacy_owner));rpc('nexo_join_group',[literal(link['token'])],legacy_member)
sql("update auth.users set raw_app_meta_data='{\"deleted\":true}'::jsonb where id="+literal(legacy_owner),role=None)
assert json.loads(rpc('divzplit_delete_account',[],legacy_member))['deleted'] is True
assert sql('select count(*) from public.nexo_groups where id='+literal(legacy['id']),role=None)=='0'
print('PASS account deletion with managed Storage protection: pending cleanup, shared ledger/owner preservation, cached-JWT group access/restore rejection, pending cancellation, isolation, auth cleanup, retry and last-member deletion')
