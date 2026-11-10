"""Public landing and shared language, with no real Supabase requests."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('LANDING_URL','http://127.0.0.1:3030/').rstrip('/')+'/'
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for locale,language,headline in [('es-ES','es','Divide gastos.'),('en-GB','en','Split expenses.'),('ro-RO','ro','Împarte cheltuielile.')]:
  c=browser.new_context(locale=locale,viewport={'width':1440,'height':1000},reduced_motion='reduce');page=c.new_page();calls=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
  page.on('request',lambda request:calls.append(request.url) if '.supabase.co' in request.url else None)
  page.goto(BASE);page.evaluate('document.fonts.ready');expect(page.locator('html')).to_have_attribute('lang',language);expect(page.locator('h1')).to_contain_text(headline)
  assert page.locator('.feature-card').count()==6 and page.locator('.faq-item').count()==5
  assert page.locator('link[rel=canonical]').get_attribute('href')=='https://divzplit.com/'
  assert '/app/' in page.locator('.hero-actions [data-app-link=signup]').get_attribute('href')
  stories=page.locator('.feature-story');assert stories.count()==7
  shots=stories.locator('img[data-app-shot]').evaluate_all('(items)=>items.map(i=>i.dataset.appShot)');assert len(set(shots))==7 and set(shots)=={'expenses','shopping','polls','currency','groups','tasks','budget'}
  assert all(language+'-'+shot in stories.locator('img').nth(i).get_attribute('src') for i,shot in enumerate(shots))
  page.locator('.faq-item').first.locator('summary').click();expect(page.locator('.faq-item').first.locator('p')).to_be_visible()
  page.locator('#como-funciona').scroll_into_view_if_needed();page.locator('[data-step=expense]').click();expect(page.locator('.step-image')).to_have_attribute('data-app-shot','expense');assert language+'-expense' in page.locator('.step-image').get_attribute('src')
  page.locator('[data-step=settlements]').click();expect(page.locator('.step-image')).to_have_attribute('data-app-shot','settlements')
  for width in [320,393,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':852});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(locale,width)
  page.set_viewport_size({'width':393,'height':852});page.evaluate('scrollTo(0,0)');page.locator('#menu-toggle').click();expect(page.locator('#menu-toggle')).to_have_attribute('aria-expanded','true');expect(page.locator('#main-navigation')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#menu-toggle')).to_have_attribute('aria-expanded','false')
  page.locator('#menu-toggle').click();page.locator('#main-navigation a[href="#planes"]').click();expect(page.locator('#menu-toggle')).to_have_attribute('aria-expanded','false')
  for section in page.locator('main>section').all():section.scroll_into_view_if_needed()
  page.evaluate("Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();}))")
  assert page.locator('img').evaluate_all('(images)=>images.every(i=>i.complete&&i.naturalWidth>0)')
  assert page.locator('.hero-phone').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
  assert calls==[],calls
  c.close();print('PASS landing',language,'responsive, native FAQ, interactive steps, real images, menu, reduced motion and no backend requests')
 # Explicit selection is reused by the actual application.
 c=browser.new_context(locale='es-ES',viewport={'width':1200,'height':900},reduced_motion='reduce')
 c.route('**/config.js',lambda route:route.fulfill(content_type='text/javascript',body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
 c.route('https://nexo-test.supabase.co/**',lambda route:route.fulfill(content_type='application/json',body='{"external":{"google":false,"apple":false}}'))
 page=c.new_page();page.goto(BASE);page.locator('#landing-language').select_option('ro');expect(page.locator('html')).to_have_attribute('lang','ro');assert page.evaluate('localStorage.getItem("divzplit-language")')=='ro'
 page.locator('.hero-actions [data-app-link=signup]').click();assert '/app/' in page.url and page.url.endswith('#registro');expect(page.locator('html')).to_have_attribute('lang','ro');expect(page.locator('input[name=email]')).to_be_visible();assert page.locator('#account-form a[href*="/privacy/"]').get_attribute('href').endswith('/privacy/')
 assert page.locator('img').evaluate_all('(images)=>images.every(i=>i.complete&&i.naturalWidth>0)')
 c.close();print('PASS explicit language and registration route are shared with app; app assets and legal URLs remain valid')
 c=browser.new_context(java_script_enabled=False,viewport={'width':393,'height':852});page=c.new_page();page.goto(BASE);expect(page.locator('html')).to_have_attribute('lang','en');expect(page.locator('h1')).to_contain_text('Split expenses.');expect(page).to_have_title('DivZplit — Split expenses. Share plans.');assert page.locator('link[rel=icon]').get_attribute('href')=='./assets/app-icon-192.png';assert page.locator('link[rel=icon]').get_attribute('sizes')=='192x192';page.locator('.faq-item').first.locator('summary').click();expect(page.locator('.faq-item').first.locator('p')).to_be_visible();assert page.locator('.hero-actions [data-app-link=signup]').get_attribute('href')=='./app/#registro';c.close()
 print('PASS English marketing content and PNG favicon, calls to action and FAQ work without JavaScript')
 assert not errors,errors
 browser.close()
