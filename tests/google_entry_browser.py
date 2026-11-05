"""Google is an icon on the entry screen; email forms contain no duplicate provider UI.
Run locally on port 3003. GOOGLE_ENTRY_ENGINES=chromium,webkit enables both engines.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
fixture=Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0].replace('http://127.0.0.1:3000/app/','http://127.0.0.1:3003/app/').replace("locale='es-ES'",'locale=TEST_LANGUAGE')
with sync_playwright() as p:
 for engine in os.environ.get('GOOGLE_ENTRY_ENGINES','chromium').split(','):
  browser=getattr(p,engine).launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if engine=='chromium' else {}))
  for locale in ['es-ES','en-GB','ro-RO']:
   ns={'TEST_LANGUAGE':locale};exec(fixture,ns);c,seen=ns['context'](browser,enabled=True)
   page=c.new_page();page.goto(ns['BASE']);google=page.locator('[data-action="oauth-google"]');expect(google).to_be_enabled()
   expect(google.locator('svg')).to_have_count(1);expect(google).to_have_text('');assert google.get_attribute('aria-label')
   for width in [320,393,768,1440]:
    page.set_viewport_size({'width':width,'height':852})
    expect(google).to_have_css('background-color','rgba(0, 0, 0, 0)');expect(google).to_have_css('border-top-width','0px');expect(google).to_have_css('box-shadow','none')
    box=google.bounding_box();assert box['width']>=44 and box['height']>=44
    mark=google.locator('svg').bounding_box();assert abs(mark['x']+mark['width']/2-box['x']-box['width']/2)<1
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if width==393 and locale=='es-ES':page.screenshot(path='work/google-entry-'+engine+'.png')
   google.click();expect(page.locator('#oauth-consent-form')).to_be_visible();assert not seen['oauth'];expect(page.locator('#oauth-consent-form [name="ageBand"]')).to_be_visible();page.locator('#modal-root [data-action="close-modal"]').first.click()
   page.locator('.welcome-entry [data-action="login"]').click();expect(page.locator('#account-form')).to_be_visible()
   expect(page.locator('[data-action="oauth-google"],.auth-card .social-providers,.auth-card .auth-divider')).to_have_count(0)
   expect(page.locator('#account-form input')).to_have_count(2)
   page.set_viewport_size({'width':393,'height':852})
   if locale=='es-ES':page.screenshot(path='work/google-email-form-'+engine+'.png')
   page.locator('.signup-prompt [data-action="signup"]').click();expect(page.locator('[name="ageBand"]')).to_be_visible();expect(page.locator('[data-action="oauth-google"]')).to_have_count(0)
   page.set_viewport_size({'width':1440,'height':852});page.goto(ns['BASE'].removesuffix('app/'));page.locator('.nav-login').click()
   expect(page.locator('[data-action="oauth-google"]')).to_have_count(0);expect(page.locator('#account-form input')).to_have_count(2)
   page.locator('[name="email"]').fill('ana@example.test');page.locator('[name="password"]').fill('fixture-password');page.locator('#account-form [type="submit"]').click();expect(page.locator('.account-empty')).to_be_visible();assert seen['tokens']==1
   c.close();assert not ns['errors'],ns['errors']
   print('PASS:',engine,locale,'icon-only Google, 44px touch target, consent preserved, email-only login, signup intact and website login works',flush=True)
  browser.close()
