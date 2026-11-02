"""Two browser accounts with local REST fixtures. No live accounts or emails."""
import copy,json,time,uuid,re,os
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
group={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Viaje de prueba','emoji':'🌴','type':'Viaje','place':'Lisboa','date':'','endDate':'','budget':20000,'currency':'RON','members':[{'id':OWNER,'name':'Ana','initials':'AN','color':'purple'},{'id':FRIEND,'name':'Luis','initials':'LU','color':'blue'}],'expenses':[{'id':'dinner','title':'Cena <b>equipo</b>','amount':10000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-10-30','createdBy':OWNER}],'payments':[],'tasks':[],'polls':[]}}
requests=[];events=[];errors=[];archives=[];saves=[];group_rows=[]
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
  elif path=='/rest/v1/nexo_groups':fulfill(route,group_rows)
  elif path=='/rest/v1/nexo_deleted_groups':fulfill(route,[])
  elif path=='/rest/v1/divzplit_history':
   cursor=parse_qs(urlsplit(route.request.url).query).get('or',[''])[0]
   match=re.search(r'id\.lt\.([0-9a-f-]+)',cursor)
   start=next((i+1 for i,e in enumerate(events) if match and e['id']==match.group(1)),0)
   fulfill(route,events[start:start+51])
  elif path=='/rest/v1/divzplit_payment_requests':fulfill(route,[r for r in requests if r['status']=='pending' and r['group_id']==parse_qs(urlsplit(route.request.url).query)['group_id'][0].removeprefix('eq.')])
  elif path.endswith('/divzplit_get_payment_archives'):fulfill(route,archives)
  elif path.endswith('/divzplit_archive_repayments'):
   assert actor==OWNER;archives[:]=[p['id'] for p in group['document']['payments']];fulfill(route,len(archives))
  elif path.endswith('/divzplit_cancel_pending_payments'):
   assert actor==OWNER
   count=sum(r['status']=='pending' for r in requests)
   for r in requests:
    if r['status']=='pending':r['status']='cancelled'
   fulfill(route,count)
  elif path.endswith('/nexo_save_group'):
   target=next(g for g in group_rows if g['id']==data['p_id']);assert data['p_version']==target['version'];saves.append(copy.deepcopy(data));target['document']=data['p_document'];target['version']+=1;fulfill(route,target)
  elif path.endswith('/divzplit_currency_support'):fulfill(route,True)
  elif path.endswith('/divzplit_expense_tools_support'):fulfill(route,True)
  elif path.endswith('/divzplit_fx_support'):fulfill(route,True)
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
 page.goto(os.environ.get('NEXO_URL','http://127.0.0.1:3003/'));expect(page.locator('.balance-stat')).to_be_visible();return c,page


from datetime import datetime,timedelta,timezone
from zoneinfo import ZoneInfo
now=datetime.now(timezone.utc)
local=now.astimezone(ZoneInfo('Europe/Bucharest'))
group['document'].update({'type':'Convivencia','name':'Nuestro piso','currency':'EUR','budget':0})
group['document']['expenses'][0].update({'title':'Compra de casa','amount':8500,'date':local.strftime('%Y-%m-%d')})
group['document']['tasks']=[{'id':'today-task','title':'Pagar internet','assignee':OWNER,'done':False,'important':True,'createdBy':OWNER,'dueAt':(now+timedelta(minutes=10)).isoformat().replace('+00:00','Z')}]
requests.extend([{'id':str(uuid.uuid4()),'group_id':GID,'from_id':FRIEND,'to_id':OWNER,'amount':amount,'currency':'EUR','status':'pending'} for amount in [1850,2400]])
TRIP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';SECOND='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
trip=copy.deepcopy(group);trip.update({'id':TRIP});trip['document'].update({'id':TRIP,'name':'Escapada a Praga','type':'Viaje','currency':'CZK','place':'Praga','date':'','endDate':'','tasks':[],'polls':[{'id':'poll','title':'Elegir restaurante','description':'Cena del viernes','votes':{},'options':[{'id':'a','label':'Italiano'},{'id':'b','label':'Checo'}],'dueAt':(now+timedelta(hours=2)).isoformat().replace('+00:00','Z')}],'expenses':[{'id':'taxi','title':'Taxi del aeropuerto','amount':5000,'payer':FRIEND,'participants':[OWNER],'category':'Transporte','date':local.strftime('%Y-%m-%d'),'createdBy':FRIEND}]})
second=copy.deepcopy(group);second.update({'id':SECOND});second['document'].update({'id':SECOND,'name':'Casa de verano','tasks':[],'expenses':[],'polls':[]})
group_rows[:]=[group,trip,second]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,page=context(b,OWNER)
 expect(page.locator('.personal-home')).to_have_attribute('data-home-mode','home')
 expect(page.locator('.balance-stat .stat-number')).to_contain_text('42,50')
 expect(page.locator('.home-attention')).to_contain_text('2 pagos esperan tu confirmación')
 expect(page.locator('.home-highlight')).to_contain_text('Pagar internet')
 assert page.locator('.home-recent .expense-row').count()==1
 for width in [320,393,430,768,1280]:
  page.set_viewport_size({'width':width,'height':900 if width>760 else 852})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('home',width)
 page.screenshot(path='work/personal-desktop.png',full_page=True)
 page.set_viewport_size({'width':393,'height':852});page.evaluate('document.fonts.ready');page.screenshot(path='work/personal-home.png',full_page=True)
 # Confirm a real fixture request through the compact list; the home ledger changes exactly.
 page.locator('.home-attention').click();expect(page.locator('.payment-request')).to_have_count(2)
 page.locator('[data-payment-response="confirm"]').first.click()
 expect(page.locator('#modal-title')).to_contain_text('18,50')
 page.locator('[data-resolve-payment="confirm"]').click();expect(page.locator('#toast')).to_contain_text('Pago confirmado')
 expect(page.locator('#toast')).to_have_class(re.compile(r'.*success.*'))
 page.locator('[data-action="close-modal"]').first.click()
 expect(page.locator('.balance-stat .stat-number')).to_contain_text('24,00')
 expect(page.locator('.home-attention')).to_contain_text('Un pago espera tu confirmación')
 # Mode switches select existing groups and preserve all financial/group documents.
 original=copy.deepcopy(group_rows);save_count=len(saves)
 page.locator('[data-group-mode="travel"]').click();expect(page.locator('.home-group-copy strong')).to_contain_text('Escapada a Praga')
 expect(page.locator('.personal-home')).to_have_attribute('data-home-mode','travel')
 expect(page.locator('.home-budget-line')).to_contain_text('Opcional')
 expect(page.locator('.home-highlight')).to_contain_text('Elegir restaurante')
 expect(page.locator('.home-attention')).to_have_count(0)
 for width in [320,393,430,768,1280]:
  page.set_viewport_size({'width':width,'height':900 if width>760 else 852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('trip',width)
 page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/personal-travel.png',full_page=True)
 page.locator('[data-group-mode="home"]').click();expect(page.locator('.home-group-copy strong')).to_contain_text('Nuestro piso')
 page.locator('[data-action="choose-group"]').click();page.locator('#modal-root [data-group="'+SECOND+'"]').click()
 expect(page.locator('.home-group-copy strong')).to_contain_text('Casa de verano')
 page.locator('[data-group-mode="travel"]').click();expect(page.locator('.home-group-copy strong')).to_contain_text('Escapada a Praga')
 page.locator('[data-group-mode="home"]').click();expect(page.locator('.home-group-copy strong')).to_contain_text('Casa de verano')
 assert group_rows==original and len(saves)==save_count
 page.locator('[data-action="choose-group"]').click();page.locator('#modal-root [data-group="'+GID+'"]').click()
 expect(page.locator('.home-group-copy strong')).to_contain_text('Nuestro piso')
 # Main expense fields match the proposal, while advanced options and exact cents remain functional.
 page.locator('.home-add').click();form=page.locator('#expense-form')
 expect(form.locator('[name="payer"]')).to_have_value('you')
 expect(form.locator('[name="payer"] option').first).to_have_attribute('value','you')
 assert 'Ana' in form.locator('[name="payer"] option').first.inner_text()
 assert not form.locator('.expense-more-options').evaluate('(e)=>e.open')
 form.locator('[name="amount"]').fill('10.01');form.locator('[name="title"]').fill('Cena del grupo')
 assert form.locator('[name="participants"]:checked').count()==2
 for width in [320,393,430,768]:
  page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('expense',width)
 page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/personal-expense.png',full_page=True)
 form.locator('.expense-more-options summary').click();form.locator('[name="category"]').select_option('Actividades')
 form.locator('[type="submit"]').click();expect(page.locator('#expense-form')).to_have_count(0)
 assert saves[-1]['p_document']['expenses'][0]['amount']==1001 and saves[-1]['p_document']['expenses'][0]['payer']==OWNER and saves[-1]['p_document']['expenses'][0]['category']=='Actividades'
 expect(page.locator('.balance-stat .stat-number')).to_contain_text('29,00')
 page.locator('.home-recent [data-expense]').click();page.locator('[data-edit-expense]').click()
 expect(page.locator('#expense-form [name="amount"]')).to_have_value('10.01')
 expect(page.locator('#expense-form [name="category"]')).to_have_value('Actividades')
 page.keyboard.press('Escape')
 # Advanced options retain a dated recurring expense and a custom cent-exact split.
 page.locator('.home-add').click();form=page.locator('#expense-form')
 form.locator('[name="amount"]').fill('10.01');form.locator('[name="title"]').fill('Reparto mensual')
 form.locator('[name="splitMode"]').select_option('percent')
 for field,value in zip(form.locator('[data-split-member]').all(),['25','75']):field.fill(value)
 form.locator('.expense-more-options summary').click()
 form.locator('[name="date"]').fill(local.strftime('%Y-%m-%d'));form.locator('[name="frequency"]').select_option('monthly')
 form.locator('[type="submit"]').click();expect(page.locator('#expense-form')).to_have_count(0)
 saved=saves[-1]['p_document']['expenses'][0]
 assert saved['split']['values']=={OWNER:2500,FRIEND:7500} and saved['amount']==1001
 assert saved['recurrence']['frequency']=='monthly' and saved['recurrence']['active']
 page.locator('.home-recent [data-expense]').click();page.locator('[data-edit-expense]').click()
 expect(page.locator('#expense-form [name="frequency"]')).to_have_value('monthly')
 expect(page.locator('#expense-form [name="date"]')).to_have_value(local.strftime('%Y-%m-%d'))
 assert page.locator('.expense-more-options').evaluate('(e)=>e.open')
 page.keyboard.press('Escape');c.close()
 # Missing mode opens creation without making up a group or changing the current group type.
 group_rows[:]=[group]
 c,page=context(b,OWNER);original=copy.deepcopy(group_rows)
 page.locator('[data-group-mode="travel"]').click();expect(page.locator('.dialog-copy')).to_contain_text('Aún no tienes grupos de viaje')
 page.locator('[data-group-type="Viaje"]').click();expect(page.locator('#group-form [name="type"]')).to_have_value('Viaje')
 assert group_rows==original;page.keyboard.press('Escape');c.close()
 group_rows[:]=[group,trip,second]
 # Long user data is escaped, and every UI language fits narrow screens.
 original_name=group['document']['name'];group['document']['name']='Casa <script>alert(1)</script> con un nombre muy largo'
 for language,label in [('es-ES','Más opciones'),('en-GB','More options'),('ro-RO','Mai multe opțiuni')]:
  c,page=context(b,OWNER,language);page.set_viewport_size({'width':320,'height':740})
  assert page.locator('.home-group-copy script').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('.home-add').click();expect(page.locator('.expense-more-options summary')).to_contain_text(label)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  c.close()
 group['document']['name']=original_name
 assert not errors,errors
 print('PASS: video-matching personal home, real balances and pending counts, existing-group mode switching, no unintended saves, compact expense exact cents, preserved edit data, empty modes, mobile/desktop and ES/EN/RO')
 b.close()
