"""Private regression against a supplied photo. Never commit the image or OCR text.
RECEIPT_TEST_IMAGE=/local/photo.jpg RECEIPT_TEST_AMOUNT=145.00 \\
RECEIPT_TEST_CURRENCY=RON python3 tests/receipt_photo_file_browser.py
"""
import json,os,subprocess
from time import monotonic
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
photo=os.environ['RECEIPT_TEST_IMAGE'];amount=os.environ['RECEIPT_TEST_AMOUNT'];currency=os.environ.get('RECEIPT_TEST_CURRENCY','EUR')
base=os.environ.get('OCR_URL','http://127.0.0.1:3002/')
state=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {seed} from './model.js';console.log(JSON.stringify(seed()))"],text=True))
for group in state['groups']:group['currency']=currency
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(locale='es-ES',reduced_motion='reduce',viewport={'width':402,'height':874},is_mobile=True,has_touch=True)
 c.add_init_script('localStorage.setItem("nexo-local-v1",'+json.dumps(json.dumps(state))+')')
 c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
 page=c.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append((r.method,r.url)))
 page.goto(base);page.locator('[data-action=demo]').click()
 before=page.evaluate('localStorage.getItem("nexo-local-v1")')
 page.locator('[data-action=new-expense]:visible').first.click();f=page.locator('#expense-form')
 f.locator('[name=receipt]').set_input_files(photo)
 expect(f.locator('[name=amount]')).to_have_value(amount,timeout=90000)
 expect(f.locator('.receipt-read-status')).to_contain_text('Importe rellenado:')
 assert f.locator('[name=amount]').evaluate('el=>el.validity.valid')
 assert f.locator('[name=title]').input_value().strip()
 assert page.evaluate('localStorage.getItem("nexo-local-v1")')==before
 assert all(method=='GET' and (urlsplit(url).netloc==urlsplit(base).netloc or url.startswith(('data:','blob:'))) for method,url in requests)
 f.locator('[name=amount]').scroll_into_view_if_needed();page.screenshot(path='work/receipt-file-filled.png')
 deadline=monotonic()+5
 while page.workers and monotonic()<deadline:page.wait_for_timeout(100)
 assert not page.workers
 if os.environ.get('RECEIPT_TEST_CROP')=='1':
  f.locator('[name=amount]').fill('')
  f.locator('[data-receipt-action=crop]').click();canvas=f.locator('.receipt-crop-editor canvas');expect(canvas).to_be_visible()
  canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
  page.mouse.move(box['x']+box['width']*.15,box['y']+box['height']*.15);page.mouse.down()
  page.mouse.move(box['x']+box['width']*.92,box['y']+box['height']*.92,steps=10);page.mouse.up()
  f.locator('[data-receipt-action=read-crop]').click()
  expect(f.locator('[name=amount]')).to_have_value(amount,timeout=90000)
  print('PASS: manually cropped supplied photo also fills the correct amount',flush=True)
 assert not errors,errors
 print('PASS: supplied photo automatically fills',amount,currency,'in real amount field; no upload, no automatic save, no browser errors',flush=True)
 b.close()
