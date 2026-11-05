"""Text-only startup animation while Auth independently restores the session."""
from pathlib import Path
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [320,393,768,1440]:
  c,seen=context(browser);page=c.new_page();page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':width,'height':852});page.goto(BASE)
  expect(page.locator('.brand-intro-curtain')).to_be_visible();expect(page.locator('.split-word')).to_have_text('DivZplit.')
  assert page.locator('.auth-header .brand').evaluate('(el)=>el.getAnimations().some(a=>a.effect.getTiming().duration===2700)')
  assert page.locator('.word-z').evaluate('(el)=>getComputedStyle(el).animationName')=='z-rise'
  assert page.locator('.brand-intro-curtain img,.brand-intro-curtain svg').count()==0
  assert 'Conectando con tu espacio' not in page.locator('body').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  expect(page.locator('.brand-intro-curtain')).to_have_count(0);expect(page.locator('#account-form')).to_be_visible()
  assert page.locator('.auth-header img').count()==0
  assert page.locator('.auth-header .brand').evaluate('(el)=>getComputedStyle(el).visibility')=='visible'
  if width==393:page.screenshot(path='/workspace/preview/divzplit-login-text-brand.png')
  c.close()
 c,seen=context(browser);held=[]
 token={'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_at':int(__import__('time').time())+3600}
 c.add_init_script('try{localStorage.setItem("nexo-session-v1:nexo-test.supabase.co",'+json.dumps(json.dumps(token))+');}catch{}')
 c.route('**/__auth_fixture/auth/v1/user',lambda route:held.append(route))
 page=c.new_page();page.emulate_media(reduced_motion='no-preference');page.goto(BASE);expect(page.locator('.brand-intro-curtain')).to_be_visible()
 assert page.locator('#account-form,.workspace-sidebar,.session-check').count()==0
 page.wait_for_timeout(1200);expect(page.locator('.brand-intro-curtain')).to_be_visible();assert held
 for route in held:route.fulfill(content_type='application/json',body=json.dumps(USER))
 expect(page.locator('.workspace-sidebar')).to_be_visible();expect(page.locator('.brand-intro-curtain')).to_have_count(0)
 assert not page.locator('#app').evaluate('(el)=>el.inert')
 c.close()
 c,seen=context(browser);page=c.new_page();page.emulate_media(reduced_motion='reduce');page.goto(BASE)
 expect(page.locator('#account-form')).to_be_visible();expect(page.locator('.brand-intro-curtain')).to_have_count(0)
 assert not errors,errors
 c.close();browser.close()
 print('PASS original 2700ms brand movement and original z-rise letter animation; no DZ/connection text; correct session and reduced-motion behavior.')
