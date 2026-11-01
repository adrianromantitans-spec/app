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


from datetime import datetime,timedelta,timezone
sql((ROOT/'supabase/planning.sql').read_text(),role=None)
OWNER,FRIEND,OTHER,OUTSIDER=[str(uuid.uuid4()) for _ in range(4)]
for actor in [OWNER,FRIEND,OTHER,OUTSIDER]:sql('insert into auth.users values ('+literal(actor)+",'{}')",role=None)
fields={'name':'Casa sin límite','type':'Convivencia','emoji':'🏠','place':'','date':'','endDate':'','requestId':str(uuid.uuid4())}
row=json.loads(rpc('nexo_create_group',[document(fields)],OWNER));gid=row['id'];assert row['document']['budget']==0
invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
for actor in [FRIEND,OTHER]:row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],actor))
def latest():return json.loads(sql('select row_to_json(g) from public.nexo_groups g where id='+literal(gid),OWNER))
def action(kind,op,item={},actor=OWNER,fail=None,version=None):
 return rpc('divzplit_plan_action',[literal(gid),str(latest()['version'] if version is None else version),literal(kind),literal(op),document(item)],actor,fail)
def remind(kind,i,actor=OWNER,fail=None):return rpc('divzplit_remind_plan',[literal(gid),literal(kind),literal(i)],actor,fail)
def inbox(actor):return json.loads(rpc('divzplit_notification_inbox',[],actor))['items']
def count_reminders(actor):return len([n for n in inbox(actor) if n['kind'].endswith('.reminder')])
def clock(delta):return (datetime.now(timezone.utc)+delta).isoformat(timespec='milliseconds').replace('+00:00','Z')
due=clock(timedelta(days=3));scheduled=clock(timedelta(days=2))
for budget in [0,10000,0]:
 row=latest();doc=row['document'];doc['budget']=budget;row=save(row,doc,OWNER);assert row['document']['budget']==budget
for budget in [-1,1,99,0.5]:
 row=latest();doc=row['document'];doc['budget']=budget;save(row,doc,OWNER,'Invalid group fields')
row=latest();doc=row['document'];doc['budget']=100;save(row,doc,FRIEND,'NEXO_OWNER')
print('PASS: absent or blank budgets create zero-limit groups; admins can add/remove budgets, invalid amounts and non-owner edits fail')
task={'id':'task','title':'Revisar factura <b>luz</b>','assignee':OTHER,'dueAt':due,'remindAt':scheduled,'important':True}
action('tasks','save',task,FRIEND);task=latest()['document']['tasks'][0];assert task['createdBy']==FRIEND and task['done']==False
poll={'id':'poll','title':'¿Qué día?','description':'Reunión','options':[{'id':'a','label':'Lunes'},{'id':'b','label':'Martes'}],'dueAt':due,'remindAt':scheduled,'important':True}
action('polls','save',poll,FRIEND);poll=latest()['document']['polls'][0];assert poll['votes']=={}
for kind,item in [('tasks',task),('polls',poll)]:
 action(kind,'delete',{'id':item['id']},OTHER,'NEXO_FORBIDDEN');action(kind,'clear',actor=FRIEND,fail='NEXO_OWNER');action(kind,'save',{**item,'title':'Forged'},OTHER,'NEXO_FORBIDDEN')
 action(kind,'delete',item,OUTSIDER,'NEXO_FORBIDDEN')
 action(kind,'save',{**item,'dueAt':'invalid'},FRIEND,'NEXO_PLAN_FIELDS')
 action(kind,'save',{**item,'remindAt':due},FRIEND,'NEXO_PLAN_FIELDS')
 action(kind,'save',{**item,'dueAt':clock(timedelta(days=-1)),'remindAt':''},FRIEND,'NEXO_PLAN_PAST')
 action(kind,'save',{**item,'important':'yes'},FRIEND,'NEXO_PLAN_FIELDS')
# All existing votes survive editing a question or scheduling changes.
row=latest();doc=row['document'];doc['polls'][0]['votes'][OTHER]='a';save(row,doc,OTHER)
action('polls','save',{'id':'poll','title':'¿Qué día nos reunimos?','options':[{'id':'forged','label':'Invalid'}],'votes':{}},FRIEND)
assert latest()['document']['polls'][0]['votes']=={OTHER:'a'}
assert latest()['document']['polls'][0]['options']==poll['options']
# Normal task completion remains available to members, but authorship cannot be forged.
row=latest();doc=row['document'];doc['tasks'][0]['done']=True;save(row,doc,OTHER)
remind('tasks','task',FRIEND,'NEXO_PLAN_FINISHED')
row=latest();doc=row['document'];doc['tasks'][0]['done']=False;save(row,doc,OTHER)
row=latest();doc=row['document'];doc['tasks'][0]['createdBy']=OTHER;save(row,doc,OTHER,'NEXO_FORBIDDEN')
action('tasks','save',{'id':'task','title':'Revisar luz'},FRIEND)
print('PASS: creator/admin editing and deletion, admin-only bulk deletion, exact vote preservation and deadlines validated on server')
for fn,args in [('divzplit_run_plan_reminders',''),('divzplit_deliver_plan_reminder',literal(gid)+",'tasks','{}'::jsonb,"+literal(OWNER)),('divzplit_plan_action',literal(gid)+",1,'tasks','clear','{}'::jsonb")]:
 sql('select public.'+fn+'('+args+')',OWNER if fn!='divzplit_plan_action' else None,role='authenticated' if fn!='divzplit_plan_action' else 'anon',fail='permission denied')
remind('tasks','task',OTHER,'NEXO_FORBIDDEN');before=latest()
counts={a:count_reminders(a) for a in [OWNER,FRIEND,OTHER]}
assert remind('tasks','task',FRIEND)=='2' and latest()==before
assert count_reminders(FRIEND)==counts[FRIEND]
for actor in [OWNER,OTHER]:assert count_reminders(actor)==counts[actor]+1
assert any(n['subject'].startswith('❗ ') for n in inbox(OWNER) if n['kind']=='tasks.reminder')
remind('tasks','task',FRIEND,'NEXO_REMINDER_WAIT')
# Scheduled jobs run once and respect category preferences and group mutes.
rpc('divzplit_set_notification_settings',['true','false','true','true',"array[]::uuid[]"],OWNER)
rpc('divzplit_set_notification_settings',['true','true','true','true',"array["+literal(gid)+"::uuid]"],OTHER)
def inject(kind,i,**changes):
 row=latest();doc=row['document'];item=next(x for x in doc[kind] if x['id']==i);item.update(changes)
 sql('update public.nexo_groups set document='+document(doc)+' where id='+literal(gid),role=None)
past=clock(timedelta(minutes=-1));inject('polls','poll',remindAt=past)
counts={a:count_reminders(a) for a in [OWNER,FRIEND,OTHER]}
# Only the sender remains, so preferences suppress every delivery, but the occurrence is still consumed.
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='0'
for actor in counts:assert count_reminders(actor)==counts[actor]
assert sql('select scheduled_at is not null from public.divzplit_plan_reminders where group_id='+literal(gid)+" and kind='polls'",role=None)=='t'
# Same item ID in another collection must not suppress its scheduled occurrence.
inject('tasks','task',remindAt=past)
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='1'
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='0'
# Identical IDs in tasks and polls are independent, even with concurrent workers.
action('tasks','save',{**task,'id':'poll','createdBy':FRIEND,'remindAt':scheduled},FRIEND)
inject('tasks','poll',remindAt=past)
with ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda _:int(sql('select public.divzplit_run_plan_reminders()',role=None)),range(2)))
assert sum(results)==1
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='0'
# Completed tasks suppress a newly due occurrence.
inject('tasks','task',done=True,remindAt=clock(timedelta(seconds=-30)))
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='0'
# Completing/deleting entries suppresses future reminders; expired polls reject votes.
inject('polls','poll',dueAt=clock(timedelta(seconds=-1)))
row=latest();doc=row['document'];doc['polls'][0]['votes'][OWNER]='b';save(row,doc,OWNER,'NEXO_POLL_CLOSED')
remind('polls','poll',FRIEND,'NEXO_PLAN_FINISHED')
inject('polls','poll',remindAt=clock(timedelta(seconds=-30)))
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='0'
financial={k:latest()['document'][k] for k in ['expenses','payments','budget','members']}
action('tasks','clear');action('polls','clear')
assert latest()['document']['tasks']==[] and latest()['document']['polls']==[]
assert {k:latest()['document'][k] for k in financial}==financial
assert sql('select public.divzplit_run_plan_reminders()',role=None)=='0'
print('PASS: manual and scheduled reminders, cooldown, no self-alerts, preferences/mutes, idempotency, closed-poll enforcement and no financial mutation')
before=latest();sql((ROOT/'supabase/planning.sql').read_text(),role=None);assert latest()==before
print('PASS: migration reruns safely without deleting or scheduling existing entries')
