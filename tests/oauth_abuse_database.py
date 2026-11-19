"""Isolated PostgreSQL proof storage/hook-policy tests, never production.
Run with an existing disposable postgres container:
NEXO_TEST_CONTAINER=divzplit-oauth-security-tests python tests/oauth_abuse_database.py
"""
from pathlib import Path
import os,subprocess,json,hashlib
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
CONTAINER=os.environ.get('NEXO_TEST_CONTAINER','divzplit-oauth-security-tests')
DOCKER=['docker','--host=unix:///var/run/docker.sock','exec','-i',CONTAINER,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAq']
def sql(text,role=None,fail=None):
 result=subprocess.run(DOCKER,input=(('set role '+role+';') if role else '')+text,text=True,capture_output=True)
 if fail:assert result.returncode and fail in result.stderr,(result.stdout,result.stderr);return
 assert result.returncode==0,result.stderr
 return result.stdout.strip()
def quote(s):return "'"+s.replace("'","''")+"'"
def digest(s):return hashlib.sha256(s.encode()).hexdigest()
def reserve(token,flow,role='service_role'):return sql('select public.divzplit_turnstile_reserve('+quote(digest(token))+','+quote(digest(flow))+');',role)
def hook(provider='google',metadata=None,role='supabase_auth_admin'):
 event={'metadata':{'name':'before-user-created','ip_address':'192.0.2.1'},'user':{'id':'11111111-1111-4111-8111-111111111111','app_metadata':{'provider':provider},'user_metadata':metadata or {},'email':'fixture@example.test'}}
 return json.loads(sql('select public.divzplit_before_user_created('+quote(json.dumps(event))+'::jsonb);',role))
sql("do $$begin if not exists(select from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;if not exists(select from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin;end if;end$$;")
for _ in range(2):sql((ROOT/'supabase/oauth-abuse.sql').read_text())
sql('truncate divzplit_security.turnstile_tokens, divzplit_security.turnstile_flow_limits;')
assert sql('select mode from divzplit_security.oauth_policy')=='observe';assert hook()=={}
for role in ['anon','authenticated']:
 sql('select public.divzplit_turnstile_reserve('+quote('a'*64)+','+quote('b'*64)+');',role,fail='permission denied')
 sql("select public.divzplit_before_user_created('{}'::jsonb);",role,fail='permission denied')
 sql("update divzplit_security.oauth_policy set mode='observe';",role,fail='permission denied')
 sql('select * from divzplit_security.turnstile_tokens;',role,fail='permission denied')
sql("select public.divzplit_before_user_created('{}'::jsonb);",'service_role',fail='permission denied')
assert reserve('token-1','flow-1')=='reserved';assert reserve('token-1','flow-2')=='replay'
with ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(lambda i:reserve('concurrent-token','concurrent-flow-'+str(i)),range(12)))
assert results.count('reserved')==1 and results.count('replay')==11,results
results=[reserve('limited-token-'+str(i),'limited-flow') for i in range(8)];assert results==['reserved']*6+['rate_limited']*2,results
sql("update divzplit_security.turnstile_tokens set expires_at=clock_timestamp()-interval '1 second' where digest="+quote(digest('token-1'))+';')
assert reserve('token-1','flow-3')=='reserved'
sql("update divzplit_security.oauth_policy set mode='block_new_google';")
for metadata in [{},{'captcha_verified':True,'turnstile_verified':True,'provider':'email'},{'oauth_grant':'invented','pkce_verifier':'invented','email':'trusted@example.test'}]:assert hook(metadata=metadata)['error']['http_code']==403
assert hook('email')=={};assert hook('apple')=={}
for event in ['null','{}','{"user":{"app_metadata":{},"user_metadata":{"provider":"google"}}}']:
 assert json.loads(sql('select public.divzplit_before_user_created('+quote(event)+'::jsonb);','supabase_auth_admin'))['error']['http_code']==400
# Reinstalling must not silently loosen an operator-selected restrictive mode.
sql((ROOT/'supabase/oauth-abuse.sql').read_text());assert sql('select mode from divzplit_security.oauth_policy')=='block_new_google'
sql("update divzplit_security.oauth_policy set mode='observe';");assert hook()=={}
print('PASS: idempotent inactive install, private/service-only access, atomic replay reservation, per-flow limits, expiry cleanup, spoofed metadata ignored, optional Google restriction, other providers and manual rollback')
