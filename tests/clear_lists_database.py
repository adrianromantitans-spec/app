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
def create(actor,name):return json.loads(rpc('nexo_create_group',[document({'name':name,'type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':100000,'requestId':str(uuid.uuid4())})],actor))
row=create(OWNER,'Borrado del historial');gid=row['id'];other=create(OWNER,'Otro grupo');other_gid=other['id']
invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER));row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
doc=row['document']
for i in range(60):doc['expenses'].append({'id':str(uuid.uuid4()),'title':'Gasto '+str(i),'amount':1000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-11-01','createdBy':OWNER})
row=save(row,doc,OWNER)
payment=str(uuid.uuid4());rpc('divzplit_request_payment',[literal(gid),str(row['version']),literal(payment),literal(OWNER),'500',literal('EUR')],FRIEND)
row=json.loads(rpc('divzplit_respond_payment',[literal(gid),literal(payment),literal('confirm')],OWNER))
def current():return json.loads(sql('select row_to_json(g) from public.nexo_groups g where id='+literal(gid),OWNER))
def count(table,where):return int(sql('select count(*) from public.'+table+' where '+where,role=None))
history_count=count('divzplit_history','group_id='+literal(gid));assert history_count>50
other_history=count('divzplit_history','group_id='+literal(other_gid));financial=current()
friend_notifications=count('divzplit_notifications','user_id='+literal(FRIEND))
rpc('divzplit_clear_history',[literal(gid)],FRIEND,'NEXO_OWNER')
rpc('divzplit_clear_history',[literal(gid)],OTHER,'NEXO_OWNER')
rpc('divzplit_clear_history',[literal(gid)],None,'NEXO_OWNER')
assert count('divzplit_history','group_id='+literal(gid))==history_count
removed=rpc('divzplit_clear_history',[literal(gid)],OWNER)
assert int(removed)==history_count
assert count('divzplit_history','group_id='+literal(gid))==0
assert count('divzplit_history','group_id='+literal(other_gid))==other_history
assert count('divzplit_notifications','user_id='+literal(FRIEND))==friend_notifications
assert current()==financial and len(financial['document']['payments'])==1
assert rpc('divzplit_clear_history',[literal(gid)],OWNER)=='0'
print('PASS: only the administrator clears all history, including older pages; other groups and all financial data stay intact')
# A later real group change still records history and generates a notice.
sql("update public.divzplit_push_config set enabled=true,public_key='"+'A'*87+"'",role=None)
endpoint='https://fcm.googleapis.com/fcm/send/'+str(uuid.uuid4())
rpc('divzplit_register_push',[literal(endpoint),literal('A'*87),literal('A'*22),literal('es')],OWNER)
doc=row['document'];doc['expenses'].append({'id':str(uuid.uuid4()),'title':'Nuevo gasto','amount':100,'payer':FRIEND,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-11-01','createdBy':FRIEND});row=save(row,doc,FRIEND)
assert count('divzplit_history','group_id='+literal(gid))==1
settings=rpc('divzplit_set_notification_settings',['true','true','true','true',"array["+literal(gid)+"::uuid]"],OWNER)
notifications=count('divzplit_notifications','user_id='+literal(OWNER));assert notifications>0
friend_notifications=count('divzplit_notifications','user_id='+literal(FRIEND))
queued=int(sql('select count(*) from public.divzplit_push_jobs j join public.divzplit_notifications n on n.id=j.notification_id where n.user_id='+literal(OWNER),role=None));assert queued>0
financial=current();subscriptions=sql('select jsonb_agg(s) from public.divzplit_push_subscriptions s where user_id='+literal(OWNER),role=None)
rpc('divzplit_clear_notifications',[],None,'NEXO_FORBIDDEN')
removed=int(rpc('divzplit_clear_notifications',[],OWNER));assert removed==notifications
assert count('divzplit_notifications','user_id='+literal(OWNER))==0
assert count('divzplit_notifications','user_id='+literal(FRIEND))==friend_notifications
assert current()==financial
assert rpc('divzplit_get_notification_settings',[],OWNER)==settings
assert sql('select jsonb_agg(s) from public.divzplit_push_subscriptions s where user_id='+literal(OWNER),role=None)==subscriptions
assert int(sql('select count(*) from public.divzplit_push_jobs j join public.divzplit_notifications n on n.id=j.notification_id where n.user_id='+literal(OWNER),role=None))==0
assert rpc('divzplit_clear_notifications',[],OWNER)=='0'
sql('select public.divzplit_clear_notifications()',role='anon',fail='permission denied')
print('PASS: notification clear is account-scoped, removes queued deliveries, and keeps preferences, subscriptions and finances')
before=current();sql((ROOT/'supabase/clear-lists.sql').read_text(),role=None);assert current()==before
assert count('divzplit_history','group_id='+literal(gid))==1
print('PASS: new history continues after clearing; activating the migration never deletes existing entries')
