"""Current real web UI + native JS adapter, with fictional APIs, not an Android device.
Includes a PKCE provider transport fixture; never signs into a real Google account.
"""
import importlib.util,json,mimetypes,os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('shots',ROOT/'scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
SCRIPT=(ROOT/'android/app/src/webview/assets/native-webview.js').read_text()
photo_ns={};exec((ROOT/'tests/receipt_ocr_browser.py').read_text().split('with sync_playwright() as p:')[0],photo_ns)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  c,rows=shots.context(browser,lang);errors=[]
  def static(route):
   path=urlsplit(route.request.url).path
   if path=='/config.js':route.fallback();return # Keep the fixture's non-production configuration.
   file=(ROOT/path.lstrip('/'))
   if path.endswith('/'):file=file/'index.html'
   if not file.is_file() or not file.resolve().is_relative_to(ROOT):route.fulfill(status=404,body='');return
   mime={'.js':'text/javascript','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.traineddata':'application/octet-stream'}.get(file.suffix,mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
   route.fulfill(content_type=mime,body=file.read_bytes())
  c.route('https://divzplit.com/**',static)
  c.route('https://nexo-test.supabase.co/rest/v1/rpc/divzplit_privacy_export',lambda route:route.fulfill(content_type='application/json',body=json.dumps({'account':{'id':shots.OWNER},'groups':[],'fixture':True})))
  page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('https://divzplit.com/app/?source=installed');expect(page.locator('.home-balance')).to_be_visible()
  assert page.locator('html').get_attribute('lang')==lang
  page.evaluate(SCRIPT)
  # Model WebView's DownloadListener for programmatic, detached anchor clicks.
  page.on('download',lambda download:page.evaluate('(url)=>window.__divzplitDownload(url)',download.url))
  page.evaluate('''() => {window.nativeMessages=[];const c=new MessageChannel();window.fakeNative=c.port1;c.port1.onmessage=e=>{const m=JSON.parse(e.data);nativeMessages.push(m);fakeNative.postMessage(JSON.stringify({id:m.id,ok:true}));};window.postMessage('divzplit-native-ready',location.origin,[c.port2]);}''')
  page.locator('.reference-dock [data-route=profile]').click();expect(page.locator('.account-page')).to_be_visible()
  page.locator('[data-action=language-settings]').click();expect(page.locator('.language-options')).to_be_visible()
  assert page.evaluate('window.__divzplitBack()') is True
  expect(page.locator('#modal-root')).to_be_empty();expect(page.locator('.account-page')).to_be_visible()
  page.locator('[data-action=privacy-export-full]').click()
  page.wait_for_function("() => nativeMessages.some(m=>m.type==='export')")
  assert page.evaluate("JSON.parse(atob(nativeMessages.find(m=>m.type==='export').base64)).account.id")==shots.OWNER
  assert page.evaluate('window.__divzplitBack()') is True
  expect(page.locator('.home-balance')).to_be_visible()
  page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action=new-expense]').click()
  f=page.locator('#expense-form');expect(f).to_be_visible()
  language={'es':'es-ES','en':'en-GB','ro':'ro-RO'}[lang]
  lines=photo_ns['fixtures'][language][0]
  f.locator('[name=receipt]').set_input_files({'name':'fixture.png','mimeType':'image/png','buffer':photo_ns['receipt'](lines)})
  expect(f.locator('.receipt-preview img')).to_be_visible()
  # Run actual bundled OCR; no external image service or real receipt.
  f.locator('[data-receipt-action=read]').click()
  expect(f.locator('[data-ocr-value=amount]')).to_have_value('24.90',timeout=90000)
  assert page.evaluate('window.__divzplitBack()') is True
  expect(page.locator('#modal-root')).to_be_empty();assert page.evaluate('window.__divzplitBack()') is False
  assert not errors,errors
  c.close();print('PASS',lang,'real UI with native adapter: modal/SPA Back, account JSON export, receipt selection and real bundled OCR',flush=True)
 # The existing PKCE fixture validates the challenge and exchange, on the same page.
 ns={};exec((ROOT/'tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0],ns)
 c,seen=ns['context'](browser,enabled=True);page=c.new_page();page.goto(ns['BASE'])
 page.locator('[data-action=oauth-google]').click();form=page.locator('#oauth-consent-form')
 form.locator('[name=ageBand]').select_option('16_or_over');form.locator('[name=acceptTerms]').check();form.locator('[type=submit]').click()
 expect(page.locator('.account-empty')).to_be_visible();assert len(seen['exchange'])==1
 assert 'code=' not in page.url
 c.close();print('PASS current Google entry + consent + simulated HTTPS callback: actual PKCE challenge/exchange and callback cleanup; real browser/App Links not tested',flush=True)
 browser.close()
