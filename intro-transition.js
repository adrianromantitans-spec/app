// Keep the original letter animation; land on the real, already-rendered header.
export function startIntroTransition({root,brand,ready,onFinish}) {
 const viewport=window.visualViewport;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const base=getComputedStyle(brand),baseSize=parseFloat(base.fontSize),baseSpacing=parseFloat(base.letterSpacing)||0;
 const host=document.createElement('div');host.className='brand-intro-host modern-auth';
 host.innerHTML='<div class="brand-intro-curtain" aria-hidden="true"></div><header class="auth-header"></header>';
 const curtain=host.firstElementChild;host.lastElementChild.append(brand);document.body.append(host);
 Object.assign(brand.style,{position:'fixed',left:'0px',top:'0px',margin:'0',fontSize:base.fontSize,letterSpacing:base.letterSpacing,visibility:'hidden',transform:'translate(-50%,-50%)'});
 let skipped=false,movement,fade,target,oldVisibility='',closed=false,frame,timer,releaseHold;
 const hold=new Promise(resolve=>{releaseHold=resolve;});
 const visibleCentre=()=>({x:(viewport?.offsetLeft||0)+(viewport?.width||innerWidth)/2,y:(viewport?.offsetTop||0)+(viewport?.height||innerHeight)/2});
 const findTarget=()=>[...root.querySelectorAll('.mobile-logo,.workspace-sidebar .brand,.auth-header .brand')].find(el=>el.getClientRects().length&&el.getBoundingClientRect().width>0);
 const restoreTarget=()=>{if(target){if(oldVisibility)target.style.visibility=oldVisibility;else target.style.removeProperty('visibility');}};
 const selectTarget=()=>{
  const next=findTarget();if(!next)return null;
  if(next!==target){restoreTarget();target=next;oldVisibility=target.style.visibility;target.style.visibility='hidden';}
  const text=target.querySelector('.split-word')||target;
  return {rect:text.getBoundingClientRect(),style:getComputedStyle(text)};
 };
 function cleanup(){
  if(closed)return;closed=true;clearTimeout(timer);cancelAnimationFrame(frame);
  movement?.cancel();fade?.cancel();restoreTarget();host.remove();
  document.removeEventListener('keydown',onKey);window.removeEventListener('resize',onResize);media.removeEventListener('change',onMotion);
  onFinish();
 }
 function skip(){skipped=true;releaseHold();if(movement){movement.finish();fade.finish();}}
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();skip();}};
 const initialWidth=innerWidth;
 const onResize=()=>{if(Math.abs(innerWidth-initialWidth)>40)skip();};
 const onMotion=()=>{if(media.matches)skip();};
 document.addEventListener('keydown',onKey);window.addEventListener('resize',onResize);media.addEventListener('change',onMotion);
 (async()=>{
  try{
   await document.fonts.ready;
   const natural=brand.getBoundingClientRect(),ratio=Math.min((viewport?.width||innerWidth)-64,360)/natural.width;
   const centre=visibleCentre(),large={left:centre.x+'px',top:centre.y+'px',fontSize:baseSize*ratio+'px',letterSpacing:baseSpacing*ratio+'px'};
   Object.assign(brand.style,large,{visibility:'visible'});
   // Keep the original lateral entrance within the visible phone screen.
   // Measure the settled text before its letter animations start.
   const text=brand.querySelector('.split-word').getBoundingClientRect();
   const viewportLeft=viewport?.offsetLeft||0,viewportRight=viewportLeft+(viewport?.width||innerWidth);
   const sideDistance=Math.max(0,Math.min(95,text.left-viewportLeft-12,viewportRight-text.right-12));
   host.style.setProperty('--intro-side-distance',sideDistance+'px');
   host.classList.add('brand-intro-active');
   // Original assembly and original 57% hold, then the same remaining 1161 ms.
   timer=setTimeout(releaseHold,skipped?0:1539);
   await Promise.all([hold,ready]);
   if(skipped||media.matches)return;
   let destination=selectTarget();if(!destination)return;
   const keyframes=()=>[large,{left:destination.rect.x+destination.rect.width/2+'px',top:destination.rect.y+destination.rect.height/2+'px',fontSize:destination.style.fontSize,letterSpacing:destination.style.letterSpacing}];
   Object.assign(brand.style,{fontFamily:destination.style.fontFamily,fontWeight:destination.style.fontWeight,fontStyle:destination.style.fontStyle});
   host.style.setProperty('--ink',destination.style.color);
   host.style.setProperty('--accent',getComputedStyle(target.querySelector('.word-z')||target).color);
   movement=brand.animate(keyframes(),{duration:1161,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
   fade=curtain.animate([{opacity:1},{opacity:0}],{duration:1161,fill:'forwards'});
   // Safari's viewport or an async render can move the real header during flight.
   const track=()=>{
    const next=selectTarget();
    if(next&&['x','y','width','height'].some(k=>Math.abs(next.rect[k]-destination.rect[k])>.1)){destination=next;movement.effect.setKeyframes(keyframes());}
    if(!closed)frame=requestAnimationFrame(track);
   };
   frame=requestAnimationFrame(track);
   await Promise.all([movement.finished,fade.finished]);
  }catch{/* An interrupted animation must leave authentication and controls usable. */}
  finally{cleanup();}
 })();
 return {skip};
}
