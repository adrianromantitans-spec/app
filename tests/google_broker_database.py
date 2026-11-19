"""Real isolated PostgreSQL enforcement/authorization tests; never production.
NEXO_TEST_CONTAINER=divzplit-google-broker-tests python tests/google_broker_database.py
"""
from pathlib import Path
import uuid
exec(Path('tests/oauth_abuse_database.py').read_text().split('for _ in range(2)')[0])
assert CONTAINER.startswith('divzplit-google-broker-tests'), 'Use a dedicated disposable broker container'
sql('''create schema if not exists auth;
create table if not exists auth.users(id uuid primary key,email text,aud text default 'authenticated',is_sso_user boolean default false,raw_app_meta_data jsonb default '{}'::jsonb,raw_user_meta_data jsonb default '{}'::jsonb);
create table if not exists auth.identities(provider_id text,provider text,user_id uuid references auth.users(id),identity_data jsonb default '{}'::jsonb,unique(provider,provider_id));
grant usage on schema auth to supabase_auth_admin;
grant insert,select,update,delete on all tables in schema auth to supabase_auth_admin;''')
for name in ['oauth-abuse.sql','google-broker.sql']:sql((ROOT/'supabase'/name).read_text())
sql("update divzplit_security.oauth_policy set mode='observe';truncate auth.identities,auth.users,divzplit_security.google_flows,divzplit_security.google_provisions cascade;")
assert sql('select public.divzplit_google_broker_ready()','service_role')=='f'
existing=str(uuid.uuid4());sql("insert into auth.users(id,email,raw_app_meta_data) values('"+existing+"','existing@example.test','{\"provider\":\"google\"}');")
sql("insert into auth.identities values('existing-sub','google','"+existing+"','{}');")
sql("update divzplit_security.oauth_policy set mode='block_new_google';")
assert sql('select public.divzplit_google_broker_ready()','service_role')=='t'
sql("insert into auth.users(id,raw_app_meta_data) values(gen_random_uuid(),'{\"provider\":\"google\",\"captcha_verified\":true}');",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
email_user=str(uuid.uuid4());sql("insert into auth.users(id,email) values('"+email_user+"','precreated@example.test');",'supabase_auth_admin')
sql("insert into auth.identities values('precreated-sub','google','"+email_user+"','{\"captcha_verified\":true}');",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
# Existing Google logins update identity data, not enrollment: keep them working.
sql("update auth.identities set identity_data='{\"name\":\"Refreshed\"}',provider_id=provider_id where provider='google' and provider_id='existing-sub';",'supabase_auth_admin')
for role in ['anon','authenticated']:
 for statement in ["select public.divzplit_google_broker_ready();","select public.divzplit_google_authorize_provision(gen_random_uuid());","select * from divzplit_security.google_flows;"]:
  sql(statement,role,fail='permission denied')
def rpc(name,args):return sql('select public.'+name+'('+','.join(args)+');','service_role')
def begin(subject='new-sub',email='new@example.test'):
 ident=str(uuid.uuid4());state=digest('state-'+ident);nonce=digest('nonce-'+ident);challenge='A'*43;completion=digest('completion-'+ident)
 rpc('divzplit_google_flow_start',[quote(ident)+'::uuid',quote(state),quote(challenge),quote('https://divzplit.com/'),quote(nonce),quote('sealed-initial-fixture')])
 rpc('divzplit_google_callback_claim',[quote(state)])
 sql('select public.divzplit_google_callback_claim('+quote(state)+');','service_role',fail='BROKER_STATE')
 rpc('divzplit_google_callback_ready',[quote(ident)+'::uuid',quote(subject),quote(email),quote('sealed-token-fixture'),quote(completion)])
 return ident,completion,challenge

def claim(ident,code,challenge):return json.loads(rpc('divzplit_google_completion_claim',[quote(code),quote(challenge),quote('https://divzplit.com/'),quote(ident)+'::uuid']))
def authorize(ident):return json.loads(rpc('divzplit_google_authorize_provision',[quote(ident)+'::uuid']))
f,code,challenge=begin()
sql('select public.divzplit_google_completion_claim('+quote(code)+','+quote('B'*43)+','+quote('https://divzplit.com/')+','+quote(f)+'::uuid);','service_role',fail='BROKER_COMPLETION')
claim(f,code,challenge);target=authorize(f);assert target['create'] is True
sql("select public.divzplit_google_authorize_provision('"+f+"');",'service_role',fail='BROKER_AUTHORIZATION')
sql("insert into auth.users(id,email,raw_app_meta_data) values('"+target['userId']+"','new@example.test','{\"provider\":\"email\"}');",'supabase_auth_admin')
sql("insert into auth.identities values('wrong-sub','google','"+target['userId']+"','{}');",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
sql("insert into auth.identities values('new-sub','google','"+email_user+"','{}');",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
sql("insert into auth.identities values('new-sub','google','"+target['userId']+"','{}');",'supabase_auth_admin')
assert sql('select identity_consumed_at is not null from divzplit_security.google_flows where id='+quote(f))=='t'
sql("delete from auth.identities where provider_id='new-sub' and provider='google';",'supabase_auth_admin')
sql("insert into auth.identities values('new-sub','google','"+target['userId']+"','{}');",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
rpc('divzplit_google_flow_finish',[quote(f)+'::uuid','true']);rpc('divzplit_google_flow_finish',[quote(f)+'::uuid'])
assert sql('select phase||coalesce(sealed_context,\'\') from divzplit_security.google_flows where id='+quote(f))=='done'
# Matching an existing identity or email never authorizes creation of another ID.
f,code,ch=begin('existing-sub','other-contact@example.test');claim(f,code,ch);assert authorize(f)=={'userId':existing,'create':False}
f,code,ch=begin('precreated-sub','precreated@example.test');claim(f,code,ch);assert authorize(f)=={'userId':email_user,'create':False}
# Only one concurrent completion can consume the original PKCE binding.
f,code,ch=begin('race-sub','race@example.test')
def race(_):
 try:claim(f,code,ch);return True
 except AssertionError:return False
with ThreadPoolExecutor(max_workers=12) as pool:assert sum(pool.map(race,range(12)))==1
# An expired authorization must not be usable for a Google identity insert.
f,code,ch=begin('expired-sub','expired@example.test');claim(f,code,ch);target=authorize(f)
sql('update divzplit_security.google_flows set completion_expires_at=clock_timestamp()-interval \'1 second\' where id='+quote(f))
sql("insert into auth.users(id,email) values('"+target['userId']+"','expired@example.test');")
sql("insert into auth.identities values('expired-sub','google','"+target['userId']+"','{}');",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
# Separate concurrent starts for one identity share a short provisioning lease.
f1,c1,ch1=begin('lease-sub','lease@example.test');claim(f1,c1,ch1)
f2,c2,ch2=begin('lease-sub','lease@example.test');claim(f2,c2,ch2)
with ThreadPoolExecutor(max_workers=2) as pool:lease_targets=list(pool.map(authorize,[f1,f2]))
assert lease_targets[0]==lease_targets[1] and lease_targets[0]['create']
# Supabase soft-deletion can retain a technical UUID with changed email.
old_target=lease_targets[0]['userId'];sql("insert into auth.users(id,email) values("+quote(old_target)+",'deleted-technical-id@example.test');")
f,c,ch=begin('lease-sub','lease@example.test');claim(f,c,ch);assert authorize(f)['userId']!=old_target
# A native prepared flow cannot skip Turnstile activation; ticket is single use.
prepared=str(uuid.uuid4());state=digest('prepared-state');ticket=digest('prepared-ticket');ch='P'*43
rpc('divzplit_google_flow_prepare',[quote(prepared)+'::uuid',quote(state),quote(ch),quote('https://divzplit.com/'),quote(digest('prepared-nonce')),quote('sealed-fixture'),quote(ticket)])
sql('select public.divzplit_google_callback_claim('+quote(state)+');','service_role',fail='BROKER_STATE')
sql('select public.divzplit_google_launch_claim('+quote(ticket)+','+quote('Q'*43)+','+quote('https://divzplit.com/')+');','service_role',fail='BROKER_LAUNCH')
rpc('divzplit_google_launch_claim',[quote(ticket),quote(ch),quote('https://divzplit.com/')])
sql('select public.divzplit_google_launch_claim('+quote(ticket)+','+quote(ch)+','+quote('https://divzplit.com/')+');','service_role',fail='BROKER_LAUNCH')
rpc('divzplit_google_callback_claim',[quote(state)])
# Existing identity field mutation must not bypass enrollment authorization.
sql("update auth.identities set user_id="+quote(email_user)+" where provider_id='existing-sub';",'supabase_auth_admin',fail='GOOGLE_BROKER_REQUIRED')
sql('alter table auth.users disable trigger divzplit_require_google_broker;');assert sql('select public.divzplit_google_broker_ready()','service_role')=='f'
sql('alter table auth.users enable trigger divzplit_require_google_broker;')
# Readiness is real enforcement, not an operator/browser assertion.
sql('alter table auth.identities disable trigger divzplit_require_google_enrollment;');assert sql('select public.divzplit_google_broker_ready()','service_role')=='f'
sql('alter table auth.identities enable trigger divzplit_require_google_enrollment;')
sql((ROOT/'supabase/google-broker.sql').read_text());assert sql('select public.divzplit_google_broker_ready()','service_role')=='t'
sql("update divzplit_security.oauth_policy set mode='observe';");assert sql('select public.divzplit_google_broker_ready()','service_role')=='f'
sql("insert into auth.identities values('rollback-sub','google','"+email_user+"','{}');",'supabase_auth_admin')
print('PASS: inactive/idempotent install; real user+identity backstops; email-precreation bypass blocked; existing identity updates allowed; private permissions; state/PKCE/callback single use; intended subject+user binding; concurrent completion; enrollment one-use/expiry; real readiness and rollback')
