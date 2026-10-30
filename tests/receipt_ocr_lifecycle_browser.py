"""Cancelling/closing/replacing cannot leave OCR workers or stale suggestions."""
from pathlib import Path
from time import monotonic
exec(Path('tests/receipt_ocr_browser.py').read_text().split('with sync_playwright() as p:')[0])
def stopped(page):
 deadline=monotonic()+5
 while page.workers and monotonic()<deadline:page.wait_for_timeout(100)
 assert not page.workers
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(locale='es-ES',reduced_motion='reduce',viewport={'width':402,'height':874})
 c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
 page=c.new_page();page.goto(BASE);page.locator('[data-action=demo]').click()
 def open_photo():
  page.locator('[data-action=new-expense]:visible').first.click()
  f=page.locator('#expense-form');f.locator('[name=amount]').fill('9.99');f.locator('[name=receipt]').set_input_files({'name':'receipt.png','mimeType':'image/png','buffer':receipt(fixtures['es-ES'][0])})
  expect(f.locator('.receipt-preview img')).to_be_visible();return f
 f=open_photo()
 f.locator('[data-receipt-action=read]').click();f.locator('[data-receipt-action=cancel]').click()
 expect(f.locator('.receipt-read-status')).to_contain_text('Lectura cancelada.')
 stopped(page)
 expect(f.locator('[data-receipt-action=read]')).to_be_enabled()
 f.locator('[data-receipt-action=read]').click();page.keyboard.press('Escape')
 expect(f).to_have_count(0);page.wait_for_timeout(100);assert not page.workers
 f=open_photo();f.locator('[data-receipt-action=read]').click()
 f.locator('[name=receipt]').set_input_files({'name':'new.png','mimeType':'image/png','buffer':receipt(['OTRA TIENDA','TOTAL 2,00 EUR'])})
 expect(f.locator('.receipt-preview img')).to_be_visible()
 expect(f.locator('.receipt-read-status')).to_be_empty()
 expect(f.locator('.receipt-suggestions')).to_be_empty()
 stopped(page)
 page.route('**/vendor/ocr/worker.min.js',lambda r:r.fulfill(content_type='text/javascript',body="throw new Error('fixture unavailable');"))
 f.locator('[data-receipt-action=read]').click()
 expect(f.locator('.receipt-read-status')).to_contain_text('No se ha podido leer el ticket.')
 stopped(page)
 f.locator('[name=title]').fill('Introducido a mano');f.locator('[name=amount]').fill('2.00')
 f.locator('[type=submit]').click();expect(f).to_have_count(0)
 # OCR contents are untrusted strings, including HTML-like merchant names.
 malicious='''self.onmessage=({data:m})=>postMessage({...m,status:'resolve',data:m.action==='recognize'?{text:'<img src=x onerror="window.ocrInjected=true">\\nTOTAL 9,99 EUR\\n30/10/2026',confidence:90}:{}});'''
 page.unroute('**/vendor/ocr/worker.min.js')
 page.route('**/vendor/ocr/worker.min.js',lambda r:r.fulfill(content_type='text/javascript',body=malicious))
 f=open_photo();f.locator('[data-receipt-action=read]').click()
 expect(f.locator('.receipt-read-status')).to_contain_text('Lectura terminada.')
 expect(f.locator('[data-ocr-value=amount]')).to_have_value('9.99')
 f.locator('.receipt-ocr-text summary').click()
 expect(f.locator('.receipt-ocr-text pre')).to_contain_text('<img src=x')
 assert not page.evaluate('Boolean(window.ocrInjected)')
 assert f.locator('.receipt-suggestions img').count()==0
 stopped(page)
 # Cancel means return to manual entry, including after a failed engine download.
 print('PASS: cancel/close/replace terminate workers; failure keeps manual save; recognized HTML stays text')
 b.close()
