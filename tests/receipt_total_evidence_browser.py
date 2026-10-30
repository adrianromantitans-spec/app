"""A weakly read TOTAL row needs corroboration; VAT lines cannot corroborate it."""
from pathlib import Path
exec(Path('tests/receipt_ocr_browser.py').read_text().split('with sync_playwright() as p:')[0])
BASE=os.environ.get('OCR_URL','http://127.0.0.1:3002/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for price,repeated,accepted in [('145.00',True,True),('14.37',True,False),('145.00',False,False)]:
  c=b.new_context(locale='es-ES',reduced_motion='reduce')
  c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
  body='SHOP SOL\nITEM 1 X 145.00'+(' 145.00 B' if repeated else '')+'\nTOTAL TVA 14.37\nTVA B 11% 14.37'
  script='let mode="3";const body='+json.dumps(body)+';self.onmessage=({data:m})=>{if(m.action==="setParameters")mode=m.payload.params.tessedit_pageseg_mode;postMessage({...m,status:"resolve",data:m.action==="recognize"?{text:mode==="7"?"TOTAL '+price+'":body,confidence:mode==="7"?48:85}:{}});};'
  c.route('**/vendor/ocr/worker.min.js',lambda r:r.fulfill(content_type='text/javascript',body=script))
  page=c.new_page();page.goto(BASE);page.locator('[data-action=demo]').click();page.locator('[data-action=new-expense]:visible').first.click()
  f=page.locator('#expense-form');f.locator('[name=receipt]').set_input_files({'name':'ticket.png','mimeType':'image/png','buffer':receipt(fixtures['es-ES'][0])})
  if accepted:
   expect(f.locator('[name=amount]')).to_have_value('145.00',timeout=30000)
  else:
   expect(f.locator('.receipt-read-status')).to_contain_text('No se ha podido identificar el total.',timeout=30000)
   expect(f.locator('[name=amount]')).to_be_empty()
  c.close()
 print('PASS: corroborated TOTAL fills; tax-only amounts and uncorroborated weak digits never fill')
 b.close()
