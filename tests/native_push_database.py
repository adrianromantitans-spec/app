"""Real PostgreSQL, disposable local container only; run after npm run test:database."""
from pathlib import Path
exec(Path('tests/database_test.py').read_text().split('OWNER=')[0])
sql((ROOT/'supabase/native-push.sql').read_text(),role=None)
sql((ROOT/'supabase/native-push.sql').read_text(),role=None)
sql('truncate public.divzplit_native_jobs,public.divzplit_native_subscriptions;update public.divzplit_native_push_config set enabled=false',role=None)
sql('alter table auth.users add column if not exists banned_until timestamptz',role=None)
A,B,C=[str(uuid.uuid4()) for _ in range(3)]
for actor in [A,B,C]:sql('insert into auth.users(id,raw_user_meta_data) values('+literal(actor)+','+document({'display_name':'Native fixture'})+')',role=None)
g=json.loads(rpc('nexo_create_group',[document({'name':'Native push fixture','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':0,'currency':'EUR','requestId':str(uuid.uuid4())})],A))
invite=json.loads(rpc('nexo_create_invite',[literal(g['id'])],A))
for actor in [B,C]:rpc('nexo_join_group',[literal(invite['token'])],actor)
token='native_fixture_'+uuid.uuid4().hex
assert json.loads(rpc('divzplit_native_push_status',[],A))['enabled'] is False
rpc('divzplit_register_native_push',[literal(token),literal('es')],A,fail='NEXO_PUSH_NOT_READY')
sql('select public.divzplit_register_native_push(\'fixture\',\'es\')',role='anon',fail='permission denied')
sql('update public.divzplit_native_push_config set enabled=true',role=None)
rpc('divzplit_register_native_push',[literal(token),literal('es')],A)
rpc('divzplit_register_native_push',[literal('bad\nvalue'),literal('es')],A,fail='NEXO_FORBIDDEN')
sql('select token from public.divzplit_native_subscriptions',A,fail='permission denied')
sql('select public.divzplit_claim_native_push(10)',A,fail='permission denied')
def notice(actor=A,read=False,age=0):
 ident=str(uuid.uuid4())
 sql('insert into public.divzplit_notifications(id,user_id,group_id,kind,category,actor_name,group_name,created_at,read_at) values('+','.join([literal(ident),literal(actor),literal(g['id']),literal('expenses.added'),literal('expenses'),literal('Fixture'),literal('Fixture'),"now()-interval "+literal(str(age)+' days'), 'now()' if read else 'null'])+')',role=None)
 return ident
def claim():return json.loads(sql('select public.divzplit_claim_native_push(20)',role='service_role'))
id=notice();jobs=claim();assert len(jobs)==1 and jobs[0]['notification_id']==id and jobs[0]['token']==token
assert claim()==[]
j=jobs[0]
assert sql('select public.divzplit_finish_native_push('+','.join([literal(j['id']),literal(str(uuid.uuid4())),'200','false','false'])+')',role='service_role')=='f'
assert sql('select public.divzplit_finish_native_push('+','.join([literal(j['id']),literal(j['lease']),'200','false','false'])+')',role='service_role')=='t'
# Read, old, muted or preference-disabled notices must not be delivered.
notice(read=True);notice(age=2);assert claim()==[]
sql('insert into public.divzplit_muted_groups(user_id,group_id) values('+literal(A)+','+literal(g['id'])+')',role=None)
notice();assert claim()==[]
sql('delete from public.divzplit_muted_groups where user_id='+literal(A),role=None)
sql('insert into public.divzplit_notification_settings(user_id,expenses) values('+literal(A)+',false) on conflict(user_id) do update set expenses=false',role=None)
notice();assert claim()==[]
sql('update public.divzplit_notification_settings set expenses=true where user_id='+literal(A),role=None)
# Device/account transfer invalidates old queued deliveries, even before sending.
notice();rpc('divzplit_register_native_push',[literal(token),literal('ro')],B);assert claim()==[]
rpc('divzplit_remove_native_push',[literal(token)],A)
assert sql('select enabled from public.divzplit_native_subscriptions where token='+literal(token),role=None)=='t'
notice(B);assert len(claim())==1
sql('update auth.users set banned_until=\'infinity\' where id='+literal(B),role=None)
notice(B);assert claim()==[]
rpc('divzplit_register_native_push',[literal(token),literal('ro')],B,fail='NEXO_FORBIDDEN')
# Exercise the existing self-delete routine with the new native cleanup in a mock auth schema.
for column,typ in {'email':'text','phone':'text','encrypted_password':'text','email_confirmed_at':'timestamptz','raw_app_meta_data':'jsonb','confirmation_token':'text','recovery_token':'text','email_change':'text','email_change_token_new':'text','email_change_token_current':'text'}.items():sql('alter table auth.users add column if not exists '+column+' '+typ,role=None)
sql((ROOT/'supabase/account-deletion.sql').read_text(),role=None)
tokenC=token+'c';rpc('divzplit_register_native_push',[literal(tokenC),literal('en')],C)
notice(C);result=json.loads(rpc('divzplit_delete_account',[],C));assert result['deleted'] is True
assert sql('select count(*) from public.divzplit_native_subscriptions where user_id='+literal(C),role=None)=='0'
sql((ROOT/'supabase/privacy-operations.sql').read_text(),role=None)
rpc('divzplit_register_native_push',[literal(token+'-new'),literal('es')],A)
export=json.loads(rpc('divzplit_privacy_export',[],A));assert len(export['native_push_subscriptions'])==1;assert 'native_push_subscriptions' in export;assert token not in json.dumps(export)
print('PASS real PostgreSQL: idempotent native migration, opt-in, RLS, token transfer, account ownership, leases, read/expired/muted/preferences/banned filtering and deletion cleanup')
