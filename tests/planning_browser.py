"""Two browser accounts with local REST fixtures. No live accounts or emails."""
import copy,json,time,uuid,re
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';FRIEND='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
group={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Viaje de prueba','emoji':'🌴','type':'Viaje','place':'Lisboa','date':'','endDate':'','budget':20000,'currency':'RON','members':[{'id':OWNER,'name':'Ana','initials':'AN','color':'purple'},{'id':FRIEND,'name':'Luis','initials':'LU','color':'blue'}],'expenses':[{'id':'dinner','title':'Cena <b>equipo</b>','amount':10000,'payer':OWNER,'participants':[OWNER,FRIEND],'category':'Comida','date':'2026-10-30','createdBy':OWNER}],'payments':[],'tasks':[],'polls':[]}}
requests=[];events=[];errors=[];archives=[];reminders=[];planning_calls=[]
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
  elif path.endswith('/divzplit_planning_support'):fulfill(route,{'enabled':enabled,'scheduling':True})
  elif path.endswith('/divzplit_plan_action'):
   kind=data['p_kind'];op=data['p_action'];item=data['p_item'];planning_calls.append(copy.deepcopy(data))
   assert data['p_version']==group['version'] and data['p_id']==group['id']
   previous=next((x for x in group['document'][kind] if x['id']==item.get('id')),None)
   if op=='clear':
    assert actor==OWNER;group['document'][kind]=[]
   elif op=='delete':
    assert actor==OWNER or previous['createdBy']==actor
    group['document'][kind]=[x for x in group['document'][kind] if x['id']!=item['id']]
   elif previous:
    assert actor==OWNER or previous['createdBy']==actor
    previous.update(item)
   else:
    item.update({'createdBy':actor});item.update({'done':False} if kind=='tasks' else {'votes':{}});group['document'][kind].insert(0,item)
   group['version']+=1;fulfill(route,group)
  elif path.endswith('/divzplit_remind_plan'):
   reminders.append(data);fulfill(route,1)
  elif path.endswith('/nexo_save_group'):
   assert data['p_version']==group['version']
   group['document']=data['p_document'];group['version']+=1;fulfill(route,group)
  elif path.endswith('/nexo_create_group'):
   assert data['p_fields']['budget']==0
   group['id']=data['p_fields']['requestId'];group['document']['id']=group['id']
   group['document'].update({k:v for k,v in data['p_fields'].items() if k!='requestId'});fulfill(route,group)
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


from datetime import datetime,timedelta
future=(datetime.now()+timedelta(days=3)).strftime('%Y-%m-%dT%H:%M')
remind=(datetime.now()+timedelta(days=2)).strftime('%Y-%m-%dT%H:%M')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,page=context(b,OWNER)
 # Both group creation and editing permit a blank budget.
 page.locator('[data-page="groups"]:visible').first.click()
 page.locator('[data-action="new-group"]:visible').first.click()
 assert not page.locator('[name="budget"]').evaluate('(e)=>e.required')
 page.locator('[name="name"]').fill('Nuestra casa')
 page.locator('#group-form button[type=submit]').click()
 expect(page.locator('.budget-card')).to_contain_text('Sin presupuesto establecido')
 assert group['document']['budget']==0
 assert page.locator('.budget-card .over-budget').count()==0
 page.locator('[data-action="edit-budget"]').click()
 page.locator('[name="budget"]').fill('1200')
 page.locator('#budget-form button[type=submit]').click()
 expect(page.locator('.budget-card .progress-track')).to_be_visible()
 assert group['document']['budget']==120000
 page.locator('[data-action="edit-budget"]').click()
 page.locator('[name="budget"]').fill('')
 page.locator('#budget-form button[type=submit]').click()
 expect(page.locator('.budget-card')).to_contain_text('Sin presupuesto establecido')
 # Create a task with optional deadline, reminder and important flag.
 page.locator('[data-action="new-task"]').first.click()
 page.locator('[name="title"]').fill('Revisar factura <b>luz</b>')
 page.locator('[name="dueAt"]').fill(future);page.locator('[name="remindAt"]').fill(remind)
 page.locator('[name="important"]').check();page.locator('#task-form button[type=submit]').click()
 expect(page.locator('.planning-list-dialog .planning-task')).to_have_count(1)
 expect(page.locator('.important-pill')).to_have_text('Importante')
 assert page.locator('.planning-task b').count()==0
 task=copy.deepcopy(group['document']['tasks'][0]);assert task['assignee']==OWNER and task['createdBy']==OWNER and task['important']
 assert task['dueAt'].endswith('Z') and task['remindAt'].endswith('Z')
 page.locator('[data-plan-detail]').click()
 page.locator('[data-plan-edit]').click()
 page.locator('[name="title"]').fill('Revisar factura de luz')
 page.locator('#task-form button[type=submit]').click()
 expect(page.locator('.planning-task')).to_contain_text('Revisar factura de luz')
 assert group['document']['tasks'][0]['dueAt']==task['dueAt']
 page.locator('[data-task]').check()
 expect(page.locator('.planning-task.done')).to_have_count(1)
 page.locator('[data-plan-detail]').click()
 assert page.locator('[data-plan-remind]').count()==0
 page.locator('[data-show-planning="tasks"]').last.click();page.locator('[data-task]').uncheck()
 page.locator('[data-plan-detail]').click();page.locator('[data-plan-remind]').click()
 page.locator('[data-confirm-plan-remind]').click()
 expect(page.locator('#toast')).to_contain_text('Recordatorio enviado')
 assert len(reminders)==1
 page.locator('[data-action="close-modal"]').first.click()
 # Poll creation, closed state and vote preservation when editing metadata.
 page.locator('[data-tab="plans"]').first.click()
 page.locator('[data-action="new-poll"]').first.click()
 page.locator('[name="title"]').fill('¿Qué día hacemos la compra?')
 page.locator('[name="option"]').nth(0).fill('Lunes');page.locator('[name="option"]').nth(1).fill('Martes')
 page.locator('[name="dueAt"]').fill(future)
 page.locator('#poll-form button[type=submit]').click()
 expect(page.locator('.planning-list-dialog .poll-card')).to_have_count(1)
 page.locator('.poll-option').first.click()
 expect(page.locator('.poll-option.chosen')).to_have_count(1)
 votes=copy.deepcopy(group['document']['polls'][0]['votes'])
 page.locator('[data-plan-edit]').click()
 page.locator('[name="title"]').fill('¿Cuándo compramos?')
 assert page.locator('[name="option"]').count()==0
 page.locator('#poll-form button[type=submit]').click()
 expect(page.locator('.poll-card h3')).to_have_text('¿Cuándo compramos?')
 assert group['document']['polls'][0]['votes']==votes
 page.locator('[data-action="close-modal"]').first.click()
 group['document']['polls'][0]['dueAt']='2020-01-01T12:00:00.000Z'
 page.locator('[data-show-planning="polls"]').last.click()
 expect(page.locator('.poll-option:disabled')).to_have_count(2)
 expect(page.locator('.vote-status')).to_have_text('Votación cerrada')
 assert page.locator('[data-plan-remind]').count()==0
 # Deleting requires confirmation; cancellation preserves the list.
 financial={k:copy.deepcopy(group['document'][k]) for k in ['expenses','payments','budget','members']}
 page.locator('[data-plan-delete]').click()
 page.locator('[data-show-planning="polls"]').last.click()
 assert len(group['document']['polls'])==1
 page.locator('[data-plan-delete]').click();page.locator('[data-confirm-plan-delete]').click()
 expect(page.locator('.poll-card')).to_have_count(0)
 assert {k:group['document'][k] for k in financial}==financial
 page.locator('[data-action="close-modal"]').first.click()
 # Long lists only appear inside the bounded, paged dialog.
 for i in range(65):group['document']['tasks'].append({'id':'long-'+str(i),'title':'Tarea '+str(i),'assignee':FRIEND,'done':False,'createdBy':OWNER,'important':False,'dueAt':task['dueAt']})
 page.locator('[data-tab="tasks"]').first.click()
 page.locator('[data-show-planning="tasks"]').last.click()
 expect(page.locator('.planning-list-dialog .planning-task')).to_have_count(30)
 assert page.locator('.planning-list-scroll').evaluate('(e)=>e.scrollHeight>e.clientHeight && e.clientHeight<innerHeight*.65')
 page.locator('[data-action="more-planning"]').click();expect(page.locator('.planning-task')).to_have_count(60)
 for width in [320,393,430,768]:
  page.set_viewport_size({'width':width,'height':852})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/planning-tasks.png',full_page=True)
 page.locator('[data-plan-clear]').click();page.locator('[data-confirm-plan-delete]').click()
 expect(page.locator('.planning-task')).to_have_count(0)
 assert group['document']['tasks']==[] and {k:group['document'][k] for k in financial}==financial
 c.close()
 # A member sees their own controls but not admin bulk deletion or other authors' controls.
 group['document']['tasks']=[{**task,'id':'owner-task','createdBy':OWNER},{**task,'id':'my-task','createdBy':FRIEND}]
 c,page=context(b,FRIEND)
 page.locator('[data-tab="tasks"]').first.click();page.locator('[data-show-planning="tasks"]').last.click()
 assert page.locator('[data-plan-clear]').count()==0
 page.locator('[data-plan-detail="owner-task"]').click();assert page.locator('[data-plan-delete]').count()==0
 page.locator('[data-show-planning="tasks"]').last.click();page.locator('[data-plan-detail="my-task"]').click()
 expect(page.locator('[data-plan-delete]')).to_be_visible();c.close()
 # Localized forms and narrow layouts.
 for locale,heading in [('en-GB','Edit task'),('ro-RO','Editează sarcina')]:
  c,page=context(b,OWNER,locale);page.locator('[data-tab="tasks"]').first.click();page.locator('[data-show-planning="tasks"]').last.click()
  page.locator('[data-plan-detail="owner-task"]').click();page.locator('[data-plan-edit]').click()
  expect(page.get_by_role('heading',name=heading,exact=True)).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  c.close()
 assert not errors,errors
 print('PASS: optional creation/edit budget, UTC deadlines, important tasks, preserved poll votes, reminders, closed polls, compact paged lists, safe deletion and ES/EN/RO mobile layouts')
 b.close()
