"""Real OCR in the browser using generated receipts, without accounts or external OCR."""
import io,json,os
from urllib.parse import urlsplit
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('OCR_URL','http://127.0.0.1:3001/')
def receipt(lines):
 im=Image.new('RGB',(850,1000),'white');draw=ImageDraw.Draw(im)
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',32)
 for i,line in enumerate(lines):draw.text((42,45+i*65),line,font=font,fill='black')
 output=io.BytesIO();im.save(output,format='PNG');return output.getvalue()
fixtures={
 'es-ES':(['MERCADO SOL','TICKET SIMPLIFICADO','FECHA 30/10/2026','PAN          4,90','COMIDA      20,00','SUBTOTAL    22,00','IVA          2,90','TOTAL A PAGAR 24,90 EUR','EFECTIVO    30,00','CAMBIO       5,10'],'Leer ticket','Lectura terminada.'),
 'en-GB':(['THE CORNER SHOP','RECEIPT','DATE 2026-10-30','BREAD        4.90','FOOD        20.00','SUB TOTAL   22.00','VAT          2.90','GRAND TOTAL 24.90 EUR','CASH        30.00','CHANGE       5.10'],'Read receipt','Reading complete.'),
 'ro-RO':(['MAGAZIN SOARE','BON FISCAL','DATA 30.10.2026','PAINE        4,90','MANCARE     20,00','SUBTOTAL    22,00','TVA          2,90','TOTAL DE PLATA 24,90 LEI','NUMERAR     30,00','REST         5,10'],'Citește bonul','Citire terminată.')}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang,(lines,label,done) in fixtures.items():
  c=b.new_context(locale=lang,reduced_motion='reduce',viewport={'width':402,'height':874})
  c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
  if lang=='en-GB':
   # Exercise the actual non-SIMD core used by older devices too.
   source=Path('receipt-ocr.js').read_text().replace('corePath:base.href',"corePath:new URL('tesseract-core-lstm.wasm.js',base).href")
   c.route('**/receipt-ocr.js?*',lambda r:r.fulfill(content_type='text/javascript',body=source))
  page=c.new_page();errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda req:requests.append((req.method,req.url)))
  page.goto(BASE);page.locator('[data-action=demo]').click();page.locator('[data-action=new-expense]:visible').first.click()
  f=page.locator('#expense-form')
  f.locator('[name=title]').fill('Mi concepto');f.locator('[name=amount]').fill('9.99');f.locator('[name=date]').fill('2026-10-01')
  f.locator('[name=receipt]').set_input_files({'name':'receipt.png','mimeType':'image/png','buffer':receipt(lines)})
  expect(page.locator('.receipt-preview img')).to_be_visible()
  page.get_by_role('button',name=label,exact=True).click()
  expect(page.locator('.receipt-read-status')).to_contain_text(done,timeout=90000)
  expect(f.locator('[name=title]')).to_have_value('Mi concepto')
  expect(f.locator('[name=amount]')).to_have_value('9.99')
  expect(f.locator('[name=date]')).to_have_value('2026-10-01')
  expect(f.locator('[data-ocr-value=title]')).to_have_value(lines[0])
  expect(f.locator('[data-ocr-value=amount]')).to_have_value('24.90')
  expect(f.locator('[data-ocr-value=date]')).to_have_value('2026-10-30')
  if lang=='ro-RO':
   expect(f.locator('[data-ocr-use=amount]')).to_be_disabled()
   expect(f.locator('.receipt-currency-warning')).to_be_visible()
  else:
   f.locator('[data-ocr-use=amount]').check();f.locator('[data-ocr-value=amount]').fill('24.91')
  f.locator('[data-ocr-use=date]').check()
  f.locator('[data-receipt-action=apply]').click()
  expect(f.locator('[name=amount]')).to_have_value('9.99' if lang=='ro-RO' else '24.91')
  expect(f.locator('[name=title]')).to_have_value('Mi concepto')
  expect(f.locator('[name=date]')).to_have_value('2026-10-30')
  assert not page.workers
  assert all(method=='GET' and (urlsplit(url).netloc==urlsplit(BASE).netloc or url.startswith('data:') or url.startswith('blob:')) for method,url in requests),requests
  if lang=='es-ES':
   page.screenshot(path='work/ocr-form.png',full_page=True)
   f.locator('[type=submit]').click();expect(f).to_have_count(0)
   data=page.evaluate('JSON.parse(localStorage.getItem("nexo-local-v1"))')
   item=next(e for e in data['groups'][0]['expenses'] if e['title']=='Mi concepto')
   assert item['amount']==2491 and item['date']=='2026-10-30' and item['receipt']
   assert not any(key in item for key in ['ocr','ocrText','recognizedText','text'])
  assert not errors,errors
  print('PASS:',lang,'real OCR reads 24.90 and date; review preserves manual data; only local GETs; worker terminates',flush=True)
  c.close()
 b.close()
