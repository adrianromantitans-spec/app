"""Compare original startup with and without only the isolated dock effects."""
import importlib.util,json
from pathlib import Path
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for signed in [False,True]:
  for width in [393,1440]:
   results=[]
   for styled in [False,True]:
    c,_=shots.context(browser,'es',viewport={'width':width,'height':852}) if signed else context(browser)
    if not styled:
     c.route('**/dock-effects.css?*',lambda r:r.fulfill(content_type='text/css',body=''))
     c.route('**/dock-effects.js?*',lambda r:r.fulfill(content_type='text/javascript',body=''))
    page=c.new_page();page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':width,'height':852});page.goto(BASE)
    page.wait_for_function("()=>document.querySelector('.brand-intro-host')?.classList.contains('brand-intro-active')")
    letters=page.evaluate("()=>[...document.querySelectorAll('.brand-intro-host .word-left,.brand-intro-host .word-z,.brand-intro-host .word-right')].map(e=>({class:e.className,animations:e.getAnimations().map(a=>({timing:a.effect.getTiming(),frames:a.effect.getKeyframes()}))}))")
    page.wait_for_function("()=>document.querySelector('.brand-intro-host .brand')?.getAnimations().some(a=>a.effect.getTiming().duration===1161)")
    flight=page.evaluate("()=>document.querySelector('.brand-intro-host .brand').getAnimations().filter(a=>a.effect.getTiming().duration===1161).map(a=>({timing:a.effect.getTiming(),frames:a.effect.getKeyframes()}))")
    results.append({'letters':letters,'flight':flight});c.close()
   assert results[0]==results[1],(signed,width,results)
   print('PASS unchanged startup keyframes, timing, font sizes and landing coordinates:', 'session' if signed else 'guest',width,flush=True)
 browser.close()
