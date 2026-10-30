"""Regression: a small receipt surrounded by desk, crop gestures and rotated photos."""
import io,json,os,subprocess
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('OCR_URL','http://127.0.0.1:3002/')
def photo(rotation=0):
 paper=Image.new('RGB',(900,3300),(242,239,232));draw=ImageDraw.Draw(paper)
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',24)
 lines=['MERCADO DEL BARRIO','TICKET SIMPLIFICADO','FECHA 30/10/2026','']
 lines += [f'PRODUCTO {i:02}                     1,50' for i in range(30)]
 lines += ['','SUBTOTAL                       70,00','IVA                             4,50','','TOTAL A PAGAR                  74,50 EUR','EFECTIVO                      100,00','CAMBIO                         25,50']
 for i,line in enumerate(lines):draw.text((40,70+i*68),line,font=font,fill=(85,81,78))
 desk=Image.new('RGB',(4000,5000),(75,64,58));desk.paste(paper,(1550,850))
 if rotation:desk=desk.rotate(rotation,expand=True)
 out=io.BytesIO();desk.save(out,format='JPEG',quality=94);return out.getvalue()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(locale='es-ES',reduced_motion='reduce',viewport={'width':402,'height':874},is_mobile=True,has_touch=True)
 c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
 page=c.new_page();page.goto(BASE);page.locator('[data-action=demo]').click()
 def upload(rotation=0):
  page.locator('[data-action=new-expense]:visible').first.click();f=page.locator('#expense-form')
  f.locator('[name=receipt]').set_input_files({'name':'photo.jpg','mimeType':'image/jpeg','buffer':photo(rotation)})
  expect(f.locator('.receipt-preview img')).to_be_visible();return f
 f=upload();f.locator('[data-receipt-action=read]').click()
 expect(f.locator('[data-ocr-value=amount]')).to_have_value('74.50',timeout=90000)
 expect(f.locator('[data-ocr-value=date]')).to_have_value('2026-10-30')
 print('PASS: real OCR reads a small faded receipt surrounded by a large dark desk',flush=True)
 # Crop by dragging, while keeping the attached image unchanged.
 preview=f.locator('.receipt-preview img').get_attribute('src')
 f.locator('[data-receipt-action=crop]').click();canvas=f.locator('.receipt-crop-editor canvas');expect(canvas).to_be_visible()
 canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
 touch=c.new_cdp_session(page)
 start={'x':box['x']+box['width']*.385,'y':box['y']+box['height']*.165}
 finish={'x':box['x']+box['width']*.615,'y':box['y']+box['height']*.835}
 touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[start]})
 for step in range(1,9):
  touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':start['x']+(finish['x']-start['x'])*step/8,'y':start['y']+(finish['y']-start['y'])*step/8}]})
 touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 canvas.focus();page.keyboard.press('ArrowLeft');page.keyboard.press('+')
 f.locator('[data-receipt-action=read-crop]').click()
 expect(f.locator('[data-ocr-value=amount]')).to_have_value('74.50',timeout=90000)
 assert f.locator('.receipt-preview img').get_attribute('src')==preview
 assert f.locator('[name=amount]').input_value()==''
 assert not page.workers
 page.keyboard.press('Escape')
 print('PASS: touch crop and keyboard adjustment read the selected area without changing attachment or amount',flush=True)
 f=upload(90);f.locator('[data-receipt-action=read]').click()
 expect(f.locator('[data-ocr-value=amount]')).to_have_value('74.50',timeout=90000)
 print('PASS: sideways photo is retried in the correct orientation',flush=True)
 page.keyboard.press('Escape');f=upload(90)
 f.locator('[data-receipt-action=rotate]').click();expect(f.locator('.receipt-crop-editor canvas')).to_be_visible()
 assert f.evaluate('el=>el.receiptOCRRotation')==90
 f.locator('[data-receipt-action=crop-cancel]').click()
 expect(f.locator('[data-receipt-action=read]')).to_be_enabled()
 # A clear warning replaces arbitrary symbol strings as a merchant suggestion.
 fake='''self.onmessage=({data:m})=>postMessage({...m,status:'resolve',data:m.action==='recognize'?{text:'e+e=$=AE',confidence:95}:{}});'''
 page.route('**/vendor/ocr/worker.min.js',lambda r:r.fulfill(content_type='text/javascript',body=fake))
 f.locator('[data-receipt-action=read]').click()
 expect(f.locator('.receipt-read-status')).to_contain_text('No se ha podido identificar el total.',timeout=90000)
 assert f.locator('[data-ocr-value]').count()==0
 expect(f.locator('[data-receipt-action=crop]')).to_be_visible()
 assert not page.workers
 print('PASS: symbol noise suggests cropping and never becomes a merchant or amount',flush=True)
 b.close()
