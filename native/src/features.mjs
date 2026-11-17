import {canManage} from './collaboration.mjs';
const copy=v=>structuredClone(v);
export function groupFields(values,previous,model,planning){
 const name=String(values.name||'').trim(),place=String(values.place||'').trim(),emoji=String(values.emoji||'🏠');
 if(!name||name.length>60||place.length>80||[...emoji].length>10||!['Viaje','Convivencia','Pareja','Plan con amigos'].includes(values.type))throw new Error('Revisa los detalles del grupo.');
 const date=values.date||'',endDate=values.endDate||'';
 for(const value of [date,endDate])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value))throw new Error('Revisa la fecha.');
 if(endDate&&(!date||endDate<date))throw new Error('La fecha final debe ser posterior a la inicial.');
 model.checkCurrencyChange(previous,values.currency);
 return {name,place,emoji,type:values.type,date,endDate,currency:values.currency,budget:planning.optionalBudget(values.budget,values.currency)};
}
export function reservedGroup(group,requests,actor){
 const id=v=>v===actor?'you':v;
 return {...group,payments:[...group.payments,...requests.filter(r=>!r.status||r.status==='pending').map(r=>({from:id(r.from_id),to:id(r.to_id),amount:r.amount}))]};
}
export function noticePage(kind){return kind?.startsWith('shopping.')?'shopping':kind?.startsWith('tasks.')?'tasks':kind?.startsWith('polls.')?'polls':kind?.startsWith('payment')?'activity':'expenses';}
export const featureState={historyNext:null,historyLoading:false,activityGroupId:null,activityError:'',archives:[],noticeNext:null,noticeLoading:false,unread:0,noticeDetail:null,notificationPrefs:null,fx:null,simplify:true,recovering:false};
export const featureMethods={
 async createGroup(fields){return this.run(async()=>{
  if(this.cloud.recovering)throw new Error(this.t('Cambia primero tu contraseña.'));
  const actor=this.cloud.user?.id,normalized=groupFields(fields,null,this.model,this.planning);
  if(!normalized.budget)await this.cloud.requirePlanning();
  if(this.cloud.user?.id!==actor)throw new Error(this.t('La cuenta ha cambiado.'));
  const group=await this.cloud.createGroup({...normalized,id:fields.id||this.model.uid()});if(this.cloud.user?.id===actor){this.replace(group);this.update({page:'home'});}return group;
 });},
 async editGroup(id,fields,version){return this.run(async()=>{
  const g=this.currentGroup(id),actor=this.cloud.user.id;if(!canManage(g,this.cloud.user))throw new Error(this.t('Solo el propietario puede editar este grupo.'));
  if(g.remote.version!==version)throw new Error(this.t('El grupo ha cambiado. Vuelve a abrir el formulario.'));
  const draft={...copy(g),...groupFields(fields,g,this.model,this.planning)};if(!draft.budget)await this.cloud.requirePlanning();
  if(!this.activeReply(id,actor))throw new Error(this.t('La cuenta o el grupo han cambiado.'));
  const result=await this.cloud.saveGroup(draft);if(this.activeReply(id,actor))this.replace(result);
 });},
 async deleteGroup(id,confirmation,version){return this.run(async()=>{
  const g=this.currentGroup(id),actor=this.cloud.user.id;if(!canManage(g,this.cloud.user))throw new Error(this.t('Solo el propietario puede eliminar este grupo.'));
  if(g.name!==confirmation)throw new Error(this.t('El nombre no coincide. Escríbelo exactamente como aparece.'));
  if(g.remote.version!==version)throw new Error(this.t('El grupo ha cambiado. Vuelve a abrir el formulario.'));
  await this.cloud.deleteGroup(g);if(this.cloud.user?.id!==actor)return;
  const groups=this.state.groups.filter(row=>row.id!==id);this.update({groups,groupId:this.group?.id===id?groups[0]?.id||null:this.state.groupId,page:'home',shopping:[],shoppingGroupId:null,...copy(featureState)});
  this.cloud.cleanupDeletedGroups().catch(()=>{});
 });},
 async revoke(id){return this.run(async()=>{const g=this.currentGroup(id);if(!canManage(g,this.cloud.user))throw new Error(this.t('Solo el propietario puede editar este grupo.'));await this.cloud.revokeInvites(id);this.update({notice:this.t('Enlaces desactivados. Los miembros actuales conservan su acceso.')});});},
 async joinLink(value){
  const input=value.trim(),url=/^[a-f0-9]{64}$/.test(input)?'https://divzplit.com/app/#invite='+input:input;
  let parsed;try{parsed=new URL(url);}catch{throw new Error(this.t('Revisa el enlace de invitación.'));}
  if(parsed.origin!=='https://divzplit.com'||!['/','/app/'].includes(parsed.pathname)||!/^[a-f0-9]{64}$/.test(new URLSearchParams(parsed.hash.slice(1)).get('invite')||''))throw new Error(this.t('Revisa el enlace de invitación.'));
  return this.run(async()=>{const actor=this.cloud.user.id,group=await this.cloud.join(new URLSearchParams(parsed.hash.slice(1)).get('invite'));if(this.cloud.user?.id===actor){this.replace(group);this.update({page:'home'});}});
 },
 async activity(more=false){
  const g=this.group,actor=this.cloud.user?.id;if(!g||!actor)return;
  if(more&&(!this.state.historyNext||this.state.historyLoading||this.state.activityGroupId!==g.id))return;
  const request={};this.activityRequest=request;this.update({historyLoading:true,activityError:''});
  try{
   const data=await this.cloud.readActivity(g.id,more?this.state.historyNext:null);
   if(this.activityRequest!==request||!this.activeReply(g.id,actor))return;
   const archives=more?this.state.archives:await this.cloud.paymentArchives(g.id).catch(()=>null);
   if(this.activityRequest!==request||!this.activeReply(g.id,actor))return;
   const events=more?[...this.state.history,...data.events]:data.events;
   this.update({history:[...new Map(events.map(e=>[e.id,e])).values()],historyNext:data.next||null,paymentRequests:data.requests,archives,activityGroupId:g.id,activityError:''});
  }catch(error){if(this.activityRequest===request&&this.activeReply(g.id,actor))this.update({activityError:error.message,activityGroupId:null});throw error;}
  finally{if(this.activityRequest===request&&this.activeReply(g.id,actor))this.update({historyLoading:false});}
 },
 settlementData(){
  const g=this.group;if(!g||this.state.activityGroupId!==g.id||this.state.activityError)throw new Error(this.t('Actualiza los pagos antes de continuar.'));
  const plan=this.settlement.settlementPlan(reservedGroup(g,this.state.paymentRequests,this.cloud.user.id));
  return this.state.simplify?plan.transfers:plan.basicTransfers;
 },
 async loadFx(target){
  const g=this.group,actor=this.cloud.user?.id;if(!g||!actor)return;
  const request={};this.fxRequest=request;
  if(!target||target===g.currency){this.update({fx:null});return;}
  if(!this.model.currencies.includes(target))throw new Error(this.t('Moneda no disponible.'));
  this.update({fx:{groupId:g.id,target,loading:true,error:'',baseQuote:null,targetQuote:null}});
  try{
   const [baseQuote,targetQuote]=await Promise.all([g.currency==='EUR'?null:this.cloud.exchangeQuote(g.currency),target==='EUR'?null:this.cloud.exchangeQuote(target)]);
   if(!this.fxTools.validConversion(baseQuote,targetQuote,g.currency,target))throw new Error(this.t('No se ha podido obtener un cambio vigente.'));
   if(this.fxRequest===request&&this.activeReply(g.id,actor))this.update({fx:{groupId:g.id,target,baseQuote,targetQuote,loading:false,error:''}});
  }catch(error){if(this.fxRequest===request&&this.activeReply(g.id,actor))this.update({fx:{groupId:g.id,target,loading:false,error:error.message}});throw error;}
 },
 paymentQuote(payment){
  const g=this.group,fx=this.state.fx;if(!fx){if(payment.fxCurrency)throw new Error(this.t('El cambio ha cambiado. Revisa el pago de nuevo.'));return {...payment};}
  if(fx.groupId!==g.id||fx.loading||fx.error||!this.fxTools.validConversion(fx.baseQuote,fx.targetQuote,g.currency,fx.target))throw new Error(this.t('El cambio ha caducado. Actualízalo antes de continuar.'));
  const amount=this.fxTools.convertedAmount(payment.amount,g.currency,fx.target,fx.baseQuote?.rate||'1',fx.targetQuote?.rate||'1');if(amount<1)throw new Error(this.t('Importe inferior a la unidad mínima. Usa la moneda original.'));
  return {...payment,fxCurrency:fx.target,fxQuoteId:fx.baseQuote?.id||null,targetQuoteId:fx.targetQuote?.id||null,targetAmount:amount,...(fx.target==='EUR'?{eurAmount:amount}:{}),displayAmount:amount};
 },
 async requestPayment(payment,requestId,groupId=this.group?.id){return this.run(async()=>{
  const g=this.currentGroup(groupId),actor=this.cloud.user.id;
  const existing=this.state.paymentRequests.find(r=>r.id===requestId);
  if(existing&&this.state.activityGroupId===g.id&&existing.from_id===actor&&existing.to_id===payment.to&&existing.amount===payment.amount){await this.activity();return;}
  const available=this.settlementData().some(p=>p.from===payment.from&&p.to===payment.to&&p.amount===payment.amount);
  if(!available||payment.from!=='you')throw new Error(this.t('Los pagos han cambiado. Actualiza y revisa el importe.'));
  // Quotes are checked again at confirmation, never silently replaced.
  const current=this.paymentQuote(payment);
  for(const key of ['fxCurrency','fxQuoteId','targetQuoteId','targetAmount','eurAmount'])if((payment[key]??null)!==(current[key]??null))throw new Error(this.t('El cambio ha cambiado. Revisa el pago de nuevo.'));
  await this.cloud.requestPayment(g,payment,requestId||this.model.uid());if(this.activeReply(g.id,actor))await this.activity().catch(()=>this.update({notice:this.t('El pago se ha registrado. Actualiza la actividad.')}));
 });},
 async respondPayment(id,action,groupId=this.group?.id){return this.run(async()=>{
  const g=this.currentGroup(groupId),actor=this.cloud.user.id,request=this.state.paymentRequests.find(r=>r.id===id);
  if(this.state.activityGroupId!==g.id||!request||!['confirm','reject','cancel'].includes(action)||(action==='cancel'?request.from_id!==actor:request.to_id!==actor))throw new Error(this.t('No tienes permiso para responder a este pago.'));
  const result=await this.cloud.respondPayment(g,id,action);if(this.activeReply(g.id,actor)){this.replace(result);await this.activity().catch(()=>this.update({notice:this.t('El pago se ha registrado. Actualiza la actividad.')}));}
 });},
 async manageHistory(action,id,groupId=this.group?.id){return this.run(async()=>{
  const g=this.currentGroup(groupId),actor=this.cloud.user.id;if(!canManage(g,this.cloud.user))throw new Error(this.t('Solo el administrador puede limpiar estas listas.'));
  if(action==='delete')await this.cloud.deleteHistory(g,id);else if(action==='history')await this.cloud.clearHistory(g);else if(['pending','repayments'].includes(action))await this.cloud.clearPaymentList(g,action);else throw new Error(this.t('Revisa la operación.'));
  if(this.activeReply(g.id,actor))await this.activity();
 });},
 async inbox(more=false){
  const actor=this.cloud.user?.id;if(!actor||this.cloud.recovering)return;if(more&&(!this.state.noticeNext||this.state.noticeLoading))return;
  const request={};this.inboxRequest=request;this.update({noticeLoading:true});
  try{const data=await this.cloud.notificationInbox(more?this.state.noticeNext:null);if(this.inboxRequest===request&&this.cloud.user?.id===actor){const items=more?[...this.state.notices,...data.items]:data.items;this.update({notices:[...new Map(items.map(n=>[n.id,n])).values()],noticeNext:data.next||null,unread:data.unread||0});}}
  finally{if(this.inboxRequest===request&&this.cloud.user?.id===actor)this.update({noticeLoading:false});}
 },
 async openNotice(id){
  const actor=this.cloud.user?.id;if(!actor||this.cloud.recovering)return;const request={};this.noticeRequest=request;this.update({noticeDetail:null});
  const result=await this.cloud.openNotification(id);if(this.noticeRequest!==request||this.cloud.user?.id!==actor)return;
  await this.inbox();let notice=this.state.notices.find(n=>n.id===id),cursor=this.state.noticeNext;const seen=new Set();
  for(let page=0;!notice&&cursor&&page<20;page++){const key=JSON.stringify(cursor);if(seen.has(key))break;seen.add(key);const batch=await this.cloud.notificationInbox(cursor);if(this.noticeRequest!==request||this.cloud.user?.id!==actor)return;notice=batch.items?.find(n=>n.id===id);cursor=batch.next;}
  if(this.noticeRequest!==request||this.cloud.user?.id!==actor)return;
  if(notice?.group_id!==result.group_id||notice?.kind!==result.kind)notice=null;
  this.update({page:'notifications',noticeDetail:{...notice,group_id:result.group_id,kind:result.kind}});
 },
 async noticeDestination(){
  const detail=this.state.noticeDetail,actor=this.cloud.user?.id;if(!detail||!actor)return;
  if(!this.state.groups.some(g=>g.id===detail.group_id)){await this.refresh();if(!this.state.groups.some(g=>g.id===detail.group_id))throw new Error(this.t('Este grupo ya no está disponible.'));}
  if(this.cloud.user?.id!==actor||this.state.noticeDetail!==detail)return;
  this.select(detail.group_id);this.update({noticeDetail:null});return this.navigate(noticePage(detail.kind));
 },
 async readNotices(){return this.run(async()=>{const actor=this.cloud.user.id;await this.cloud.markNotificationsRead(null);if(this.cloud.user?.id===actor)await this.inbox();});},
 async clearNotices(){return this.run(async()=>{const actor=this.cloud.user.id;await this.cloud.clearNotifications();if(this.cloud.user?.id===actor){this.update({notices:[],noticeNext:null,unread:0,noticeDetail:null});await this.inbox();}});},
 async notificationPreferences(){const actor=this.cloud.user?.id;if(!actor||this.cloud.recovering)return;const settings=await this.cloud.notificationSettings();if(this.cloud.user?.id===actor)this.update({notificationPrefs:settings});},
 async savePreferences(settings,muted){return this.run(async()=>{
  const actor=this.cloud.user.id,previous=this.state.notificationPrefs;if(!previous)throw new Error(this.t('Actualiza los ajustes de notificaciones.'));
  const allowed=['expenses','polls','tasks','payments',...(Object.hasOwn(previous,'shopping')?['shopping']:[])],payload={};for(const key of allowed){if(typeof settings[key]!=='boolean')throw new Error(this.t('Revisa los ajustes.'));payload[key]=settings[key];}
  if(!Array.isArray(muted)||muted.some(id=>!this.state.groups.some(g=>g.id===id)))throw new Error(this.t('El grupo ya no está disponible.'));
  const result=await this.cloud.saveNotificationSettings(payload,[...new Set(muted)]);if(this.cloud.user?.id===actor)this.update({notificationPrefs:result});
 });},
 async verifyCode(email,code){return this.run(async()=>{await this.cloud.verifyRecoveryCode(email.trim(),code.trim());await this.platform.flush();this.update({recovering:true,user:null});});},
 async resetPassword(password,confirmation){return this.run(async()=>{if(typeof password!=='string'||password.length<10||password.length>128||password!==confirmation)throw new Error(this.t('Las contraseñas deben coincidir y tener al menos 10 caracteres.'));await this.cloud.updatePassword(password);await this.cloud.signOut();await this.platform.flush();this.update({...copy(featureState),recovering:false,user:null,groups:[],groupId:null,notice:this.t('Contraseña actualizada. Entra con tu nueva contraseña.')});});}
};
export const featureCopy={
 'Elegir fecha':{en:'Choose date',ro:'Alege data'},
 'Invitar al grupo':{en:'Invite to group',ro:'Invită în grup'},
 'Editar grupo':{en:'Edit group',ro:'Editează grupul'},
 '¿Desactivar los enlaces de invitación?':{en:'Disable invitation links?',ro:'Dezactivezi linkurile de invitație?'},
 'Los miembros actuales conservan su acceso.':{en:'Current members keep their access.',ro:'Membrii actuali își păstrează accesul.'},
 'Desactivar enlaces de invitación':{en:'Disable invitation links',ro:'Dezactivează linkurile de invitație'},
 'Eliminar el grupo no realiza pagos ni salda las deudas.':{en:'Deleting the group does not send payments or settle debts.',ro:'Ștergerea grupului nu efectuează plăți și nu stinge datoriile.'},
 'Unirme al grupo':{en:'Join group',ro:'Alătură-te grupului'},
 'DivZplit registra devoluciones; no envía dinero ni realiza transferencias.':{en:'DivZplit records repayments; it does not send money or make transfers.',ro:'DivZplit înregistrează rambursări; nu trimite bani și nu efectuează transferuri.'},
 '¿Has recibido el pago?':{en:'Have you received the payment?',ro:'Ai primit plata?'},
 '¿Rechazar este pago?':{en:'Reject this payment?',ro:'Respingi această plată?'},
 '¿Cancelar este pago?':{en:'Cancel this payment?',ro:'Anulezi această plată?'},
 'El saldo solo cambia cuando se confirma la recepción.':{en:'The balance changes only when receipt is confirmed.',ro:'Soldul se modifică doar după confirmarea primirii.'},
 'Liquidar gastos':{en:'Settle expenses',ro:'Achită cheltuielile'},
 'Los pagos pendientes ya se tienen en cuenta. Los saldos no cambian hasta que se confirma la recepción.':{en:'Pending payments are already taken into account. Balances change only when receipt is confirmed.',ro:'Plățile în așteptare sunt deja luate în calcul. Soldurile se modifică doar după confirmarea primirii.'},
 'He pagado':{en:'I have paid',ro:'Am plătit'},
 'Tu parte':{en:'Your share',ro:'Partea ta'},
 'Por categoría':{en:'By category',ro:'Pe categorii'},
 'Quién pagó':{en:'Who paid',ro:'Cine a plătit'},
 'Cancelar pagos pendientes':{en:'Cancel pending payments',ro:'Anulează plățile în așteptare'},
 'Archivar devoluciones':{en:'Archive repayments',ro:'Arhivează rambursările'},
 'Borrar historial':{en:'Clear history',ro:'Șterge istoricul'},
 'Se cancelarán las solicitudes pendientes; no se registrarán pagos.':{en:'Pending requests will be cancelled; no payments will be recorded.',ro:'Solicitările în așteptare vor fi anulate; nu se vor înregistra plăți.'},
 'Últimos cambios del grupo':{en:'Latest group changes',ro:'Ultimele modificări ale grupului'},
 'Ver grupo':{en:'View group',ro:'Vezi grupul'},
 'Marcar todo como leído':{en:'Mark all as read',ro:'Marchează totul ca citit'},
 '¿Borrar los avisos?':{en:'Clear notifications?',ro:'Ștergi notificările?'},
 'Borrar avisos':{en:'Clear notifications',ro:'Șterge notificările'},
 'Cargando ajustes…':{en:'Loading settings…',ro:'Se încarcă setările…'},
 'Revisa los detalles del grupo.':{en:'Check the group details.',ro:'Verifică detaliile grupului.'},
 'Revisa la fecha.':{en:'Check the date.',ro:'Verifică data.'},
 'La cuenta ha cambiado.':{en:'The account has changed.',ro:'Contul s-a schimbat.'},
 'Solo el propietario puede editar este grupo.':{en:'Only the owner can edit this group.',ro:'Doar proprietarul poate edita acest grup.'},
 'La cuenta o el grupo han cambiado.':{en:'The account or group has changed.',ro:'Contul sau grupul s-a schimbat.'},
 'Revisa el enlace de invitación.':{en:'Check the invitation link.',ro:'Verifică linkul de invitație.'},
 'Actualiza los pagos antes de continuar.':{en:'Refresh payments before continuing.',ro:'Actualizează plățile înainte de a continua.'},
 'Moneda no disponible.':{en:'Currency unavailable.',ro:'Monedă indisponibilă.'},
 'El cambio ha cambiado. Revisa el pago de nuevo.':{en:'The exchange rate selection has changed. Review the payment again.',ro:'Selecția cursului de schimb s-a modificat. Verifică din nou plata.'},
 'Los pagos han cambiado. Actualiza y revisa el importe.':{en:'Payments have changed. Refresh and review the amount.',ro:'Plățile s-au modificat. Actualizează și verifică suma.'},
 'El pago se ha registrado. Actualiza la actividad.':{en:'The payment was recorded. Refresh activity.',ro:'Plata a fost înregistrată. Actualizează activitatea.'},
 'No tienes permiso para responder a este pago.':{en:'You do not have permission to respond to this payment.',ro:'Nu ai permisiunea de a răspunde la această plată.'},
 'Este grupo ya no está disponible.':{en:'This group is no longer available.',ro:'Acest grup nu mai este disponibil.'},
 'Actualiza los ajustes de notificaciones.':{en:'Refresh notification settings.',ro:'Actualizează setările de notificare.'},
 'Revisa los ajustes.':{en:'Check the settings.',ro:'Verifică setările.'},
 'El grupo ya no está disponible.':{en:'The group is no longer available.',ro:'Grupul nu mai este disponibil.'},
 'Recortar y girar':{en:'Crop and rotate',ro:'Decupează și rotește'},
 'Arrastra sobre la foto para seleccionar el ticket. Puedes volver a seleccionar antes de guardar.':{en:'Drag over the photo to select the receipt. You can select again before saving.',ro:'Trage peste fotografie pentru a selecta bonul. Poți selecta din nou înainte de salvare.'},
 'Girar 90°':{en:'Rotate 90°',ro:'Rotește 90°'},
 'Foto completa':{en:'Full photo',ro:'Fotografie completă'},
 'Correo confirmado. Inicia sesión para continuar.':{en:'Email confirmed. Sign in to continue.',ro:'E-mail confirmat. Autentifică-te pentru a continua.'},
 'Escribe tu nombre y una contraseña de al menos 10 caracteres.':{en:'Enter your name and a password of at least 10 characters.',ro:'Introdu numele tău și o parolă de cel puțin 10 caractere.'},
 'Detalles del grupo':{en:'Group details',ro:'Detaliile grupului'},
 'Ajustes de notificaciones':{en:'Notification settings',ro:'Setări de notificare'},
 'Ajustes del dispositivo':{en:'Device settings',ro:'Setările dispozitivului'},
 'Todos los gastos':{en:'All expenses',ro:'Toate cheltuielile'}
};
