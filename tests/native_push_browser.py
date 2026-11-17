"""Actual notification UI in es/en/ro, with modeled Android ports and fictional APIs."""
import importlib.util,json,mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('shots',ROOT/'scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
SCRIPT=(ROOT/'android/app/src/webview/assets/native-webview.js').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  for permission in ['default','denied']:
   c,_=shots.context(b,lang);calls=[];errors=[]
   def static(route):
    path=urlsplit(route.request.url).path
    if path=='/config.js':route.fallback();return
    file=ROOT/path.lstrip('/')
    if path.endswith('/'):file=file/'index.html'
    if not file.is_file() or not file.resolve().is_relative_to(ROOT):route.fulfill(status=404,body='');return
    route.fulfill(content_type={'.js':'text/javascript','.webmanifest':'application/manifest+json'}.get(file.suffix,mimetypes.guess_type(str(file))[0] or 'application/octet-stream'),body=file.read_bytes())
   c.route('https://divzplit.com/**',static)
   def native_rpc(route):
    path=urlsplit(route.request.url).path;body=json.loads(route.request.post_data or '{}');calls.append((path,body))
    route.fulfill(content_type='application/json',body=json.dumps({'enabled':True}) if path.endswith('_status') else 'null')
   c.route('https://nexo-test.supabase.co/rest/v1/rpc/*native*',native_rpc)
   page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('https://divzplit.com/app/?source=installed');expect(page.locator('.home-balance')).to_be_visible()
   page.evaluate(SCRIPT)
   page.evaluate('''(permission)=>{
    const state={permission,userId:'',enabled:false,token:''};window.nativeCalls=[];
    const c=new MessageChannel();window.nativeFixture=c.port1;
    nativeFixture.onmessage=e=>{
     const m=JSON.parse(e.data);nativeCalls.push(m.type);let value;
     if(m.type==='pushState')value={...state};
     else if(m.type==='pushClear'){state.userId='';state.enabled=false;state.token='';}
     else if(m.type==='pushPermission'){state.permission=permission==='denied'?'denied':'granted';value=state.permission;}
     else if(m.type==='pushToken'){state.token='fictional_native_fixture_token_12345';value=state.token;}
     else if(m.type==='pushBind'){state.userId=m.userId;state.enabled=true;value={...state};}
     nativeFixture.postMessage(JSON.stringify({id:m.id,ok:true,value}));
    };
    window.postMessage('divzplit-native-ready',location.origin,[c.port2]);
   }''',permission)
   page.wait_for_function("() => window.nativeCalls.includes('pushState')")
   page.locator('.notification-bell').click();page.locator('[data-notification-action=preferences]').click()
   expect(page.locator('.notification-settings')).to_be_visible()
   if permission=='default':
    expect(page.locator('[data-notification-action=enable]')).to_be_visible();page.locator('[data-notification-action=enable]').click()
    expect(page.locator('[data-notification-action=disable]')).to_be_visible()
    register=[args for path,args in calls if path.endswith('divzplit_register_native_push')]
    assert register and register[-1]['p_language']==lang and register[-1]['p_token'].startswith('fictional_')
    assert page.evaluate("nativeCalls.indexOf('pushPermission')<nativeCalls.indexOf('pushBind')")
    page.locator('[data-notification-action=disable]').click();expect(page.locator('[data-notification-action=enable]')).to_be_visible()
    assert any(path.endswith('divzplit_remove_native_push') for path,args in calls)
   else:
    expect(page.locator('[data-notification-action=enable]')).to_have_count(0)
    expect(page.locator('.notification-device')).to_contain_text({'es':'teléfono','en':'phone settings','ro':'telefonului'}[lang])
    assert not any(path.endswith('divzplit_register_native_push') for path,args in calls)
   assert not errors,errors
   c.close();print('PASS',lang,permission,'actual notification UI, native consent/registration/disable or denied state; mocked Android and backend',flush=True)
 b.close()
