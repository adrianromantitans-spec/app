import {tr,ui,language,locale} from './i18n.js?v=lists-28';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const titles={'expenses.added':'Nuevo gasto','expenses.updated':'Gasto modificado','expenses.deleted':'Gasto eliminado','polls.added':'Nueva votación','tasks.added':'Nueva tarea asignada','tasks.updated':'Tarea asignada','payment.requested':'Pago pendiente de confirmar','payments.added':'Pago confirmado','payment.rejected':'Pago no recibido','payment.cancelled':'Solicitud de pago cancelada'};
const categoryLabels={expenses:'Gastos',polls:'Votaciones',tasks:'Tareas',payments:'Pagos'};
export function pushEnvironment(nav=globalThis.navigator,standalone=globalThis.matchMedia?.('(display-mode: standalone)').matches){const ios=/iPad|iPhone|iPod/.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1);return {ios,installed:!!standalone||nav?.standalone===true,supported:!!globalThis.isSecureContext&&'serviceWorker' in (nav||{})&&'PushManager' in globalThis&&'Notification' in globalThis};}
function keyBytes(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));}
export class NotificationCentre {
 constructor({cloud,openModal,toast,openGroup,groups,closeModal,canOfferOnboarding=()=>true}){Object.assign(this,{cloud,openModal,toast,openGroup,groups,closeModal,canOfferOnboarding});this.introMemory=new Set();this.reset();}
 reset(){this.inboxGeneration=(this.inboxGeneration||0)+1;clearTimeout(this.introTimer);this.introTimer=null;this.wantsOnboarding=false;this.deviceSynced=false;clearInterval(this.timer);this.timer=null;this.account=null;this.settings=null;this.items=[];this.unread=0;this.next=null;this.error='';this.available=null;this.lastPoll=0;this.enabled=false;this.requestEpoch=(this.requestEpoch||0)+1;}
 bell(){return `<button class="notification-bell" data-notification-action="inbox" aria-label="${esc(tr('Notificaciones'))}"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" ${this.unread?'':'hidden'}>${Math.min(this.unread,99)}</span></button>`;}
 updateBadge(){document.querySelectorAll('.notification-count').forEach(el=>{el.hidden=!this.unread;el.textContent=String(Math.min(this.unread,99));});}
 async registration(){if(!pushEnvironment().supported)return null;return navigator.serviceWorker.register(new URL('./sw.js?v=notifications-26',location.href),{scope:new URL('./',location.href).pathname,updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready);}
 async workerMessage(type,userId,epoch=this.requestEpoch){const registration=await this.registration();if(epoch!==this.requestEpoch||!registration?.active)return null;return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve(null),2000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};registration.active.postMessage({type,userId},[channel.port2]);});}
 async connect(account,{onboard=false}={}){this.reset();this.account=account;const environment=pushEnvironment();this.wantsOnboarding=(onboard||(environment.ios&&environment.installed&&globalThis.Notification?.permission==='default'))&&!new URL(location.href).searchParams.has('notification');await this.poll(true);if(this.account!==account)return;this.timer=setInterval(()=>{if(!document.hidden)this.poll().catch(()=>{});},10000);this.deviceSync=this.syncDevice(account).catch(()=>{});this.deviceSync.then(()=>{if(this.account===account){this.deviceSynced=true;this.offerOnboarding();}});await this.consumeLink();}
 onboardingSeen(){try{return this.introMemory.has(this.account)||localStorage.getItem('divzplit-notification-intro:'+this.account)==='1';}catch{return this.introMemory.has(this.account);}}
 rememberOnboarding(){this.wantsOnboarding=false;this.introMemory.add(this.account);try{localStorage.setItem('divzplit-notification-intro:'+this.account,'1');}catch{}this.cloud.finishNotificationOnboarding().catch(()=>{});}
 offerOnboarding(){
  clearTimeout(this.introTimer);this.introTimer=null;
  if(!this.wantsOnboarding||!this.account||!this.deviceSynced)return;
  if(this.onboardingSeen()||this.enabled||globalThis.Notification?.permission==='denied'){this.rememberOnboarding();return;}
  if(!this.settings?.push_ready||document.hidden||!this.canOfferOnboarding()){this.introTimer=setTimeout(()=>this.offerOnboarding(),1000);return;}
  const env=pushEnvironment(),canEnable=env.supported&&(!env.ios||env.installed);
  this.rememberOnboarding();
  this.openModal(tr('No te pierdas las novedades'),`<div class="notification-onboarding"><p>${tr('Recibe avisos cuando tu grupo añada gastos, cree votaciones o te asigne tareas.')}</p>${env.ios&&!env.installed?`<p>${tr('En iPhone, añade DivZplit a la pantalla de inicio para recibir avisos con la app cerrada.')}</p>`:''}<div class="modal-actions"><button class="button secondary" data-notification-action="later">${tr('Ahora no')}</button><button class="button primary" data-notification-action="${canEnable?'enable':'preferences'}">${tr(canEnable?'Activar notificaciones':'Ver cómo activarlas')}</button></div></div>`);
 }
 async syncDevice(account){if(!pushEnvironment().supported)return;const binding=await this.workerMessage('GET_PUSH_ACCOUNT');if(this.account!==account)return;
  const registration=await this.registration(),subscription=await registration?.pushManager.getSubscription();if(this.account!==account)return;
  if(binding?.userId!==account){await this.workerMessage('CLEAR_PUSH_ACCOUNT');if(subscription)await subscription.unsubscribe();this.enabled=false;return;}
  if(subscription&&this.settings?.push_ready){await this.cloud.registerPush(subscription,language);if(this.account===account)this.enabled=true;}
 }
 async disconnect(){this.account=null;const epoch=++this.requestEpoch;this.enabled=false;clearInterval(this.timer);await this.workerMessage('CLEAR_PUSH_ACCOUNT',undefined,epoch).catch(()=>{});if(epoch!==this.requestEpoch)return;const registration=await this.registration().catch(()=>null);const subscription=await registration?.pushManager.getSubscription().catch(()=>null);if(epoch!==this.requestEpoch)return;if(subscription){await subscription.unsubscribe().catch(()=>{});await this.cloud.removePush(subscription.endpoint).catch(()=>{});}if(epoch===this.requestEpoch)this.reset();}
 async poll(force=false){if(!this.account||this.clearing&&!force)return;if(!force&&Date.now()-this.lastPoll<(this.available===false?30000:7000))return;
  const account=this.account,epoch=this.requestEpoch,generation=this.inboxGeneration;this.lastPoll=Date.now();
  try{const settings=await this.cloud.notificationSettings();if(this.account!==account||this.requestEpoch!==epoch||generation!==this.inboxGeneration)return;this.settings=settings;this.available=!!settings;if(!settings)return;
   const data=await this.cloud.notificationInbox();if(this.account!==account||this.requestEpoch!==epoch||generation!==this.inboxGeneration)return;
   const keepPages=this.items.length>30&&JSON.stringify(this.items.slice(0,30))===JSON.stringify(data.items),items=keepPages?this.items:data.items;const changed=JSON.stringify(this.items)!==JSON.stringify(items);this.unread=data.unread;this.items=items;this.next=keepPages?this.next:data.next;this.error='';this.updateBadge();if(changed)this.renderInbox();
  }catch(error){if(this.account===account&&this.requestEpoch===epoch&&generation===this.inboxGeneration)this.error=error.message;}
 }
 inboxHTML(){if(this.error)return `<p class="form-error" role="alert">${esc(this.error)}</p><button class="button secondary" data-notification-action="inbox">${tr('Volver a intentar')}</button>`;
  if(this.available===false)return `<p class="notification-empty">${tr('Los avisos del grupo todavía no están activados.')}</p>`;
  return `<div class="notification-toolbar"><button class="text-button" data-notification-action="preferences">${tr('Preferencias')}</button>${this.unread?`<button class="text-button" data-notification-action="read-all">${tr('Marcar todas como leídas')}</button>`:''}${this.items.length||this.unread?`<button class="text-button danger-text" data-notification-action="clear">${tr('Borrar todo')}</button>`:''}</div>${this.items.length?`<div class="notification-list">${this.items.map(n=>`<button class="notification-item ${n.read_at?'':'unread'}" data-notification-action="open" data-id="${esc(n.id)}"><strong>${esc(tr(titles[n.kind]||'Novedades del grupo'))}</strong><span>${esc(n.group_name)} · ${esc(n.actor_name)}</span>${n.subject?`<span>${esc(n.subject)}</span>`:''}<time datetime="${esc(n.created_at)}">${esc(new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(n.created_at)))}</time></button>`).join('')}</div>`:`<p class="notification-empty">${tr('No tienes avisos. Las novedades de tus grupos aparecerán aquí.')}</p>`}${this.next?`<button class="button secondary" data-notification-action="more">${tr('Ver más avisos')}</button>`:''}`;
 }
 renderInbox(){const container=document.querySelector('.notification-dialog');if(container)container.innerHTML=this.inboxHTML();}
 async showInbox(){this.openModal(tr('Notificaciones'),`<div class="notification-dialog"><p role="status">${tr('Cargando avisos…')}</p></div>`);await this.poll(true);this.renderInbox();}
 preferencesHTML(){const env=pushEnvironment(),blocked=globalThis.Notification?.permission==='denied';
  const deviceMessage=!this.settings?.push_ready?'El envío de avisos al móvil todavía no está activado.':env.ios&&!env.installed?'En iPhone: abre DivZplit en Safari, pulsa Compartir y Añadir a pantalla de inicio. Después abre ese icono para activar los avisos.':!env.supported?'Este navegador no permite avisos del móvil. Puedes consultar la campanita dentro de DivZplit.':blocked?'Las notificaciones están bloqueadas. Puedes permitirlas desde los ajustes del navegador.':this.enabled?'Los avisos están activados en este dispositivo.':'Activa los avisos para recibir novedades aunque DivZplit esté cerrada.';
  return `<div class="notification-device"><h3>${tr('Avisos en este dispositivo')}</h3><p>${tr(deviceMessage)}</p>${this.enabled?`<button class="button secondary" data-notification-action="disable">${tr('Desactivar en este dispositivo')}</button>`:this.settings?.push_ready&&env.supported&&(!env.ios||env.installed)&&!blocked?`<button class="button primary" data-notification-action="enable">${tr('Activar notificaciones')}</button>`:''}</div><div class="notification-preferences"><h3>${tr('Qué quieres recibir')}</h3>${Object.entries(categoryLabels).map(([key,label])=>`<label><input type="checkbox" data-notification-pref="${key}" ${this.settings?.[key]?'checked':''}>${tr(label)}</label>`).join('')}<h3>${tr('Silenciar grupos')}</h3>${this.groups().map(g=>`<label><input type="checkbox" data-notification-mute="${esc(g.id)}" ${this.settings?.muted_groups?.includes(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')}<button class="button primary" data-notification-action="save">${tr('Guardar preferencias')}</button><button class="text-button" data-notification-action="inbox">${tr('Volver a los avisos')}</button></div>`;
 }
 showPreferences(){this.openModal(tr('Preferencias de avisos'),`<div class="notification-settings">${this.preferencesHTML()}</div>`);}
 async enable(){const env=pushEnvironment();if(!this.settings?.push_ready||!env.supported||(env.ios&&!env.installed))return;
  // Request permission immediately in the user's click, before any network await.
  const permissionPromise=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
  const account=this.account,onboarding=!!document.querySelector('.notification-onboarding');if(await permissionPromise!=='granted'){if(onboarding)this.closeModal();else this.showPreferences();return;}
  await this.deviceSync;const registration=await this.registration();let subscription=await registration.pushManager.getSubscription();
  try{
   if(this.account!==account)return;
   const key=keyBytes(this.settings.public_key),oldKey=subscription?.options?.applicationServerKey;
   if(subscription&&oldKey&&String(new Uint8Array(oldKey))!==String(key)){await subscription.unsubscribe();subscription=null;}
   subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   await this.cloud.registerPush(subscription,language);if(this.account!==account){await subscription.unsubscribe();return;}
   const binding=await this.workerMessage('SET_PUSH_ACCOUNT',account);if(binding?.userId!==account)throw new Error(tr('No se han podido activar los avisos en este dispositivo. Vuelve a intentarlo.'));this.enabled=true;if(onboarding)this.closeModal();else this.showPreferences();this.toast(tr('Notificaciones activadas en este dispositivo.'));
  }catch(error){await this.workerMessage('CLEAR_PUSH_ACCOUNT').catch(()=>{});await subscription?.unsubscribe().catch(()=>{});throw error;}
 }
 async consumeLink(){const url=new URL(location.href),id=url.searchParams.get('notification');if(!id||!this.account)return;
  url.searchParams.delete('notification');history.replaceState(null,'',url.pathname+url.search+url.hash);
  if(idPattern.test(id))try{await this.open(id);}catch(error){this.toast(error.message);}
 }
 async open(id){const account=this.account,result=await this.cloud.openNotification(id);if(this.account!==account)return;await this.poll(true);await this.openGroup(result.group_id,result.kind);}
 async clearAll(){
  if(this.clearing)return;
  const account=this.account,confirmation=document.querySelector('.notification-clear-confirm');this.clearing=true;this.inboxGeneration++;confirmation?.setAttribute('aria-busy','true');confirmation?.querySelectorAll('button').forEach(button=>button.disabled=true);
  try{
   await this.cloud.clearNotifications();if(this.account!==account)return;
   this.inboxGeneration++;this.items=[];this.next=null;this.unread=0;this.updateBadge();await this.poll(true);
   if(document.querySelector('.notification-clear-confirm'))this.openModal(tr('Notificaciones'),`<div class="notification-dialog">${this.inboxHTML()}</div>`);
   this.toast(tr('Notificaciones borradas.'));
  }finally{this.clearing=false;confirmation?.removeAttribute('aria-busy');confirmation?.querySelectorAll('button').forEach(button=>button.disabled=false);}
 }
 async handle(button){const action=button.dataset.notificationAction;
  if(action==='clear'){this.openModal(tr('¿Borrar todas tus notificaciones?'),ui`<div class="notification-clear-confirm"><p class="dialog-copy">Se borrarán todos tus avisos, leídos y pendientes. Las notificaciones de otras personas y tus preferencias se conservarán.</p><div class="modal-actions"><button class="button secondary" data-notification-action="inbox">Cancelar</button><button class="button danger" data-notification-action="confirm-clear">Borrar todo</button></div></div>`);return;}
  if(action==='confirm-clear'){await this.clearAll();return;}
  if(action==='later'){this.closeModal();return;}
  if(action==='enable'){await this.enable();return;}
  if(action==='disable'){const account=this.account;await this.disconnect();this.account=account;await this.poll(true);this.showPreferences();return;}
  if(action==='inbox'){await this.showInbox();return;}
  if(action==='preferences'){this.showPreferences();return;}
  if(action==='open'){await this.open(button.dataset.id);return;}
  if(action==='read-all'){await this.cloud.markNotificationsRead();await this.poll(true);this.renderInbox();return;}
  if(action==='more'){const account=this.account,generation=this.inboxGeneration,data=await this.cloud.notificationInbox(this.next);if(this.account!==account||generation!==this.inboxGeneration)return;this.items=[...new Map([...this.items,...data.items].map(item=>[item.id,item])).values()];this.next=data.next;this.unread=data.unread;this.renderInbox();this.updateBadge();return;}
  if(action==='save'){const settings=Object.fromEntries([...document.querySelectorAll('[data-notification-pref]')].map(el=>[el.dataset.notificationPref,el.checked]));const muted=[...document.querySelectorAll('[data-notification-mute]:checked')].map(el=>el.dataset.notificationMute);this.settings=await this.cloud.saveNotificationSettings(settings,muted);this.toast(tr('Preferencias guardadas.'));}
 }
}
