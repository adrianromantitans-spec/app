// A text-only opening animation. Authentication runs independently underneath.
export function createBrandIntro() {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const overlay=document.createElement('div');overlay.className='wordmark-intro';
 overlay.setAttribute('role','status');overlay.setAttribute('aria-label','DivZplit');
 overlay.innerHTML='<span class="intro-wordmark" aria-hidden="true"><span class="intro-left">Div</span><span class="intro-z">Z</span><span class="intro-right">plit<span class="intro-dot">.</span></span></span>';
 document.body.append(overlay);
 let release;const assembled=new Promise(resolve=>{release=resolve;});
 const timer=setTimeout(release,reduced.matches?0:1100);
 let finishing=false;
 const skip=event=>{if(event.key==='Escape')release();};
 document.addEventListener('keydown',skip);overlay.addEventListener('click',()=>release());
 return {get active(){return overlay.isConnected;},async finish(){
  if(finishing)return;finishing=true;
  let target;
  try{
   await assembled;
   target=[...document.querySelectorAll('.mobile-logo,.workspace-sidebar .brand,.auth-header .brand')].find(el=>el.getClientRects().length&&el.getBoundingClientRect().width>0);
   const wordmark=overlay.querySelector('.intro-wordmark');
   if(!reduced.matches&&target&&wordmark.animate){
    const from=wordmark.getBoundingClientRect(),to=target.getBoundingClientRect();
    target.style.visibility='hidden';
    await Promise.all([
     wordmark.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${to.left+to.width/2-from.left-from.width/2}px,${to.top+to.height/2-from.top-from.height/2}px) scale(${to.width/from.width})`}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}).finished,
     overlay.animate([{backgroundColor:'#f9f7fd',offset:0},{backgroundColor:'#f9f7fd',offset:.5},{backgroundColor:'transparent',offset:1}],{duration:650,fill:'forwards'}).finished
    ]);
   }
  }catch{/* Interrupted animations must never block access to the app. */}
  finally{clearTimeout(timer);target?.style.removeProperty('visibility');overlay.remove();document.removeEventListener('keydown',skip);const app=document.getElementById('app');if(app)app.inert=!!document.getElementById('modal-root')?.firstElementChild;}
 }};
}
