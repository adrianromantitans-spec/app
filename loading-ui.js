// Loading presentation only: no data requests, application state or button disabling.
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadingSkeleton(kind='list',label='',{status=true}={}){
 const type=['list','button','text','media'].includes(kind)?kind:'list';
 const rows=type==='list'?Array.from({length:3},()=>'<div class="skeleton-row"><i class="skeleton-square"></i><span><i class="skeleton-line"></i><i class="skeleton-line short"></i></span><i class="skeleton-value"></i></div>').join(''):type==='button'?'<i class="skeleton-pill"></i>':type==='media'?'<i class="skeleton-photo"></i>':'<i class="skeleton-line"></i><i class="skeleton-line short"></i>';
 return '<div class="content-skeleton content-skeleton--'+type+'"'+(status?' role="status"':'')+' aria-busy="true"><span class="loading-sr">'+escapeText(label)+'</span><div class="skeleton-shapes" aria-hidden="true">'+rows+'</div></div>';
}
const refreshes=new WeakMap(),blocked=new WeakMap(),buttons=new WeakMap();
function ready(root){return root?.classList.contains('personal-shell')&&!root.inert&&!root.classList.contains('brand-intro-active');}
function revealRefresh(root,state){
 if(!state.count||!ready(root))return;
 const host=root.querySelector('.topbar-right');if(!host||host!==state.host)return;
 if(!state.element?.isConnected){state.element=document.createElement('span');state.element.className='content-refresh';state.element.setAttribute('role','status');const label=document.createElement('span');label.className='loading-sr';label.textContent=state.label;state.element.append(label);host.prepend(state.element);}
}
export function beginContentRefresh(root,label,{preferButton=false}={}){
 if(!ready(root)||(preferButton&&document.querySelector('.loading-button[aria-busy=true]')))return ()=>{};
 const host=root.querySelector('.topbar-right');if(!host)return ()=>{};
 let state=refreshes.get(root);
 if(state&&state.host!==host){clearTimeout(state.timer);state.element?.remove();state=null;}
 if(!state){state={count:0,element:null,timer:0,label,host};refreshes.set(root,state);}
 state.count++;state.label=label;
 if(!state.timer&&!state.element?.isConnected)state.timer=setTimeout(()=>{state.timer=0;revealRefresh(root,state);},150);
 let ended=false;
 return ()=>{if(ended)return;ended=true;if(--state.count<=0){clearTimeout(state.timer);state.element?.remove();if(refreshes.get(root)===state)refreshes.delete(root);}};
}
export function showBusyInPlace(root,label,isBusy){
 if(blocked.has(root)||!ready(root))return;
 const finish=beginContentRefresh(root,label);const state=refreshes.get(root);if(state)revealRefresh(root,state);
 const check=()=>{if(!isBusy()||!root.isConnected||!root.classList.contains('personal-shell')||root.querySelector('.topbar-right')!==state?.host){finish();blocked.delete(root);}else job.timer=setTimeout(check,100);};
 const job={timer:0};blocked.set(root,job);job.timer=setTimeout(check,100);
}
function beginButton(button){
 let state=buttons.get(button);
 if(state&&state.count===0){clearTimeout(state.cleanup);state.restore();state=null;}
 if(!state){
  state={count:0,timer:0,cleanup:0,shown:false,confirmed:false,busy:button.getAttribute('aria-busy'),ink:button.style.getPropertyValue('--loading-ink')};buttons.set(button,state);
  button.style.setProperty('--loading-ink',getComputedStyle(button).color);button.classList.add('loading-button');button.setAttribute('aria-busy','true');
  state.timer=setTimeout(()=>{state.shown=true;if(button.isConnected)button.classList.add('is-loading');},120);
 }
 clearTimeout(state.cleanup);state.count++;
 let ended=false;
 return success=>{
  if(ended)return;ended=true;state.confirmed ||=!!success;if(--state.count>0)return;
  clearTimeout(state.timer);button.classList.remove('is-loading');
  const restore=()=>{button.classList.remove('loading-button','is-loading','has-saved');if(state.busy===null)button.removeAttribute('aria-busy');else button.setAttribute('aria-busy',state.busy);if(state.ink)button.style.setProperty('--loading-ink',state.ink);else button.style.removeProperty('--loading-ink');buttons.delete(button);};
  state.restore=restore;
  if(state.shown&&state.confirmed&&button.isConnected){button.classList.add('has-saved');if(state.busy===null)button.removeAttribute('aria-busy');else button.setAttribute('aria-busy',state.busy);state.cleanup=setTimeout(restore,700);}else restore();
 };
}
const forms=new Set(['account-form','recovery-form','recovery-code-form','password-form','expense-form','group-form','task-form','poll-form','budget-form','shopping-item-form','delete-account-form','delete-group-form']);
export function withSubmitFeedback(handler,isBlocked){
 return async event=>{
  const form=event.target,button=event.submitter||form.querySelector?.('[type=submit]');
  if(!forms.has(form.id)||!button||isBlocked())return handler(event);
  const finish=beginButton(button);
  try{const result=await handler(event);const error=[...form.querySelectorAll('.form-error,[role=alert]')].some(el=>el.textContent.trim());finish(!error);return result;}
  catch(error){finish(false);throw error;}
 };
}
const clickActions='[data-confirm-payment],[data-confirm-delete],[data-confirm-history-delete],[data-confirm-history-clear],[data-confirm-clear-payments],[data-stop-recurrence],[data-confirm-plan-delete],[data-confirm-plan-clear],[data-confirm-plan-remind],[data-action=generate-invite],[data-action=revoke-invites],[data-action=more-history],[data-action=privacy-export-full],[data-shopping-action=confirm],[data-shopping-action=send-reminder],[data-notification-action=save],[data-notification-action=read-all],[data-notification-action=confirm-clear]';
export function withClickFeedback(handler,isBlocked){
 return async event=>{
  const button=event.target.closest?.('button');
  if(!button?.matches(clickActions)||isBlocked())return handler(event);
  const finish=beginButton(button);
  try{return await handler(event);}finally{finish(false);}
 };
}
