"""Real PostgreSQL integration tests (isolated container; no public network).

Requires an existing disposable postgres container, default nexo-postgres-tests.
Never point this at production: it creates a local auth fixture and three users.
Run: npm run test:database
"""
import json
import os
from pathlib import Path
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = os.environ.get('NEXO_TEST_CONTAINER', 'nexo-postgres-tests')
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']

def sql(text, actor=None, role='authenticated', fail=None):
    prefix = '' if role is None else f"set role {role}; set request.jwt.claim.sub='{actor or ''}';\n"
    result = subprocess.run(DOCKER + ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tAq'],
                            input=prefix+text, text=True, capture_output=True)
    if fail:
        assert result.returncode != 0 and fail in result.stderr, (fail, result.stdout, result.stderr)
        return
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def rpc(name, args, actor, fail=None):
    return sql('select public.' + name + '(' + ','.join(args) + ');', actor, fail=fail)

def document(value):
    return literal(json.dumps(value, ensure_ascii=False)) + '::jsonb'

def save(row, doc, actor, fail=None):
    value=rpc('nexo_save_group', [literal(row['id'])+'::uuid', str(row['version']), document(doc)], actor, fail)
    return json.loads(value) if value else None

OWNER='11111111-1111-4111-8111-111111111111'
FRIEND='22222222-2222-4222-8222-222222222222'
STRANGER='33333333-3333-4333-8333-333333333333'

sql("""
do $$ begin
 if not exists(select from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111','{"display_name":"Ana"}'),
 ('22222222-2222-4222-8222-222222222222','{"display_name":"Luis"}'),
 ('33333333-3333-4333-8333-333333333333','{"display_name":"Eva"}')
on conflict(id) do nothing;
""", role=None)
sql((ROOT/'supabase/schema.sql').read_text(), role=None)
print('PASS: complete migration executes on PostgreSQL')
sql((ROOT/'supabase/schema.sql').read_text(), role=None)
print('PASS: migration can be rerun without deleting data')

fields={'name':'Viaje real','type':'Viaje','emoji':'🌴','place':'Lisboa','date':'2027-06-12','endDate':'2027-06-15','budget':100000,'requestId':str(uuid.uuid4())}
row=json.loads(rpc('nexo_create_group',[document(fields)],OWNER))
gid=row['id']
retried=json.loads(rpc('nexo_create_group',[document(fields)],OWNER))
assert retried['id']==gid and retried['version']==1
rpc('nexo_create_group',[document(fields)],STRANGER,'NEXO_FORBIDDEN')
print('PASS: retrying a group creation is idempotent and cannot expose another owner’s group')
assert row['document']['members'][0]['id']==OWNER
assert row['document']['members'][0]['name']=='Ana'
assert sql(f"select count(*) from public.nexo_groups where id={literal(gid)};",OWNER)=='1'
assert sql(f"select count(*) from public.nexo_groups where id={literal(gid)};",STRANGER)=='0'
assert sql(f"select count(*) from public.nexo_members where group_id={literal(gid)};",STRANGER)=='0'
sql('select * from public.nexo_groups;', role='anon', fail='permission denied')
sql(f"update public.nexo_groups set version=999 where id={literal(gid)};",OWNER,fail='permission denied')
sql('select * from public.nexo_invites;',OWNER,fail='permission denied')
print('PASS: RLS isolates groups and membership; direct writes/invite reads are denied')

rpc('nexo_save_group',[literal(gid),str(row['version']),document(row['document'])],STRANGER,'NEXO_FORBIDDEN')
rpc('nexo_create_invite',[literal(gid)],STRANGER,'NEXO_OWNER')
rpc('nexo_create_group',[document(fields)],None,'NEXO_FORBIDDEN')
invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
assert len(invite['token'])==64
row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
assert len(row['document']['members'])==2
assert row['version']==2
again=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
assert again['version']==row['version']
assert sql(f"select count(*) from public.nexo_groups where id={literal(gid)};",FRIEND)=='1'
print('PASS: valid invitation joins a second account exactly once')

rpc('nexo_create_invite',[literal(gid)],FRIEND,'NEXO_OWNER')
rpc('nexo_revoke_invites',[literal(gid)],FRIEND,'NEXO_OWNER')
bad={**row['document'],'members':row['document']['members'][:1]}
save(row,bad,OWNER,'NEXO_FORBIDDEN')
bad={**row['document'],'budget':50000}
save(row,bad,FRIEND,'NEXO_OWNER')
print('PASS: members cannot change owner-only fields, membership or invitation settings')

doc=row['document']
doc['expenses']=[{'id':'expense-1','title':'Cena','amount':1001,'payer':OWNER,
                  'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-10-30','createdBy':OWNER}]
doc['tasks']=[{'id':'task-1','title':'Reservar museo','assignee':FRIEND,'done':False}]
doc['polls']=[{'id':'poll-1','title':'¿Qué hacemos?','description':'Plan del sábado',
               'options':[{'id':'a','label':'Playa'},{'id':'b','label':'Museo'}],'votes':{OWNER:'a'}}]
previous=row
row=save(row,doc,OWNER)
save(previous,doc,OWNER,'NEXO_CONFLICT')
print('PASS: exact-cent expense, task and poll save; stale revisions are rejected')

doc=json.loads(json.dumps(row['document']))
doc['polls'][0]['votes'][OWNER]='b'
save(row,doc,FRIEND,'NEXO_FORBIDDEN')
doc['polls'][0]['votes'][OWNER]='a'
doc['polls'][0]['votes'][FRIEND]='b'
doc['tasks'][0]['done']=True
row=save(row,doc,FRIEND)
assert row['document']['polls'][0]['votes']=={OWNER:'a',FRIEND:'b'}
print('PASS: a member can complete tasks and vote, but cannot alter somebody else’s vote')

doc=json.loads(json.dumps(row['document']))
doc['expenses']=[]
save(row,doc,FRIEND,'NEXO_FORBIDDEN')
doc=json.loads(json.dumps(row['document']))
doc['expenses'][0]['participants']=[OWNER,OWNER]
save(row,doc,OWNER,'Invalid expense participants')
doc['expenses'][0]['participants']=[STRANGER]
save(row,doc,OWNER,'Invalid expense participants')
doc['expenses'][0]['participants']=[OWNER]
doc['expenses'][0]['amount']=1.1
save(row,doc,OWNER,'Invalid expense')
print('PASS: expense authorship, duplicate/foreign participants and fractional cents are enforced')

doc=json.loads(json.dumps(row['document']))
doc['payments']=[{'id':'payment-1','from':FRIEND,'to':OWNER,'amount':500,'date':'2026-10-30'}]
row=save(row,doc,FRIEND)
doc={**row['document'],'payments':[]}
save(row,doc,OWNER,'NEXO_FORBIDDEN')
print('PASS: involved parties can confirm repayments; recorded payments are append-only')

rpc('nexo_join_group',[literal('0'*64)],STRANGER,'NEXO_INVITE')
rpc('nexo_join_group',[literal('invalid')],STRANGER,'NEXO_INVITE')
replacement=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
rpc('nexo_join_group',[literal(invite['token'])],STRANGER,'NEXO_INVITE')
rpc('nexo_revoke_invites',[literal(gid)],OWNER)
rpc('nexo_join_group',[literal(replacement['token'])],STRANGER,'NEXO_INVITE')
expired=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
sql(f"update public.nexo_invites set expires_at=now()-interval '1 second' where group_id={literal(gid)};",role=None)
rpc('nexo_join_group',[literal(expired['token'])],STRANGER,'NEXO_INVITE')
used=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
sql(f"update public.nexo_invites set uses=max_uses where group_id={literal(gid)};",role=None)
rpc('nexo_join_group',[literal(used['token'])],STRANGER,'NEXO_INVITE')
print('PASS: invalid, rotated, revoked, expired and exhausted invitations are rejected')

def race_save(_):
    doc={**row['document'],'budget':120000}
    query=f"set role authenticated;set request.jwt.claim.sub={literal(OWNER)};select public.nexo_save_group({literal(gid)}, {row['version']}, {document(doc)});"
    return subprocess.run(DOCKER+['exec','-i',CONTAINER,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAq'],
                          input=query,text=True,capture_output=True)
with ThreadPoolExecutor(max_workers=2) as pool:
    competing=list(pool.map(race_save,[1,2]))
assert sum(r.returncode==0 for r in competing)==1
assert sum('NEXO_CONFLICT' in r.stderr for r in competing)==1
print('PASS: competing database connections yield one successful save and one conflict')

# Clean just this run's group, leaving no invitation tokens in console output.
sql(f"delete from public.nexo_groups where id={literal(gid)};",role=None)
print('PASS: real PostgreSQL integration checks complete')
