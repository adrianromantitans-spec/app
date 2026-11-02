"""Real PostgreSQL: authenticated cross-currency payments keep the original ledger."""
from pathlib import Path
exec(Path('tests/fx_database.py').read_text().split("sql((ROOT/'supabase/exchange-rates.sql')")[0])
sql((ROOT/'supabase/settlement-currencies.sql').read_text(),role=None)
OWNER,FRIEND,OTHER=[str(uuid.uuid4()) for _ in range(3)]
for actor in [OWNER,FRIEND,OTHER]:sql('insert into auth.users values ('+literal(actor)+",'{}')",role=None)
def make(currency,amount):
 row=json.loads(rpc('nexo_create_group',[document({'name':'Cambio flexible','type':'Viaje','emoji':'✈️','currency':currency,'requestId':str(uuid.uuid4())})],OWNER))
 invite=json.loads(rpc('nexo_create_invite',[literal(row['id'])],OWNER));row=json.loads(rpc('nexo_join_group',[literal(invite['token'])],FRIEND))
 d=row['document'];d['expenses']=[{'id':'expense','title':'Compra','amount':amount,'payer':OWNER,'participants':[FRIEND],'category':'Comida','date':'2026-11-02','createdBy':OWNER}]
 return json.loads(rpc('nexo_save_group',[literal(row['id']),str(row['version']),document(d)],OWNER))
def quote(currency,rate,user=FRIEND,age=0):
 return json.loads(sql('select public.divzplit_issue_fx_quote('+literal(user)+','+literal(currency)+','+str(rate)+',current_date-'+str(age)+','+literal('ECB')+');',role='service_role'))
def request(row,q,tq,target,amount,request_id=None,actor=FRIEND,fail=None):
 return rpc('divzplit_request_payment_fx',[literal(row['id']),str(row['version']),literal(request_id or str(uuid.uuid4())),literal(OWNER),str(row['document']['expenses'][0]['amount']),literal(row['document']['currency']),'null' if q is None else literal(q['id']),literal(target),'null' if tq is None else literal(tq['id']),str(amount)],actor,fail)
row=make('RON',10000);base=quote('RON',5,age=2);target=quote('USD',1.2);request_id=str(uuid.uuid4())
request(row,base,target,'USD',2400,actor=OTHER,fail='NEXO_FORBIDDEN')
request(row,base,target,'USD',2401,fail='NEXO_FX_AMOUNT')
request(row,base,target,'GBP',2400,fail='NEXO_FX_EXPIRED')
request(row,quote('RON',5,OWNER),target,'USD',2400,fail='NEXO_FX_EXPIRED')
request(row,base,target,'RON',2400,fail='NEXO_CURRENCY')
r=json.loads(request(row,base,target,'USD',2400,request_id))
assert r['amount']==10000 and r['currency']=='RON' and r['fx']['amount']==2400 and r['fx']['currency']=='USD'
assert r['fx']['baseDate']!=r['fx']['targetDate'] and r['fx']['baseRate']=='5.0000000000'
assert json.loads(request(row,base,target,'USD',2400,request_id))==r
request(row,base,target,'USD',2401,request_id,fail='NEXO_FORBIDDEN')
quote('RON',7);quote('USD',1.4)
rpc('divzplit_respond_payment',[literal(row['id']),literal(request_id),literal('confirm')],FRIEND,'NEXO_FORBIDDEN')
saved=json.loads(rpc('divzplit_respond_payment',[literal(row['id']),literal(request_id),literal('confirm')],OWNER))
assert saved['document']['payments'][0]['amount']==10000 and saved['document']['payments'][0]['fx']==r['fx']
assert sql('select public.divzplit_member_balance('+document(saved['document'])+','+literal(FRIEND)+');',role=None)=='0'
for currency,amount,baseq,targetq,targetcode,result in [
 ('EUR',10000,None,quote('ISK',160),'ISK',16000),
 ('ISK',1000,quote('ISK',160),quote('RON',5),'RON',3125),
 ('RON',1,quote('RON',5),quote('ISK',160),'ISK',0)]:
 row2=make(currency,amount)
 if result==0:request(row2,baseq,targetq,targetcode,result,fail='NEXO_FX_AMOUNT')
 else:
  payment=json.loads(request(row2,baseq,targetq,targetcode,result))
  assert payment['fx']['currency']==targetcode and payment['fx']['amount']==result
 sql('delete from public.nexo_groups where id='+literal(row2['id']),role=None)
row3=make('RON',100);q3=quote('RON',5);t3=quote('USD',1.2)
sql('update public.divzplit_fx_quotes set expires_at=clock_timestamp()-interval '+literal('1 second')+' where id='+literal(t3['id']),role=None)
request(row3,q3,t3,'USD',24,fail='NEXO_FX_EXPIRED')
before=sql('select document from public.nexo_groups where id='+literal(row['id']),OWNER)
sql((ROOT/'supabase/settlement-currencies.sql').read_text(),role=None)
assert sql('select document from public.nexo_groups where id='+literal(row['id']),OWNER)==before
for g in [row,row3]:sql('delete from public.nexo_groups where id='+literal(g['id']),role=None)
print('PASS: trusted cross-currency quotes, target minor units, EUR/ISK bases, forged/expired/foreign quote rejection, frozen confirmation, idempotency and unchanged base ledger')
