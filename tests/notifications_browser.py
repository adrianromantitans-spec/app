"""Notification UI with local transport and Push API fixtures; no real push sent."""
import json,time,os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
OWNER='11111111-1111-4111-8111-111111111111';OTHER='22222222-2222-4222-8222-222222222222';GID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';NID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
group={'id':GID,'owner_id':OWNER,'version':1,'document':{'id':GID,'name':'Grupo <amigos>','emoji':'🌴','type':'Viaje','place':'','date':'','endDate':'','budget':10000,'currency':'EUR','members':[{'id':OWNER,'name':'Ana','initials':'AN','color':'purple'},{'id':OTHER,'name':'Luis','initials':'LU','color':'blue'}],'expenses':[],'payments':[],'tasks':[],'polls':[]}}
errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for locale,ios in [('es-ES',True),('en-GB',False),('ro-RO',False)]:
  c=b.new_context(locale=locale,viewport={'width':393,'height':852},reduced_motion='reduce',user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' if ios else None)
  settings={'expenses':True,'polls':True,'tasks':True,'payments':True,'shopping':True,'shopping_ready':True,'muted_groups':[],'push_ready':True,'public_key':'B'+'A'*86};read=False;deleted=False;saved=[];registered=[];open_kind='expenses.added'
  c.add_init_script('localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps({'access_token':'fixture','refresh_token':'fixture-refresh','expires_at':int(time.time())+3600}))+');')
  c.add_init_script('''
   window.__registrationURLs=[];window.__permissionCalls=0;window.__binding=null;window.__subscription=null;window.__permission='default';
   Object.defineProperty(Notification,'permission',{get:()=>window.__permission});
   Notification.requestPermission=()=>{window.__permissionCalls++;window.__permission='granted';return Promise.resolve('granted');};
   const registration={active:{postMessage:(data,ports)=>{if(data.type==='CLEAR_PUSH_ACCOUNT')window.__binding=null;if(data.type==='SET_PUSH_ACCOUNT')window.__binding={userId:data.userId};ports[0].postMessage(window.__binding);}},pushManager:{getSubscription:()=>Promise.resolve(window.__subscription),subscribe:async()=>window.__subscription={endpoint:'https://fcm.googleapis.com/fcm/send/fixture',toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>{window.__subscription=null;return true;}}}};
   Object.defineProperty(navigator,'serviceWorker',{value:{register:async(url,options)=>{window.__registrationURLs.push({url:String(url),scope:options.scope});return registration;},ready:Promise.resolve(registration)}});
  ''')
  c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
  def api(route):
   global read,deleted
   path=urlsplit(route.request.url).path;data=json.loads(route.request.post_data or '{}');value=None
   if path=='/auth/v1/user':value={'id':OWNER,'email':'test@example.test','user_metadata':{'display_name':'Ana'}}
   elif path=='/auth/v1/settings':value={'external':{'google':False,'apple':False}}
   elif path=='/auth/v1/logout':value={}
   elif path=='/rest/v1/nexo_groups':value=[group]
   elif path=='/rest/v1/nexo_deleted_groups':value=[]
   elif path.endswith('/divzplit_get_notification_settings'):value=settings
   elif path.endswith('/divzplit_notification_inbox'):value={'items':[] if deleted else [{'id':NID,'group_id':GID,'kind':open_kind,'category':'expenses','actor_name':'Luis','group_name':group['document']['name'],'subject':'Cena <script>test</script>','created_at':'2026-11-01T12:00:00Z','read_at':'2026-11-01T12:00:01Z' if read else None}],'unread':0 if read or deleted else 1,'next':None}
   elif path.endswith('/divzplit_clear_notifications'):deleted=True;value=1
   elif path.endswith('/divzplit_read_notifications'):read=True
   elif path.endswith('/divzplit_open_notification'):read=True;value={'group_id':GID,'kind':open_kind}
   elif path.endswith(('/divzplit_set_notification_settings','/divzplit_set_notification_settings_v2')):saved.append(data);settings.update({key:data['p_'+key] for key in ['expenses','polls','tasks','payments','shopping']});settings['muted_groups']=data['p_muted'];value=settings
   elif path.endswith('/divzplit_register_push'):registered.append(data)
   elif path.endswith('/divzplit_remove_push'):value=None
   else:route.fulfill(status=404,content_type='application/json',body='{"code":"PGRST202"}');return
   route.fulfill(content_type='application/json',body=json.dumps(value))
  c.route('https://nexo-test.supabase.co/**',api)
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(os.environ.get('NEXO_URL','http://127.0.0.1:3004/app/'))
  expect(page.locator('.notification-count')).to_have_text('1')
  assert page.evaluate('window.__permissionCalls')==0
  page.locator('.notification-bell').click();expect(page.locator('.notification-item')).to_be_visible()
  assert page.locator('.notification-item script').count()==0
  expect(page.locator('.notification-item')).to_contain_text('Cena <script>test</script>')
  page.locator('[data-notification-action="preferences"]').click()
  if ios:
   expect(page.locator('.notification-device')).to_contain_text('pantalla de inicio')
   assert page.locator('[data-notification-action="enable"]').count()==0
  else:
   page.locator('[data-notification-action="enable"]').click()
   expect(page.locator('[data-notification-action="disable"]')).to_be_visible()
   assert page.evaluate('window.__permissionCalls')==1 and len(registered)==1
   assert registered[0]['p_language']==locale[:2]
   assert page.evaluate("window.__registrationURLs.length>0 && window.__registrationURLs.every(r=>new URL(r.url).pathname==='/sw.js' && r.scope==='/')"), 'Keep the existing root worker and push subscription from /app/'
   assert page.evaluate('window.__binding.userId')==OWNER
  page.locator('[data-notification-pref="expenses"]').uncheck()
  page.locator('[data-notification-pref="shopping"]').uncheck()
  page.locator('[data-notification-mute]').check()
  page.locator('[data-notification-action="save"]').click()
  expect(page.locator('#toast')).to_be_visible()
  assert saved[-1]['p_shopping']==False and saved[-1]['p_expenses']==False and saved[-1]['p_muted']==[GID]
  page.locator('.notification-settings [data-notification-action="inbox"]').click()
  page.locator('[data-notification-action="read-all"]').click()
  expect(page.locator('.notification-count')).to_be_hidden()
  for width in [320,393,430,768]:
   page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path='work/notifications-'+locale[:2]+'.png',full_page=True)
  main_before=page.locator('#main').inner_html()
  page.locator('[data-notification-action="open"]').click();expect(page.locator('.notification-detail-subject')).to_contain_text('Cena <script>test</script>')
  assert page.locator('#main').inner_html()==main_before
  assert page.locator('.notification-detail script').count()==0
  page.locator('[data-action="close-modal"]').first.click()
  assert page.locator('.notification-dialog').count()==0
  for kind in ['tasks.added','tasks.updated','tasks.reminder','polls.added','polls.reminder','expenses.added','expenses.updated','expenses.deleted','payment.requested','payments.added','payment.rejected','payment.cancelled','shopping.added','shopping.reminder']:
   open_kind=kind
   page.locator('.notification-bell').click();page.locator('[data-notification-action="open"]').click()
   expect(page.locator('.notification-detail-subject')).to_contain_text('Cena <script>test</script>')
   assert page.locator('.notification-detail').count()==1
   assert page.locator('#poll-form,#task-form,#expense-form,.planning-list-dialog,.payment-list-dialog').count()==0
   assert page.locator('#main').inner_html()==main_before
   page.locator('[data-action="close-modal"]').first.click()
  # Section navigation is explicit, never an automatic consequence of opening an alert.
  open_kind='polls.reminder'
  page.locator('.notification-bell').click();page.locator('[data-notification-action="open"]').click()
  page.locator('[data-notification-action="view-group"]').click()
  expect(page.locator('.planning-list-dialog')).to_have_attribute('data-kind','polls')
  page.locator('[data-action="close-modal"]').first.click()
  # An OS push link also opens only one alert, without navigating into creation.
  page.goto(os.environ.get('NEXO_URL','http://127.0.0.1:3004/app/')+'?notification='+NID)
  expect(page.locator('.notification-detail-subject')).to_be_visible()
  assert page.locator('#poll-form,#task-form,#expense-form,.planning-list-dialog').count()==0
  assert 'notification=' not in page.url
  page.locator('[data-action="close-modal"]').first.click()

  page.locator('.notification-bell').click()
  page.locator('[data-notification-action="clear"]').click()
  assert deleted==False
  page.locator('[data-notification-action="confirm-clear"]').click()
  expect(page.locator('.notification-item')).to_have_count(0)
  expect(page.locator('.notification-count')).to_be_hidden()
  assert deleted and settings['expenses']==False and settings['muted_groups']==[GID]
  page.locator('[data-action="close-modal"]').first.click()
  page.locator('[data-action="workspace-menu"]').click();page.locator('.navigation-drawer [data-route="profile"]').click()
  page.get_by_role('button',name={'es-ES':'Cerrar sesión','en-GB':'Sign out','ro-RO':'Deconectare'}[locale],exact=True).click()
  expect(page.locator('#account-form')).to_be_visible()
  assert page.evaluate('window.__binding') is None
  c.close()
 assert not errors,errors
 b.close()
print('PASS: ES/EN/RO bell, unread state, escaped content, preferences, group mute, user-driven permission, iPhone install help, group navigation and logout cleanup')
