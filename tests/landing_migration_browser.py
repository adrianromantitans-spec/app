"""Legacy callback migration with real app boot and local transport fixtures."""
from pathlib import Path
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
from urllib.parse import urljoin
ROOT_URL=urljoin(BASE,'../')
KEY='nexo-session-v1:nexo-test.supabase.co'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for provider in ['google','recovery']:
  c,seen=context(browser,enabled=True);verifier='A'*64
  record={'verifier':verifier,'provider':provider,'redirect':ROOT_URL,'createdAt':int(__import__('time').time()*1000)}
  store='localStorage' if provider=='recovery' else 'sessionStorage';suffix=':recovery-pkce' if provider=='recovery' else ':oauth'
  c.add_init_script('try{if(!sessionStorage.getItem("legacy-fixture-set")){'+store+'.setItem('+json.dumps(KEY+suffix)+','+json.dumps(json.dumps(record))+');sessionStorage.setItem("legacy-fixture-set","yes");}}catch{}')
  seen['oauth'].append({'code_challenge':[base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')]})
  page=c.new_page();page.goto(ROOT_URL+'?code=fixture-code')
  if provider=='recovery':expect(page.locator('#password-form')).to_be_visible()
  else:expect(page.locator('.workspace-sidebar')).to_be_visible()
  assert page.url.startswith(BASE) and 'code=' not in page.url and 'legacy_auth_return' not in page.url
  assert len(seen['exchange'])==1
  assert page.evaluate(store+'.getItem('+json.dumps(KEY+suffix)+')') is None
  c.close();print('PASS migrated legacy root callback:',provider)
 c,seen=context(browser);page=c.new_page();page.goto(ROOT_URL+'#invite='+'a'*64);expect(page.get_by_text('Te han invitado a un grupo.',exact=False)).to_be_visible();assert page.url.startswith(BASE);c.close()
 c,seen=context(browser);page=c.new_page();page.goto(ROOT_URL+'#access_token=untrusted&refresh_token=untrusted');expect(page.locator('#account-form')).to_be_visible();assert page.evaluate('localStorage.getItem('+json.dumps(KEY)+')') is None;assert seen['tokens']==0;c.close()
 c,seen=context(browser);page=c.new_page();page.goto(ROOT_URL+'?notification=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');expect(page.locator('.welcome-entry')).to_be_visible();assert page.url.startswith(BASE) and 'notification=' in page.url;c.close()
 c,seen=context(browser);page=c.new_page();page.goto(ROOT_URL+'?source=installed');expect(page.locator('.welcome-entry')).to_be_visible();assert page.url.startswith(BASE);c.close()
 c,seen=context(browser);token={'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_at':int(__import__('time').time())+3600}
 c.add_init_script('try{localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(token))+');}catch{}')
 page=c.new_page();page.goto(ROOT_URL);expect(page.locator('.hero h1')).to_be_visible();assert page.locator('.workspace-sidebar').count()==0;assert page.evaluate('JSON.parse(localStorage.getItem('+json.dumps(KEY)+')).access_token')=='fixture-access'
 page.locator('footer [data-app-link=open]').click();expect(page.locator('.workspace-sidebar')).to_be_visible();assert page.url.startswith(BASE);c.close()
 # The page bridge must never adopt tokens from an unsolicited email fragment.
 assert not errors,errors
 print('PASS legacy invites, confirmation safety, notification links and installed launch routes')
 browser.close()
