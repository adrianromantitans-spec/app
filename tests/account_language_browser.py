"""Language changes from Account with German device preferences and local Auth fixtures."""
from pathlib import Path
exec(Path('tests/planning_browser.py').read_text().split('with sync_playwright() as p:')[0])
group['document']['currency']='EUR';group['document']['expenses'][0]['amount']=123456

def route(page,section):
    expect(page.locator('.personal-shell .topbar')).to_be_visible()
    if page.locator('.nav-add').is_visible():
        page.mouse.move(4,300);page.mouse.down();page.mouse.move(150,300,steps=10);page.mouse.up()
        expect(page.locator('.navigation-drawer')).to_be_visible()
        page.locator('.navigation-drawer #modal-title').click()
        if section=='profile':page.locator('.navigation-drawer .drawer-profile').click()
        else:page.locator('.navigation-drawer [data-route="'+section+'"]').click()
    else:page.locator('.workspace-sidebar [data-route="'+section+'"]').click()

def choose(page,code):
    page.locator('[data-action="language-settings"]').click()
    expect(page.locator('.language-option')).to_have_count(4)
    page.locator('[data-language-choice="'+code+'"]').click()
    expect(page.locator('#modal-root')).to_be_empty()

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    c,page=context(b,OWNER,'de-DE')
    expect(page.locator('html')).to_have_attribute('lang','en')
    route(page,'profile');expect(page.locator('.account-row-value')).to_contain_text('Automatic')
    session=page.evaluate('localStorage.getItem("nexo-session-v1:nexo-test.supabase.co")')
    page.evaluate('window.languageChangeSentinel=123')
    for code,heading in [('es','Cuenta'),('ro','Cont'),('en','Account')]:
        choose(page,code)
        expect(page.locator('html')).to_have_attribute('lang',code)
        expect(page.locator('.account-heading h1')).to_have_text(heading)
        expected_plans={'es':'Planes','en':'Plans','ro':'Planuri'}[code]
        expect(page.locator('.reference-dock [data-route=groups]')).to_have_text(expected_plans)
        assert page.evaluate('window.languageChangeSentinel')==123,'language change reloaded the page'
        assert page.evaluate('localStorage.getItem("nexo-session-v1:nexo-test.supabase.co")')==session
        assert page.evaluate('localStorage.getItem("divzplit-language")')==code
        route(page,'expenses')
        expected=page.evaluate("locale=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(1234.56)",{'es':'es-ES','en':'en-GB','ro':'ro-RO'}[code])
        expect(page.locator('.expense-value>strong').first).to_have_text(expected)
        expect(page.locator('.expense-description strong').first).to_contain_text('Cena <b>equipo</b>')
        route(page,'profile');page.locator('[data-route="help"]').click()
        expect(page.locator('#main')).to_contain_text({'es':'Centro de ayuda','en':'Help centre','ro':'Centrul de ajutor'}[code])
        route(page,'profile')
    choose(page,'ro');page.reload();expect(page.locator('html')).to_have_attribute('lang','ro');route(page,'profile')
    expect(page.locator('.account-row-value')).to_have_text('Română')
    choose(page,'auto');expect(page.locator('html')).to_have_attribute('lang','en')
    assert page.evaluate('localStorage.getItem("divzplit-language")') is None
    page.goto('http://127.0.0.1:3003/app/?lang=es');expect(page.locator('html')).to_have_attribute('lang','es');route(page,'profile')
    choose(page,'ro');assert 'lang=' not in page.url
    expect(page.locator('html')).to_have_attribute('lang','ro')
    for width in [320,393,768,1440]:
        page.set_viewport_size({'width':width,'height':852})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.locator('[data-action="language-settings"]').click()
        expect(page.locator('[data-language-choice="ro"]')).to_have_attribute('aria-pressed','true')
        assert page.locator('.language-option').evaluate_all('(items)=>items.every(e=>e.scrollWidth<=e.clientWidth)')
        if width==393:page.screenshot(path='work/account-language-ro.png')
        page.locator('#modal-root [data-action="close-modal"]').click()
    # A browser denying persistence can still apply the choice for this visit.
    page.evaluate("() => {const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='divzplit-language')throw new Error('blocked');return original.call(this,k,v)}}")
    choose(page,'es');expect(page.locator('html')).to_have_attribute('lang','es')
    expect(page.locator('#toast')).to_contain_text('esta sesión')
    page.screenshot(path='work/account-language-es.png')
    c.close()
    c=b.new_context(locale='de-DE');c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const cloudConfig={};'))
    page=c.new_page();page.goto('http://127.0.0.1:3003/app/')
    expect(page.locator('.welcome-entry')).to_be_visible()
    assert page.locator('[data-action="language-settings"],[data-language-choice]').count()==0
    c.close();assert not errors,errors;b.close()
print('PASS: Account-only language choice, German fallback, live translations across views and money, saved preference, automatic reset, URL overrides, no reload/sign-out, mobile layout and blocked storage fallback')
