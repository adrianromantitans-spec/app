"""Recovery codes and localized receipt picker. Local fixtures only; no outgoing email."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
fixture=Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0].replace("locale='es-ES'",'locale=TEST_LANGUAGE').replace('http://127.0.0.1:3000/app/','http://127.0.0.1:3003/app/')
planning=Path('tests/planning_browser.py').read_text().split('with sync_playwright() as p:')[0]
copy={
 'es-ES':('Elegir foto','Ninguna foto seleccionada','El código no es válido o ha caducado. Solicita uno nuevo.'),
 'en-GB':('Choose photo','No photo selected','The code is invalid or has expired. Request a new one.'),
 'ro-RO':('Alege o fotografie','Nicio fotografie selectată','Codul nu este valid sau a expirat. Solicită unul nou.')}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for locale,(choose,empty,invalid) in copy.items():
  ns={'TEST_LANGUAGE':locale};exec(fixture,ns);c,seen=ns['context'](b);calls={'recover':0,'verify':0,'password':0}
  def recover(route):
   calls['recover']+=1;assert json.loads(route.request.post_data)['email']=='ana@example.test';route.fulfill(content_type='application/json',body='{}')
  def verify(route):
   calls['verify']+=1;data=json.loads(route.request.post_data);assert data['type']=='recovery' and data['email']=='ana@example.test'
   if data['token']=='000000':route.fulfill(status=403,content_type='application/json',body='{"error_code":"otp_expired"}');return
   assert data['token']=='12345678';route.fulfill(content_type='application/json',body=json.dumps({'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_in':3600,'user':ns['USER']}))
  def user(route):
   if route.request.method=='PUT':calls['password']+=1;assert json.loads(route.request.post_data)['password']=='new-fixture-password'
   route.fulfill(content_type='application/json',body=json.dumps(ns['USER']))
  c.route('**/__auth_fixture/auth/v1/recover?**',recover);c.route('**/__auth_fixture/auth/v1/verify',verify);c.route('**/__auth_fixture/auth/v1/user',user)
  page=c.new_page();page.set_viewport_size({'width':393,'height':852});page.goto(ns['BASE']);page.locator('.welcome-entry [data-action="login"]').click();page.locator('[data-action="recover"]').click()
  form=page.locator('#recovery-form');form.locator('[name="email"]').fill('ana@example.test');form.locator('[type="submit"]').click()
  code=page.locator('#recovery-code-form');expect(code).to_be_visible();assert calls['recover']==1
  expect(page.locator('#password-form')).to_have_count(0)
  code.locator('[name="code"]').fill('000000');code.locator('[type="submit"]').first.click();expect(code.locator('[role="alert"]')).to_have_text(invalid);assert calls['password']==0
  code.locator('[name="code"]').fill('');code.locator('[value="resend"]').click();expect(code.locator('[role="status"]')).not_to_be_empty();assert calls['recover']==2
  code.locator('[data-action="recover"]').click();expect(page.locator('#recovery-form')).to_be_visible()
  page.locator('#recovery-form [name="email"]').fill('ana@example.test');page.locator('#recovery-form [type="submit"]').click();expect(code).to_be_visible()
  code.locator('[name="code"]').fill('12345678');code.locator('[type="submit"]').first.click();password=page.locator('#password-form');expect(password).to_be_visible()
  password.locator('[name="password"]').fill('new-fixture-password');password.locator('[name="confirm"]').fill('different-password');password.locator('[type="submit"]').click();expect(password.locator('[role="alert"]')).not_to_be_empty();assert calls['password']==0
  password.locator('[name="confirm"]').fill('new-fixture-password');password.locator('[type="submit"]').click();expect(page.locator('#account-form')).to_be_visible();assert calls['password']==1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');c.close();assert not ns['errors'],ns['errors']
  # The browser stays Spanish while the app uses the account preference from the screenshot.
  ns={};exec(planning,ns);ns['group']['document']['currency']='EUR';c,page=ns['context'](b,ns['OWNER'],locale='es-ES')
  page.evaluate('(lang)=>localStorage.setItem("divzplit-language",lang)',locale[:2]);page.reload();expect(page.locator('.balance-stat')).to_be_visible()
  for width in [320,393,1440]:
   page.set_viewport_size({'width':width,'height':852});page.locator('.nav-add:visible').first.click();page.locator('[data-action="new-expense"]').click();form=page.locator('#expense-form');form.locator('details').evaluate('(el)=>el.open=true')
   control=form.locator('.receipt-file-control');expect(control.locator('.receipt-file-button')).to_have_text(choose);expect(control.locator('[data-receipt-filename]')).to_have_text(empty)
   expect(control.locator('[type="file"]')).to_have_css('opacity','0');assert not any(s in control.inner_text() for s in ['Seleccionar archivo','nada seleccionado'])
   form.locator('[name="amount"]').fill('10');image=page.locator('.modal-heading').screenshot()
   # A real input receives the file; image preparation and clearing must still work.
   control.locator('[type="file"]').set_input_files({'name':'bon.png','mimeType':'image/png','buffer':image});expect(form.locator('.receipt-preview img')).to_be_visible();expect(control.locator('[data-receipt-filename]')).to_have_text('bon.png')
   control.locator('[type="file"]').set_input_files([]);expect(control.locator('[data-receipt-filename]')).to_have_text(empty);expect(form.locator('.receipt-preview img')).to_have_count(0)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.keyboard.press('Escape')
  c.close();assert not ns['errors'],ns['errors']
  print('PASS:',locale,'recovery request, expired code, resend, email correction, verified password change; localized upload with Spanish browser at 320/393/1440px',flush=True)
 b.close()
