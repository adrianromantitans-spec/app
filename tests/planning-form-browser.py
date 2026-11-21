"""Web planning forms: Safari geometry, translations and save/edit with local fixtures."""
import importlib.util,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3062/app/')
with sync_playwright() as p:
 browser=p.webkit.launch(headless=True)
 for lang in ['es','en','ro']:
  for width in [320,393,440]:
   class Safari:
    def new_context(self,**kwargs):
     kwargs.update(is_mobile=True,has_touch=True,user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
     return browser.new_context(**kwargs)
   context,rows=shots.context(Safari(),lang,{'width':width,'height':740})
   saved=[]
   def save(route):
    body=route.request.post_data_json;row=next(row for row in rows if row['id']==body['p_id']);item=body['p_item'];kind=body['p_kind'];items=row['document'][kind]
    previous=next((old for old in items if old['id']==item['id']),None)
    if previous:previous.update(item)
    else:items.insert(0,dict(item,createdBy=shots.OWNER,done=False))
    row['version']+=1;saved.append(body);route.fulfill(content_type='application/json',body=json.dumps(row))
   context.route('**/rest/v1/rpc/divzplit_plan_action',save)
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible()
   page.locator('.home-reference-action[data-route=tasks]').click()
   page.locator('[data-action=new-task]').first.click();form=page.locator('#task-form')
   expect(page.locator('#modal-title')).to_have_text({'es':'Añadir tarea','en':'Add task','ro':'Adaugă o sarcină'}[lang])
   def check(form):
    expect(form).to_be_visible()
    geometry=form.locator('.planning-date-fields').evaluate("""grid=>{const fields=[...grid.querySelectorAll('input')].map(input=>{const r=input.getBoundingClientRect(),p=input.parentElement.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,labelLeft:p.left,labelRight:p.right,font:parseFloat(getComputedStyle(input).fontSize)}});return {fields,width:document.documentElement.clientWidth,overflow:grid.scrollWidth>grid.clientWidth+1}}""")
    a,b=geometry['fields'];assert not geometry['overflow'],geometry
    for field in [a,b]:assert field['left']>=field['labelLeft']-1 and field['right']<=field['labelRight']+1 and field['right']<=width and field['font']>=16,geometry
    assert b['top']>=a['bottom'],geometry
   check(form)
   form.locator('[name=title]').fill('Planning layout test');form.locator('[name=dueAt]').fill('2030-12-04T18:00');form.locator('[name=remindAt]').fill('2030-12-04T17:00');check(form)
   form.locator('button[type=submit]').click();expect(page.locator('#task-form')).to_have_count(0);assert len(saved)==1
   card=page.locator('.planning-task').filter(has_text='Planning layout test');card.locator('[data-plan-detail]').click();page.locator('[data-plan-edit]').click();form=page.locator('#task-form');check(form);expect(form.locator('[name=dueAt]')).to_have_value('2030-12-04T18:00');expect(form.locator('[name=remindAt]')).to_have_value('2030-12-04T17:00')
   form.locator('[name=title]').fill('Edited layout test');form.locator('button[type=submit]').click();expect(page.locator('#task-form')).to_have_count(0);assert len(saved)==2
   page.locator('.reference-dock [data-route=home]').click();page.locator('.home-reference-action[data-route=polls]').click()
   page.locator('[data-action=new-poll]').first.click();check(page.locator('#poll-form'));expect(page.locator('#modal-title')).to_have_text({'es':'Crear votación','en':'Create poll','ro':'Creează un sondaj'}[lang])
   if lang=='en' and width==393:
    Path('/workspace/scratch/web-planning').mkdir(exist_ok=True);page.locator('[data-action=close-modal]').first.click();page.locator('.reference-dock [data-route=home]').click();page.locator('.home-reference-action[data-route=tasks]').click();page.locator('[data-action=new-task]').first.click();page.screenshot(path='/workspace/scratch/web-planning/task-iphone.png')
   assert not errors,errors
   print('PASS',lang,width,'task/poll layout, localized titles, dates, save and edit',flush=True);context.close()
 browser.close()
