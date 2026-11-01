"""Two browser accounts with local REST fixtures. No live accounts or emails."""
import copy,json,time,uuid,re
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
group={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Viaje de prueba','emoji':'🌴','type':'Viaje','place':'Lisboa','date':'','endDate':'','budget':20000,'currency':'RON','members':[{'id':OWNER,'name':'Ana','initials':'AN','color':'purple'},{'id':FRIEND,'name':'Luis','initials':'LU','color':'blue'}],'expenses':[{'id':'dinner','title':'Cena <b>equipo</b>','amount':10000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-10-30','createdBy':OWNER}],'payments':[],'tasks':[],'polls':[]}}
requests=[];events=[];errors=[];archives=[]
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
   group['document']['payments'].append(payment);event('payments.added',actor,after=payment);fulfill(route,group)
  elif path.endswith('/divzplit_clear_history'):
   assert actor==OWNER and data['p_id']==GID
   count=len(events);events.clear();fulfill(route,count)
  elif path.endswith('/divzplit_delete_history'):
   assert actor==OWNER;events[:]=[e for e in events if e['id']!=data['p_event_id']];fulfill(route,True)
  else:fulfill(route,{'code':'PGRST202'},404)
 c.route('https://nexo-test.supabase.co/**',api)
 page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:3003/');expect(page.locator('.balance-stat')).to_be_visible();return c,page

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 cf,friend=context(b,FRIEND)
 expect(friend.locator('.balance-stat .stat-number')).to_contain_text('50')
 friend.locator('[data-action="settlements"]').first.click()
 friend.locator('[data-action="fx-original"]').click()
 friend.get_by_role('button',name='Marcar como pagado',exact=True).click()
 friend.get_by_role('button',name='Ya lo he enviado',exact=True).click()
 expect(friend.locator('#toast')).to_contain_text('para confirmar')
 assert group['document']['payments']==[]
 expect(friend.locator('.balance-stat .stat-number')).to_contain_text('50')
 friend.locator('[data-page="activity"]:visible').first.click()
 assert friend.locator('.payment-request').count()==0
 friend.locator('[data-action="show-pending-payments"]').click()
 expect(friend.locator('.payment-request')).to_have_count(1)
 assert friend.locator('[data-clear-payment-list]').count()==0
 assert friend.locator('[data-payment-response="confirm"]').count()==0
 assert friend.locator('[data-delete-history]').count()==0
 friend.locator('[data-action="close-modal"]').first.click()
 friend.locator('[data-action="show-history"]').click()
 expect(friend.locator('.history-entry').first).to_be_visible()
 assert friend.locator('[data-action="clear-history"]').count()==0
 friend.locator('[data-action="close-modal"]').first.click()
 co,owner=context(b,OWNER)
 owner.locator('[data-page="activity"]:visible').first.click()
 assert owner.locator('.payment-request').count()==0
 assert owner.locator('.history-entry').count()==0
 owner.locator('[data-action="show-history"]').click()
 expect(owner.locator('[data-delete-history]').first).to_be_visible()
 owner.locator('.history-entry details').last.locator('summary').click()
 assert owner.locator('.history-entry b').count()==0
 expect(owner.locator('.history-entry').last).to_contain_text('Cena <b>equipo</b>')
 owner.locator('[data-action="close-modal"]').first.click()
 owner.locator('[data-action="show-pending-payments"]').click()
 owner.locator('[data-payment-response="confirm"]').click()
 owner.locator('[data-resolve-payment="confirm"]').click()
 expect(owner.locator('#toast')).to_contain_text('Pago confirmado')
 assert len(group['document']['payments'])==1
 owner.locator('[data-action="close-modal"]').first.click()
 owner.locator('[data-page="home"]:visible').first.click()
 expect(owner.locator('.balance-stat .stat-number')).to_contain_text('0')
 friend.reload();expect(friend.locator('.balance-stat .stat-number')).to_contain_text('0')
 owner.locator('[data-page="activity"]:visible').first.click()
 owner.locator('[data-action="show-history"]').click()
 before=copy.deepcopy(group);event_count=len(events)
 owner.locator('[data-delete-history]').first.click()
 owner.locator('[data-confirm-history-delete]').click()
 expect(owner.locator('#toast')).to_contain_text('historial borrada')
 assert len(events)==event_count-1 and group==before
 print('PASS: debtor marks sent without changing balance; recipient confirms; member cannot delete; administrator deletion preserves finances')
 for locale,heading in [('es-ES','Historial de cambios'),('en-GB','Change history'),('ro-RO','Istoricul modificărilor')]:
  c,page=context(b,OWNER,locale)
  page.locator('[data-page="activity"]:visible').first.click()
  expect(page.get_by_role('heading',name=heading,exact=True)).to_be_visible()
  page.locator('[data-action="show-history"]').click()
  expect(page.locator('.history-entry').first).to_be_visible()
  for width in [320,393,430,768]:
   page.set_viewport_size({'width':width,'height':852})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(locale,width)
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/activity-'+locale[:2]+'.png',full_page=True);c.close()
 # A long history stays inside its dialog; clearing affects every page.
 for i in range(70):event('expenses.updated',OWNER,before={'title':'Cambio','amount':1000},after={'title':'Cambio','amount':1001})
 c,page=context(b,OWNER)
 page.locator('[data-page="activity"]:visible').first.click()
 expect(page.locator('[data-action="show-history"]')).to_be_visible()
 assert page.locator('#main .history-entry').count()==0
 page.locator('[data-action="show-history"]').click()
 expect(page.locator('.history-entry')).to_have_count(50)
 assert page.locator('.history-scroll').evaluate('(el)=>el.scrollHeight>el.clientHeight && el.clientHeight<innerHeight*.6')
 page.locator('[data-action="more-history"]').click()
 expect(page.locator('.history-entry')).to_have_count(len(events))
 financial=copy.deepcopy(group);count=len(events)
 page.locator('[data-action="clear-history"]').click()
 assert len(events)==count
 page.locator('#modal-root [data-action="show-history"]').click()
 page.locator('[data-action="clear-history"]').click()
 page.locator('[data-confirm-clear-history]').click()
 expect(page.locator('.history-entry')).to_have_count(0)
 assert len(events)==0 and group==financial
 assert page.locator('[data-action="clear-history"]').count()==0
 c.close()
 print('PASS: compact activity, bounded full history, pagination, administrator-only bulk clear and cancellation without financial changes')
 # Both payment sections remain compact; the archive keeps all financial rows.
 for i in range(65):group['document']['payments'].append({'id':'old-'+str(i),'from':FRIEND,'to':OWNER,'amount':1,'date':'2026-10-31'})
 c,page=context(b,OWNER)
 page.locator('[data-page="activity"]:visible').first.click()
 assert page.locator('#main .payment-row').count()==0
 page.locator('[data-action="show-recorded-payments"]').click()
 expect(page.locator('.payment-list-dialog .payment-row')).to_have_count(50)
 assert page.locator('.payment-list-scroll').evaluate('(el)=>el.scrollHeight>el.clientHeight && el.clientHeight<innerHeight*.6')
 page.locator('[data-action="more-recorded-payments"]').click()
 expect(page.locator('.payment-list-dialog .payment-row')).to_have_count(66)
 financial=copy.deepcopy(group)
 page.locator('[data-clear-payment-list="recorded"]').click()
 page.locator('#modal-root [data-action="show-recorded-payments"]').click()
 assert archives==[]
 page.locator('[data-clear-payment-list="recorded"]').click()
 page.locator('[data-confirm-clear-payments="recorded"]').click()
 expect(page.locator('.payment-list-dialog .payment-row')).to_have_count(0)
 assert group==financial and len(archives)==66
 page.locator('[data-action="toggle-recorded-archive"]').click()
 expect(page.locator('.payment-list-dialog .payment-row')).to_have_count(50)
 assert page.locator('[data-clear-payment-list]').count()==0
 page.locator('[data-action="close-modal"]').first.click()
 requests.append({'id':str(uuid.uuid4()),'group_id':GID,'from_id':FRIEND,'to_id':OWNER,'amount':100,'currency':'RON','status':'pending'})
 page.locator('[data-action="show-pending-payments"]').click()
 expect(page.locator('.payment-request')).to_have_count(1)
 page.locator('[data-clear-payment-list="pending"]').click()
 page.locator('[data-confirm-clear-payments="pending"]').click()
 expect(page.locator('.payment-request')).to_have_count(0)
 assert group==financial and requests[-1]['status']=='cancelled'
 c.close()
 print('PASS: compact payment lists, bounded paging, owner-only clear, archive access and balances preserved')

 c,page=context(b,OWNER,enabled=False)
 page.locator('[data-action="settlements"]').first.click()
 expect(page.get_by_text('Los pagos con confirmación y el historial todavía no están activados.',exact=True)).to_be_visible()
 assert page.locator('[data-settle]').count()==0
 assert not errors,errors
 print('PASS: ES/EN/RO, phone/tablet layouts, safe HTML rendering and disabled migration gate')
 b.close()
