"""Navigation and action tests for the glass layout. Demo data only."""
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:3000/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 labels={
  'es-ES':('Explorar una demo','Añadir','Añadir gasto','Tu perfil, a tu manera.'),
  'en-GB':('Explore a demo','Add','Add expense','Your profile, your way.'),
  'ro-RO':('Explorează un demo','Adaugă','Adaugă o cheltuială','Profilul tău, așa cum îți place.')
 }
 for locale,(demo,add,expense,profile) in labels.items():
  c=b.new_context(locale=locale,viewport={'width':390,'height':844})
  c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE);page.get_by_role('button',name=demo,exact=False).click()
  expect(page.locator('.mobile-nav .mobile-nav-item')).to_have_count(4)
  expect(page.locator('.mobile-nav [data-page=home]')).to_have_attribute('aria-current','page')
  page.locator('.nav-add').click();expect(page.get_by_role('dialog')).to_be_visible()
  expect(page.locator('.nav-add')).to_have_attribute('aria-expanded','true')
  page.locator('[data-quick-group]').select_option('piso')
  expect(page.locator('.quick-add-context')).to_contain_text('Nuestro pisito')
  page.keyboard.press('Escape');expect(page.locator('.nav-add')).to_have_attribute('aria-expanded','false')
  assert page.locator('.nav-add').evaluate('el=>document.activeElement===el')
  page.locator('.nav-add').click();page.get_by_role('dialog').get_by_role('button',name=expense,exact=False).click()
  f=page.locator('#expense-form');expect(f).to_be_visible()
  f.locator('[name=title]').fill('Quick action expense');f.locator('[name=amount]').fill('7.50')
  f.get_by_role('button',name={'es-ES':'Guardar gasto','en-GB':'Save expense','ro-RO':'Salvează cheltuiala'}[locale],exact=False).click()
  state=page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1'))")
  assert state['activeGroup']=='piso'
  assert state['groups'][1]['expenses'][0]['title']=='Quick action expense'
  assert len(state['groups'][0]['expenses'])==3
  for width in [320,360,390,430,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900})
   for route in ['home','groups','activity','profile','budget']:
    nav='.mobile-nav' if width<=760 and route!='budget' else '.sidebar'
    if width<=760 and route=='budget':
     page.locator('.mobile-nav [data-page=home]').click();page.locator('.stats-context [data-page=budget]').click()
    else:page.locator(nav+' [data-page='+route+']').first.click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(locale,width,route)
   if width<=760:
    page.locator('.mobile-nav [data-page=profile]').click();expect(page.get_by_role('heading',name=profile)).to_be_visible()
    page.locator('.mobile-nav [data-page=home]').click()
    page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
    assert page.locator('.mobile-nav').evaluate('el=>el.getBoundingClientRect().bottom<=innerHeight')
   else:expect(page.locator('.mobile-nav')).not_to_be_visible()
  assert not errors,errors
  c.close();print('PASS:',locale,'quick actions select the right group, Profile/Budget remain accessible, phone/tablet/desktop fit')
 # An empty account/demo still has a useful + menu and a reachable profile.
 c=b.new_context(locale='en-GB',viewport={'width':320,'height':700},reduced_motion='reduce')
 c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
 c.add_init_script("localStorage.setItem('nexo-local-v1',JSON.stringify({version:1,activeGroup:null,groups:[]}))")
 page=c.new_page();page.goto(BASE);page.get_by_role('button',name='Explore a demo',exact=False).click()
 page.locator('.nav-add').click();expect(page.get_by_role('dialog').get_by_role('button',name='Create group',exact=False)).to_be_visible()
 assert page.locator('[data-action=new-expense]').count()==0
 assert page.get_by_role('dialog').evaluate('el=>getComputedStyle(el).animationName')=='none'
 page.keyboard.press('Escape');page.locator('.mobile-nav [data-page=profile]').click()
 expect(page.get_by_role('heading',name='Your profile, your way.')).to_be_visible()
 b.close();print('PASS: no-group + menu, keyboard return and reduced motion')
