// Presentation and pointer gestures only. Existing buttons retain all app actions.
const root=document.querySelector('#app');
const mobile=matchMedia('(max-width:760px)');
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
const properties=['--dock-width','--dock-left','--dock-height','--dock-fade','--dock-plus-down','--dock-clip'];
let view=null,gesture=null,frame=0,previousTime=0,idleTimer=0,intentUntil=0,ignoreScrollUntil=0,blockedClick=null;
let keyboardNavigation=false,viewportWidth=document.documentElement.clientWidth;
let amount=0,amountVelocity=0,amountTarget=0,lensAmount=0,lensVelocity=0,lensTarget=0,lensX=0,lensXTarget=0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const now=()=>performance.now();
function eligible(){return mobile.matches&&root?.classList.contains('personal-shell')&&!root.inert&&!root.classList.contains('brand-intro-active');}
function editable(){return document.activeElement?.matches('input,textarea,select,[contenteditable=true]');}
function originalControls(dock){return [...dock.querySelectorAll(':scope > button[data-route]'),root.querySelector('.mobile-quick-add .nav-add')].filter(Boolean).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);}
function restoreLinks(){if(!view)return;for(const item of view.links){item.element.inert=item.inert;if(item.hidden===null)item.element.removeAttribute('aria-hidden');else item.element.setAttribute('aria-hidden',item.hidden);}}
function layout(){
 if(!view)return;
 const width=document.documentElement.clientWidth-36,shown=width+(68-width)*amount;
 root.style.setProperty('--dock-width',shown+'px');root.style.setProperty('--dock-left',(document.documentElement.clientWidth-shown)/2+'px');
 root.style.setProperty('--dock-height',(72-12*amount)+'px');root.style.setProperty('--dock-fade',Math.max(0,1-amount*2.5));root.style.setProperty('--dock-plus-down',6*amount+'px');
 root.style.setProperty('--dock-clip',amount>.001?'hidden':'visible');
 const hidden=amount>.55;
 for(const item of view.links){if(item.element.inert!==(hidden||item.inert))item.element.inert=hidden||item.inert;if(hidden)item.element.setAttribute('aria-hidden','true');else if(item.hidden===null)item.element.removeAttribute('aria-hidden');else item.element.setAttribute('aria-hidden',item.hidden);}
}
function clearHover(){if(!view)return;view.dock.classList.remove('dock-pressed');for(const button of view.controls)button.classList.remove('dock-drag-target');}
function teardown(){
 clearTimeout(idleTimer);cancelAnimationFrame(frame);frame=0;previousTime=0;gesture=null;amount=amountVelocity=amountTarget=lensAmount=lensVelocity=lensTarget=0;
 if(view){restoreLinks();clearHover();view.lens.remove();}
 view=null;root?.classList.remove('dock-effects-enabled');for(const property of properties)root?.style.removeProperty(property);
}
function sync(){
 const dock=root?.querySelector('.reference-dock');
 if(!eligible()||!dock){if(view)teardown();return;}
 if(view?.dock===dock)return;
 teardown();
 const lens=document.createElement('div');lens.className='dock-glass-lens';lens.hidden=true;lens.inert=true;lens.setAttribute('aria-hidden','true');
 const copy=document.createElement('div');copy.className='dock-lens-copy';lens.append(copy);root.querySelector('.main-shell').append(lens);
 const controls=originalControls(dock);
 view={dock,lens,copy,controls,links:controls.filter(el=>el!==root.querySelector('.nav-add')).map(element=>({element,inert:element.inert,hidden:element.getAttribute('aria-hidden')})),geometry:null,lastScroll:Math.max(0,window.scrollY)};
 root.classList.add('dock-effects-enabled');ignoreScrollUntil=now()+120;layout();
}
function schedule(){if(!frame&&view)frame=requestAnimationFrame(tick);}
function tick(time){
 frame=0;if(!view)return;
 const dt=previousTime?Math.min(1/30,(time-previousTime)/1000):1/60;previousTime=time;
 amountVelocity+=(240*(amountTarget-amount)-28*amountVelocity)*dt;amount=clamp(amount+amountVelocity*dt,0,1);
 lensVelocity+=(250*(lensTarget-lensAmount)-25*lensVelocity)*dt;lensAmount=clamp(lensAmount+lensVelocity*dt,0,1.08);
 const before=lensX;lensX+=(lensXTarget-lensX)*Math.min(1,dt*32);
 layout();
 if(view.geometry&&lensAmount>.008){
  const g=view.geometry,speed=Math.abs(lensX-before),width=54+22*lensAmount+Math.min(13,speed*1.2),height=54+21*lensAmount-Math.min(5,speed*.4);
  const left=lensX-width/2,top=g.top+g.height/2-height/2;
  view.lens.hidden=false;Object.assign(view.lens.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',opacity:String(Math.min(1,lensAmount))});
  Object.assign(view.copy.style,{left:(g.left-left)+'px',top:(g.top-top)+'px',width:g.width+'px',height:g.height+'px',transformOrigin:(lensX-g.left)+'px '+g.height/2+'px',transform:'scale('+(1+.18*lensAmount)+')'});
 }else view.lens.hidden=true;
 if(Math.abs(amountTarget-amount)>.001||Math.abs(amountVelocity)>.01||Math.abs(lensTarget-lensAmount)>.001||Math.abs(lensVelocity)>.01||Math.abs(lensXTarget-lensX)>.1)schedule();
 else{amount=amountTarget;lensAmount=lensTarget;previousTime=0;layout();if(!lensTarget)view.lens.hidden=true;}
}
function expand(immediate=false){clearTimeout(idleTimer);amountTarget=0;if(immediate){amount=amountVelocity=0;layout();}else schedule();}
function cancelPress(){gesture=null;lensTarget=0;clearHover();schedule();}
function makeLens(){
 view.geometry=view.dock.getBoundingClientRect();view.copy.replaceChildren();const g=view.geometry;
 for(const control of view.controls){
  const rect=control.getBoundingClientRect(),copy=document.createElement('div');copy.className='dock-lens-item'+(control.matches('.nav-add')?' dock-lens-plus':'');
  for(const node of control.childNodes)copy.append(node.cloneNode(true));
  for(const element of copy.querySelectorAll('*'))for(const attr of [...element.attributes])if(attr.name==='id'||attr.name.startsWith('data-')||attr.name.startsWith('aria-')||attr.name.startsWith('on'))element.removeAttribute(attr.name);
  Object.assign(copy.style,{left:(rect.left-g.left)+'px',top:(rect.top-g.top)+'px',width:rect.width+'px',height:rect.height+'px'});
  if(control.matches('.nav-add')){const style=getComputedStyle(control);for(const name of ['background','border','borderRadius','boxShadow','color'])copy.style[name]=style[name];}
  copy.dataset.slot=String(view.copy.children.length);view.copy.append(copy);
 }
}
function targetAt(x){return view?.controls.reduce((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return Math.abs(ar.left+ar.width/2-x)<Math.abs(br.left+br.width/2-x)?a:b;});}
function hover(control){
 if(!view)return;
 for(const item of view.controls)item.classList.toggle('dock-drag-target',item===control);
 for(const [i,item]of [...view.copy.children].entries())item.classList.toggle('is-focus',view.controls[i]===control);
}
function begin(event){
 if(!view||!eligible()||event.button!==0||event.isPrimary===false)return;
 const control=event.target.closest('.reference-dock > button,.mobile-quick-add .nav-add');if(!control||!view.controls.includes(control))return;
 // Isolate the bar from the existing page-edge drawer gesture, while leaving clicks intact.
 event.stopPropagation();expand(true);makeLens();const rect=control.getBoundingClientRect();
 gesture={id:event.pointerId,x:event.clientX,y:event.clientY,dragged:false};lensX=lensXTarget=rect.left+rect.width/2;
 if(!reducedMotion.matches){lensTarget=1;view.dock.classList.add('dock-pressed');hover(control);schedule();}
}
function move(event){
 if(!gesture||event.pointerId!==gesture.id||!view)return;
 const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
 if(!gesture.dragged&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){cancelPress();return;}
 if(!gesture.dragged&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.25)gesture.dragged=true;
 if(!gesture.dragged)return;
 event.preventDefault();const g=view.geometry;lensXTarget=clamp(event.clientX,g.left+27,g.right-27);hover(targetAt(lensXTarget));schedule();
}
function end(event){
 if(!gesture||event.pointerId!==gesture.id||!view)return;
 const dragged=gesture.dragged,g=view.geometry,target=targetAt(event.clientX);
 const inside=event.clientX>=g.left-16&&event.clientX<=g.right+16&&event.clientY>=g.top-40&&event.clientY<=g.bottom+40;
 if(dragged){event.preventDefault();event.stopPropagation();blockedClick={x:event.clientX,y:event.clientY,until:now()+500,pointer:event.pointerId};}
 cancelPress();
 if(dragged&&inside&&target){const route=target.dataset.route;queueMicrotask(()=>{if(!eligible())return;const original=route?root.querySelector('.reference-dock > button[data-route="'+route+'"]'):root.querySelector('.mobile-quick-add .nav-add');original?.click();});}
}
function suppressNativeClick(event){
 if(!blockedClick||!event.isTrusted||event.detail===0)return;
 if(now()>blockedClick.until){blockedClick=null;return;}
 if(Math.abs(event.clientX-blockedClick.x)<=5&&Math.abs(event.clientY-blockedClick.y)<=5){event.preventDefault();event.stopImmediatePropagation();blockedClick=null;}
}
function scrollIntent(event){if(event.type==='pointermove'&&event.buttons===0&&event.pointerType!=='touch')return;if(view&&eligible()&&!event.target.closest?.('.reference-dock,.mobile-quick-add,#modal-root'))intentUntil=now()+1200;}
function scroll(event){
 if(!view||!eligible()||reducedMotion.matches||editable()||gesture)return;
 if(event.target!==document&&event.target!==document.scrollingElement)return;
 const top=clamp(window.scrollY,0,Math.max(0,document.documentElement.scrollHeight-window.innerHeight));
 const distance=Math.abs(top-view.lastScroll);view.lastScroll=top;
 if(distance<.5||now()<ignoreScrollUntil||now()>intentUntil||(keyboardNavigation&&(view.dock.contains(document.activeElement)||document.activeElement?.closest('.mobile-quick-add'))))return;
 intentUntil=now()+1200;amountTarget=1;schedule();clearTimeout(idleTimer);idleTimer=setTimeout(()=>{amountTarget=0;schedule();},280);
}
if(root){
 new MutationObserver(sync).observe(root,{childList:true,attributes:true,attributeFilter:['class','inert']});
 document.addEventListener('pointerdown',()=>{keyboardNavigation=false;},true);
 document.addEventListener('keydown',event=>{if(event.key==='Tab'){keyboardNavigation=true;expand(true);}else if(['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key)&&event.target.closest('.reference-dock,.mobile-quick-add'))keyboardNavigation=true;});
 document.addEventListener('pointerdown',begin,true);document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',end,true);
 document.addEventListener('pointercancel',cancelPress,true);document.addEventListener('click',suppressNativeClick,true);
 document.addEventListener('pointerdown',scrollIntent,{passive:true});document.addEventListener('pointermove',scrollIntent,{passive:true});document.addEventListener('wheel',scrollIntent,{passive:true});document.addEventListener('scroll',scroll,{passive:true,capture:true});
 document.addEventListener('focusin',event=>{if(event.target.closest('.reference-dock,.mobile-quick-add,input,textarea,select,[contenteditable=true]'))expand(true);});
 window.addEventListener('resize',()=>{const changed=viewportWidth!==document.documentElement.clientWidth;viewportWidth=document.documentElement.clientWidth;if(changed||editable()||gesture||!mobile.matches){cancelPress();expand(true);}sync();layout();},{passive:true});window.addEventListener('blur',()=>{cancelPress();expand(true);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelPress();expand(true);blockedClick=null;}});
 mobile.addEventListener('change',sync);reducedMotion.addEventListener('change',()=>{cancelPress();expand(true);sync();});sync();
}

// Match inventory's shared navigation spring (420 / 36) and directional page entry.
function captureDockNavigation(){
 if(!mobile.matches||reducedMotion.matches)return null;
 const selected=root?.querySelector('.reference-dock-item.active');
 const icon=selected?.querySelector('.dock-navigation-indicator')||selected?.querySelector('.icon');
 if(!icon)return null;
 return {route:selected.dataset.route,rect:icon.getBoundingClientRect(),moving:icon.classList.contains('dock-navigation-indicator')};
}
function animateDockNavigation(previous){
 if(!previous||!mobile.matches||reducedMotion.matches)return;
 const selected=root.querySelector('.reference-dock-item.active');
 if(!selected||(selected.dataset.route===previous.route&&!previous.moving))return;
 const routes=['home','groups','activity','profile'];
 const direction=Math.sign(routes.indexOf(selected.dataset.route)-routes.indexOf(previous.route));
 const icon=selected.querySelector('.icon'),rect=icon.getBoundingClientRect(),button=selected.getBoundingClientRect();
 const style=getComputedStyle(icon),indicator=document.createElement('span');
 indicator.className='dock-navigation-indicator';indicator.setAttribute('aria-hidden','true');
 Object.assign(indicator.style,{left:(rect.left-button.left)+'px',top:(rect.top-button.top)+'px',width:rect.width+'px',height:rect.height+'px',background:style.background,boxShadow:style.boxShadow,borderRadius:style.borderRadius});
 selected.append(indicator);selected.classList.add('dock-transitioning');
 const frames=[];
 const damping=18,frequency=Math.sqrt(420-damping*damping);
 for(let i=0;i<=36;i++){
  const t=i/60,remaining=Math.exp(-damping*t)*(Math.cos(frequency*t)+damping/frequency*Math.sin(frequency*t));
  frames.push({transform:`translateX(${i===36?0:(previous.rect.left-rect.left)*remaining}px)`,offset:i/36});
 }
 const spring=indicator.animate(frames,{duration:600,easing:'linear'});
 const cleanup=()=>{indicator.remove();selected.classList.remove('dock-transitioning');};
 spring.onfinish=cleanup;spring.oncancel=cleanup;
 if(selected.dataset.route!==previous.route)root.querySelector('#main')?.animate([{opacity:0,transform:`translateX(${direction*24}px)`},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'});
}

let pendingDockNavigation=null;
root?.addEventListener('dock-before-render',()=>{pendingDockNavigation=captureDockNavigation();});
root?.addEventListener('dock-after-render',()=>{animateDockNavigation(pendingDockNavigation);pendingDockNavigation=null;});
