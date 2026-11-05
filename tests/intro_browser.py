"""Direct app entry and slow session restoration, without the former brand splash."""
from pathlib import Path
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [320,393,768,1440]:
  c,seen=context(browser);page=c.new_page();page.set_viewport_size({'width':width,'height':852});page.goto(BASE)
  expect(page.locator('#account-form')).to_be_visible();assert page.locator('.brand-intro-curtain,.brand-intro-active').count()==0
  assert page.locator('.auth-header img').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  c.close()
 c,seen=context(browser);held=[]
 token={'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_at':int(__import__('time').time())+3600}
 c.add_init_script('try{localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps(token))+');}catch{}')
 c.route('**/__auth_fixture/auth/v1/user',lambda route:held.append(route))
 page=c.new_page();page.goto(BASE);expect(page.locator('.session-check')).to_be_visible()
 assert page.locator('#account-form,.workspace-sidebar,.brand-intro-curtain').count()==0
 page.wait_for_function('document.querySelector(".session-check")!==null')
 assert held
 for route in held:route.fulfill(content_type='application/json',body=json.dumps(USER))
 expect(page.locator('.workspace-sidebar')).to_be_visible();assert page.locator('#account-form,.brand-intro-curtain').count()==0
 assert not errors,errors
 c.close();browser.close()
 print('PASS direct login at all sizes; pending session shows no incorrect form or brand splash; valid session restores app.')
