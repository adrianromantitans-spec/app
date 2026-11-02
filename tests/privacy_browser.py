"""Legal entry points and user-sent requests. All Auth traffic is a local fixture."""
from pathlib import Path
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,seen=context(browser,enabled=True);page=c.new_page();page.goto(BASE+'#registro')
 page.get_by_label('¿Cómo te llamas?').fill('Ana');page.get_by_label('Correo electrónico',exact=True).fill('ana@example.test');page.get_by_label('Contraseña',exact=True).fill('fixture-password')
 page.get_by_role('button',name='Crear cuenta',exact=True).click();assert len(seen['signup'])==0
 page.locator('select[name=ageBand]').select_option('under_16')
 expect(page.get_by_role('heading',name='Registro a partir de 16 años',exact=True)).to_be_visible();assert len(seen['signup'])==0
 assert page.locator('[data-kind=guardian]').count()==0
 page.goto(BASE+'#registro');page.get_by_label('¿Cómo te llamas?').fill('Ana');page.get_by_label('Correo electrónico',exact=True).fill('ana@example.test');page.get_by_label('Contraseña',exact=True).fill('fixture-password');page.locator('select[name=ageBand]').select_option('16_or_over');page.locator('input[name=acceptTerms]').check();page.get_by_role('button',name='Crear cuenta',exact=True).click()
 expect(page.get_by_role('heading',name='Revisa tu correo',exact=True)).to_be_visible();assert len(seen['signup'])==1;assert seen['signup'][0]['data']['terms_version']=='2026-11-02.2';assert seen['signup'][0]['data']['declared_age_band']=='16_or_over'
 print('PASS: email signup requires explicit terms and age band; under-16 registration is stopped without a guardian registration route')
 c.close()
 for provider in ['google','apple']:
  c,seen=context(browser,enabled=True);page=c.new_page();page.goto(BASE)
  page.get_by_role('button',name='Continuar con '+provider.title(),exact=True).click();assert seen['oauth']==[]
  expect(page.locator('#oauth-consent-form')).to_be_visible();page.locator('select[name=ageBand]').select_option('under_16');expect(page.get_by_role('heading',name='Registro a partir de 16 años',exact=True)).to_be_visible();assert seen['oauth']==[]
  page.get_by_role('button',name='Entendido',exact=True).click();page.get_by_role('button',name='Continuar con '+provider.title(),exact=True).click();page.locator('select[name=ageBand]').select_option('16_or_over');page.locator('input[name=acceptTerms]').check();page.locator('#oauth-consent-form').get_by_role('button',name='Continuar',exact=True).click()
  expect(page.locator('.workspace-sidebar')).to_be_visible();assert len(seen['oauth'])==1 and len(seen['exchange'])==1
  page.locator('.drawer-profile').click();page.get_by_role('button',name='Privacidad y mis datos',exact=True).click()
  if provider=='google':
   page.get_by_role('button',name='Descargar datos de mi cuenta',exact=True).click();expect(page.locator('#toast')).to_contain_text('no está disponible todavía')
   c.route('**/__auth_fixture/rest/v1/rpc/divzplit_privacy_export',lambda r:r.fulfill(content_type='application/json',body=json.dumps({'account':{'id':USER['id']},'groups':[],'scope':{'fixture':True}})))
   with page.expect_download() as info:page.get_by_role('button',name='Descargar datos de mi cuenta',exact=True).click()
   assert json.loads(Path(info.value.path()).read_text())['account']['id']==USER['id']
  page.get_by_role('button',name='Cerrar mi cuenta y solicitar borrado',exact=True).click();page.locator('textarea[name=details]').fill('Please close my account');page.get_by_role('button',name='Preparar correo',exact=True).click()
  draft=page.get_by_role('link',name='Abrir mi correo').get_attribute('href');body=parse_qs(urlsplit(draft).query)['body'][0];assert 'Request: deletion' in body and USER['id'] in body
  assert c.cookies()==[]
  for width in [320,393,768,1440]:page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  c.close()
 print('PASS: both social providers require a separate explicit step, PKCE survives, account privacy requests remain drafts and fit mobile widths')
 for lang,label in [('en-US','I am 16 or older'),('ro-RO','Am cel puțin 16 ani')]:
  c,seen=context(browser);c.add_init_script("Object.defineProperty(navigator,'languages',{get:()=>["+json.dumps(lang)+"]})");page=c.new_page();page.goto(BASE+'#registro');expect(page.get_by_role('option',name=label,exact=True)).to_have_count(1);assert 'Acepto las' not in page.locator('#account-form').inner_text();c.close()
 print('PASS: legal registration UI is localized to English and Romanian')
 assert not errors,errors
 browser.close()
