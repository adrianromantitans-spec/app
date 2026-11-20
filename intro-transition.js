// Keep the original letter animation; land on the real, already-rendered header.
export function startIntroTransition({root,brand,ready,onFinish}) {
 const viewport=window.visualViewport;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const base=getComputedStyle(brand),baseSize=parseFloat(base.fontSize),baseSpacing=parseFloat(base.letterSpacing)||0;
 const host=document.createElement('div');host.className='brand-intro-host modern-auth';
 host.innerHTML='<div class="brand-intro-curtain" aria-hidden="true"></div><header class="auth-header"></header>';
 const curtain=host.firstElementChild;host.lastElementChild.append(brand);document.body.append(host);
 Object.assign(brand.style,{position:'fixed',left:'0px',top:'0px',margin:'0',fontFamily:'DivZplitManrope,Arial,sans-serif',fontWeight:'850',fontStyle:'normal',fontSize:base.fontSize,letterSpacing:base.letterSpacing,visibility:'hidden',transform:'translate(-50%,-50%)'});
 const word=brand.querySelector('.split-word');if(word)Object.assign(word.style,{fontFamily:'DivZplitManrope,Arial,sans-serif',fontWeight:'850',fontStyle:'normal'});
 let skipped=false,movement,fade,target,oldVisibility='',closed=false,frame,timer,releaseHold,resizeObserver,mutationObserver,retarget=()=>{};
 const hold=new Promise(resolve=>{releaseHold=resolve;});
 const visibleCentre=()=>({x:(viewport?.offsetLeft||0)+(viewport?.width||innerWidth)/2,y:(viewport?.offsetTop||0)+(viewport?.height||innerHeight)/2});
 const findTarget=()=>[...root.querySelectorAll('.mobile-logo,.workspace-sidebar .brand,.auth-header .brand')].find(el=>el.getClientRects().length&&el.getBoundingClientRect().width>0);
 const restoreTarget=()=>{if(target){if(oldVisibility)target.style.visibility=oldVisibility;else target.style.removeProperty('visibility');}};
 const selectTarget=()=>{
  const next=findTarget();if(!next)return null;
  if(next!==target){restoreTarget();target=next;oldVisibility=target.style.visibility;target.style.visibility='hidden';}
  const text=target.querySelector('.split-word')||target;
  return {rect:text.getBoundingClientRect()};
 };
 const scheduleTarget=()=>{if(closed||!movement||frame)return;frame=requestAnimationFrame(()=>{frame=0;retarget();});};
 function cleanup(){
  if(closed)return;closed=true;clearTimeout(timer);cancelAnimationFrame(frame);
  resizeObserver?.disconnect();mutationObserver?.disconnect();
  movement?.cancel();fade?.cancel();restoreTarget();host.remove();
  document.removeEventListener('keydown',onKey);window.removeEventListener('resize',onResize);media.removeEventListener('change',onMotion);
  viewport?.removeEventListener('resize',scheduleTarget);viewport?.removeEventListener('scroll',scheduleTarget);window.removeEventListener('scroll',scheduleTarget);
  onFinish();
 }
 function skip(){skipped=true;releaseHold();if(movement){movement.finish();fade.finish();}}
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();skip();}};
 const initialWidth=innerWidth;
 const onResize=()=>{if(Math.abs(innerWidth-initialWidth)>40)skip();else scheduleTarget();};
 const onMotion=()=>{if(media.matches)skip();};
 document.addEventListener('keydown',onKey);window.addEventListener('resize',onResize);media.addEventListener('change',onMotion);
 viewport?.addEventListener('resize',scheduleTarget);viewport?.addEventListener('scroll',scheduleTarget);window.addEventListener('scroll',scheduleTarget,{passive:true});
 (async()=>{
  try{
   try{await document.fonts.load('850 48px DivZplitManrope');}catch{/* the assembly still runs with the fallback */}
   await document.fonts.ready;
   const centre=visibleCentre();
   const viewW=viewport?.width||innerWidth,viewLeft=viewport?.offsetLeft||0,narrow=viewW<760;
   const margin=narrow?44:72;
   const natural=brand.getBoundingClientRect();
   const cap=Math.min(viewW-margin*2,narrow?viewW*0.72:420);
   let ratio=Math.min((cap||1)/Math.max(natural.width,1),narrow?1:1.35);
   if(!Number.isFinite(ratio)||ratio<=0)ratio=1;
   const apply=amount=>{
    const next={left:centre.x+'px',top:centre.y+'px',fontSize:baseSize*amount+'px',letterSpacing:baseSpacing*amount+'px'};
    Object.assign(brand.style,next,{visibility:'visible'});
    return next;
   };
   apply(ratio);
   let text=brand.querySelector('.split-word').getBoundingClientRect();
   for(let pass=0;pass<4&&(text.width>viewW-margin*2||text.left<viewLeft+16||text.right>viewLeft+viewW-16);pass++){
    ratio*=Math.min(1,(viewW-margin*2)/Math.max(text.width,1))*0.96;
    apply(ratio);text=brand.querySelector('.split-word').getBoundingClientRect();
   }
   const sideRoom=Math.max(0,Math.min(text.left-viewLeft-12,viewLeft+viewW-text.right-12));
   const sideDistance=Math.min(narrow?28:95,sideRoom);
   host.style.setProperty('--intro-side-distance',sideDistance+'px');
   host.classList.add('brand-intro-active');
   // Original assembly and original 57% hold, then the same remaining 1161 ms.
   timer=setTimeout(releaseHold,skipped?0:1539);
   await Promise.all([hold,ready]);
   if(skipped||media.matches)return;
   let destination=selectTarget();if(!destination)return;
   const source=brand.querySelector('.split-word').getBoundingClientRect();
   // Freeze text metrics during flight: animating font-size/letter-spacing/left/top
   // forced Safari to lay out and repaint the wordmark on every frame.
   const keyframes=()=>{
    const sx=destination.rect.width/source.width,sy=destination.rect.height/source.height;
    const x=destination.rect.x+destination.rect.width/2-centre.x-sx*(source.x+source.width/2-centre.x);
    const y=destination.rect.y+destination.rect.height/2-centre.y-sy*(source.y+source.height/2-centre.y);
    return [{transform:'translate3d(0px,0px,0px) scale(1,1) translate(-50%,-50%)'},{transform:`translate3d(${x}px,${y}px,0px) scale(${sx},${sy}) translate(-50%,-50%)`}];
   };
   movement=brand.animate(keyframes(),{duration:1161,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
   fade=curtain.animate([{opacity:1},{opacity:0}],{duration:1161,fill:'forwards'});
   const observeTarget=()=>{resizeObserver?.disconnect();resizeObserver?.observe(root);if(target)resizeObserver?.observe(target);};
   // Measure only when layout actually changes, not on every display frame.
   // Preserve the current visual transform if Safari moves the viewport/header.
   retarget=()=>{
    if(movement.playState==='finished')return;
    const previous=target;
    const next=selectTarget();
    if(next&&['x','y','width','height'].some(k=>Math.abs(next.rect[k]-destination.rect[k])>.1)){
     const progress=movement.effect.getComputedTiming().progress,current=getComputedStyle(brand).transform;
     destination=next;const frames=keyframes();
     if(progress>0&&progress<1){frames[0].offset=0;frames[1].offset=1;frames.splice(1,0,{transform:current,offset:progress});}
     movement.effect.setKeyframes(frames);
    }
    if(previous!==target)observeTarget();
   };
   if(typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(scheduleTarget);observeTarget();}
   mutationObserver=new MutationObserver(scheduleTarget);mutationObserver.observe(root,{childList:true,subtree:true});
   await Promise.all([movement.finished,fade.finished]);
  }catch{/* An interrupted animation must leave authentication and controls usable. */}
  finally{cleanup();}
 })();
 return {skip};
}
