"""Opening letters remain inside the viewport at every sampled animation frame."""
from pathlib import Path
exec(Path('tests/auth_browser.py').read_text().split('with sync_playwright() as p:')[0])
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [320,375,393,440,768,1440]:
  c,seen=context(browser);page=c.new_page();page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':width,'height':852});page.goto(BASE)
  page.wait_for_function("()=>document.querySelector('.brand-intro-host .word-left')?.getAnimations().length>0")
  assert page.locator('.brand-intro-host .word-left').evaluate('(el)=>el.getAnimations()[0].effect.getTiming().duration')==1350
  samples=page.evaluate('''()=>{
   const host=document.querySelector('.brand-intro-host'),parts=[host.querySelector('.word-left'),host.querySelector('.word-right')];
   const animations=parts.map(el=>el.getAnimations()[0]);
   animations.forEach(a=>a.pause());
   return [0,16,50,100,250,500,1000,1350].map(time=>{
    animations.forEach(a=>a.currentTime=time);
    return {time,rects:parts.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};})};
   });
  }''')
  for sample in samples:
   assert all(r['left']>=11 and r['right']<=width-11 for r in sample['rects']),(width,sample)
  if width==1440:assert abs(samples[-1]['rects'][0]['left']-samples[0]['rects'][0]['left']-95)<.1
  assert page.locator('.brand-intro-host .word-z').evaluate('(el)=>getComputedStyle(el).animationName')=='z-rise'
  page.keyboard.press('Escape');expect(page.locator('.brand-intro-host')).to_have_count(0);expect(page.locator('#account-form')).to_be_visible()
  c.close();print('PASS',width,'px: no clipped opening letters; original Z animation and exit remain usable.',flush=True)
 assert not errors,errors
 browser.close()
