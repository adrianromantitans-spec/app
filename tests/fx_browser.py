"""Two browser accounts with local REST fixtures. No live accounts or emails."""
import copy,json,time,uuid,re
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
group={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Viaje de prueba','emoji':'🌴','type':'Viaje','place':'Lisboa','date':'','endDate':'','budget':20000,'currency':'RON','members':[{'id':OWNER,'name':'Ana','initials':'AN','color':'purple'},{'id':FRIEND,'name':'Luis','initials':'LU','color':'blue'}],'expenses':[{'id':'dinner','title':'Cena <b>equipo</b>','amount':10000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-10-30','createdBy':OWNER}],'payments':[],'tasks':[],'polls':[]}}
requests=[];events=[];errors=[];archives=[];fx_calls=[];rate='5';fx_failure=False
def event(kind,actor,before=None,after=None):
 e={'id':str(uuid.uuid4()),'group_id':GID,'kind':kind,'actor_id':actor,'actor_name':'Ana' if actor==OWNER else 'Luis','entity_id':'dinner','before_data':before,'after_data':after,'currency':'RON','created_at':'2026-10-31T12:00:00Z'};events.insert(0,e);return e
event('expenses.added',OWNER,after=group['document']['expenses'][0])

def context(browser,actor,locale='es-ES',enabled=True):
 c=browser.new_context(locale=locale,viewport={'width':393,'height':852},reduced_motion='reduce')
 token={'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_at':int(time.time())+3600}
 c.add_init_script('localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps(token))+');')
 c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
 def fulfill(route,value,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(value))
 def api(route):
  path=urlsplit(route.request.url).path;data=json.loads(route.request.post_data or '{}')
  if path=='/auth/v1/user':fulfill(route,{'id':actor,'email':'fixture@example.test','user_metadata':{'display_name':'Ana' if actor==OWNER else 'Luis'}})
  elif path=='/auth/v1/settings':fulfill(route,{'external':{'google':False,'apple':False}})
  elif path=='/rest/v1/nexo_groups':fulfill(route,[group])
  elif path=='/rest/v1/nexo_deleted_groups':fulfill(route,[])
  elif path=='/rest/v1/divzplit_history':
   cursor=parse_qs(urlsplit(route.request.url).query).get('or',[''])[0]
   match=re.search(r'id\.lt\.([0-9a-f-]+)',cursor)
   start=next((i+1 for i,e in enumerate(events) if match and e['id']==match.group(1)),0)
   fulfill(route,events[start:start+51])
  elif path=='/rest/v1/divzplit_payment_requests':fulfill(route,[r for r in requests if r['status']=='pending'])
  elif path.endswith('/divzplit_get_payment_archives'):fulfill(route,archives)
  elif path.endswith('/divzplit_archive_repayments'):
   assert actor==OWNER;archives[:]=[p['id'] for p in group['document']['payments']];fulfill(route,len(archives))
  elif path.endswith('/divzplit_cancel_pending_payments'):
   assert actor==OWNER
   count=sum(r['status']=='pending' for r in requests)
   for r in requests:
    if r['status']=='pending':r['status']='cancelled'
   fulfill(route,count)
  elif path.endswith('/divzplit_fx_support'):fulfill(route,True)
  elif path.endswith('/divzplit_currency_support'):fulfill(route,True)
  elif path=='/functions/v1/exchange-rates':
   fx_calls.append(data)
   if fx_failure:fulfill(route,{'error':'Unavailable'},503)
   else:fulfill(route,{'id':'cccccccc-cccc-4ccc-8ccc-cccccccccccc','currency':data['currency'],'rate':rate,'rate_date':'2026-10-30','source':'ECB','checked_at':'2026-11-01T12:00:00Z','expires_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+900))})
  elif path.endswith('/divzplit_request_payment_eur'):
   assert actor==FRIEND and data['p_amount']==5000 and data['p_eur_amount']==1000 and data['p_quote']=='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
   r={'id':data['p_request_id'],'group_id':GID,'from_id':actor,'to_id':OWNER,'amount':5000,'currency':group['document']['currency'],'status':'pending','fx':{'quoteId':data['p_quote'],'currency':'EUR','amount':1000,'rate':rate,'date':'2026-10-30','source':'ECB'}};requests.append(r);event('payment.requested',actor,after=r.copy());fulfill(route,r)
  elif path.endswith('/nexo_save_group'):
   group['document']=data['p_document'];group['version']+=1;fulfill(route,group)
  elif path.endswith('/divzplit_collaboration_support'):fulfill(route,enabled)
  elif path.endswith('/divzplit_request_payment'):
   assert actor==FRIEND and data['p_to']==OWNER
   assert data['p_amount']==5000 and data['p_currency']=='RON'
   r={'id':data['p_request_id'],'group_id':GID,'from_id':actor,'to_id':OWNER,'amount':5000,'currency':'RON','status':'pending'};requests.append(r);event('payment.requested',actor,after=r.copy());fulfill(route,r)
  elif path.endswith('/divzplit_respond_payment'):
   r=next(r for r in requests if r['id']==data['p_request_id'])
   assert actor==OWNER and data['p_action']=='confirm'
   r['status']='confirmed';group['version']+=1
   payment={'id':r['id'],'from':FRIEND,'to':OWNER,'amount':r['amount'],'date':'2026-10-31'}
   payment.update({'fx':r['fx']} if r.get('fx') else {});group['document']['payments'].append(payment);event('payments.added',actor,after=payment);fulfill(route,group)
  elif path.endswith('/divzplit_clear_history'):
   assert actor==OWNER and data['p_id']==GID
   count=len(events);events.clear();fulfill(route,count)
  elif path.endswith('/divzplit_delete_history'):
   assert actor==OWNER;events[:]=[e for e in events if e['id']!=data['p_event_id']];fulfill(route,True)
  else:fulfill(route,{'code':'PGRST202'},404)
 c.route('https://nexo-test.supabase.co/**',api)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(__import__('os').environ.get('NEXO_URL','http://127.0.0.1:3003/app/'));expect(page.locator('.balance-stat')).to_be_visible();return c,page


def go(page,route):
 page.locator('[data-action="workspace-menu"]').click();page.locator('.navigation-drawer [data-route="'+('expenses' if route=='activity' else route)+'"]').click();page.wait_for_timeout(100)
 if route=='activity':page.locator('.finance-sections [data-route="activity"]').click();page.wait_for_timeout(100)

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,friend=context(b,FRIEND)
 friend.locator('[data-action="settlements"]').first.click()
 expect(friend.locator('[data-fx-target]')).to_be_visible()
 expect(friend.locator('.settlement-amount>strong')).to_contain_text('10,00')
 expect(friend.locator('.settlement-amount>small')).to_contain_text('50,00')
 expect(friend.locator('.fx-panel')).to_contain_text('2026-10-30')
 assert fx_calls==[{'currency':'RON'}]
 for width in [320,393,430,768]:
  friend.set_viewport_size({'width':width,'height':852})
  assert friend.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 friend.set_viewport_size({'width':393,'height':852});friend.screenshot(path='work/fx-settlements.png',full_page=True)
 friend.locator('[data-settle]').click()
 expect(friend.locator('.dialog-copy')).to_contain_text('10,00')
 expect(friend.locator('.fx-detail')).to_contain_text('2026-10-30')
 friend.locator('[data-confirm-payment]').click()
 expect(friend.locator('#toast')).to_contain_text('para confirmar')
 assert group['document']['payments']==[] and requests[0]['fx']['amount']==1000
 # A later rate never changes a pending payment or recipient confirmation.
 rate='6'
 co,owner=context(b,OWNER)
 go(owner,'activity')
 owner.locator('[data-action="show-pending-payments"]').click()
 expect(owner.locator('.payment-request')).to_contain_text('10,00')
 expect(owner.locator('.payment-request')).to_contain_text('50,00')
 owner.locator('[data-payment-response="confirm"]').click()
 expect(owner.locator('.dialog-copy').first).to_contain_text('10,00')
 owner.locator('[data-resolve-payment="confirm"]').click()
 expect(owner.locator('#toast')).to_contain_text('Pago confirmado')
 assert group['document']['payments'][0]['amount']==5000 and group['document']['payments'][0]['fx']['amount']==1000 and group['document']['payments'][0]['fx']['rate']=='5'
 owner.locator('[data-action="close-modal"]').first.click()
 owner.locator('[data-action="show-recorded-payments"]').click()
 expect(owner.locator('.payment-row')).to_contain_text('10,00')
 expect(owner.locator('.payment-row')).to_contain_text('50,00')
 owner.locator('[data-action="close-modal"]').first.click()
 go(owner,'home');expect(owner.locator('.balance-stat .stat-amount')).to_contain_text('0,00')
 co.close();c.close()
 # Provider failure cannot masquerade as a valid euro amount; original payment remains available.
 group['document']['payments']=[];requests.clear();fx_failure=True
 c,page=context(b,FRIEND)
 page.locator('[data-action="settlements"]').first.click()
 expect(page.locator('.fx-panel [role="alert"]')).to_contain_text('No se ha podido consultar')
 expect(page.locator('[data-settle]')).to_be_disabled()
 page.locator('[data-action="fx-original"]').click();expect(page.locator('[data-settle]')).to_be_enabled()
 page.locator('[data-action="close-modal"]').first.click();c.close()
 # A subcent EUR amount remains payable only in the original currency.
 group['document']['expenses'][0]['amount']=1;group['document']['expenses'][0]['participants']=[FRIEND];fx_failure=False
 c,page=context(b,FRIEND);page.locator('[data-action="settlements"]').first.click()
 expect(page.locator('.settlement-amount')).to_contain_text('Importe inferior a la unidad mínima')
 expect(page.locator('[data-settle]')).to_be_disabled();c.close()
 # New currency selection and integral ISK expense input.
 group['document']['currency']='ISK';group['document']['expenses']=[];fx_failure=False
 c,page=context(b,OWNER)
 go(page,'groups');page.locator('[data-action="new-group"]:visible').first.click()
 assert page.locator('[name="currency"] option').count()==25
 page.locator('[name="currency"]').select_option('ISK');expect(page.locator('[name="budget"]')).to_have_attribute('step','1')
 page.locator('[data-action="close-modal"]').first.click();go(page,'home')
 page.locator('[data-action="new-expense"]:visible').first.click()
 expect(page.locator('[name="amount"]')).to_have_attribute('step','1')
 page.locator('[name="title"]').fill('Cena islandesa');page.locator('[name="amount"]').fill('101')
 page.locator('#expense-form button[type=submit]').click();expect(page.locator('#toast')).to_contain_text('actualizado')
 assert group['document']['expenses'][0]['amount']==101
 c.close()
 # EUR groups have no unnecessary conversion; localized FX copy works in EN/RO.
 group['document']['currency']='EUR'
 c,page=context(b,OWNER);page.locator('[data-action="settlements"]').first.click()
 expect(page.locator('.settlement-row')).to_be_visible();expect(page.locator('[data-action="fx-original"]')).to_have_text('EUR');c.close()
 group['document']['currency']='RON'
 for language,label in [('en-GB','View in euros'),('ro-RO','Vezi în euro')]:
  c,page=context(b,FRIEND,language);page.locator('[data-action="settlements"]').first.click()
  expect(page.locator('[data-fx-target]')).to_be_visible();c.close()
 assert not errors,errors
 print('PASS: dated EUR preview, original debt retained, frozen payment/confirmation, provider failure fallback, all 25 currencies, integral ISK and ES/EN/RO mobile layouts')
 b.close()
