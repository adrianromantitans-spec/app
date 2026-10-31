"""Two browser accounts with local REST fixtures. No live accounts or emails."""
import copy,json,time,uuid
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
group={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Viaje de prueba','emoji':'🌴','type':'Viaje','place':'Lisboa','date':'','endDate':'','budget':20000,'currency':'RON','members':[{'id':OWNER,'name':'Ana','initials':'AN','color':'purple'},{'id':FRIEND,'name':'Luis','initials':'LU','color':'blue'}],'expenses':[{'id':'dinner','title':'Cena <b>equipo</b>','amount':10000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-10-30','createdBy':OWNER}],'payments':[],'tasks':[],'polls':[]}}
requests=[];events=[];errors=[]
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
  elif path=='/rest/v1/divzplit_history':fulfill(route,events)
  elif path=='/rest/v1/divzplit_payment_requests':fulfill(route,[r for r in requests if r['status']=='pending'])
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
 friend.get_by_role('button',name='Marcar como pagado',exact=True).click()
 friend.get_by_role('button',name='Ya lo he enviado',exact=True).click()
 expect(friend.locator('#toast')).to_contain_text('para confirmar')
 assert group['document']['payments']==[]
 expect(friend.locator('.balance-stat .stat-number')).to_contain_text('50')
 friend.locator('[data-page="activity"]:visible').first.click()
 expect(friend.locator('.payment-request')).to_have_count(1)
 assert friend.locator('[data-payment-response="confirm"]').count()==0
 assert friend.locator('[data-delete-history]').count()==0
 co,owner=context(b,OWNER)
 owner.locator('[data-page="activity"]:visible').first.click()
 expect(owner.locator('[data-payment-response="confirm"]')).to_be_visible()
 expect(owner.locator('[data-delete-history]').first).to_be_visible()
 owner.locator('.history-entry details').last.locator('summary').click()
 assert owner.locator('.history-entry b').count()==0
 expect(owner.locator('.history-entry').last).to_contain_text('Cena <b>equipo</b>')
 owner.locator('[data-payment-response="confirm"]').click()
 owner.locator('[data-resolve-payment="confirm"]').click()
 expect(owner.locator('#toast')).to_contain_text('Pago confirmado')
 assert len(group['document']['payments'])==1
 owner.locator('[data-page="home"]:visible').first.click()
 expect(owner.locator('.balance-stat .stat-number')).to_contain_text('0')
 friend.reload();expect(friend.locator('.balance-stat .stat-number')).to_contain_text('0')
 owner.locator('[data-page="activity"]:visible').first.click()
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
  expect(page.locator('.history-entry').first).to_be_visible()
  for width in [320,393,430,768]:
   page.set_viewport_size({'width':width,'height':852})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(locale,width)
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/activity-'+locale[:2]+'.png',full_page=True);c.close()
 c,page=context(b,OWNER,enabled=False)
 page.locator('[data-action="settlements"]').first.click()
 expect(page.get_by_text('Los pagos con confirmación y el historial todavía no están activados.',exact=True)).to_be_visible()
 assert page.locator('[data-settle]').count()==0
 assert not errors,errors
 print('PASS: ES/EN/RO, phone/tablet layouts, safe HTML rendering and disabled migration gate')
 b.close()
