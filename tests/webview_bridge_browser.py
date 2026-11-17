"""Check the pilot's injected bridge in Chromium using fictional local data only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
SCRIPT=Path('android/app/src/webview/assets/native-webview.js').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context()
 context.route('https://divzplit.com/**',lambda route:route.fulfill(content_type='text/html',body='<html><body>Fixture</body></html>'))
 page=context.new_page();page.goto('https://divzplit.com/app/')
 page.evaluate(SCRIPT)
 page.evaluate('''() => {
  window.messages=[];const channel=new MessageChannel();window.nativeTestPort=channel.port1;
  nativeTestPort.onmessage=e=>{const value=JSON.parse(e.data);if(value.type.startsWith('push')){nativeTestPort.postMessage(JSON.stringify({id:value.id,ok:true,value:{permission:'default',userId:'',enabled:false,token:''}}));return;}messages.push(value);nativeTestPort.postMessage(JSON.stringify({id:value.id,ok:true}));};
  window.postMessage('divzplit-native-ready',location.origin,[channel.port2]);
 }''')
 page.evaluate("navigator.clipboard.writeText('https://divzplit.com/app/#invite=fictional')")
 assert page.evaluate("messages[0].type==='clipboard' && messages[0].text.endsWith('fictional')")
 # Injection is idempotent: repeated page-finished callbacks must not export twice.
 page.evaluate(SCRIPT)
 page.evaluate('''() => {const link=document.createElement('a');link.download='fixture.json';link.href=URL.createObjectURL(new Blob([JSON.stringify({groups:[],fixture:true})],{type:'application/json'}));document.body.append(link);link.click();}''')
 page.wait_for_function("messages.filter(m=>m.type==='export').length===1")
 assert page.evaluate("JSON.parse(atob(messages[1].base64)).fixture===true")
 page.evaluate("window.__divzplitDownload('https://evil.test/fixture.json')")
 assert page.evaluate('messages.length')==2
 # Android Back closes a modal, returns a SPA section home, then allows exit.
 page.evaluate("document.body.insertAdjacentHTML('beforeend','<div id=modal-root><section>Dialog</section></div><div class=main-shell data-current-page=profile></div><div class=reference-dock><button data-route=home>Home</button></div>');document.addEventListener('keydown',e=>{if(e.key===\"Escape\")document.querySelector('#modal-root').replaceChildren()});document.querySelector('[data-route=home]').onclick=()=>document.querySelector('.main-shell').dataset.currentPage='home';void 0")
 assert page.evaluate('window.__divzplitBack()') is True
 assert page.locator('#modal-root').inner_html()==''
 assert page.evaluate("document.querySelector('.main-shell').dataset.currentPage")=='profile'
 assert page.evaluate('window.__divzplitBack()') is True
 assert page.evaluate("document.querySelector('.main-shell').dataset.currentPage")=='home'
 assert page.evaluate('window.__divzplitBack()') is False
 # A frame must not acquire the main-frame clipboard/export bridge.
 page.evaluate("document.body.append(document.createElement('iframe'))")
 frame=page.frames[1];frame.evaluate(SCRIPT)
 assert frame.evaluate('window.__divzplitWebViewInstalled===undefined')
 context.route('https://other.test/**',lambda route:route.fulfill(content_type='text/html',body='<html></html>'))
 page.goto('https://other.test/');page.evaluate(SCRIPT)
 assert page.evaluate('window.__divzplitWebViewInstalled===undefined')
 print('PASS native bridge: clipboard acknowledgement, exact JSON export, idempotent injection, blocked external URL, iframe and other-origin isolation')
 browser.close()
