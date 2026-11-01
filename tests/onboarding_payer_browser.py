"""Registration notification invitation and current-account expense payer fixtures."""
import copy,json,time
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';VIEWER='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
base={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Grupo compartido','emoji':'🌴','type':'Viaje','place':'','date':'','endDate':'','budget':10000,'currency':'EUR','members':[{'id':OWNER,'name':'Adrián','initials':'AD','color':'purple'},{'id':VIEWER,'name':'Lucía','initials':'LU','color':'blue'}],'expenses':[{'id':'old','title':'Cena anterior','amount':1000,'payer':OWNER,'participants':[OWNER,VIEWER],'category':'Comida','date':'2026-11-01','createdBy':VIEWER}],'payments':[],'tasks':[],'polls':[]}}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for locale,ios,installed in [('es-ES',False,False),('en-GB',False,False),('ro-RO',True,False),('es-ES',True,True)]:
  g=copy.deepcopy(base);metadata={'display_name':'Lucía','notification_intro_pending':True};updates=[];saved=[];registered=[];errors=[]
  c=b.new_context(locale=locale,viewport={'width':393,'height':852},reduced_motion='reduce',user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' if ios else None)
  c.add_init_script('localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps({'access_token':'fixture','refresh_token':'fixture-refresh','expires_at':int(time.time())+3600}))+');')
  c.add_init_script('Object.defineProperty(navigator,"standalone",{value:'+str(installed).lower()+'});')
  c.add_init_script('''window.__permissionCalls=0;window.__binding=null;window.__sub=null;window.__permission='default';
   Object.defineProperty(Notification,'permission',{get:()=>window.__permission});Notification.requestPermission=()=>{window.__permissionCalls++;window.__permission='granted';return Promise.resolve('granted');};
   const registration={active:{postMessage:(data,ports)=>{if(data.type==='CLEAR_PUSH_ACCOUNT')window.__binding=null;if(data.type==='SET_PUSH_ACCOUNT')window.__binding={userId:data.userId};ports[0].postMessage(window.__binding);}},pushManager:{getSubscription:async()=>window.__sub,subscribe:async()=>window.__sub={endpoint:'https://fcm.googleapis.com/fcm/send/fixture',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>{window.__sub=null;return true;}}}};
   Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration)}});''')
  c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
  def api(route):
   path=urlsplit(route.request.url).path;data=json.loads(route.request.post_data or '{}');value=None
   if path=='/auth/v1/user':
    if route.request.method=='PUT':updates.append(data);metadata.update(data['data'])
    value={'id':VIEWER,'email':'lucia@example.test','user_metadata':metadata}
   elif path=='/auth/v1/settings':value={'external':{'google':False,'apple':False}}
   elif path=='/rest/v1/nexo_groups':value=[g]
   elif path=='/rest/v1/nexo_deleted_groups':value=[]
   elif path.endswith('/divzplit_get_notification_settings'):value={'expenses':True,'polls':True,'tasks':True,'payments':True,'muted_groups':[],'push_ready':True,'public_key':'B'+'A'*86}
   elif path.endswith('/divzplit_notification_inbox'):value={'items':[],'unread':0,'next':None}
   elif path.endswith('/divzplit_register_push'):registered.append(data)
   elif path.endswith('/nexo_save_group'):g['document']=data['p_document'];g['version']+=1;saved.append(data);value=g
   else:route.fulfill(status=404,content_type='application/json',body='{"code":"PGRST202"}');return
   route.fulfill(content_type='application/json',body=json.dumps(value))
  c.route('https://nexo-test.supabase.co/**',api)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:3005/')
  expect(page.locator('.notification-onboarding')).to_be_visible()
  assert page.evaluate('window.__permissionCalls')==0
  page.wait_for_function("localStorage.getItem('divzplit-notification-intro:22222222-2222-4222-8222-222222222222')==='1'")
  assert updates[0]['data']=={'notification_intro_pending':False}
  if ios and not installed:
   assert page.locator('.notification-onboarding [data-notification-action="enable"]').count()==0
   expect(page.locator('.notification-onboarding [data-notification-action="preferences"]')).to_be_visible()
   page.locator('[data-notification-action="later"]').click()
  elif installed:
   page.locator('.notification-onboarding [data-notification-action="enable"]').click()
   expect(page.locator('.notification-onboarding')).to_have_count(0)
   assert page.evaluate('window.__permissionCalls')==1 and len(registered)==1
  else:page.locator('[data-notification-action="later"]').click()
  page.locator('[data-action="new-expense"]:visible').first.click()
  form=page.locator('#expense-form');expect(form.locator('[name="payer"]')).to_have_value('you')
  expect(form.locator('[name="payer"] option').first).to_have_attribute('value','you')
  expect(form.locator('[name="payer"] option').first).to_contain_text('Lucía')
  assert [m['id'] for m in g['document']['members']]==[OWNER,VIEWER]
  form.locator('[name="payer"]').select_option(OWNER)
  page.locator('[data-action="close-modal"]').first.click()
  page.locator('[data-action="new-expense"]:visible').first.click();form=page.locator('#expense-form')
  expect(form.locator('[name="payer"]')).to_have_value('you')
  form.locator('[name="title"]').fill('Compra nueva');form.locator('[name="amount"]').fill('12.34');form.locator('[type="submit"]').click()
  expect(page.locator('#expense-form')).to_have_count(0)
  assert saved[-1]['p_document']['expenses'][0]['payer']==VIEWER
  assert [m['id'] for m in saved[-1]['p_document']['members']]==[OWNER,VIEWER]
  page.locator('[data-expense="old"]:visible').first.click();page.locator('[data-edit-expense="old"]').click()
  expect(page.locator('#expense-form [name="payer"]')).to_have_value(OWNER)
  page.locator('[data-action="close-modal"]').first.click();page.reload();expect(page.locator('.topbar')).to_be_visible();page.wait_for_timeout(1200)
  assert page.locator('.notification-onboarding').count()==0
  assert not errors,errors
  c.close()
 b.close()
print('PASS: signup invitation once, no automatic OS prompt, iPhone install/PWA handling, self-first default payer, reset per new expense, unchanged member order and preserved payer on edits in ES/EN/RO')
