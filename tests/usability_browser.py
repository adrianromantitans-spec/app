"""Responsive expense/planning/payment flows using isolated Auth/database fixtures.
Run with the local server on port 3003. No production account is used.
"""
from pathlib import Path
fixture_source=Path('tests/planning_browser.py').read_text().split('with sync_playwright() as p:')[0]
# Keep background refreshes out of the deterministic interaction/layout checks.
fixture_source=fixture_source.replace(" token={'access_token'", " c.add_init_script('window.setInterval=()=>0;')\n token={'access_token'")
exec(fixture_source)


def navigate(page, section):
    if page.locator('.nav-add').is_visible():
        page.locator('.nav-add').click()
        page.locator('.quick-add-modal [data-action="workspace-menu"]').click()
        page.locator('.navigation-drawer [data-route="'+section+'"]').click()
    else:
        page.locator('.workspace-sidebar [data-route="'+section+'"]').click()
    page.wait_for_timeout(150)


def close_modal(page):
    page.locator('#modal-root [data-action="close-modal"]').last.click()


def contained(inner, outer, margin=0):
    rect='(e)=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}'
    a, b = inner.evaluate(rect), outer.evaluate(rect)
    assert a and b and a['width']>0 and a['height']>0, (a,b)
    assert a['x']>=b['x']+margin-1 and a['x']+a['width']<=b['x']+b['width']-margin+1,(a,b)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for locale in ['es-ES','en-GB','ro-RO']:
        group['document']['currency']='EUR'
        group['document']['tasks']=[{'id':str(uuid.uuid4()),'title':'Preparar la maleta '+str(i),'assignee':OWNER,'done':False,'createdBy':OWNER} for i in range(35)]
        group['document']['polls']=[{'id':str(uuid.uuid4()),'title':'Plan de fin de semana','description':'Elegir entre todos','createdBy':OWNER,'votes':{},'options':[{'id':'one','label':'Una excursión larga con parada para comer y visitar el centro de la ciudad','emoji':'🏠'},{'id':'two','label':'Playa','emoji':'🌴'}]}]
        c,page=context(browser,OWNER,locale)
        for width in [320,393,430,768,1440]:
            page.set_viewport_size({'width':width,'height':1000 if width>760 else 852})
            page.locator('.mobile-quick-add .nav-add').click()
            page.locator('.quick-add-modal [data-action="new-expense"]').click()
            picker=page.locator('[name="splitMode"]')
            expect(picker).to_be_visible();contained(picker,page.locator('#expense-form'))
            picker.select_option('percent')
            expect(picker).to_have_value('percent')
            expect(page.locator('.split-fields')).to_be_visible()
            contained(picker,page.locator('#expense-form'));close_modal(page)
        page.set_viewport_size({'width':393,'height':852})
        navigate(page,'groups');page.locator('[data-action="new-group"]').first.click()
        note=page.locator('[data-trip-span]')
        for width in [320,393,430,768,1440]:
            page.set_viewport_size({'width':width,'height':852})
            form=page.locator('#group-form');dates=form.locator('.group-date-fields input')
            contained(dates.nth(0),form);contained(dates.nth(1),form)
            a,b=dates.nth(0).bounding_box(),dates.nth(1).bounding_box()
            assert abs(a['width']-b['width'])<1 and abs(a['height']-b['height'])<1,(a,b)
            if width>360:assert b['x']-(a['x']+a['width'])>=10,(a,b)
            assert note.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')<=10
        page.set_viewport_size({'width':393,'height':852})
        assert note.inner_text() in ['Las fechas son opcionales. Puedes añadirlas más adelante.','Dates are optional. You can add them later.','Datele sunt opționale. Le poți adăuga mai târziu.']
        page.locator('#group-form [name="date"]').fill('2027-06-12');page.locator('#group-form [name="endDate"]').fill('2027-06-15')
        expect(note).to_contain_text('4');expect(note).to_contain_text('3')
        page.locator('#group-form [name="date"]').fill('');page.locator('#group-form [name="endDate"]').fill('')
        assert 'op' in note.inner_text().lower();close_modal(page)
        navigate(page,'tasks')
        expect(page.locator('#main .planning-task')).to_have_count(30)
        assert page.locator('#modal-root .planning-list-dialog').count()==0
        page.locator('[data-action="more-planning"]').click();expect(page.locator('#main .planning-task')).to_have_count(35)
        first=page.locator('#main .planning-task').first;first.locator('[data-task]').check()
        expect(page.locator('#main .planning-task').first.locator('[data-task]')).to_be_checked()
        page.locator('#main .task-detail-button').first.click();page.locator('[data-show-planning="tasks"]').click()
        expect(page.locator('#main .planning-task')).to_have_count(30);expect(page.locator('#modal-root')).to_be_empty()
        first=page.locator('#main .planning-task').first
        expect(first.locator('.avatar')).to_be_visible()
        contained(first.locator('.avatar'),first,6)
        page.screenshot(path='work/usability-tasks-'+locale+'.png')
        page.locator('#main [data-action="new-task"]').first.click()
        page.locator('#task-form [name="title"]').fill('Revisar las reservas')
        page.locator('#task-form [type="submit"]').click()
        expect(page.locator('#modal-root')).to_be_empty()
        expect(page.locator('#main .task-detail-button').first).to_have_text('Revisar las reservas')
        page.locator('#main .task-detail-button').first.click();page.locator('[data-plan-edit]').click()
        page.locator('#task-form [name="title"]').fill('Confirmar las reservas');page.locator('#task-form [type="submit"]').click()
        expect(page.locator('#main .task-detail-button').first).to_have_text('Confirmar las reservas')
        navigate(page,'polls')
        expect(page.locator('#main .poll-card')).to_have_count(1)
        for width in [320,393,768,1440]:
            page.set_viewport_size({'width':width,'height':852})
            option=page.locator('#main .poll-option').first
            contained(option.locator('.option-count'),option,12)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path='work/usability-polls-'+locale+'.png')
        page.locator('#main .poll-option').first.click()
        expect(page.locator('#main .poll-option').first).to_have_attribute('aria-pressed','true')
        expect(page.locator('#main .option-count').first).to_contain_text('1')
        page.locator('[data-plan-delete]').click();page.locator('[data-show-planning="polls"]').click()
        expect(page.locator('#main .poll-card')).to_have_count(1)
        page.locator('[data-plan-delete]').click();page.locator('[data-confirm-plan-delete]').click()
        expect(page.locator('#main .poll-card')).to_have_count(0)
        expect(page.locator('#modal-root')).to_be_empty()
        page.locator('#main [data-action="new-poll"]').first.click()
        page.locator('#poll-form [name="title"]').fill('¿Dónde cenamos?')
        page.locator('#poll-form [name="option"]').nth(0).fill('En casa');page.locator('#poll-form [name="option"]').nth(1).fill('Fuera')
        page.locator('#poll-form [type="submit"]').click()
        expect(page.locator('#modal-root')).to_be_empty();expect(page.locator('#main .poll-card')).to_have_count(1)
        # Normal secondary text must remain readable on the light app surface.
        rgb=page.locator('#main .section-heading p').evaluate('(e)=>getComputedStyle(e).color')
        values=[int(n)/255 for n in re.findall(r'\d+',rgb)[:3]]
        linear=[n/12.92 if n<=0.04045 else ((n+0.055)/1.055)**2.4 for n in values]
        lum=sum(n*w for n,w in zip(linear,[0.2126,0.7152,0.0722]))
        assert 1.05/(lum+0.05)>=4.5,rgb
        page.set_viewport_size({'width':393,'height':852});navigate(page,'home')
        # Ordinary settlement entry stays in the original currency until conversion is requested.
        page.locator('[data-action="settlements"]').first.evaluate('(e)=>e.removeAttribute("data-prefer-euros")')
        page.locator('[data-action="settlements"]').first.click()
        expect(page.locator('.fx-disclosure')).not_to_have_attribute('open')
        expect(page.locator('.settlement-row')).to_have_count(1)
        assert page.locator('.settlement-list').bounding_box()['y']<page.locator('.fx-disclosure').bounding_box()['y']
        page.locator('.fx-disclosure summary').click();expect(page.locator('[data-fx-target]')).to_be_visible()
        page.locator('[data-action="toggle-simplify"]').click();expect(page.locator('.fx-disclosure')).to_have_attribute('open','')
        page.screenshot(path='work/usability-settlements-'+locale+'.png',full_page=True)
        close_modal(page);c.close()
        print('PASS:',locale,'split controls at five widths; optional dates; inline planning, pagination, task update, voting and delete/cancel; payment-first layout and expandable currency controls')
    assert not errors,errors
    browser.close()
