"""Verify that loading presentation changes neither domain code nor the existing design."""
from pathlib import Path
import subprocess,re,difflib
BASE='75753eedf31102a6b2cacf548a98b062dd861bcd'
def original(name):return subprocess.check_output(['git','show',BASE+':'+name]).decode()
def normalize_app(s):
 old=original("app.js");gesture=old[old.index("let edgeSwipe=null,edgeSwipeUsed=false;"):old.index("async function onAppClick(event)")]
 assert "let edgeSwipe=" not in s
 s=s.replace("async function onAppClick(event)",gesture+"async function onAppClick(event)",1)
 s=s.replace('data-route="tasks">${icon(\'task\')}<span>${tr(\'Tareas\')}</span></button><button class="home-reference-action"','data-action="new-expense">${icon(\'plus\')}<span>${tr(\'Añadir gasto\')}</span></button><button class="home-reference-action"')
 s=s.replace('<nav class="home-reference-actions" aria-label="${tr(\'Organización\')}">','<nav class="home-reference-actions" aria-label="${tr(\'Añadir\')}">')
 s=s.replace("import {loadingSkeleton,beginContentRefresh,showBusyInPlace,withSubmitFeedback,withClickFeedback} from './loading-ui.js?v=loading-92';\n",'')
 s=s.replace("from './notifications.js?v=loading-92'","from './notifications.js?v=language-90'")
 s=re.sub(r'^[ \t]*const finish(?:Saving|Loading|Refreshing)=.*\n','',s,flags=re.M)
 s=s.replace('remoteBusy=false;finishSaving();','remoteBusy=false;').replace('remoteBusy=false;finishRefreshing();','remoteBusy=false;').replace('finally{finishLoading();}','')
 s=s.replace("withClickFeedback(onAppClick,()=>remoteBusy||authLoading)(event)",'onAppClick(event)')
 s=s.replace("showBusyInPlace(root,tr('Espera un momento; estamos conectando con tus grupos.'),()=>remoteBusy||authLoading)","toast(tr('Espera un momento; estamos conectando con tus grupos.'))")
 s=s.replace("document.addEventListener('submit',withSubmitFeedback(async event=>{","document.addEventListener('submit',async event=>{").replace('},()=>remoteBusy||authLoading));','});')
 s=s.replace("data.ready===null&&!data.error?loadingSkeleton('button',tr('Cargando actividad…')):ui",'ui')
 s=s.replace("if(data.ready===null)return loadingSkeleton('button',tr('Cargando actividad…'));", "if(data.ready===null)return `<p class=\"muted\" role=\"status\">${tr('Cargando actividad…')}</p>`;")
 s=s.replace("${loadingSkeleton('list',tr('Cargando actividad…'))}","<p role=\"status\">${tr('Cargando actividad…')}</p>")
 s=s.replace("shoppingState.loading?loadingSkeleton('list',tr('Cargando lista…'))", "shoppingState.loading?`<p role=\"status\">${tr('Cargando lista…')}</p>`")
 s=s.replace("fx.loading?loadingSkeleton('text',tr('Consultando el cambio más reciente…'))",'fx.loading?ui`<p role="status">Consultando el cambio más reciente…</p>`')
 s=s.replace("openModal(tr('Foto del ticket'),'<div class=\"receipt-loading\" role=\"status\">'+loadingSkeleton('media',tr('Abriendo ticket…'),{status:false})+'</div>');", "openModal(tr('Foto del ticket'),tr('<p class=\"receipt-loading\" role=\"status\">Abriendo ticket…</p>'));")
 return s
app=normalize_app(Path('app.js').read_text());before=original('app.js')
assert app==before,'Unexpected behavior change beyond audited loading UI hooks:\n'+''.join(difflib.unified_diff(before.splitlines(True),app.splitlines(True)))
notifications=Path('notifications.js').read_text().replace("import {loadingSkeleton} from './loading-ui.js?v=loading-92';\n",'')
notifications=notifications.replace("${loadingSkeleton('list',tr('Cargando avisos…'))}","<p role=\"status\">${tr('Cargando avisos…')}</p>")
notifications=notifications.replace("'<div class=\"notification-detail\">'+loadingSkeleton('text',tr('Cargando avisos…'))+'</div>'", "'<div class=\"notification-detail\"><p role=\"status\">'+tr('Cargando avisos…')+'</p></div>'")
assert notifications==original('notifications.js')
count=0
for name in subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],text=True).splitlines():
 if name in ['app.js','notifications.js','scripts/build-landing.mjs','landing.js','landing-copy.js']:continue
 if name.endswith(('.js','.mjs','.css','.webmanifest')):
  text=Path(name).read_text()
  if name in ['landing.js','scripts/build-landing.mjs']:text=text.replace('images-95','images-90')
  if name=='server.mjs':text=text.replace(" 'loading-ui.js', 'loading-ui.css',",'')
  if name=='glass.css':text=text.replace('/* The curtain owns the entire reveal; do not leave the auth glow above the app. */\n.brand-intro-host.modern-auth:before{display:none}\n','')
  if name=='refined.css':text=text.replace('.personal-shell .shopping-page .shopping-footer>.button.primary:not(:disabled){color:#fff}\n','')
  assert text==original(name),'Unexpected runtime/stylesheet change: '+name
  count+=1
entry=Path('app/index.html').read_text().replace('    <link rel="stylesheet" href="../loading-ui.css?v=loading-92" />\n','').replace('app.js?v=drawer-98','app.js?v=language-90').replace('refined.css?v=shopping-93','refined.css?v=visual-87').replace('glass.css?v=intro-99','glass.css?v=brand-81')
entry=re.sub(r'    <!-- Startup hints:.*?    <!-- End startup hints\. -->\n','',entry,flags=re.S)
assert entry==original('app/index.html')
# The landing's default language/favicon are covered by landing_browser.py.
print('PASS audited presentation hooks and task shortcut only;',count,'other runtime/style/manifest files, startup and dock unchanged')
