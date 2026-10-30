"""Two browser accounts, real SQL permissions, local Auth and Storage transports."""
from pathlib import Path
import uuid
exec(Path('tests/shared_browser.py').read_text().split('try:\n    with sync_playwright()')[0])
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  co=context(b);cf=context(b);owner=co.new_page();friend=cf.new_page()
  owner.goto(BASE+'#acceso');login(owner,'ana@example.test')
  owner.get_by_role('button',name='Crear mi primer grupo').click()
  form=owner.locator('#group-form');form.get_by_label('Nombre del grupo',exact=True).fill('Edición compartida')
  form.get_by_label('Presupuesto total del grupo',exact=False).fill('1000');form.get_by_role('button',name='Crear grupo',exact=True).click()
  owner.get_by_role('button',name='Invitar',exact=True).click();owner.get_by_role('button',name='Generar enlace de invitación').click()
  link=owner.get_by_label('Enlace de invitación').input_value();owner.keyboard.press('Escape')
  friend.goto(link);login(friend,'luis@example.test');friend.get_by_role('button',name='Aceptar invitación').click()
  owner.get_by_role('button',name='Actualizar',exact=True).click()
  owner.get_by_role('button',name='Añadir gasto',exact=True).first.click()
  f=owner.locator('#expense-form');f.get_by_label('¿Qué habéis pagado?',exact=True).fill('Cena compartida');f.get_by_label('Importe (€)',exact=True).fill('10.01');f.get_by_role('button',name='Guardar gasto').click()
  friend.get_by_role('button',name='Actualizar',exact=True).click();friend.get_by_role('button',name='Ver detalle de Cena compartida').click()
  assert friend.get_by_role('button',name='Editar gasto',exact=True).count()==0
  friend.keyboard.press('Escape')
  owner.get_by_role('button',name='Ver detalle de Cena compartida').click();owner.get_by_role('button',name='Editar gasto',exact=True).click()
  f=owner.locator('#expense-form');f.get_by_label('Tipo de reparto',exact=False).select_option('percent')
  for field,value in zip(f.locator('[data-split-member]').all(),['25','75']):field.fill(value)
  f.get_by_role('button',name='Guardar cambios').click()
  friend.get_by_role('button',name='Actualizar',exact=True).click();friend.get_by_role('button',name='Ver detalle de Cena compartida').click()
  assert [r.inner_text().splitlines()[-1] for r in friend.locator('.share-row').all()]==['2,50\xa0€','7,51\xa0€']
  friend.keyboard.press('Escape')
  owner.get_by_role('button',name='Ver detalle de Cena compartida').click();owner.get_by_role('button',name='Editar gasto',exact=True).click()
  f=owner.locator('#expense-form');f.get_by_label('Importe (€)',exact=True).fill('20')
  friend.get_by_role('button',name='Añadir gasto',exact=True).first.click()
  ff=friend.locator('#expense-form');ff.get_by_label('¿Qué habéis pagado?',exact=True).fill('Taxi');ff.get_by_label('Importe (€)',exact=True).fill('1');ff.get_by_role('button',name='Guardar gasto').click()
  f.get_by_role('button',name='Guardar cambios').click();expect(f.get_by_role('alert')).to_contain_text('Alguien ha actualizado')
  expect(owner.locator('#expense-form')).to_be_visible()
  f.get_by_role('button',name='Guardar cambios').click();expect(owner.locator('#expense-form')).to_have_count(0)
  # A committed edit with a lost response is confirmed by content, never just by ID.
  owner.get_by_role('button',name='Ver detalle de Cena compartida').click();owner.get_by_role('button',name='Editar gasto',exact=True).click()
  f=owner.locator('#expense-form');f.get_by_label('Importe (€)',exact=True).fill('30');lose_next_save=True
  f.get_by_role('button',name='Guardar cambios').click();expect(owner.locator('#expense-form')).to_have_count(0)
  gid=created[0]
  doc=json.loads(sql('select document from public.nexo_groups where id='+quote(gid)+';',OWNER).stdout)
  assert len(doc['expenses'])==2
  dinner=next(e for e in doc['expenses'] if e['title']=='Cena compartida');assert dinner['amount']==3000 and dinner['split']['values']=={OWNER:2500,FRIEND:7500}
  print('PASS: shared custom shares, owner/author editing and edit conflict/lost-response recovery')
  # Stale confirmation must not delete new activity.
  owner.get_by_role('button',name='Editar detalles del grupo').click();owner.get_by_role('button',name='Eliminar grupo',exact=True).click()
  delete=owner.locator('#delete-group-form');delete.get_by_label('Escribe el nombre del grupo para confirmar').fill('Edición compartida')
  friend.get_by_role('button',name='Actualizar',exact=True).click();friend.get_by_role('button',name='Añadir gasto',exact=True).first.click()
  ff=friend.locator('#expense-form');ff.get_by_label('¿Qué habéis pagado?',exact=True).fill('Nuevo gasto');ff.get_by_label('Importe (€)',exact=True).fill('2');ff.get_by_role('button',name='Guardar gasto').click()
  delete.get_by_role('button',name='Eliminar grupo definitivamente').click();expect(delete.get_by_role('alert')).to_contain_text('El grupo ha cambiado')
  owner.keyboard.press('Escape');owner.get_by_role('button',name='Actualizar',exact=True).click()
  # Include an unreferenced private file; cleanup must remove the entire deleted prefix.
  for actor in [OWNER,FRIEND]:
   path=gid+'/'+actor+'/'+str(uuid.uuid4())+'.jpg'
   result=sql("insert into storage.objects(bucket_id,name) values('divzplit-receipts',"+quote(path)+");",actor);assert result.returncode==0,result.stderr
  owner.get_by_role('button',name='Editar detalles del grupo').click();owner.get_by_role('button',name='Eliminar grupo',exact=True).click()
  delete=owner.locator('#delete-group-form');delete.get_by_label('Escribe el nombre del grupo para confirmar').fill('Edición compartida');delete.get_by_role('button',name='Eliminar grupo definitivamente').click()
  expect(owner.get_by_role('button',name='Crear mi primer grupo')).to_be_visible()
  for _ in range(50):
   result=sql("select cleaned_at is not null from public.nexo_deleted_groups where id="+quote(gid)+';',OWNER)
   if result.stdout.strip()=='t':break
   owner.wait_for_timeout(100)
  assert result.stdout.strip()=='t',result.stderr
  assert sql("select count(*) from storage.objects where starts_with(name,"+quote(gid+'/')+');',admin=True).stdout.strip()=='0'
  friend.reload();expect(friend.get_by_role('button',name='Crear mi primer grupo')).to_be_visible()
  assert friend.get_by_role('heading',name='Edición compartida').count()==0
  b.close();print('PASS: stale deletion blocked, confirmed deletion reaches peers and private file cleanup finishes')
finally:
 for gid in created:sql('delete from public.nexo_groups where id='+quote(gid)+';',admin=True)
