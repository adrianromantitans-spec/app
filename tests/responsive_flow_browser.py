"""Real browser controls and main app flows, using local Auth fixtures and demo data.
Run against the local server on port 3003. Optional: AUDIT_ENGINES=chromium,webkit.
No production accounts, emails, groups or payments are modified.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ns={}
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0].replace('http://127.0.0.1:3000/app/','http://127.0.0.1:3003/app/'),ns)


def fit(page,label):
    result=page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert result['scroll']<=result['width']+1,(label,result)
    for select in page.locator('select:visible').all():
        assert select.evaluate('(e)=>getComputedStyle(e).opacity')=='1',label
        assert select.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.width<=innerWidth}'),label


def route(page,target):
    if target=='help':
        route(page,'profile');page.locator('.account-page [data-route="help"]').click();return
    if page.locator('.back-to-home').is_visible():page.locator('.back-to-home').click()
    if page.locator('[data-action="workspace-menu"]').is_visible():
        page.locator('[data-action="workspace-menu"]').click()
        page.locator('.navigation-drawer [data-route="'+target+'"]').click()
    else:page.locator('.workspace-sidebar button[data-route="'+target+'"]').click()


def close(page):page.locator('#modal-root [data-action="close-modal"]').last.click()

with sync_playwright() as p:
    for engine in os.environ.get('AUDIT_ENGINES','chromium').split(','):
        browser=getattr(p,engine).launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if engine=='chromium' else {}))
        c,seen=ns['context'](browser,enabled=True);c.add_init_script('window.setInterval=()=>0;');page=c.new_page();page.goto(ns['BASE']+'#registro')
        for width in [320,393,430,768,1024,1440]:
            page.set_viewport_size({'width':width,'height':852});fit(page,'signup '+str(width))
            age=page.locator('[name="ageBand"]');expect(age).to_be_visible();age.scroll_into_view_if_needed()
            assert age.evaluate('(e)=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e}'),width
        page.set_viewport_size({'width':393,'height':852})
        age.select_option('under_16');expect(page.locator('#modal-title')).to_have_text('Registro a partir de 16 años');assert not seen['signup'];close(page)
        age.select_option('16_or_over');page.locator('[name="name"]').fill('Persona de prueba');page.locator('[name="email"]').fill('audit@example.test');page.locator('[name="password"]').fill('fixture-password');page.locator('[name="acceptTerms"]').check();page.locator('#account-form [type="submit"]').click()
        expect(page.get_by_role('heading',name='Revisa tu correo',exact=True)).to_be_visible();assert len(seen['signup'])==1 and seen['signup'][0]['data']['declared_age_band']=='16_or_over'
        page.goto(ns['BASE']);page.locator('[data-action="oauth-google"]').click();expect(page.locator('#oauth-consent-form')).to_be_visible();page.locator('#oauth-consent-form [name="ageBand"]').select_option('16_or_over');page.locator('#oauth-consent-form [name="acceptTerms"]').check();fit(page,'social consent');close(page)
        # Enter the app's existing local demo without signing into any production account.
        page.evaluate("()=>{const b=document.createElement('button');b.dataset.action='demo';b.id='audit-demo';document.body.append(b)}");page.locator('#audit-demo').click();page.locator('#audit-demo').evaluate('(e)=>e.remove()')
        for width in [320,393,430,768,1024,1440]:
            page.set_viewport_size({'width':width,'height':852})
            for section in ['home','expenses','tasks','polls','shopping','budget','groups','profile','help']:
                route(page,section);fit(page,str(width)+' '+section)
            print('Layout:',engine,width,flush=True)
        page.set_viewport_size({'width':393,'height':852});route(page,'groups');page.locator('[data-action="new-group"]').first.click()
        f=page.locator('#group-form');f.locator('[name="name"]').fill('Grupo de auditoría');f.locator('[name="currency"]').select_option('RON');f.locator('[name="emoji"]').select_option('🏠');f.locator('[name="type"]').select_option('Convivencia')
        for width in [320,393,430,768,1440]:page.set_viewport_size({'width':width,'height':852});fit(page,'new group '+str(width))
        f.locator('[type="submit"]').click();expect(page.locator('.home-group-copy strong')).to_contain_text('Grupo de auditoría')
        assert page.evaluate("JSON.parse(localStorage.getItem('nexo-local-v1')).groups.find(g=>g.name==='Grupo de auditoría').currency")=='RON'
        print('Currency and group:',engine,flush=True)
        page.set_viewport_size({'width':393,'height':852});page.locator('.mobile-quick-add .nav-add').click();page.locator('.quick-add-modal [data-action="new-expense"]').click()
        f=page.locator('#expense-form');f.locator('[name="title"]').fill('Compra de prueba');f.locator('[name="amount"]').fill('12.50');f.locator('.expense-more-options summary').click();f.locator('[name="category"]').select_option('Supermercado');f.locator('[name="frequency"]').select_option('monthly')
        for width in [320,393,430,768,1440]:page.set_viewport_size({'width':width,'height':852});fit(page,'expense '+str(width))
        f.locator('[type="submit"]').click();expect(page.locator('.expense-description strong')).to_contain_text('Compra de prueba')
        page.locator('[data-expense]').first.click();page.locator('[data-edit-expense]').click();page.locator('#expense-form [name="title"]').fill('Compra revisada');page.locator('#expense-form [type="submit"]').click();expect(page.locator('.expense-description strong')).to_contain_text('Compra revisada')
        page.locator('[data-expense]').first.click();page.locator('[data-delete-expense]').click();page.locator('[data-confirm-delete]').click();expect(page.locator('.expense-description')).to_have_count(0)
        page.set_viewport_size({'width':393,'height':852});route(page,'tasks');page.locator('[data-action="new-task"]').first.click();page.locator('#task-form [name="title"]').fill('Preparar la compra');page.locator('#task-form [type="submit"]').click();expect(page.locator('.planning-task')).to_have_count(1);page.locator('[data-task]').check();expect(page.locator('[data-task]')).to_be_checked()
        route(page,'polls');page.locator('[data-action="new-poll"]').first.click();page.locator('#poll-form [name="title"]').fill('¿Dónde compramos?');page.locator('#poll-form [name="option"]').nth(0).fill('Cerca');page.locator('#poll-form [name="option"]').nth(1).fill('En el centro');page.locator('#poll-form [type="submit"]').click();page.locator('[data-poll]').first.click();expect(page.locator('[data-poll]').first).to_have_attribute('aria-pressed','true')
        route(page,'shopping');page.locator('[data-shopping-action="add"]').click();page.locator('#shopping-item-form [name="title"]').fill('Pan');page.locator('#shopping-item-form [name="quantity"]').fill('2 barras');page.locator('#shopping-item-form [type="submit"]').click();expect(page.locator('.shopping-row')).to_have_count(1)
        page.locator('[data-shopping-action="edit"]').click();page.locator('#shopping-item-form [name="title"]').fill('Pan integral');page.locator('#shopping-item-form [type="submit"]').click();page.locator('[data-shopping-check]').check();expect(page.locator('.shopping-bought .shopping-row')).to_have_count(1)
        page.locator('[data-shopping-action="checkout"]').click();page.locator('#expense-form [name="amount"]').fill('5.25');page.locator('#expense-form [type="submit"]').click();expect(page.locator('[data-shopping-action="expense"]')).to_be_visible();page.locator('[data-shopping-action="expense"]').click();expect(page.locator('#modal-title')).to_contain_text('Pan integral');close(page)
        route(page,'budget');page.locator('[data-action="edit-budget"]').click();page.locator('#budget-form [name="budget"]').fill('500');page.locator('#budget-form [type="submit"]').click();expect(page.locator('.budget-numbers strong')).to_be_visible()
        route(page,'profile');page.locator('[data-action="language-settings"]').click();page.locator('[data-language-choice="ro"]').click();expect(page.locator('.account-heading')).to_contain_text('Cont');page.locator('[data-action="language-settings"]').click();page.locator('[data-language-choice="es"]').click()
        page.screenshot(path='work/audit-'+engine+'-account.png');assert not ns['errors'],ns['errors'];c.close();browser.close()
        print('PASS:',engine,'registration age, currency/group creation, native selects, routes at six widths, expense add/edit/delete, tasks, voting, shopping checkout, budget and account language')
