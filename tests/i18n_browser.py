"""Real browser languages; local demo data only, no emails or real accounts."""
import os
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3000/')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 errors=[]
 labels={
  'es-ES':{'lang':'es','login':'Iniciar sesión','signup':'Crear cuenta','demo':'Explorar una demo','name':'¿Cómo te llamas?'},
  'en-GB':{'lang':'en','login':'Sign in','signup':'Create account','demo':'Explore a demo','name':"What's your name?"},
  'ro-RO':{'lang':'ro','login':'Autentificare','signup':'Creează un cont','demo':'Explorează un demo','name':'Cum te numești?'},
  'fr-FR':{'lang':'en','login':'Sign in','signup':'Create account','demo':'Explore a demo','name':"What's your name?"}
 }
 for locale,text in labels.items():
  c=browser.new_context(locale=locale,viewport={'width':390,'height':844})
  c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body="export const cloudConfig={url:'https://i18n-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
  c.route('**/auth/v1/settings',lambda r:r.fulfill(content_type='application/json',body='{"external":{}}',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,OPTIONS'}))
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
  expect(page.locator('html')).to_have_attribute('lang',text['lang'])
  expect(page.get_by_role('link',name=text['login'],exact=False)).to_be_visible()
  page.get_by_role('link',name=text['signup'],exact=False).click()
  expect(page.get_by_label(text['name'],exact=True)).to_be_visible()
  # Reject credentials locally to verify translated server errors without real accounts.
  def token(route):
   headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}
   route.fulfill(status=204 if route.request.method=='OPTIONS' else 400,content_type='application/json',body='' if route.request.method=='OPTIONS' else '{"code":"invalid_credentials"}',headers=headers)
  c.route('**/auth/v1/token?**',token)
  page.get_by_role('link',name=text['login'],exact=False).click()
  email_label={'es':'Correo electrónico','en':'Email address','ro':'Adresă de e-mail'}[text['lang']]
  password_label={'es':'Contraseña','en':'Password','ro':'Parolă'}[text['lang']]
  form=page.locator('#account-form')
  form.get_by_label(email_label,exact=True).fill('fixture@example.test')
  form.get_by_label(password_label,exact=True).fill('fixture-password')
  form.get_by_role('button',name=text['login'],exact=False).click()
  expected_error={'es':'El correo o la contraseña no son correctos.','en':'The email address or password is incorrect.','ro':'Adresa de e-mail sau parola este incorectă.'}[text['lang']]
  expect(form.get_by_role('alert')).to_contain_text(expected_error)
  page.get_by_role('button',name=text['demo'],exact=False).click()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if locale=='en-GB':
   page.get_by_role('button',name='Create group',exact=True).first.click()
   form=page.locator('#group-form');form.get_by_label('Group name',exact=True).fill('Mis grupos <test>')
   form.get_by_label('Group type',exact=False).select_option(label='Shared home')
   form.get_by_label('Total group budget (€)').fill('1000')
   form.get_by_label("Who's joining?",exact=False).fill('Gastos')
   form.get_by_role('button',name='Create group',exact=True).click()
   expect(page.get_by_role('heading',name='Mis grupos <test>',exact=True)).to_be_visible()
   page.get_by_role('button',name='Add expense',exact=True).first.click()
   form=page.locator('#expense-form');form.get_by_label('What did you pay for?',exact=True).fill('Guardar gasto')
   form.get_by_label('Amount (€)',exact=True).fill('10.01')
   form.get_by_label('Category',exact=False).select_option(label='Food')
   assert form.get_by_label('Repeat',exact=False).locator('option[value=monthly]').inner_text()=='Every month'
   form.get_by_role('button',name='Save expense',exact=True).click()
   expect(page.get_by_text('Guardar gasto',exact=True)).to_be_visible()
   raw=page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1'))")
   g=next(g for g in raw['groups'] if g['name']=='Mis grupos <test>')
   assert g['type']=='Convivencia' and g['expenses'][0]['category']=='Comida'
   assert g['expenses'][0]['amount']==1001
   saved=c.storage_state()
   romanian=browser.new_context(locale='ro-RO',storage_state=saved,viewport={'width':390,'height':844})
   romanian.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body="export const cloudConfig={url:'https://i18n-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
   rp=romanian.new_page();rp.goto(BASE);rp.get_by_role('button',name='Explorează un demo',exact=False).click()
   expect(rp.get_by_role('heading',name='Mis grupos <test>',exact=True)).to_be_visible()
   expect(rp.get_by_text('Guardar gasto',exact=True)).to_be_visible()
   actual=rp.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1'))")
   assert actual==raw,'Changing language must not migrate or translate persisted data'
   expected=rp.evaluate("new Intl.NumberFormat('ro-RO',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(10.01)")
   assert expected in rp.locator('body').inner_text()
   assert rp.evaluate('document.documentElement.scrollWidth<=innerWidth')
   romanian.close()
  print('PASS:',locale,'automatic language, mobile layout and localized controls')
  c.close()
 # The first supported language can be a secondary preference.
 pref=browser.new_context(locale='fr-FR')
 pref.add_init_script("Object.defineProperty(navigator,'languages',{get:()=>['fr-FR','ro-RO','es-ES']})")
 pref.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
 pp=pref.new_page();pp.goto(BASE)
 expect(pp.locator('html')).to_have_attribute('lang','ro')
 expect(pp.get_by_role('link',name='Autentificare',exact=False)).to_be_visible()
 pref.close()
 assert not errors,errors
 browser.close()
print('PASS: shared canonical values, euro amounts, user content and storage survive a language change unchanged')
