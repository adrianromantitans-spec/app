"""Two independent browser accounts against real PostgreSQL RPC/RLS.

Auth and the HTTP transport are local test doubles (no real emails, passwords or
Supabase requests). Database operations execute the shipped SQL, not a fake DB.
Requires the disposable container and auth fixture from database_test.py.
Start npm start, then: python3 tests/shared_browser.py
"""
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3000/')
BASE=BASE.rstrip('/')+'/'
CONTAINER=os.environ.get('NEXO_TEST_CONTAINER','nexo-postgres-tests')
OWNER='11111111-1111-4111-8111-111111111111'
FRIEND='22222222-2222-4222-8222-222222222222'
users={
    'ana@example.test':{'id':OWNER,'email':'ana@example.test','user_metadata':{'display_name':'Ana'}},
    'luis@example.test':{'id':FRIEND,'email':'luis@example.test','user_metadata':{'display_name':'Luis'}}
}
tokens={f'fixture-{u["id"]}':u for u in users.values()}
created=[]
errors=[]
lose_next_save=False

def quote(value): return "'"+str(value).replace("'","''")+"'"
def sql(text,actor=None,admin=False):
    prefix='' if admin else f"set role authenticated;set request.jwt.claim.sub={quote(actor or '')};"
    return subprocess.run(['docker','--host=unix:///var/run/docker.sock','exec','-i',CONTAINER,
                           'psql','-U','postgres','-tAq','-v','ON_ERROR_STOP=1'],
                          input=prefix+text,text=True,capture_output=True)

def fulfill(route,value,status=200):
    route.fulfill(status=status,content_type='application/json',body=json.dumps(value),
                  headers={'Access-Control-Allow-Origin':'*'})

def api(route):
    global lose_next_save
    request=route.request
    path=urlsplit(request.url).path.removeprefix('/__supabase')
    if request.method=='OPTIONS':
        route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*',
            'Access-Control-Allow-Headers':'apikey,authorization,content-type',
            'Access-Control-Allow-Methods':'GET,POST,OPTIONS'})
        return
    data=json.loads(request.post_data or '{}')
    user=tokens.get(request.headers.get('authorization','').replace('Bearer ',''))
    if path=='/auth/v1/token':
        user=users.get(data.get('email'))
        if not user or data.get('password')!='fixture-password':
            fulfill(route,{'code':'invalid_credentials'},400);return
        fulfill(route,{'access_token':'fixture-'+user['id'],'refresh_token':'fixture-refresh',
                       'expires_in':3600,'user':user});return
    if path=='/auth/v1/user':
        fulfill(route,user or {'code':'invalid_credentials'},200 if user else 401);return
    if path=='/auth/v1/logout': fulfill(route,{});return
    if not user: fulfill(route,{'message':'NEXO_FORBIDDEN'},403);return
    if path=='/rest/v1/nexo_groups':
        result=sql("select coalesce(jsonb_agg(to_jsonb(g) order by created_at),'[]') from public.nexo_groups g;",user['id'])
    else:
        name=path.rsplit('/',1)[-1]
        if name=='nexo_create_group': args=[quote(json.dumps(data['p_fields']))+'::jsonb']
        elif name=='nexo_save_group': args=[quote(data['p_id'])+'::uuid',str(int(data['p_version'])),quote(json.dumps(data['p_document']))+'::jsonb']
        elif name in ['nexo_create_invite','nexo_revoke_invites']: args=[quote(data['p_id'])+'::uuid']
        elif name=='nexo_join_group': args=[quote(data['p_token'])]
        else: fulfill(route,{},404);return
        result=sql('select public.'+name+'('+','.join(args)+');',user['id'])
    if result.returncode:
        code=next((c for c in ['NEXO_CONFLICT','NEXO_INVITE','NEXO_OWNER','NEXO_FORBIDDEN'] if c in result.stderr),'22023')
        fulfill(route,{'code':'P0001','message':code},400);return
    value=json.loads(result.stdout.strip() or 'null')
    if path.endswith('/nexo_create_group'):created.append(value['id'])
    if path.endswith('/nexo_save_group') and lose_next_save:
        lose_next_save=False
        route.abort('failed')
        return
    fulfill(route,value)

def context(browser):
    c=browser.new_context(viewport={'width':1440,'height':1000})
    c.route('**/config.js',lambda route:route.fulfill(content_type='text/javascript',
        body="export const cloudConfig={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_fixture'};"))
    # Keep all fixture transport on localhost. The managed browser may block
    # external hosts before Playwright interception; no Supabase access is needed.
    c.add_init_script("""
      const realFetch=window.fetch.bind(window);
      window.fetch=(input,options)=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.origin==='https://nexo-test.supabase.co'){
          return realFetch(location.origin+'/__supabase'+url.pathname+url.search,options);
        }
        return realFetch(input,options);
      };
    """)
    c.route('**/__supabase/**',api)
    return c

def login(page,email):
    page.get_by_label('Correo electrónico').fill(email)
    page.get_by_label('Contraseña',exact=True).fill('fixture-password')
    page.get_by_role('dialog').get_by_role('button',name='Entrar',exact=True).click()
    try:
        expect(page.get_by_role('dialog')).to_have_count(0)
    except AssertionError:
        print('Auth UI error:',page.locator('.form-error').all_text_contents())
        print('Browser errors:',errors)
        raise

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),
                                  headless=True,args=['--no-sandbox'])
        owner_context=context(browser);friend_context=context(browser)
        owner=owner_context.new_page();friend=friend_context.new_page()
        for page in [owner,friend]:page.on('pageerror',lambda error:errors.append(str(error)))
        owner.goto(BASE+'#access_token=unsolicited-fixture&refresh_token=fixture&type=signup')
        expect(owner.get_by_role('dialog').get_by_label('Correo electrónico')).to_be_visible()
        assert owner.evaluate("!localStorage.getItem('nexo-session-v1:nexo-test.supabase.co')")
        assert '#access_token=' not in owner.url
        owner.keyboard.press('Escape')
        print('PASS: returning from email confirmation requests explicit sign-in and clears URL tokens')
        owner.get_by_role('button',name='Entrar',exact=True).click()
        login(owner,'ana@example.test')
        expect(owner.get_by_role('heading',name='Tu próximo plan empieza aquí')).to_be_visible()
        assert owner.get_by_role('heading',name='Escapada a Lisboa',exact=True).count()==0
        print('PASS: real account starts empty; local sample groups are not uploaded')

        owner.get_by_role('button',name='Crear mi primer grupo').click()
        dialog=owner.get_by_role('dialog')
        dialog.get_by_label('Nombre del grupo').fill('Viaje entre móviles')
        dialog.get_by_label('Presupuesto total del grupo (€)').fill('1000')
        assert dialog.get_by_label('¿Quién se apunta?').count()==0
        dialog.get_by_role('button',name='Crear grupo',exact=True).click()
        expect(owner.get_by_role('heading',name='Viaje entre móviles',exact=True)).to_be_visible()

        owner.get_by_role('button',name='Añadir tarea',exact=True).first.click()
        owner.get_by_label('¿Qué queda pendiente?').fill('Reservar museo')
        owner.get_by_role('dialog').get_by_role('button',name='Añadir tarea').click()
        owner.get_by_role('tab',name='Planes y votaciones').click()
        owner.get_by_role('button',name='Nueva votación').click()
        owner.get_by_label('La gran pregunta').fill('¿Dónde comemos?')
        owner.get_by_label('Opción 1',exact=True).fill('Mercado')
        owner.get_by_label('Opción 2',exact=True).fill('Terraza')
        owner.get_by_role('dialog').get_by_role('button',name='Crear votación').click()
        owner.get_by_role('tab',name='Resumen',exact=True).click()
        print('PASS: group, task and poll are persisted through the actual database RPCs')

        owner.get_by_role('button',name='Invitar',exact=True).click()
        owner.get_by_role('button',name='Generar enlace de invitación').click()
        link=owner.get_by_label('Enlace de invitación').input_value()
        assert '#invite=' in link
        owner.keyboard.press('Escape')
        friend.goto(link)
        assert '#invite=' not in friend.url
        friend.get_by_role('button',name='Entrar y unirme').click()
        login(friend,'luis@example.test')
        friend.get_by_role('button',name='Aceptar invitación').click()
        expect(friend.get_by_role('heading',name='Viaje entre móviles',exact=True)).to_be_visible()
        expect(friend.get_by_text('2 personas, un gran plan')).to_be_visible()
        owner.get_by_role('button',name='Actualizar',exact=True).click()
        expect(owner.get_by_text('2 personas, un gran plan')).to_be_visible()
        assert friend.get_by_role('button',name='Invitar',exact=True).count()==0
        assert friend.get_by_role('button',name='Ajustar presupuesto').count()==0
        print('PASS: invitation survives sign-in, joins another account and respects owner permissions')

        owner.get_by_role('button',name='Añadir gasto',exact=True).first.click()
        owner.get_by_label('¿Qué habéis pagado?').fill('Cena sincronizada')
        owner.get_by_label('Importe (€)').fill('10.01')
        owner.get_by_role('button',name='Guardar gasto').click()
        # Use the real polling interval rather than forcing a reload.
        expect(friend.get_by_text('Cena sincronizada',exact=True)).to_be_visible(timeout=12000)
        print('PASS: second browser receives a shared expense through automatic polling')

        owner.get_by_role('button',name='Mercado',exact=False).click()
        friend.get_by_role('button',name='Actualizar',exact=True).click()
        friend.get_by_role('button',name='Terraza',exact=False).click()
        owner.get_by_role('button',name='Actualizar',exact=True).click()
        expect(owner.get_by_text('2 de 2 han votado')).to_be_visible()
        expect(owner.get_by_role('button',name='Mercado',exact=False)).to_have_attribute('aria-pressed','true')
        expect(friend.get_by_role('button',name='Terraza',exact=False)).to_have_attribute('aria-pressed','true')
        print('PASS: the two accounts have independent votes in the same poll')

        # Keep the first browser's revision stale while a form is being edited.
        owner.get_by_role('button',name='Añadir gasto',exact=True).click()
        owner.get_by_label('¿Qué habéis pagado?').fill('Taxi sin duplicados')
        owner.get_by_label('Importe (€)').fill('20')
        friend.get_by_role('checkbox',name='Reservar museo').check()
        expect(friend.get_by_role('checkbox',name='Reservar museo')).to_be_checked()
        owner.get_by_role('button',name='Guardar gasto').click()
        expect(owner.get_by_role('dialog').get_by_role('alert')).to_contain_text('Alguien ha actualizado el grupo')
        owner.get_by_role('button',name='Guardar gasto').click()
        expect(owner.get_by_text('Taxi sin duplicados',exact=True)).to_have_count(1)
        expect(owner.get_by_role('checkbox',name='Reservar museo')).to_be_checked()
        friend.get_by_role('button',name='Actualizar',exact=True).click()
        expect(friend.get_by_text('Taxi sin duplicados',exact=True)).to_have_count(1)
        print('PASS: concurrent edits produce a visible conflict; retry preserves peers’ changes without duplicates')

        # The database commits, but the browser loses the response. Recover by
        # checking the stable form ID instead of submitting a second expense.
        lose_next_save=True
        owner.get_by_role('button',name='Añadir gasto',exact=True).click()
        owner.get_by_label('¿Qué habéis pagado?').fill('Gasto con respuesta perdida')
        owner.get_by_label('Importe (€)').fill('4')
        owner.get_by_role('button',name='Guardar gasto').click()
        expect(owner.get_by_role('dialog')).to_have_count(0)
        expect(owner.get_by_text('Gasto con respuesta perdida',exact=True)).to_have_count(1)
        owner.get_by_role('tab',name='Gastos',exact=True).click()
        expect(owner.get_by_text('Gasto con respuesta perdida',exact=True)).to_have_count(1)
        owner.get_by_role('tab',name='Resumen',exact=True).click()
        print('PASS: a lost response after commit is recovered without duplicating the expense')

        friend.reload()
        expect(friend.get_by_role('heading',name='Viaje entre móviles',exact=True)).to_be_visible()
        friend.set_viewport_size({'width':390,'height':844})
        assert friend.evaluate('document.documentElement.scrollWidth <= innerWidth')
        friend.screenshot(path='/tmp/nexo-shared-mobile.png',full_page=True)
        print('PASS: account restoration, membership and shared layout work on mobile')

        owner.get_by_role('button',name='Invitar',exact=True).click()
        owner.get_by_role('button',name='Desactivar los enlaces actuales').click()
        friend.goto(link)
        friend.get_by_role('button',name='Aceptar invitación').click()
        expect(friend.locator('#toast')).to_contain_text('caducado')
        print('PASS: revoked invitation cannot be reused')

        owner.get_by_role('button',name='Tu perfil y datos').click()
        owner.get_by_role('button',name='Cerrar sesión',exact=True).click()
        expect(owner.get_by_role('heading',name='Escapada a Lisboa',exact=True)).to_be_visible()
        assert owner.get_by_text('Viaje entre móviles',exact=True).count()==0
        print('PASS: signing out removes private groups and restores the separate demo')
        assert errors==[],errors
        print('PASS: no JavaScript errors in either browser')
        browser.close()
finally:
    for gid in created:
        sql('delete from public.nexo_groups where id='+quote(gid)+';',admin=True)
