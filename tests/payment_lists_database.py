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


sql((ROOT/'supabase/payment-lists.sql').read_text(),role=None)
OWNER,FRIEND,OTHER=[str(uuid.uuid4()) for _ in range(3)]
for actor in [OWNER,FRIEND,OTHER]:sql('insert into auth.users values ('+literal(actor)+",'{}')",role=None)
row=json.loads(rpc('nexo_create_group',[document({'name':'Listas de pagos','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':100000,'requestId':str(uuid.uuid4())})],OWNER));gid=row['id']
invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER))
for actor in [FRIEND,OTHER]:row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],actor))
doc=row['document'];doc['expenses']=[{'id':'debt','title':'Cena','amount':100000,'payer':OTHER,'participants':[FRIEND,OTHER],'category':'Comida','date':'2026-11-01','createdBy':OWNER}]
row=save(row,doc,OWNER)
def latest():return json.loads(sql('select row_to_json(g) from public.nexo_groups g where id='+literal(gid),OWNER))
def request():
 rid=str(uuid.uuid4());rpc('divzplit_request_payment',[literal(gid),str(latest()['version']),literal(rid),literal(OTHER),'100',literal('EUR')],FRIEND);return rid
def cancel(actor=OWNER,fail=None):return rpc('divzplit_cancel_pending_payments',[literal(gid)],actor,fail)
def archive(actor=OWNER,fail=None):return rpc('divzplit_archive_repayments',[literal(gid)],actor,fail)
def ids(actor=OWNER):return json.loads(rpc('divzplit_get_payment_archives',[literal(gid)],actor))
confirmed=request();rpc('divzplit_respond_payment',[literal(gid),literal(confirmed),literal('confirm')],OTHER)
pending=request();before=latest()
for actor in [FRIEND,OTHER,None]:cancel(actor,'NEXO_OWNER');archive(actor,'NEXO_OWNER')
for fn in ['divzplit_cancel_pending_payments','divzplit_archive_repayments','divzplit_get_payment_archives']:
 sql('select public.'+fn+'('+literal(gid)+')',role='anon',fail='permission denied')
assert cancel()=='1' and latest()==before
assert cancel()=='0' and latest()==before
assert sql('select status from public.divzplit_payment_requests where id='+literal(pending),OWNER)=='cancelled'
for actor in [FRIEND,OTHER]:
 assert sql('select count(*) from public.divzplit_notifications where user_id='+literal(actor)+" and kind='payment.cancelled' and group_id="+literal(gid),role=None)=='1'
assert sql('select count(*) from public.divzplit_notifications where user_id='+literal(OWNER)+" and kind='payment.cancelled' and group_id="+literal(gid),role=None)=='0'
# The full reservation is released; a new request can subsequently be confirmed.
fresh=request();rpc('divzplit_respond_payment',[literal(gid),literal(fresh),literal('confirm')],OTHER)
before=latest();assert archive()=='2' and len(ids(FRIEND))==2 and archive()=='0' and latest()==before
before=latest();assert archive()=='0' and latest()==before
fresh=request();rpc('divzplit_respond_payment',[literal(gid),literal(fresh),literal('confirm')],OTHER)
assert fresh not in ids() and len(latest()['document']['payments'])==3
# Archive every page of old imported repayments without changing their ledger.
before=latest();doc=before['document']
for i in range(65):doc['payments'].append({'id':'legacy-'+str(i),'from':FRIEND,'to':OTHER,'amount':1,'date':'2026-11-01'})
sql('update public.nexo_groups set document='+document(doc)+' where id='+literal(gid),role=None)
before=latest();assert archive()=='66' and len(ids())==68 and latest()==before
# Muting applies to the explicit sender notice as well as the recipient trigger.
rpc('divzplit_set_notification_settings',['true','true','true','true',"array["+literal(gid)+"::uuid]"],FRIEND)
request();count=sql('select count(*) from public.divzplit_notifications where user_id='+literal(FRIEND),role=None)
assert cancel()=='1';assert sql('select count(*) from public.divzplit_notifications where user_id='+literal(FRIEND),role=None)==count
before=latest();archived=ids();sql((ROOT/'supabase/payment-lists.sql').read_text(),role=None)
assert latest()==before and ids()==archived
print('PASS: owner-only atomic cancellation, both parties notified, mute respected, idempotent archival across all pages, unchanged financial ledger and fresh confirmations visible')
# A simultaneous recipient confirmation and administrator clear share the group lock.
rid=request();before=latest()
def confirm_racing():
 try:return rpc('divzplit_respond_payment',[literal(gid),literal(rid),literal('confirm')],OTHER)
 except AssertionError as error:
  assert 'NEXO_PAYMENT_CHANGED' in str(error);return None
with ThreadPoolExecutor(max_workers=2) as pool:
 a=pool.submit(cancel);b=pool.submit(confirm_racing);a.result();b.result()
status=sql('select status from public.divzplit_payment_requests where id='+literal(rid),OWNER)
rows=[p for p in latest()['document']['payments'] if p['id']==rid]
assert (status=='confirmed' and len(rows)==1) or (status=='cancelled' and not rows)
if status=='cancelled':assert latest()==before
# Archive reads require group membership, even for an owner of another group.
outsider=str(uuid.uuid4());sql('insert into auth.users values ('+literal(outsider)+",'{}')",role=None)
rpc('divzplit_get_payment_archives',[literal(gid)],outsider,'NEXO_FORBIDDEN')
foreign=json.loads(rpc('nexo_create_group',[document({'name':'Otro','type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':100000,'requestId':str(uuid.uuid4())})],OWNER))
assert json.loads(rpc('divzplit_get_payment_archives',[literal(foreign['id'])],OWNER))==[]
assert rpc('divzplit_cancel_pending_payments',[literal(foreign['id'])],OWNER)=='0'
print('PASS: concurrent cancellation and confirmation serialize correctly; archive data is group-scoped and member-only')
