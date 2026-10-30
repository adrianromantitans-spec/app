"""Attaching a receipt fills the real amount input without an extra read/apply step."""
from pathlib import Path
from time import monotonic
exec(Path('tests/receipt_ocr_browser.py').read_text().split('with sync_playwright() as p:')[0])
BASE=os.environ.get('OCR_URL','http://127.0.0.1:3002/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es-ES','en-GB','ro-RO']:
  c=b.new_context(locale=lang,reduced_motion='reduce',viewport={'width':402,'height':874})
  c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE);page.locator('[data-action=demo]').click();page.locator('[data-action=new-expense]:visible').first.click()
  f=page.locator('#expense-form')
  # EUR in all three interface languages, so the group currency matches.
  lines=list(fixtures[lang][0]);lines=[line.replace('LEI','EUR') for line in lines]
  f.locator('[name=receipt]').set_input_files({'name':'ticket.png','mimeType':'image/png','buffer':receipt(lines)})
  expect(f.locator('[name=amount]')).to_have_value('24.90',timeout=90000)
  expect(f.locator('[name=title]')).to_have_value(lines[0])
  expect(f.locator('[name=date]')).to_have_value('2026-10-30')
  assert f.locator('[name=amount]').evaluate('el=>el.validity.valid')
  assert f.locator('.receipt-amount-status').inner_text()
  assert f.locator('.receipt-detected-review').count()==1
  assert not f.locator('.receipt-detected-review').evaluate('el=>el.open')
  expect(page.get_by_role('dialog')).to_be_visible()
  # The expense still needs an explicit Save; corrections remain possible.
  f.locator('[name=amount]').fill('24.95')
  f.locator('[type=submit]').click();expect(f).to_have_count(0)
  state=page.evaluate('JSON.parse(localStorage.getItem("nexo-local-v1"))')
  e=next(e for e in state['groups'][0]['expenses'] if e['title']==lines[0])
  assert e['amount']==2495 and e['receipt']
  assert not errors,errors
  print('PASS:',lang,'attach photo fills the actual amount/title/date; correction and explicit save work',flush=True)
  c.close()
 # Deterministic worker responses exercise manual edits, replacing photos and mismatched currency.
 c=b.new_context(locale='es-ES',reduced_motion='reduce',viewport={'width':402,'height':874})
 c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
 workerText=['SUPERMERCADO SOL\n30/10/2026\nTOTAL A PAGAR 24,90 EUR']
 delay=[50]
 def worker(route):
  route.fulfill(content_type='text/javascript',body='const text='+json.dumps(workerText[0])+';self.onmessage=({data:m})=>setTimeout(()=>postMessage({...m,status:"resolve",data:m.action==="recognize"?{text,confidence:95}:{}}),'+str(delay[0])+');')
 c.route('**/vendor/ocr/worker.min.js',worker)
 page=c.new_page();page.goto(BASE);page.locator('[data-action=demo]').click()
 def open_form():
  page.locator('[data-action=new-expense]:visible').first.click();return page.locator('#expense-form')
 def upload(f):
  f.locator('[name=receipt]').set_input_files({'name':'ticket.png','mimeType':'image/png','buffer':receipt(fixtures['es-ES'][0])})
 f=open_form();upload(f);expect(f.locator('[name=amount]')).to_have_value('24.90')
 workerText[0]='OTRA TIENDA\n29/10/2026\nTOTAL A PAGAR 42,80 EUR'
 upload(f);expect(f.locator('[name=amount]')).to_have_value('42.80');expect(f.locator('[name=title]')).to_have_value('OTRA TIENDA')
 # Typing during recognition always wins over automatic data.
 page.keyboard.press('Escape');f=open_form();delay[0]=250;upload(f)
 expect(f.locator('[data-receipt-action=cancel]')).to_be_visible()
 f.locator('[name=amount]').fill('8.75');f.locator('[name=title]').fill('Mi concepto')
 expect(f.locator('.receipt-suggestions')).to_contain_text('Usar datos seleccionados',timeout=15000)
 expect(f.locator('[name=amount]')).to_have_value('8.75');expect(f.locator('[name=title]')).to_have_value('Mi concepto')
 page.keyboard.press('Escape');delay[0]=10
 workerText[0]='MAGAZIN SOARE\n30/10/2026\nTOTAL DE PLATA 24,90 RON'
 f=open_form();upload(f);expect(f.locator('.receipt-currency-warning')).to_be_visible()
 expect(f.locator('[name=amount]')).to_be_empty();expect(f.locator('[data-ocr-use=amount]')).to_be_disabled()
 page.keyboard.press('Escape');workerText[0]='e+e=$=AE'
 f=open_form();upload(f);expect(f.locator('.receipt-read-status')).to_contain_text('No se ha podido identificar el total.',timeout=15000)
 expect(f.locator('[name=amount]')).to_be_empty()
 assert f.locator('[data-ocr-value]').count()==0
 page.keyboard.press('Escape');workerText[0]='TIENDA SOL\n30/10/2026\nTOTAL A PAGAR 24,90 EUR';delay[0]=250
 f=open_form();upload(f);expect(f.locator('[data-receipt-action=cancel]')).to_be_visible()
 f.locator('[data-receipt-action=cancel]').click()
 expect(f.locator('.receipt-read-status')).to_contain_text('Lectura cancelada.')
 expect(f.locator('[name=amount]')).to_be_empty()
 deadline=monotonic()+5
 while page.workers and monotonic()<deadline:page.wait_for_timeout(100)
 assert not page.workers
 page.keyboard.press('Escape');delay[0]=10
 page.locator('[data-expense]:visible').first.click();page.locator('[data-edit-expense]').click()
 f=page.locator('#expense-form');previous={name:f.locator('[name='+name+']').input_value() for name in ['title','amount','date']}
 upload(f);expect(f.locator('.receipt-preview img')).to_be_visible()
 expect(f.locator('[data-receipt-action=read]')).to_be_enabled()
 assert not page.workers
 f.locator('[data-receipt-action=read]').click()
 expect(f.locator('.receipt-suggestions')).to_contain_text('Usar datos seleccionados')
 for name,value in previous.items():expect(f.locator('[name='+name+']')).to_have_value(value)
 print('PASS: replacement updates only automatic values; typing wins; wrong currency/noise/cancel stay empty; existing expenses are preserved',flush=True)
 b.close()
