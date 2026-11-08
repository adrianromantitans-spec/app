"""Audit real UI translations with local fictional fixtures; no production requests or writes.
NEXO_URL=http://127.0.0.1:3003/app/ python3 tests/translation_audit_browser.py
"""
from pathlib import Path
import importlib.util,json,os,subprocess,re
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3003/app/')
OUT=Path(os.environ.get('TRANSLATION_AUDIT_OUT','work/translation-audit'));OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {translations} from './translations.js';console.log(JSON.stringify(translations))"]))
resource_urls=set()
source=Path('i18n.js').read_text().replace('  // Icons and dynamic values remain opaque.', "  if(globalThis.document)console.debug('__DZ_MISSING__'+JSON.stringify({key,language}));\n  // Icons and dynamic values remain opaque.")
missing={};report=[];errors=[]
def instrument(context,lang):
 context.route('**/i18n.js?*',lambda r:r.fulfill(content_type='text/javascript',body=source))
 def onpage(page):
  page.on('pageerror',lambda e:errors.append(str(e)))
  def console(msg):
   if msg.text.startswith('__DZ_MISSING__'):
    d=json.loads(msg.text[len('__DZ_MISSING__'):]);missing.setdefault(d['key'],set()).add(d['language'])
  page.on('console',console)
 context.on('page',onpage)
 context.on('request',lambda r:resource_urls.add(r.url) if re.search(r'/(?:i18n|translations)\.js',r.url) else None)
def screen(page,lang,name):
 # Wait for asynchronous dialogs before inspecting their real rendered copy.
 if name in {'group-picker','quick-add','notifications','notification-preferences','new-group','new-expense','new-task','new-poll','expense-options','settlements','currency','expense-details','shopping-add','shopping-checkout','budget-editor','show-pending-payments','show-history','show-recorded-payments','language-settings','delete-account'} or name.startswith('split-'):
  expect(page.locator('#modal-root .modal')).to_be_visible()
 # Read-only walk of actual visible labels; fixture content remains opaque.
 text=page.locator('body').inner_text();report.append({'language':lang,'screen':name,'text':text})
 if lang!='es':
  for line in text.splitlines():
   key=' '.join(line.split())
   if len(key)>=3 and key in catalog and key not in ['Español','English','Română']:
    assert catalog[key][lang]==key,('Spanish UI label',lang,name,key)
  if page.locator('.reference-members').count():
   expect(page.locator('.reference-members>span:last-child')).to_have_text({'en':'You · Nora','ro':'Tu · Nora'}[lang])
 attrs=page.locator('[aria-label],[placeholder],[title],[alt]').evaluate_all('(items)=>items.flatMap(e=>["aria-label","placeholder","title","alt"].map(k=>e.getAttribute(k)).filter(Boolean))')
 if lang!='es':
  for key in attrs:
   if key in catalog:assert catalog[key][lang]==key,('Spanish accessible label',lang,name,key)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(lang,name)
 print('SCREEN',lang,name,flush=True)
def close(page):page.keyboard.press('Escape');expect(page.locator('#modal-root')).to_be_empty()
def route(page,name):
 if name=='help':route(page,'profile');page.locator('.account-page [data-route=help]').click();return
 if page.locator('.reference-dock [data-route='+name+']').count():page.locator('.reference-dock [data-route='+name+']').click();return
 if page.locator('.back-to-home:visible').count():page.locator('.back-to-home').click()
 page.mouse.move(4,300);page.mouse.down();page.mouse.move(150,300,steps=10);page.mouse.up();expect(page.locator('.navigation-drawer')).to_be_visible();page.locator('.navigation-drawer #modal-title').click();page.locator('.navigation-drawer [data-route='+name+']').click();expect(page.locator('#modal-root')).to_be_empty()
def add(page,action):page.locator('.nav-add').click();page.locator('.quick-add-modal [data-action='+action+']').click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for lang in ['es','en','ro']:
  c,rows=shots.context(b,lang);instrument(c,lang);page=c.new_page();page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible()
  expect(page.locator('.reference-dock [data-route=groups]')).to_have_text({'es':'Planes','en':'Plans','ro':'Planuri'}[lang]);screen(page,lang,'home')
  page.locator('.home-group-picker').click();screen(page,lang,'group-picker');close(page)
  page.locator('.nav-add').click();screen(page,lang,'quick-add');close(page)
  page.locator('.notification-bell').click();screen(page,lang,'notifications')
  page.locator('[data-notification-action=preferences]').click();screen(page,lang,'notification-preferences');close(page)
  for action in ['new-group','new-expense','new-task','new-poll']:
   add(page,action);screen(page,lang,action)
   if action=='new-expense':
    page.locator('.expense-more-options>summary').click();screen(page,lang,'expense-options')
    for value in ['amounts','percent','shares']:
     page.locator('#expense-form [name=splitMode]').select_option(value);screen(page,lang,'split-'+value)
   close(page)
  page.locator('[data-action=settlements]').click();screen(page,lang,'settlements')
  if page.locator('.fx-disclosure>summary').count():page.locator('.fx-disclosure>summary').click();page.locator('[data-fx-target]').select_option('USD');screen(page,lang,'currency')
  close(page)
  for name in ['expenses','shopping','polls','tasks','budget','groups','activity','profile','help']:
   route(page,name);screen(page,lang,name)
   if name=='expenses':page.locator('.expense-row').first.click();screen(page,lang,'expense-details');close(page)
   if name=='shopping':
    page.locator('[data-shopping-action=add]').click();screen(page,lang,'shopping-add');close(page)
    page.locator('[data-shopping-action=checkout]').click();screen(page,lang,'shopping-checkout');close(page)
   if name=='budget':page.locator('[data-action=edit-budget]').click();screen(page,lang,'budget-editor');close(page)
   if name=='activity':
    for action in ['show-pending-payments','show-history','show-recorded-payments']:
     page.locator('[data-action='+action+']').click();screen(page,lang,action);close(page)
   if name=='profile':
    for action in ['language-settings','delete-account']:
     page.locator('[data-action='+action+']').click();screen(page,lang,action);close(page)
  c.close();print('AUDITED',lang,flush=True)
 # Guest welcome, login, registration and recovery controls in each language.
 auth={};exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0],auth)
 for lang in ['es','en','ro']:
  class LocaleBrowser:
   def new_context(self,**kwargs):kwargs['locale']={'es':'es-ES','en':'en-GB','ro':'ro-RO'}[lang];return b.new_context(**kwargs)
  c,_=auth['context'](LocaleBrowser());instrument(c,lang);page=c.new_page();page.goto(BASE);expect(page.locator('.welcome-entry')).to_be_visible();screen(page,lang,'welcome')
  page.locator('.welcome-entry [data-action=login]').click();screen(page,lang,'login')
  page.locator('[data-action=recover]').click();screen(page,lang,'recovery')
  page.goto(BASE+'#registro');expect(page.locator('input[name=email]')).to_be_visible();screen(page,lang,'register');c.close()
 # All modules share one fresh language singleton and one fresh catalog.
 assert resource_urls, 'No translation modules recorded'
 assert all(url.endswith('?v=language-90') for url in resource_urls),resource_urls
 assert len(resource_urls)==2,resource_urls
 assert not errors,errors
 b.close()
(OUT/'screens.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(OUT/'fallback-keys.json').write_text(json.dumps({k:sorted(v) for k,v in sorted(missing.items())},ensure_ascii=False,indent=2))
print('PASS',len(report),'real app surfaces: Spanish/English/Romanian labels and accessible text, self label, Plans/Planuri and one fresh shared translation graph')
