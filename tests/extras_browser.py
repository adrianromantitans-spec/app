"""Local browser tests. Never sends email or creates real accounts."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
# Reuse the existing isolated Auth transport fixture, without running its tests.
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])

with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(locale='es-ES',viewport={'width':390,'height':844})
 page.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
 page.goto(BASE);page.get_by_role('button',name='Explorar una demo').click()
 page.get_by_role('button',name='Añadir gasto',exact=True).first.click()
 form=page.locator('#expense-form')
 form.get_by_label('¿Qué habéis pagado?').fill('Internet mensual')
 form.get_by_label('Importe (€)').fill('40')
 form.get_by_label('Fecha',exact=True).fill('2026-01-31')
 form.get_by_label('Repetir',exact=False).select_option('monthly')
 # Browser-generated image fixture; no external files or personal receipts.
 image=page.locator('.modal-heading').screenshot()
 form.locator('input[type=file]').set_input_files({'name':'ticket.png','mimeType':'image/png','buffer':image})
 expect(page.locator('.receipt-preview img')).to_be_visible()
 form.get_by_role('button',name='Guardar gasto').click()
 expect(page.get_by_role('dialog')).not_to_be_visible()
 page.locator('[data-tab=expenses]').first.click()
 source=page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1')).groups[0].expenses.find(e=>e.recurrence).id")
 page.locator('[data-expense="'+source+'"]').click()
 expect(page.get_by_text('Próximo gasto:',exact=False)).to_be_visible()
 page.get_by_role('button',name='Ver foto del ticket').click()
 expect(page.locator('.receipt-photo')).to_be_visible()
 page.keyboard.press('Escape')
 page.reload();page.get_by_role('button',name='Explorar una demo').click()
 state=page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1'))")
 expenses=state['groups'][0]['expenses'];series=[e for e in expenses if e.get('seriesId')]
 assert len(series)==8,len(series) # Feb through Sep; Oct 31 is still in the future.
 assert all('receipt' not in e for e in series)
 before=len(expenses)
 page.reload();page.get_by_role('button',name='Explorar una demo').click()
 assert page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1')).groups[0].expenses.length")==before
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 print('PASS: photo preview, saved receipt, reload persistence, due recurring charges without duplicates')
 page.close()

 c,seen=context(b)
 page=c.new_page();page.goto(BASE+'#acceso')
 page.get_by_role('button',name='¿Has olvidado tu contraseña?').click()
 expect(page.get_by_role('heading',name='Recupera tu cuenta')).to_be_visible()
 def recover(route):
  body=json.loads(route.request.post_data)
  assert body['email']=='ana@example.test' and body['code_challenge_method']=='s256'
  seen['recovery_challenge']=body['code_challenge'];route.fulfill(content_type='application/json',body='{}')
 c.route('**/__auth_fixture/auth/v1/recover?**',recover)
 page.get_by_label('Correo electrónico').fill('ana@example.test')
 page.get_by_role('button',name='Enviar enlace de recuperación').click()
 expect(page.get_by_role('heading',name='Revisa tu correo')).to_be_visible()
 # An email may open in a new tab of the same browser.
 def exchange(route):
  body=json.loads(route.request.post_data)
  challenge=base64.urlsafe_b64encode(hashlib.sha256(body['code_verifier'].encode()).digest()).decode().rstrip('=')
  assert challenge==seen['recovery_challenge']
  route.fulfill(content_type='application/json',body=json.dumps({'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_in':3600,'user':USER}))
 c.route('**/__auth_fixture/auth/v1/token?grant_type=pkce',exchange)
 def update(route):
  if route.request.method=='PUT':
   assert json.loads(route.request.post_data)['password']=='new-fixture-password';seen['updated']=True
  route.fulfill(content_type='application/json',body=json.dumps(USER))
 c.route('**/__auth_fixture/auth/v1/user',update)
 tab=c.new_page();tab.goto(BASE+'?code=recovery-fixture')
 expect(tab.get_by_role('heading',name='Elige una contraseña')).to_be_visible()
 tab.get_by_label('Nueva contraseña',exact=True).fill('new-fixture-password')
 tab.get_by_label('Repetir contraseña').fill('different-password')
 tab.get_by_role('button',name='Guardar contraseña').click()
 expect(tab.get_by_role('alert')).to_contain_text('coincidir')
 tab.get_by_label('Repetir contraseña').fill('new-fixture-password')
 tab.get_by_role('button',name='Guardar contraseña').click()
 expect(tab.get_by_role('heading',name='Inicia sesión',exact=True)).to_be_visible()
 assert seen['updated']
 assert 'code=' not in tab.url
 print('PASS: recovery email, same-browser new tab, password validation and verified update')
 b.close()
