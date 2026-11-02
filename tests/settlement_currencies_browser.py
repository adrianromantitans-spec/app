"""Currency selector and frozen non-EUR payments with local PostgreSQL RPCs."""
import os,subprocess
from pathlib import Path
prefix=Path('tests/fx_browser.py').read_text().split('def go(page,route):')[0]
a=prefix.index("  elif path=='/functions/v1/exchange-rates':");b=prefix.index("  elif path.endswith('/divzplit_request_payment_eur'):",a)
prefix=prefix[:a]+'''  elif path=='/functions/v1/exchange-rates':
   fx_calls.append(data)
   if hold_usd and data['currency']=='USD':held.append((route,data,actor))
   else:fulfill(route,issue(actor,data['currency']))
  elif path.endswith('/divzplit_request_payment_fx'):
   result=dbcall('divzplit_request_payment_fx',[q(data['p_id']),str(data['p_version']),q(data['p_request_id']),q(data['p_to']),str(data['p_amount']),q(data['p_currency']),'null' if data['p_quote'] is None else q(data['p_quote']),q(data['p_target_currency']),'null' if data['p_target_quote'] is None else q(data['p_target_quote']),str(data['p_target_amount'])],actor)
   requests.append(result);event('payment.requested',actor,after=result.copy());fulfill(route,result)
'''+prefix[b:]
a=prefix.index("  elif path.endswith('/divzplit_respond_payment'):");b=prefix.index("  elif path.endswith('/divzplit_clear_history'):",a)
prefix=prefix[:a]+'''  elif path.endswith('/divzplit_respond_payment'):
   result=dbcall('divzplit_respond_payment',[q(data['p_id']),q(data['p_request_id']),q(data['p_action'])],actor);group.update(result)
   r=next(r for r in requests if r['id']==data['p_request_id']);r['status']='confirmed';event('payments.added',actor,after=group['document']['payments'][0]);fulfill(route,result)
'''+prefix[b:]
exec(prefix)
rates={'RON':'5','USD':'1.2','GBP':'0.8','ISK':'160'};hold_usd=False;held=[]
def q(v):return "'"+str(v).replace("'","''")+"'"
def dbcall(name,args,actor=None,service=False):
 lead='set role '+('service_role' if service else 'authenticated')+';set request.jwt.claim.sub='+q(actor or '')+';'
 r=subprocess.run(['docker','--host=unix:///var/run/docker.sock','exec','-i','nexo-postgres-tests','psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAq'],input=lead+'select public.'+name+'('+','.join(args)+');',text=True,capture_output=True)
 assert r.returncode==0,r.stderr
 return json.loads(r.stdout)
def issue(actor,currency):return dbcall('divzplit_issue_fx_quote',[q(actor),q(currency),rates[currency],'current_date',q('ECB')],service=True)
group=dbcall('nexo_create_group',[q(json.dumps({'name':'Cambio flexible','type':'Viaje','emoji':'✈️','currency':'RON','requestId':str(uuid.uuid4())}))+'::jsonb'],OWNER);GID=group['id']
invite=dbcall('nexo_create_invite',[q(GID)],OWNER);group=dbcall('nexo_join_group',[q(invite['token'])],FRIEND)
group['document']['expenses']=[{'id':'expense','title':'Compra','amount':10000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-11-02','createdBy':OWNER}]
group=dbcall('nexo_save_group',[q(GID),str(group['version']),q(json.dumps(group['document']))+'::jsonb'],OWNER)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,page=context(b,FRIEND)
 page.locator('[data-action="settlements"]').click();expect(page.locator('.settlement-amount>strong')).to_contain_text('10,00')
 base=page.locator('[data-action="fx-original"]');expect(base).to_have_text('RON')
 selector=page.locator('[data-fx-target]');assert selector.locator('option').count()==25 and selector.locator('option[value="RON"]').count()==0
 selector.select_option('USD');expect(page.locator('.settlement-amount>strong')).to_contain_text('12,00');expect(base).to_have_text('RON')
 selector.select_option('GBP');expect(page.locator('.settlement-amount>strong')).to_contain_text('8,00');expect(base).to_have_text('RON')
 base.click();expect(page.locator('.settlement-amount>strong')).to_contain_text('50,00')
 # A slow result for a previous selection must not overwrite the latest currency.
 hold_usd=True;selector.select_option('USD');page.wait_for_timeout(80);selector.select_option('GBP')
 expect(page.locator('.settlement-amount>strong')).to_contain_text('8,00')
 for route,data,actor in held:route.fulfill(content_type='application/json',body=json.dumps(issue(actor,data['currency'])))
 held.clear();hold_usd=False;page.wait_for_timeout(100);expect(selector).to_have_value('GBP');expect(page.locator('.settlement-amount>strong')).to_contain_text('8,00')
 selector.select_option('USD');expect(page.locator('.settlement-amount>strong')).to_contain_text('12,00')
 for width in [320,393,430,768]:
  page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/settlement-selector.png',full_page=False)
 page.locator('[data-settle]').click();expect(page.locator('.dialog-copy').first).to_contain_text('12,00');page.locator('[data-confirm-payment]').click()
 expect(page.locator('#toast')).to_contain_text('para confirmar');assert requests[0]['fx']['currency']=='USD' and requests[0]['fx']['amount']==1200
 frozen=requests[0]['fx'].copy();rates['USD']='1.5'
 co,owner=context(b,OWNER);owner.locator('.home-attention').click();expect(owner.locator('.payment-request>div>span')).to_contain_text('12,00')
 owner.locator('[data-payment-response="confirm"]').click();expect(owner.locator('#modal-title')).to_contain_text('12,00')
 owner.locator('[data-resolve-payment="confirm"]').click();expect(owner.locator('#toast')).to_contain_text('Pago confirmado')
 assert group['document']['payments'][0]['amount']==5000 and group['document']['payments'][0]['fx']==frozen
 co.close();c.close()
 for language,label in [('ro-RO','Ultimele cheltuieli'),('en-GB','Recent expenses')]:
  c,page=context(b,OWNER,language);expect(page.locator('.home-section-heading h2')).to_have_text(label);c.close()
 # EUR groups now also offer conversion, while their left-hand currency stays EUR.
 group['document']['currency']='EUR'
 c,page=context(b,OWNER);page.locator('[data-action="settlements"]').click();expect(page.locator('[data-action="fx-original"]')).to_have_text('EUR')
 expect(page.locator('[data-fx-target]')).to_be_visible();c.close()
 assert not errors,errors
 b.close()
print('PASS: original currency fixed, 24 targets, RON/USD/GBP conversion, stale response guard, frozen USD payment and confirmation, EUR base and Romanian/English recent-expense copy')
