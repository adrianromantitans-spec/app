"""One logo moves into the centred glass panel; skipping and reduced motion work."""
from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:3000/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width,height in [(390,844),(1440,1000)]:
        c=browser.new_context(locale='es-ES',viewport={'width':width,'height':height})
        c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
        page=c.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE)
        expect(page.locator('.brand-intro-curtain')).to_be_visible()
        expect(page.locator('.entry-controls')).to_have_css('opacity','0')
        assert page.locator('.split-word').count()==1
        page.locator('.auth-header .brand').evaluate('(el)=>window.introLogo=el')
        page.wait_for_timeout(700)
        assert page.locator('.auth-header .brand').evaluate('(el)=>parseFloat(getComputedStyle(el).fontSize)>60')
        box=page.locator('.auth-header .brand').bounding_box()
        assert abs(box['x']+box['width']/2-width/2)<2
        assert abs(box['y']+box['height']/2-height/2)<2
        assert page.locator('.auth-header .brand').evaluate('(el)=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
        page.screenshot(path=f'work/intro-{width}.png')
        expect(page.locator('.brand-intro-curtain')).to_have_count(0)
        expect(page.get_by_role('link',name='Crear cuenta',exact=False)).to_be_visible()
        assert page.locator('.auth-header .brand').evaluate('(el)=>el===window.introLogo')
        assert page.locator('.split-word').count()==1
        final=page.locator('.auth-header .brand').bounding_box()
        panel=page.locator('.welcome-panel').bounding_box()
        assert panel['y'] < final['y'] < panel['y']+panel['height']/2
        assert abs(final['x']+final['width']/2-width/2)<2
        page.screenshot(path=f'work/welcome-{width}.png',full_page=True)
        page.get_by_role('link',name='Crear cuenta',exact=False).click()
        assert page.locator('.brand-intro-curtain').count()==0
        expect(page.get_by_role('heading',name='Crea tu cuenta',exact=True)).to_be_visible()
        page.reload();expect(page.locator('.brand-intro-curtain')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator('.brand-intro-curtain')).to_have_count(0)
        expect(page.locator('.auth-main')).to_be_visible()
        page.reload();expect(page.locator('.brand-intro-curtain')).to_be_visible()
        page.evaluate('window.dispatchEvent(new Event("resize"))')
        expect(page.locator('.brand-intro-curtain')).to_be_visible()
        page.set_viewport_size({'width':width,'height':height-60})
        page.wait_for_timeout(100)
        expect(page.locator('.brand-intro-curtain')).to_be_visible()
        page.set_viewport_size({'width':width+100,'height':height})
        expect(page.locator('.brand-intro-curtain')).to_have_count(0)
        assert not errors,errors
        c.close()
    c=browser.new_context(locale='es-ES',reduced_motion='reduce')
    c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
    page=c.new_page();page.goto(BASE)
    expect(page.locator('.auth-main')).to_be_visible()
    assert page.locator('.brand-intro-curtain').count()==0
    assert page.locator('.split-word').count()==1
    c.close()
    for language,login in [('es-ES','Iniciar sesión'),('en-GB','Sign in'),('ro-RO','Autentificare')]:
        c=browser.new_context(locale=language,reduced_motion='reduce',viewport={'width':320,'height':568})
        c.route('**/config.js',lambda r:r.fulfill(content_type='application/javascript',body='export const cloudConfig={};'))
        page=c.new_page();page.goto(BASE)
        expect(page.locator('[data-action="login"]')).to_have_text(login)
        image=page.locator('.welcome-phone img')
        assert image.get_attribute('src')==f'./assets/welcome-{language[:2]}.png'
        expect(image).to_be_visible()
        page.wait_for_function("document.querySelector('.welcome-phone img').naturalWidth>0")
        assert page.locator('.split-word').count()==1
        assert 'Alex' not in page.locator('body').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        panel=page.locator('.welcome-panel').bounding_box()
        assert panel['y']>=0 and panel['y']+panel['height']<=568
        assert page.locator('.auth-footer').count()==0
        c.close()
    browser.close()
print('PASS: single logo centres, assembles, travels into centred panel; navigation, Escape, resize and reduced motion work')
