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
def fixtures(lang):
 c=COPY[lang]
 def expense(key,amount,payer,participants=MEMBERS):return {'id':key,'title':c[key],'amount':amount,'payer':MEMBERS[payer]['id'],'participants':[m['id'] for m in participants],'category':'Alojamiento' if key in ['stay','rent'] else 'Transporte' if key in ['tram','taxi'] else 'Comida','date':'2026-11-05','createdBy':MEMBERS[payer]['id']}
 rows=[]
 for i,(key,kind,expenses,members,budget) in enumerate([
 ('trip','Viaje',[expense('dinner',8600,1),expense('tram',6400,2),expense('stay',24000,0),expense('breakfast',4000,0),expense('museum',4800,3)],MEMBERS,70000),
 ('home','Convivencia',[expense('food',7800,1,MEMBERS[:3]),expense('rent',90000,0,MEMBERS[:3])],MEMBERS[:3],0),
 ('friends','Plan con amigos',[expense('dinner',13200,1,MEMBERS[:3]),expense('taxi',4200,0,MEMBERS[:3])],MEMBERS[:3],0)]):
  gid=f'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa{i}'
  doc={'id':gid,'name':c[key],'emoji':['🚋','🪴','🍕'][i],'type':kind,'place':'Lisboa, Portugal' if i==0 else '', 'date':'2026-11-06' if i==0 else '', 'endDate':'2026-11-08' if i==0 else '', 'budget':budget,'currency':'EUR','members':members,'expenses':expenses,'payments':[],'tasks':[],'polls':[]}
  rows.append({'id':gid,'owner_id':OWNER,'version':1,'document':doc})
 return rows

MANIFEST={}
def save(raw,name):
 image=Image.open(io.BytesIO(raw)).convert('RGB');MANIFEST[name]={'width':image.width//2,'height':image.height//2};(OUT/'manifest.json').write_text(json.dumps({'source':'Actual DivZplit UI rendered by Playwright with fictional local data','images':MANIFEST},ensure_ascii=False,indent=2)+'\n');image.save(OUT/(name+'-2x.webp'),'WEBP',quality=84,method=6)
 image.resize((image.width//2,image.height//2),Image.Resampling.LANCZOS).save(OUT/(name+'.webp'),'WEBP',quality=84,method=6)

def capture(browser,lang):
 rows=fixtures(lang);c=browser.new_context(locale={'es':'es-ES','en':'en-GB','ro':'ro-RO'}[lang],viewport={'width':393,'height':852},device_scale_factor=2,reduced_motion='reduce')
 token={'access_token':'local-screenshot-fixture','refresh_token':'local-fixture-refresh','expires_at':int(time.time())+3600}
 c.add_init_script('localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps(token))+');')
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
  elif path.startswith('/rest/v1/'):data=[]
  else:raise AssertionError('Unexpected capture request: '+path)
  route.fulfill(content_type='application/json',body=json.dumps(data,ensure_ascii=False))
 c.route('https://nexo-test.supabase.co/**',api)
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 expect(page.locator('.home-balance')).to_be_visible();page.evaluate('document.fonts.ready');page.locator('.home-balance').scroll_into_view_if_needed();page.evaluate('scrollTo(0,0)')
 save(page.screenshot(),lang+'-home')
 save(page.locator('.home-balance').screenshot(),lang+'-balance')
 save(page.locator('.home-recent .expense-row').first.screenshot(),lang+'-recent')
 page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-group]').click()
 page.locator('#group-form input[name=name]').fill(COPY[lang]['new']);page.locator('#group-form input[name=place]').fill(COPY[lang]['newPlace']);page.locator('#group-form input[name=date]').fill('2026-12-04');page.locator('#group-form input[name=endDate]').fill('2026-12-06')
 page.locator('#group-form input[name=budget]').fill('600');page.locator('#group-form input[name=budget]').blur();save(page.screenshot(),lang+'-group')
 page.locator('[data-action=close-modal]').first.click();page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-expense]').click()
 page.locator('#expense-form input[name=amount]').fill('86');page.locator('#expense-form input[name=title]').fill(COPY[lang]['expense']);page.locator('#expense-form input[name=title]').blur();save(page.screenshot(),lang+'-expense')
 page.locator('[data-action=close-modal]').first.click();page.locator('[data-action=settlements]').click();expect(page.locator('.settlements-dialog')).to_be_visible();save(page.screenshot(),lang+'-settlements')
 page.locator('[data-action=close-modal]').first.click()
 for i,key in [(1,'house'),(2,'friends')]:
  page.evaluate('(value)=>sessionStorage.setItem('+json.dumps('nexo-active-'+OWNER)+',value)',rows[i]['id']);page.reload();expect(page.locator('.home-balance')).to_be_visible();page.evaluate('document.fonts.ready');save(page.screenshot(),lang+'-'+key)
 assert not errors,errors
 c.close();print('CAPTURED',lang,'actual app screenshots with local example data',flush=True)

if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for lang in ['es','en','ro']:capture(browser,lang)
  browser.close()
