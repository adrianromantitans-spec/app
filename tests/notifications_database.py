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

OWNER,FRIEND,OTHER=[str(uuid.uuid4()) for _ in range(3)]
for actor in [OWNER,FRIEND,OTHER]:sql('insert into auth.users values ('+literal(actor)+','+literal(json.dumps({'display_name':'Test'}))+')',role=None)
sql('truncate public.divzplit_push_jobs',role=None)
sql('update public.divzplit_push_config set enabled=false,public_key=null',role=None)
row=json.loads(rpc('nexo_create_group',[document({'name':'Avisos','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':100000,'requestId':str(uuid.uuid4())})],OWNER))
gid=row['id'];invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
for actor in [FRIEND,OTHER]:row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],actor))
def inbox(actor):return json.loads(rpc('divzplit_notification_inbox',[],actor))
def settings(actor,expenses=True,muted=None):return rpc('divzplit_set_notification_settings',[str(expenses).lower(),'true','true','true',("array["+literal(gid)+"::uuid]") if muted else "array[]::uuid[]"],actor)
def expense():
 global row
 doc=row['document'];doc['expenses'].append({'id':str(uuid.uuid4()),'title':'Cena','amount':1000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-11-01','createdBy':OWNER});row=save(row,doc,OWNER)
expense()
assert inbox(OWNER)['unread']==0 and inbox(FRIEND)['unread']==1 and inbox(OTHER)['unread']==1
assert inbox(FRIEND)['items'][0]['subject']=='Cena'
friend_id=inbox(FRIEND)['items'][0]['id']
rpc('divzplit_open_notification',[literal(friend_id)],OWNER,'NEXO_FORBIDDEN')
rpc('divzplit_read_notifications',["array["+literal(friend_id)+"::uuid]"],OWNER)
assert inbox(FRIEND)['unread']==1
rpc('divzplit_open_notification',[literal(friend_id)],FRIEND)
assert inbox(FRIEND)['unread']==0
print('PASS: no self notifications; inbox and read operations are isolated by account')
settings(FRIEND,expenses=False);settings(OTHER,muted=True)
expense();assert inbox(FRIEND)['unread']==0 and inbox(OTHER)['unread']==1
settings(FRIEND);settings(OTHER)
before_friend=inbox(FRIEND)['unread'];before_other=inbox(OTHER)['unread']
doc=row['document'];doc['tasks'].append({'id':'task','title':'Reservar','assignee':FRIEND,'done':False});row=save(row,doc,OWNER)
assert inbox(FRIEND)['unread']==before_friend+1 and inbox(OTHER)['unread']==before_other
doc=row['document'];doc['tasks'][0]['done']=True;row=save(row,doc,OWNER)
assert inbox(FRIEND)['unread']==before_friend+1
doc=row['document'];doc['tasks'][0]['assignee']=OTHER;row=save(row,doc,OWNER)
assert inbox(OTHER)['unread']==before_other+1
before_friend=inbox(FRIEND)['unread'];before_other=inbox(OTHER)['unread']
doc=row['document'];doc['polls'].append({'id':'poll','title':'Plan del sábado','description':'','options':[{'id':'a','label':'Cena'},{'id':'b','label':'Cine'}],'votes':{}});row=save(row,doc,OWNER)
assert inbox(FRIEND)['unread']==before_friend+1 and inbox(OTHER)['unread']==before_other+1
print('PASS: category preferences, muted groups, task targeting and reassignment work')
endpoint='https://fcm.googleapis.com/fcm/send/fixture-'+str(uuid.uuid4())
def register(actor,url=endpoint):return rpc('divzplit_register_push',[literal(url),literal('A'*87),literal('A'*22),literal('es')],actor)
register_failed=lambda:rpc('divzplit_register_push',[literal(endpoint),literal('A'*87),literal('A'*22),literal('es')],FRIEND,'NEXO_PUSH_NOT_READY')
register_failed()
sql("update public.divzplit_push_config set enabled=true,public_key='"+'A'*87+"'",role=None)
for url in ['https://127.0.0.1/private','http://fcm.googleapis.com/a','https://fcm.googleapis.com.evil.test/a','https://user:pass@fcm.googleapis.com/a']:
 rpc('divzplit_register_push',[literal(url),literal('A'*87),literal('A'*22),literal('es')],FRIEND,'NEXO_FORBIDDEN')
register(FRIEND)
rpc('divzplit_register_push',[literal(endpoint),literal('B'*87),literal('B'*22),literal('es')],OWNER,'NEXO_FORBIDDEN')
for table in ['divzplit_notifications','divzplit_push_subscriptions','divzplit_push_jobs','divzplit_push_config']:
 sql('select * from public.'+table,FRIEND,fail='permission denied')
rpc('divzplit_claim_push',[],FRIEND,'permission denied')
expense()
def claim():return json.loads(sql('select public.divzplit_claim_push(20)',role='service_role'))
def finish(job,status,retry=False,disable=False,lease=None):
 return sql('select public.divzplit_finish_push('+','.join([literal(job['id']),literal(lease or job['lease']),str(status),str(retry).lower(),str(disable).lower()])+')',role='service_role')
jobs=claim();assert len(jobs)==1 and jobs[0]['user_id']==FRIEND
assert claim()==[]
assert finish(jobs[0],201,lease=str(uuid.uuid4()))=='f'
assert finish(jobs[0],503,retry=True)=='t'
assert claim()==[]
sql("update public.divzplit_push_jobs set next_attempt_at=now() where id="+literal(jobs[0]['id']),role=None)
job=claim()[0];assert job['attempts']==2
assert finish(job,410,disable=True)=='t'
assert sql("select enabled from public.divzplit_push_subscriptions where endpoint="+literal(endpoint),role=None)=='f'
print('PASS: provider endpoint restrictions, private subscription keys, worker permissions, leases, backoff and expired endpoints')
register(FRIEND);expense();register(OWNER)
assert claim()==[]
# Rebinding the same device never delivers the previous account's jobs.
assert sql("select count(*) from public.divzplit_push_jobs where status='pending'",role=None)=='0'
register(FRIEND);expense();rpc('divzplit_read_notifications',[],FRIEND)
assert claim()==[]
register(FRIEND);expense();settings(FRIEND,muted=True)
assert claim()==[]
print('PASS: account rebinding, read notifications and newly muted groups discard queued pushes')
settings(FRIEND)
# Pagination uses stable timestamps and IDs, including equal timestamps.
for _ in range(32):expense()
first=inbox(FRIEND);assert len(first['items'])==30 and first['next']
second=json.loads(rpc('divzplit_notification_inbox',[literal(first['next']['created_at']),literal(first['next']['id'])],FRIEND))
assert not ({n['id'] for n in first['items']}&{n['id'] for n in second['items']})
old_count=sql("select count(*) from public.divzplit_notifications where user_id="+literal(FRIEND),role=None)
row_n=sql("select event_id from public.divzplit_notifications where user_id="+literal(FRIEND)+" and event_id is not null limit 1",role=None)
rpc('divzplit_delete_history',[literal(gid),literal(row_n)],OWNER)
assert sql("select count(*) from public.divzplit_notifications where user_id="+literal(FRIEND),role=None)==old_count
sql((ROOT/'supabase/notifications.sql').read_text(),role=None)
assert sql("select count(*) from public.divzplit_notifications where user_id="+literal(FRIEND),role=None)==old_count
print('PASS: pagination, history-independent inbox and repeatable activation preserve data')
