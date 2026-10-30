"""Welcome/email/OAuth UI tests with a completely local Auth transport fixture.
No real social provider, accounts or emails are used. Start Nexo first.
"""
import base64
import hashlib
import json
import os
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3000/').rstrip('/')+'/'
errors=[]
USER={'id':'11111111-1111-4111-8111-111111111111','email':'ana@example.test',
      'user_metadata':{'display_name':'Ana'}}

def context(browser,enabled=False,hold_settings=False):
    c=browser.new_context(viewport={'width':1440,'height':1000})
    seen={'settings':[],'oauth':[],'exchange':[],'signup':[],'tokens':0,'hold':hold_settings}
    c.route('**/config.js',lambda r:r.fulfill(content_type='text/javascript',
        body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
    c.add_init_script("""
      const originalFetch=window.fetch.bind(window);
      window.fetch=(input,options)=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.origin==='https://nexo-test.supabase.co')return originalFetch(location.origin+'/__auth_fixture'+url.pathname+url.search,options);
        return originalFetch(input,options);
      };
    """)
    def fulfill(route,data,status=200):
        route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
    def api(route):
        path=urlsplit(route.request.url).path.removeprefix('/__auth_fixture')
        data=json.loads(route.request.post_data or '{}')
        query=parse_qs(urlsplit(route.request.url).query)
        if path=='/auth/v1/settings':
            if seen['hold']:seen['settings'].append(route)
            else:fulfill(route,{'external':{'google':enabled,'apple':enabled,'email':True}})
        elif path=='/auth/v1/token':
            seen['tokens']+=1
            if query.get('grant_type')==['pkce']:
                assert data['auth_code']=='fixture-code'
                challenge=base64.urlsafe_b64encode(hashlib.sha256(data['code_verifier'].encode()).digest()).decode().rstrip('=')
                assert challenge==seen['oauth'][-1]['code_challenge'][0]
                seen['exchange'].append(data)
            elif data.get('password')!='fixture-password':
                fulfill(route,{'code':'invalid_credentials'},400);return
            fulfill(route,{'access_token':'fixture-access','refresh_token':'fixture-refresh','expires_in':3600,'user':USER})
        elif path=='/auth/v1/user':fulfill(route,USER)
        elif path=='/auth/v1/signup':seen['signup'].append(data);fulfill(route,{'user':USER})
        elif path=='/auth/v1/logout':fulfill(route,{})
        elif path=='/rest/v1/nexo_groups':fulfill(route,[])
        else:fulfill(route,{},404)
    c.route('**/__auth_fixture/**',api)
    def authorize(route):
        query=parse_qs(urlsplit(route.request.url).query)
        assert query['code_challenge_method']==['s256']
        assert query['redirect_to']==[BASE]
        assert 'apikey' not in query and 'code_verifier' not in query
        seen['oauth'].append(query)
        route.fulfill(status=302,headers={'Location':BASE+'?code=fixture-code'},body='')
    c.route('https://nexo-test.supabase.co/auth/v1/authorize?**',authorize)
    c.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
    return c,seen

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),
                             headless=True,args=['--no-sandbox'])
    c,seen=context(browser,hold_settings=True)
    page=c.new_page();page.goto(BASE)
    expect(page.get_by_role('heading',name='Bienvenido a DivZplit.')).to_be_visible()
    assert page.locator('.sidebar').count()==0
    page.get_by_label('Correo electrónico').fill('draft@example.test')
    for route in seen['settings']:route.fulfill(content_type='application/json',body=json.dumps({'external':{'google':False,'apple':False}}))
    seen['hold']=False
    expect(page.get_by_text('Google y Apple todavía no están disponibles.',exact=False)).to_be_visible()
    expect(page.get_by_role('button',name='Continuar con Google',exact=False)).to_be_disabled()
    expect(page.get_by_role('button',name='Continuar con Apple',exact=False)).to_be_disabled()
    expect(page.get_by_label('Correo electrónico')).to_have_value('draft@example.test')
    page.reload()
    expect(page.get_by_role('heading',name='Bienvenido a DivZplit.')).to_be_visible()
    assert page.locator('.sidebar').count()==0
    print('PASS: welcome is the default, refresh stays there and provider updates preserve form input')

    # New account entry, without sending any actual confirmation email.
    page.locator('.auth-mode-tabs [data-action=signup]').click()
    form=page.locator('#account-form')
    form.get_by_label('¿Cómo te llamas?').fill('Ana')
    form.get_by_label('Correo electrónico').fill(USER['email'])
    form.get_by_label('Contraseña',exact=True).fill('fixture-password')
    form.get_by_role('button',name='Crear cuenta',exact=True).click()
    expect(page.get_by_role('heading',name='Revisa tu correo')).to_be_visible()
    assert seen['signup'][0]['data']['display_name']=='Ana'
    page.get_by_role('button',name='Ya he confirmado: entrar').click()
    form=page.locator('#account-form')
    form.get_by_label('Correo electrónico').fill(USER['email'])
    form.get_by_label('Contraseña',exact=True).fill('wrong-password')
    form.get_by_role('button',name='Iniciar sesión',exact=True).click()
    expect(form.get_by_role('alert')).to_contain_text('no son correctos')
    form.get_by_label('Contraseña',exact=True).fill('fixture-password')
    form.get_by_role('button',name='Iniciar sesión',exact=True).click()
    expect(page.get_by_role('heading',name='Tu próximo plan empieza aquí')).to_be_visible()
    page.reload()
    expect(page.get_by_role('heading',name='Tu próximo plan empieza aquí')).to_be_visible()
    page.get_by_role('button',name='Tu perfil y datos').click()
    page.get_by_role('button',name='Cerrar sesión',exact=True).click()
    expect(page.get_by_role('heading',name='Bienvenido a DivZplit.')).to_be_visible()
    print('PASS: signup, confirmation guidance, login errors, session restoration and logout')
    c.close()

    for provider in ['google','apple']:
        c,seen=context(browser,enabled=True)
        page=c.new_page();page.goto(BASE+'#invite='+'a'*64)
        expect(page.get_by_text('Te han invitado a un grupo.',exact=False)).to_be_visible()
        page.get_by_role('button',name='Continuar con '+provider.title(),exact=True).click()
        expect(page.get_by_role('heading',name='Tu próximo plan empieza aquí')).to_be_visible()
        expect(page.get_by_role('button',name='Aceptar invitación')).to_be_visible()
        assert seen['oauth'][0]['provider']==[provider]
        assert len(seen['exchange'])==1 and 'code=' not in page.url
        page.reload()
        expect(page.get_by_role('heading',name='Tu próximo plan empieza aquí')).to_be_visible()
        print('PASS:',provider,'PKCE redirect, code exchange, verified session and preserved invitation')
        c.close()

    c,seen=context(browser,enabled=True)
    page=c.new_page();page.goto(BASE+'?code=unsolicited')
    expect(page.get_by_role('heading',name='Bienvenido a DivZplit.')).to_be_visible()
    expect(page.locator('#toast')).to_contain_text('otro navegador')
    assert seen['tokens']==0 and 'code=' not in page.url
    page.goto(BASE+'?error=access_denied&error_description=untrusted-provider-text')
    expect(page.locator('#toast')).to_contain_text('cancelado')
    assert 'untrusted-provider-text' not in page.locator('body').inner_text()
    print('PASS: unsolicited and cancelled OAuth callbacks cannot create sessions or expose raw provider errors')
    for width in [360,390,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='/tmp/nexo-welcome-mobile.png',full_page=True)
    page.set_viewport_size({'width':1440,'height':1000})
    page.screenshot(path='/tmp/nexo-welcome-desktop.png',full_page=True)
    assert errors==[],errors
    print('PASS: welcome fits phone/tablet/desktop widths with no JavaScript errors')
    browser.close()
