"""Compare actual card pixels immediately before/after intro host cleanup."""
import importlib.util,io,os
from pathlib import Path
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright,expect

spec=importlib.util.spec_from_file_location('shots','scripts/capture-landing.py');shots=importlib.util.module_from_spec(spec);spec.loader.exec_module(shots)
BASE=os.environ.get('NEXO_URL','http://127.0.0.1:3076/app/')
OUT=Path(os.environ.get('INTRO_HANDOFF_OUT','work/intro-card'));OUT.mkdir(parents=True,exist_ok=True)
# Hold cleanup after the original fade finishes, without altering any keyframes/timing.
gate="""window.setInterval=()=>0;
window.__introGate=new Promise(resolve=>window.__releaseIntro=resolve);
const nativeAnimate=Element.prototype.animate;
Element.prototype.animate=function(...args){
 const animation=nativeAnimate.apply(this,args);
 if(this.classList.contains('brand-intro-curtain')){
  const finished=animation.finished;
  Object.defineProperty(animation,'finished',{get:()=>finished.then(()=>window.__introGate)});
  window.__introFade=animation;
 }
 return animation;
};"""
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [393,440,1440]:
  for original_glow in [True,False]:
   context,_=shots.context(browser,'en',viewport={'width':width,'height':956});context.add_init_script(gate)
   page=context.new_page();page.emulate_media(reduced_motion='no-preference');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE);expect(page.locator('.home-balance')).to_be_visible()
   if original_glow:page.add_style_tag(content='.brand-intro-host.modern-auth:before{display:block}')
   page.wait_for_function("()=>window.__introFade?.playState==='finished'")
   assert page.evaluate('window.__introFade.effect.getTiming().duration')==1161
   before=page.locator('.home-balance').screenshot()
   page.evaluate('window.__releaseIntro()');expect(page.locator('.brand-intro-host')).to_have_count(0)
   after=page.locator('.home-balance').screenshot()
   a=Image.open(io.BytesIO(before)).convert('RGB');b=Image.open(io.BytesIO(after)).convert('RGB');difference=ImageChops.difference(a,b)
   changed=sum(pixel!=(0,0,0) for pixel in difference.getdata())
   label='old-glow' if original_glow else 'fixed'
   (OUT/f'{width}-{label}-before.png').write_bytes(before);(OUT/f'{width}-{label}-after.png').write_bytes(after)
   if original_glow and width<=760:assert changed>100,'The original abrupt glow removal was not reproduced'
   else:assert changed==0,f'Card still changes at cleanup: {changed} pixels'
   assert not errors,errors
   print('PASS',width,label,changed,'card pixels change at cleanup; original 1161 ms fade preserved',flush=True)
   context.close()
 browser.close()
