"""Capture the actual DivZplit UI with clearly fictional local fixtures.
No live accounts, API writes or emails. Run a local server first.
NEXO_URL=http://127.0.0.1:3030/app/ python3 scripts/capture-landing.py
"""
import io,json,os,time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/landing';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3030/app/')
OWNER='11111111-1111-4111-8111-111111111111'
MEMBERS=[{'id':OWNER,'name':'Alex','initials':'AL','color':'purple'},{'id':'22222222-2222-4222-8222-222222222222','name':'Nora','initials':'NO','color':'pink'},{'id':'33333333-3333-4333-8333-333333333333','name':'Dani','initials':'DA','color':'blue'},{'id':'44444444-4444-4444-8444-444444444444','name':'Lucía','initials':'LU','color':'orange'}]
COPY={
'es':{'trip':'Escapada a Lisboa','home':'Nuestra casa','friends':'Planes con amigos','dinner':'Cena en Alfama','tram':'Tranvía y miradores','stay':'Apartamento en Lisboa','breakfast':'Desayuno juntos','museum':'Entradas al museo','rent':'Alquiler de noviembre','food':'Compra de la semana','taxi':'Taxi de vuelta','new':'Escapada a Sevilla','newPlace':'Sevilla, España','expense':'Cena del viernes'},
'en':{'trip':'Lisbon weekend','home':'Our place','friends':'Plans with friends','dinner':'Dinner in Alfama','tram':'Tram and viewpoints','stay':'Apartment in Lisbon','breakfast':'Breakfast together','museum':'Museum tickets','rent':'November rent','food':'Weekly groceries','taxi':'Taxi home','new':'Weekend in Seville','newPlace':'Seville, Spain','expense':'Friday dinner'},
'ro':{'trip':'Weekend la Lisabona','home':'Casa noastră','friends':'Planuri cu prietenii','dinner':'Cină în Alfama','tram':'Tramvai și belvedere','stay':'Apartament în Lisabona','breakfast':'Micul dejun împreună','museum':'Bilete la muzeu','rent':'Chiria din noiembrie','food':'Cumpărături săptămânale','taxi':'Taxi spre casă','new':'Weekend la Sevilla','newPlace':'Sevilla, Spania','expense':'Cina de vineri'}}
DEMO_TEXT={
 'es':{'poll':'¿Qué hacemos el sábado?','options':['Ruta junto al río','Museo y café','Tarde en la playa'],'tasks':['Reservar la cena','Comprar los billetes','Preparar la ruta'],'shopping':['Pan','Tomates','Pasta','Café'],'quantity':['2 barras','1 kg','2 paquetes','1 paquete']},
 'en':{'poll':'What shall we do on Saturday?','options':['Riverside walk','Museum and coffee','Afternoon at the beach'],'tasks':['Book dinner','Buy the tickets','Plan the route'],'shopping':['Bread','Tomatoes','Pasta','Coffee'],'quantity':['2 loaves','1 kg','2 packs','1 pack']},
 'ro':{'poll':'Ce facem sâmbătă?','options':['Plimbare pe malul râului','Muzeu și cafea','După-amiază la plajă'],'tasks':['Rezervă cina','Cumpără biletele','Pregătește traseul'],'shopping':['Pâine','Roșii','Paste','Cafea'],'quantity':['2 pâini','1 kg','2 pachete','1 pachet']}
}
def fixtures(lang):
 c=COPY[lang]
 def expense(key,amount,payer,participants=MEMBERS):return {'id':key,'title':c[key],'amount':amount,'payer':MEMBERS[payer]['id'],'participants':[m['id'] for m in participants],'category':'Alojamiento' if key in ['stay','rent'] else 'Transporte' if key in ['tram','taxi'] else 'Comida','date':'2026-11-05','createdBy':MEMBERS[payer]['id']}
 rows=[]
 for i,(key,kind,expenses,members,budget) in enumerate([
 ('trip','Viaje',[expense('dinner',8600,1),expense('tram',6400,2),expense('stay',24000,0),expense('breakfast',4000,0),expense('museum',4800,3)],MEMBERS,70000),
 ('home','Convivencia',[expense('food',7800,1,MEMBERS[:3]),expense('rent',90000,0,MEMBERS[:3])],MEMBERS[:3],0),
 ('friends','Plan con amigos',[expense('dinner',13200,1,MEMBERS[:3]),expense('taxi',4200,0,MEMBERS[:3])],MEMBERS[:3],0)]):
  gid=f'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa{i}'
  doc={'id':gid,'name':c[key],'emoji':['🚋','🪴','🍕'][i],'type':kind,'place':'Lisboa, Portugal' if i==0 else '', 'date':'2026-11-06' if i==0 else '', 'endDate':'2026-11-08' if i==0 else '', 'budget':budget,'currency':'EUR','members':members,'expenses':expenses,'payments':[],'tasks':[{'id':f'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb{j}','title':title,'assignee':MEMBERS[j]['id'],'done':j==2,'createdBy':OWNER,'dueAt':'2026-12-04T15:00:00Z'} for j,title in enumerate(DEMO_TEXT[lang]['tasks'])],'polls':[{'id':'cccccccc-cccc-4ccc-8ccc-cccccccccccc','title':DEMO_TEXT[lang]['poll'],'description':'','options':[{'id':str(j),'label':label,'emoji':['🌿','☕','☀️'][j]} for j,label in enumerate(DEMO_TEXT[lang]['options'])],'votes':{OWNER:'0',MEMBERS[1]['id']:'1',MEMBERS[2]['id']:'0'},'createdBy':OWNER}]}
  rows.append({'id':gid,'owner_id':OWNER,'version':1,'document':doc})
 return rows

MANIFEST={}
def save(raw,name):
 image=Image.open(io.BytesIO(raw)).convert('RGB');MANIFEST[name]={'width':image.width//2,'height':image.height//2};(OUT/'manifest.json').write_text(json.dumps({'source':'Actual DivZplit UI rendered by Playwright with fictional local data','images':MANIFEST},ensure_ascii=False,indent=2)+'\n');image.save(OUT/(name+'-2x.webp'),'WEBP',quality=84,method=6)
 image.resize((image.width//2,image.height//2),Image.Resampling.LANCZOS).save(OUT/(name+'.webp'),'WEBP',quality=84,method=6)

def context(browser,lang,viewport=None):
 rows=fixtures(lang);c=browser.new_context(locale={'es':'es-ES','en':'en-GB','ro':'ro-RO'}[lang],viewport=viewport or {'width':393,'height':852},device_scale_factor=2,reduced_motion='reduce')
 token={'access_token':'local-screenshot-fixture','refresh_token':'local-fixture-refresh','expires_at':int(time.time())+3600}
 c.add_init_script('try{localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps(token))+');}catch{}')
 c.route('**/config.js',lambda route:route.fulfill(content_type='text/javascript',body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_screenshot_fixture'};"))
 def api(route):
  path=urlsplit(route.request.url).path
  if path=='/auth/v1/user':data={'id':OWNER,'email':'alex@example.test','created_at':'2026-01-01T00:00:00Z','last_sign_in_at':'2026-11-05T10:00:00Z','user_metadata':{'display_name':'Alex','notification_intro_pending':False}}
  elif path=='/auth/v1/settings':data={'external':{'google':False,'apple':False}}
  elif path=='/rest/v1/nexo_groups':data=rows
  elif path.endswith('/divzplit_collaboration_support') or path.endswith('/divzplit_expense_tools_support') or path.endswith('/divzplit_currency_support') or path.endswith('/divzplit_fx_support'):data=True
  elif path.endswith('/divzplit_planning_support'):data={'enabled':True,'scheduling':True}
  elif path.endswith('/divzplit_get_notification_settings'):data={'expenses':True,'polls':True,'tasks':True,'payments':True,'shopping':True,'muted_groups':[],'push_ready':False}
  elif path.endswith('/divzplit_notification_inbox'):data={'items':[],'unread':0,'next':None}
  elif path.endswith('/divzplit_shopping_list'):data=[{'id':f'dddddddd-dddd-4ddd-8ddd-ddddddddddd{j}','title':title,'quantity':DEMO_TEXT[lang]['quantity'][j],'bought':j==3,'created_by':OWNER,'expense_id':None,'version':1} for j,title in enumerate(DEMO_TEXT[lang]['shopping'])]
  elif path=='/functions/v1/exchange-rates':data={'id':'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','currency':'USD','rate':'1.09','rate_date':'2026-11-05','source':'ECB','expires_at':'2099-01-01T00:00:00Z'}
  elif path.startswith('/rest/v1/'):data=[]
  else:raise AssertionError('Unexpected capture request: '+path)
  route.fulfill(content_type='application/json',body=json.dumps(data,ensure_ascii=False))
 c.route('https://nexo-test.supabase.co/**',api)
 return c,rows

def capture(browser,lang):
 c,rows=context(browser,lang)
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 expect(page.locator('.home-balance')).to_be_visible();page.evaluate('document.fonts.ready');page.locator('.home-balance').scroll_into_view_if_needed();page.evaluate('scrollTo(0,0)')
 save(page.screenshot(),lang+'-home')
 page.set_viewport_size({'width':402,'height':874})
 if os.environ.get('CAPTURE_WELCOME','1')!='0':page.screenshot(path=str(ROOT/'assets'/('welcome-'+lang+'.png')))
 page.set_viewport_size({'width':393,'height':852})
 save(page.locator('.home-balance').screenshot(),lang+'-balance')
 save(page.locator('.home-recent .expense-row').first.screenshot(),lang+'-recent')
 page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-group]').click()
 page.locator('#group-form input[name=name]').fill(COPY[lang]['new']);page.locator('#group-form input[name=place]').fill(COPY[lang]['newPlace']);page.locator('#group-form input[name=date]').fill('2026-12-04');page.locator('#group-form input[name=endDate]').fill('2026-12-06')
 page.locator('#group-form input[name=budget]').fill('600');page.locator('#group-form input[name=budget]').blur();save(page.screenshot(),lang+'-group')
 page.locator('[data-action=close-modal]').first.click();page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-expense]').click()
 page.locator('#expense-form input[name=amount]').fill('86');page.locator('#expense-form input[name=title]').fill(COPY[lang]['expense']);page.locator('#expense-form input[name=title]').blur();save(page.screenshot(),lang+'-expense')
 page.locator('[data-action=close-modal]').first.click();page.locator('[data-action=settlements]').click();expect(page.locator('.settlements-dialog')).to_be_visible();save(page.screenshot(),lang+'-settlements')
 if not page.locator('[data-fx-target]').is_visible():page.locator('.fx-disclosure>summary').click()
 page.locator('[data-fx-target]').select_option('USD');expect(page.locator('.fx-detail')).to_be_visible();expect(page.locator('.fx-panel [role=alert]')).to_have_count(0);page.locator('.fx-panel').scroll_into_view_if_needed();save(page.screenshot(),lang+'-currency')
 page.locator('[data-action=close-modal]').first.click()
 def navigate(route):
  if page.locator('.back-to-home:visible').count():page.locator('.back-to-home').click()
  # Use visible home shortcuts/dock; the mobile drawer gesture was removed.
  page.locator('.reference-dock [data-route=home]').click()
  if route in ['home','expenses','tasks','polls','shopping']:
   if route=='expenses':page.locator('.home-recent [data-route=expenses]').click()
   elif route!='home':page.locator('.home-reference-action[data-route='+route+']').click()
  else:
   viewport=page.viewport_size.copy();page.set_viewport_size({'width':1024,'height':viewport['height']})
   page.locator('.workspace-sidebar [data-route='+route+']').click();page.set_viewport_size(viewport)
  page.evaluate('scrollTo(0,0)')
 navigate('expenses');expect(page.locator('.expense-list')).to_be_visible();save(page.screenshot(),lang+'-expenses')
 navigate('shopping');expect(page.locator('.shopping-row')).to_have_count(4);save(page.screenshot(),lang+'-shopping')
 for route in ['polls','tasks']:
  navigate(route)
  # Current app displays the actual planning cards inline.
  expect(page.locator('.poll-card' if route=='polls' else '.task-row')).to_have_count(1 if route=='polls' else 3)
  save(page.screenshot(),lang+'-'+route)
 navigate('budget');expect(page.locator('.budget-card')).to_be_visible();save(page.screenshot(),lang+'-budget')
 # The real group selector fits the phone and shows both household and travel groups.
 navigate('home');page.locator('.home-group-picker').click();expect(page.locator('.home-group-option')).to_have_count(3);assert page.locator('.home-modes').count()==0;save(page.screenshot(),lang+'-groups');page.locator('[data-action=close-modal]').first.click()
 for i,key in [(1,'house'),(2,'friends')]:
  page.evaluate('(value)=>sessionStorage.setItem('+json.dumps('nexo-active-'+OWNER)+',value)',rows[i]['id']);page.reload();expect(page.locator('.home-balance')).to_be_visible();page.evaluate('document.fonts.ready');save(page.screenshot(),lang+'-'+key)
 assert not errors,errors
 c.close();print('CAPTURED',lang,'actual app screenshots with local example data',flush=True)

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for lang in ['es','en','ro']:capture(browser,lang)
  browser.close()
