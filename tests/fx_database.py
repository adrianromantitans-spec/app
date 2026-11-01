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


sql((ROOT/'supabase/exchange-rates.sql').read_text(),role=None)
OWNER,FRIEND,OTHER=[str(uuid.uuid4()) for _ in range(3)]
for actor in [OWNER,FRIEND,OTHER]:sql('insert into auth.users values ('+literal(actor)+",'{}')",role=None)
def create(currency):
 return json.loads(rpc('nexo_create_group',[document({'name':'Viaje '+currency,'type':'Viaje','emoji':'🌴','place':'','date':'','endDate':'','budget':0,'currency':currency,'requestId':str(uuid.uuid4())})],OWNER))
for currency in ['EUR','RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP']:
 row=create(currency);assert row['document']['currency']==currency
for currency in ['ZZZ','BTC','JPY']:
 try:create(currency);raise RuntimeError('unsupported currency accepted')
 except AssertionError as error:assert 'NEXO_CURRENCY' in str(error)
row=create('CZK');gid=row['id'];invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER));row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
doc=row['document'];doc['expenses']=[{'id':'dinner','title':'Cena','amount':10000,'payer':OWNER,'createdBy':OWNER,'participants':[OWNER,FRIEND],'date':'2026-11-01','category':'Comida'}];row=save(row,doc,OWNER)
def latest():return json.loads(sql('select row_to_json(g) from public.nexo_groups g where id='+literal(gid),OWNER))
def issue(actor=FRIEND,currency='CZK',rate='25',role='service_role',fail=None):
 value=sql('select public.divzplit_issue_fx_quote('+literal(actor)+','+literal(currency)+','+rate+',current_date,'+literal('ECB')+');',role=role,fail=fail)
 return json.loads(value) if value else None
def pay(q,rid=None,amount=5000,eur=200,actor=FRIEND,fail=None,version=None):
 return rpc('divzplit_request_payment_eur',[literal(gid),str(latest()['version'] if version is None else version),literal(rid or str(uuid.uuid4())),literal(OWNER),str(amount),literal(latest()['document']['currency']),literal(q['id']),str(eur)],actor,fail)
for role in ['anon','authenticated']:issue(role=role,fail='permission denied')
for rate in ['0','-1',"'NaN'::numeric"]:issue(rate=rate,fail='NEXO_FX_RATE')
sql('select * from public.divzplit_fx_quotes',FRIEND,fail='permission denied')
q=issue();pay(q,actor=OTHER,fail='NEXO_FORBIDDEN');pay(issue(OWNER),fail='NEXO_FX_EXPIRED')
pay(q,amount=1,eur=0,fail='NEXO_FX_AMOUNT');pay(q,eur=201,fail='NEXO_FX_AMOUNT');pay(q,version=0,fail='NEXO_CONFLICT')
sql('update public.divzplit_fx_quotes set expires_at=clock_timestamp()-interval '+literal('1 second')+' where id='+literal(q['id']),role=None)
pay(q,fail='NEXO_FX_EXPIRED')
print('PASS: all European national currencies and USD are accepted; unsupported currencies, forged/expired quotes, foreign users and altered EUR amounts fail')
q=issue();rid=str(uuid.uuid4());before=latest()
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:json.loads(pay(q,rid)),range(2)))
assert results[0]['id']==results[1]['id']==rid and results[0]['fx']['amount']==200
assert latest()==before
assert int(sql('select count(*) from public.divzplit_history where group_id='+literal(gid)+" and kind='payment.requested'",OWNER))==1
# Existing reservations apply across EUR and original-currency requests.
rpc('divzplit_request_payment',[literal(gid),str(latest()['version']),literal(str(uuid.uuid4())),literal(OWNER),'5000',literal('CZK')],FRIEND,'NEXO_PAYMENT_CHANGED')
issue(rate='30')
sql('delete from public.divzplit_fx_quotes where user_id='+literal(FRIEND),role=None)
# Retrying a committed request remains idempotent even after its quote expires or is purged.
assert json.loads(pay(q,rid))['fx']['amount']==200
rpc('divzplit_respond_payment',[literal(gid),literal(rid),literal('confirm')],FRIEND,'NEXO_FORBIDDEN')
row=json.loads(rpc('divzplit_respond_payment',[literal(gid),literal(rid),literal('confirm')],OWNER))
payment=row['document']['payments'][0]
assert payment['amount']==5000 and payment['fx']['amount']==200 and payment['fx']['currency']=='EUR' and payment['fx']['rate']=='25.0000000000'
assert sql('select public.divzplit_member_balance(document,'+literal(FRIEND)+') from public.nexo_groups where id='+literal(gid),role=None)=='0'
assert json.loads(rpc('divzplit_respond_payment',[literal(gid),literal(rid),literal('confirm')],OWNER))['version']==row['version']
doc=row['document'];doc['payments'][0]['fx']['amount']=1;save(row,doc,OWNER,'NEXO_PAYMENT_FLOW')
print('PASS: identical requests are idempotent, pending payments reserve the original debt, only the receiver confirms, the EUR snapshot stays fixed and the original ledger balances exactly')
# Zero-decimal currencies use whole units for budgets, expenses and conversion.
row=create('ISK');gid=row['id'];invite=json.loads(rpc('nexo_create_invite',[literal(gid)],OWNER));row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
doc=row['document'];doc['budget']=1;doc['expenses']=[{'id':'isk','title':'Cena','amount':100,'payer':OWNER,'createdBy':OWNER,'participants':[OWNER,FRIEND],'date':'2026-11-01','category':'Comida'}];row=save(row,doc,OWNER)
q=issue(currency='ISK',rate='136');rid=str(uuid.uuid4());pay(q,rid,amount=50,eur=37)
row=json.loads(rpc('divzplit_respond_payment',[literal(gid),literal(rid),literal('confirm')],OWNER))
assert row['document']['payments'][0]['amount']==50 and row['document']['payments'][0]['fx']['amount']==37
assert sql('select public.divzplit_member_balance(document,'+literal(FRIEND)+') from public.nexo_groups where id='+literal(gid),role=None)=='0'
before=latest();sql((ROOT/'supabase/exchange-rates.sql').read_text(),role=None);assert latest()==before
print('PASS: whole-unit ISK rounds to EUR cents correctly; migration activation is repeatable and preserves every expense/payment')
