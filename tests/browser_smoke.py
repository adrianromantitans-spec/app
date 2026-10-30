"""Optional end-to-end check: requires Python Playwright and Chromium.
Start Nexo first with npm start, then: python3 tests/browser_smoke.py
"""
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('NEXO_URL', 'http://127.0.0.1:3000'))
    expect(page.get_by_role('heading', name='Bienvenido a Nexo.')).to_be_visible()
    page.get_by_role('button', name='Explorar una demo').click()
    expect(page.get_by_role('heading', name='Escapada a Lisboa', exact=True)).to_be_visible()
    print('PASS: dashboard and seeded group')

    page.get_by_role('button', name='Añadir gasto', exact=True).first.click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('¿Qué habéis pagado?').fill('Cena de prueba')
    dialog.get_by_label('Importe (€)').fill('10.01')
    dialog.get_by_role('button', name='Guardar gasto').click()
    expect(page.get_by_text('Cena de prueba', exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_role('heading', name='Bienvenido a Nexo.')).to_be_visible()
    page.get_by_role('button', name='Explorar una demo').click()
    expect(page.get_by_text('Cena de prueba', exact=True)).to_be_visible()
    print('PASS: add expense and persistence after reload')

    page.get_by_role('button', name='Añadir gasto', exact=True).first.click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('¿Qué habéis pagado?').fill('No válido')
    dialog.get_by_label('Importe (€)').fill('5')
    for checkbox in dialog.locator('input[name=participants]').all():
        checkbox.uncheck()
    dialog.get_by_role('button', name='Guardar gasto').click()
    expect(dialog.get_by_role('alert')).not_to_be_empty()
    page.keyboard.press('Escape')
    print('PASS: empty participant validation and Escape')

    page.get_by_role('button', name='Excursión a Sintra').click()
    expect(page.get_by_role('button', name='Excursión a Sintra')).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='Playa en Cascais').click()
    expect(page.get_by_role('button', name='Excursión a Sintra')).to_have_attribute('aria-pressed', 'false')
    expect(page.get_by_role('button', name='Playa en Cascais')).to_have_attribute('aria-pressed', 'true')
    print('PASS: vote and change vote')

    task = page.get_by_role('checkbox', name='Buscar sitios para cenar')
    task.check()
    expect(page.get_by_role('checkbox', name='Buscar sitios para cenar')).to_be_checked()
    page.get_by_role('button', name='Añadir tarea', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('¿Qué queda pendiente?').fill('Reservar museo')
    dialog.get_by_role('button', name='Añadir tarea').click()
    page.get_by_role('tab', name='Tareas').click()
    expect(page.get_by_role('checkbox', name='Reservar museo')).to_be_visible()
    print('PASS: complete and create tasks')

    page.get_by_role('tab', name='Planes y votaciones').click()
    page.get_by_role('button', name='Nueva votación').click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('La gran pregunta').fill('¿Dónde comemos?')
    dialog.get_by_label('Opción 1', exact=True).fill('Mercado')
    dialog.get_by_label('Opción 2', exact=True).fill('Terraza')
    dialog.get_by_role('button', name='Crear votación').click()
    expect(page.get_by_role('heading', name='¿Dónde comemos?')).to_be_visible()
    print('PASS: create poll')

    page.get_by_role('tab', name='Resumen', exact=True).click()
    page.get_by_role('button', name='Ajustar presupuesto').click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('Presupuesto total del grupo (€)').fill('2000')
    dialog.get_by_role('button', name='Actualizar presupuesto').click()
    expect(page.get_by_text('de 2000,00', exact=False)).to_be_visible()
    page.get_by_role('button', name='Vamos a dejarlo a cero').click()
    page.get_by_role('button', name='Registrar pago', exact=True).first.click()
    page.get_by_role('button', name='Sí, registrar pago').click()
    page.locator('.sidebar [data-page=activity]').click()
    expect(page.locator('.payment-row')).to_have_count(1)
    print('PASS: edit budget and register a confirmed repayment')

    page.locator('.sidebar button[data-page=home]').click()
    page.get_by_role('button', name='Crear grupo', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_label('Nombre del grupo').fill('Plan de prueba')
    dialog.get_by_label('¿Quién se apunta?').fill('Ana, Luis')
    dialog.get_by_label('Presupuesto total del grupo (€)').fill('300')
    dialog.get_by_role('button', name='Crear grupo', exact=True).click()
    expect(page.get_by_role('heading', name='Plan de prueba', exact=True)).to_be_visible()
    expect(page.get_by_text('3 personas, un gran plan')).to_be_visible()
    page.reload()
    page.get_by_role('button', name='Explorar una demo').click()
    expect(page.get_by_role('heading', name='Plan de prueba', exact=True)).to_be_visible()
    print('PASS: create group with members and restore active group')

    for width in [360, 390, 768, 1024, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Overflow at {width}px'
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('.mobile-nav [data-page=groups]').click()
    expect(page.get_by_role('heading', name='La gente con la que compartes.')).to_be_visible()
    page.get_by_role('button', name='Escapada a Lisboa').click()
    expect(page.get_by_role('heading', name='Escapada a Lisboa', exact=True)).to_be_visible()
    page.get_by_role('button', name='Añadir gasto', exact=True).first.click()
    expect(page.get_by_role('dialog')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.keyboard.press('Escape')
    print('PASS: responsive widths, mobile navigation, group switching and mobile dialog')

    assert errors == [], errors
    print('PASS: no browser JavaScript errors')
    browser.close()
