from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(locale='es-ES',viewport={'width':390,'height':844})
 page.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
 page.goto('http://127.0.0.1:3000/');page.get_by_role('button',name='Explorar una demo',exact=False).click()
 page.get_by_role('button',name='Crear grupo',exact=True).first.click()
 f=page.locator('#group-form');f.get_by_label('Nombre del grupo',exact=True).fill('Repartos de prueba')
 f.get_by_label('¿Quién se apunta?',exact=False).fill('Ana, Luis');f.get_by_label('Presupuesto total del grupo',exact=False).fill('1000')
 f.get_by_role('button',name='Crear grupo',exact=True).click()
 page.get_by_role('button',name='Añadir gasto',exact=True).first.click()
 f=page.locator('#expense-form');f.get_by_label('¿Qué habéis pagado?',exact=True).fill('Cena personalizada')
 f.get_by_label('Importe (€)',exact=True).fill('10.01')
 f.get_by_label('Tipo de reparto',exact=False).select_option('percent')
 rows=f.locator('[data-split-member]')
 for field,value in zip(rows.all(),['50','25','24']):field.fill(value)
 f.get_by_role('button',name='Guardar gasto').click()
 expect(f.get_by_role('alert')).to_contain_text('100 %')
 rows.nth(2).fill('25')
 image=page.locator('.modal-heading').screenshot()
 f.locator('input[type=file]').set_input_files({'name':'ticket.png','mimeType':'image/png','buffer':image})
 expect(page.locator('.receipt-preview img')).to_be_visible()
 f.get_by_role('button',name='Guardar gasto').click()
 expect(page.get_by_role('button',name='Ver detalle de Cena personalizada')).to_be_visible()
 def current():return page.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('nexo-local-v1'));return s.groups.find(g=>g.name==='Repartos de prueba')})()")
 before=current();eid=before['expenses'][0]['id'];photo=before['expenses'][0]['receipt']
 page.get_by_role('button',name='Ver detalle de Cena personalizada').click()
 assert [r.inner_text().splitlines()[-1] for r in page.locator('.share-row').all()]==['5,01\xa0€','2,50\xa0€','2,50\xa0€']
 page.get_by_role('button',name='Editar gasto',exact=True).click()
 f=page.locator('#expense-form');expect(f.get_by_label('¿Qué habéis pagado?',exact=True)).to_have_value('Cena personalizada')
 f.get_by_label('Importe (€)',exact=True).fill('20')
 f.get_by_label('Tipo de reparto',exact=False).select_option('amounts')
 for field,value in zip(f.locator('[data-split-member]').all(),['12','4','4']):field.fill(value)
 f.get_by_role('button',name='Guardar cambios').click()
 after=current();assert len(after['expenses'])==1 and after['expenses'][0]['id']==eid
 assert after['expenses'][0]['receipt']==photo
 assert after['expenses'][0]['amount']==2000
 page.get_by_role('button',name='Ver detalle de Cena personalizada').click()
 page.get_by_role('button',name='Editar gasto',exact=True).click()
 f=page.locator('#expense-form');f.get_by_label('Tipo de reparto',exact=False).select_option('shares')
 for field,value in zip(f.locator('[data-split-member]').all(),['2','1','1']):field.fill(value)
 f.get_by_label('Quitar la foto actual',exact=False).check()
 f.get_by_role('button',name='Guardar cambios').click()
 assert 'receipt' not in current()['expenses'][0]
 page.get_by_role('button',name='Ver detalle de Cena personalizada').click()
 assert [r.inner_text().splitlines()[-1] for r in page.locator('.share-row').all()]==['10,00\xa0€','5,00\xa0€','5,00\xa0€']
 page.keyboard.press('Escape')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # Every deletion requires typing that group's own name, including the last group.
 for expected in ['Repartos de prueba','Escapada a Lisboa','Nuestro pisito','Verano sin prisa']:
  page.get_by_role('button',name='Editar detalles del grupo').click()
  page.get_by_role('button',name='Eliminar grupo',exact=True).click()
  f=page.locator('#delete-group-form');assert f.get_attribute('data-name')==expected
  f.get_by_label('Escribe el nombre del grupo para confirmar').fill('incorrecto')
  f.get_by_role('button',name='Eliminar grupo definitivamente').click()
  expect(f.get_by_role('alert')).to_contain_text('no coincide')
  f.get_by_label('Escribe el nombre del grupo para confirmar').fill(expected)
  f.get_by_role('button',name='Eliminar grupo definitivamente').click()
  expect(page.locator('#delete-group-form')).to_have_count(0)
 page.reload();page.get_by_role('button',name='Explorar una demo',exact=False).click()
 assert page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1')).groups.length")==0
 expect(page.get_by_role('button',name='Crear mi primer grupo')).to_be_visible()
 print('PASS: percent/amount/share splits, invalid totals, edit preserves identity and receipts, last-group deletion persists')
 b.close()
