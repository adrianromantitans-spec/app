const ROOT='https://divzplit.com/';
const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export class NativeController{
 constructor({cloud,model,home,settlement,i18n,native,platform,extras,receipt,photos}){
  Object.assign(this,{cloud,model,home,settlement,i18n,native,platform,extras,receipt,photos});this.listeners=new Set();this.handled=new Set();this.pendingNotice=null;this.receiptUploads=new Map();
  this.state={ready:false,busy:false,user:null,groups:[],groupId:null,page:'home',error:'',notice:'',notices:[],history:[],shopping:[],paymentRequests:[],pushEnabled:false,pushReady:false};
 }
 snapshot=()=>this.state;
 subscribe=listener=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener);};
 update(fields){this.state={...this.state,...fields};for(const listener of this.listeners)listener();}
 get group(){return this.state.groups.find(g=>g.id===this.state.groupId)||this.state.groups[0]||null;}
 t(text){return this.i18n.tr(text);}
 async run(action){if(this.state.busy)throw new Error(this.t('Espera a que termine la operación actual.'));this.update({busy:true,error:''});try{return await action();}catch(error){this.update({error:error.message});throw error;}finally{this.update({busy:false});}}
 async start(url){try{if(url)await this.handleURL(url,false);if(!this.cloud.user)await this.cloud.restore();if(this.cloud.user)await this.refresh();}catch(error){this.update({error:error.message});}finally{this.update({ready:true,user:this.cloud.user});}}
 async handleURL(value,refresh=true){
  let url;try{url=new URL(value);}catch{return false;}
  if(url.origin!==ROOT.slice(0,-1)||!['/','/app/'].includes(url.pathname)||this.handled.has(value))return false;
  this.handled.add(value);
  if(url.searchParams.has('code')||url.searchParams.has('error')){
   const record=this.platform.temporaryStorage.getItem(this.cloud.storageKey+':oauth');
   if(record)await this.cloud.finishOAuth(url.search,ROOT);
   else if(!this.cloud.user)throw new Error(this.t('Este enlace de acceso ha caducado o se abrió en otro navegador. Solicita un nuevo enlace o vuelve a continuar con Google o Apple.'));
  }
  const hash=new URLSearchParams(url.hash.slice(1));
  if(hash.has('invite')){const token=hash.get('invite');if(!/^[a-f0-9]{64}$/.test(token))throw new Error(this.t('El enlace de invitación no está completo. Pide a tu amigo que lo copie de nuevo.'));this.platform.temporaryStorage.setItem('native-invite',token);}
  const id=url.searchParams.get('notification');if(id&&/^[a-f0-9-]{36}$/i.test(id))this.pendingNotice=id;
  if(refresh&&this.cloud.user)await this.refresh();await this.platform.flush();return true;
 }
 async login(email,password){return this.run(async()=>{await this.cloud.signIn(email.trim(),password);await this.platform.flush();await this.refresh();});}
 async register({email,password,name,accepted,ageBand}){return this.run(async()=>{const signedIn=await this.cloud.signUp(email.trim(),password,name.trim(),ROOT,{accepted,ageBand});await this.platform.flush();if(signedIn)await this.refresh();else this.update({notice:this.t('Revisa tu correo')});});}
 async oauth(provider,acknowledgement){return this.run(async()=>{const providers=await this.cloud.providers();if(!providers[provider])throw new Error(this.t('Esta forma de acceso no está disponible.'));const url=await this.cloud.oauthURL(provider,ROOT,acknowledgement);await this.platform.flush();await this.native.external(url);});}
 async recover(email){return this.run(async()=>{await this.cloud.recoverPassword(email.trim(),ROOT);await this.platform.flush();this.update({notice:this.t('Revisa tu correo')});});}
 async recoveryCode(email,code,password){return this.run(async()=>{await this.cloud.verifyRecoveryCode(email.trim(),code.trim());await this.cloud.updatePassword(password);await this.platform.flush();await this.refresh();});}
 async refresh(){
  const actor=this.cloud.user?.id;if(!actor)return;
  if(this.refreshRequest?.actor===actor)return this.refreshRequest.promise;
  const request={actor,promise:null};this.refreshRequest=request;
  request.promise=this.refreshGroups();
  try{return await request.promise;}finally{if(this.refreshRequest===request)this.refreshRequest=null;}
 }
 async refreshGroups(){
  const user=this.cloud.user;if(!user)return;
  const groups=await this.cloud.listGroups();if(this.cloud.user?.id!==user.id)return;
  if(this.extras)for(let index=0;index<groups.length;index++){
   const original=groups[index],draft=structuredClone(original),before=JSON.stringify(draft);
   this.extras.materializeRecurring(draft,day(),e=>original.remote.ownerId===user.id||e.createdBy===user.id,user.id);
   if(before!==JSON.stringify(draft)){
    if(this.cloud.user?.id!==user.id)return;
    groups[index]=await this.cloud.saveGroup(draft);
    if(this.cloud.user?.id!==user.id)return;
   }
  }
  const remembered=this.platform.storage.getItem('native-active-group:'+user.id),groupId=groups.some(g=>g.id===this.state.groupId)?this.state.groupId:groups.find(g=>g.id===remembered)?.id||groups[0]?.id||null;
  this.update({groups,groupId,user,error:''});
  const invite=this.platform.temporaryStorage.getItem('native-invite');
  if(invite){const joined=await this.cloud.join(invite);if(this.cloud.user?.id!==user.id)return;this.platform.temporaryStorage.removeItem('native-invite');const joinedGroups=await this.cloud.listGroups();if(this.cloud.user?.id!==user.id)return;this.update({groups:joinedGroups,groupId:joined.id});}
  await this.syncPush().catch(()=>{});
  if(this.cloud.user?.id!==user.id)return;
  if(this.pendingNotice){const id=this.pendingNotice;this.pendingNotice=null;await this.openNotice(id);}
 }
 select(id){if(!this.state.groups.some(g=>g.id===id))return;this.platform.storage.setItem('native-active-group:'+this.cloud.user.id,id);this.update({groupId:id,page:'home',history:[],shopping:[],paymentRequests:[]});}
 navigate(page){this.update({page,error:'',notice:''});if(page==='activity')return this.activity();if(page==='shopping')return this.shopping();if(page==='notifications')return this.inbox();}
 async saveExpense(fields,id=null,requestId=null,options={}){return this.run(async()=>{
  const current=this.group;if(!current)throw new Error(this.t('Elige un grupo'));
  if(options.groupId&&options.groupId!==current.id)throw new Error(this.t('El grupo ha cambiado. Vuelve a abrir el formulario.'));
  const draft=structuredClone(current),actor=this.cloud.user?.id;
  let expense;
  const effectiveId=id||(requestId&&draft.expenses.some(e=>e.id===requestId)?requestId:null);
  if(effectiveId){const old=draft.expenses.find(e=>e.id===effectiveId);if(!old)throw new Error(this.t('Este gasto ya no existe. Actualiza el grupo.'));if(old.createdBy!==actor&&current.remote.ownerId!==actor)throw new Error(this.t('No tienes permiso para editar este gasto.'));expense=this.model.updateExpense(draft,effectiveId,fields);}
  else{expense=this.model.addExpense(draft,fields);expense.createdBy=actor;if(requestId)expense.id=requestId;
   if(options.frequency){const nextDate=this.extras.nextOccurrence(expense.date,options.frequency);expense.recurrence={frequency:options.frequency,active:true,anchorDay:Number(expense.date.slice(8)),nextDate};}
  }
  const previous=current.expenses.find(e=>e.id===effectiveId)?.receipt;
  if(options.removeReceipt)delete expense.receipt;
  if(options.photo){
   const photo=options.photo,key=actor+':'+current.id+':'+photo.id;
   let uploaded=this.receiptUploads.get(key);
   if(!uploaded){uploaded=await this.cloud.uploadReceipt(current.id,this.model.uid(),{...photo,nativeReceipt:true});if(this.receiptUploads.size>=32)this.receiptUploads.delete(this.receiptUploads.keys().next().value);this.receiptUploads.set(key,uploaded);}
   expense.receipt=uploaded;
  }
  if(this.cloud.user?.id!==actor||this.group?.id!==current.id)throw new Error(this.t('El grupo ha cambiado. Vuelve a abrir el formulario.'));
  const result=await this.cloud.saveGroup(draft);
  if(this.cloud.user?.id!==actor)return result;
  this.replace(result);
  if(previous?.path&&previous.path!==expense.receipt?.path)await this.cloud.deleteReceipt(current.id,previous.path).catch(()=>this.update({notice:this.t('El gasto se ha guardado. No se ha podido borrar la foto anterior.')}));
  return result;
 });}
 async changeExpense(id,action,groupId){return this.run(async()=>{
  const current=this.group,actor=this.cloud.user?.id;
  if(!current||current.id!==groupId)throw new Error(this.t('El grupo ha cambiado. Vuelve a abrir el formulario.'));
  const draft=structuredClone(current),expense=draft.expenses.find(e=>e.id===id);
  if(!expense)throw new Error(this.t('Este gasto ya no existe. Actualiza el grupo.'));
  if(expense.createdBy!==actor&&current.remote.ownerId!==actor)throw new Error(this.t('No tienes permiso para editar este gasto.'));
  if(action==='stop'&&expense.recurrence?.active)expense.recurrence.active=false;
  else if(action==='delete')draft.expenses=draft.expenses.filter(e=>e.id!==id);
  else throw new Error(this.t('Revisa la operación.'));
  const result=await this.cloud.saveGroup(draft);if(this.cloud.user?.id!==actor)return;this.replace(result);
  if(action==='delete'&&expense.receipt?.path)await this.cloud.deleteReceipt(current.id,expense.receipt.path).catch(()=>this.update({notice:this.t('El gasto se ha eliminado. No se ha podido borrar la foto anterior.')}));
 });}
 replace(group){this.update({groups:this.state.groups.some(g=>g.id===group.id)?this.state.groups.map(g=>g.id===group.id?group:g):[group,...this.state.groups],groupId:group.id});}
 async createGroup(fields){return this.run(async()=>{this.replace(await this.cloud.createGroup({...fields,id:this.model.uid(),date:fields.date||'',endDate:fields.endDate||'',place:fields.place||'',emoji:fields.emoji||'🌴',budget:fields.budget||0}));this.update({page:'home'});});}
 async invite(){return this.run(async()=>{const result=await this.cloud.invite(this.group.id);const url=ROOT+'app/#invite='+result.token;await this.native.copy(url);this.update({notice:this.t('Enlace copiado. ¡Pásalo a tu gente!')});return url;});}
 async activity(){const g=this.group;if(!g)return;const data=await this.cloud.readActivity(g.id);if(this.group?.id===g.id)this.update({history:data.events,paymentRequests:data.requests});}
 async requestPayment(payment){return this.run(async()=>{await this.cloud.requestPayment(this.group,payment,this.model.uid());await this.activity();});}
 async respondPayment(id,action){return this.run(async()=>{await this.cloud.respondPayment(this.group,id,action);await this.refresh();await this.activity();});}
 async shopping(){const g=this.group;if(!g)return;const rows=await this.cloud.shoppingList(g.id);if(this.group?.id===g.id)this.update({shopping:rows});}
 async shoppingAction(action,item){return this.run(async()=>{await this.cloud.shoppingAction(this.group.id,action,item);await this.shopping();});}
 async plan(kind,action,item){return this.run(async()=>{const result=await this.cloud.planningAction(this.group,kind,action,item);this.replace(result);});}
 async vote(poll,option){return this.run(async()=>{const draft=structuredClone(this.group),target=draft.polls.find(p=>p.id===poll.id);if(!target)throw new Error(this.t('Actualiza el grupo.'));this.model.vote(target,option,'you');this.replace(await this.cloud.saveGroup(draft));});}
 async task(item){return this.run(async()=>{const draft=structuredClone(this.group),target=draft.tasks.find(t=>t.id===item.id);if(!target)throw new Error(this.t('Actualiza el grupo.'));target.done=!target.done;this.replace(await this.cloud.saveGroup(draft));});}
 async inbox(){const data=await this.cloud.notificationInbox();this.update({notices:data.items||[]});}
 async openNotice(id){const result=await this.cloud.openNotification(id);this.update({page:'notifications',notice:result.notification?.subject||result.subject||this.t('Notificaciones')});await this.inbox();}
 async syncPush(){
  const user=this.cloud.user;if(!user)return;
  const [status,state]=await Promise.all([this.cloud.rpc('divzplit_native_push_status',{}).catch(()=>({enabled:false})),this.native.pushState()]);
  if(this.cloud.user?.id!==user.id)return;
  this.update({pushReady:status.enabled===true,pushEnabled:false});
  if(state.userId&&state.userId!==user.id){await this.native.pushClear();return;}
  if(status.enabled&&state.enabled&&state.permission==='granted'){
   const token=await this.native.pushToken();await this.cloud.rpc('divzplit_register_native_push',{p_token:token,p_language:this.i18n.language});
   if(this.cloud.user?.id===user.id){await this.native.pushBind(user.id);this.update({pushEnabled:true});}
  }
 }
 async enablePush(){return this.run(async()=>{const user=this.cloud.user?.id;if(!this.state.pushReady)return;if(await this.native.pushPermission()!=='granted')return;const token=await this.native.pushToken();await this.cloud.rpc('divzplit_register_native_push',{p_token:token,p_language:this.i18n.language});if(this.cloud.user?.id!==user){await this.native.pushClear();return;}await this.native.pushBind(user);this.update({pushEnabled:true});});}
 async disablePush(){const state=await this.native.pushState();await this.native.pushClear();if(state.token)await this.cloud.rpc('divzplit_remove_native_push',{p_token:state.token}).catch(()=>{});this.update({pushEnabled:false});}
 async logout(){return this.run(async()=>{await this.disablePush();await this.cloud.signOut();await this.platform.flush();this.receiptUploads.clear();this.update({user:null,groups:[],groupId:null,page:'home',history:[],notices:[],shopping:[],paymentRequests:[]});});}
 language(value){this.i18n.setLanguage(value);this.update({});return this.platform.flush();}
 async export(){return this.run(async()=>{const data=await this.cloud.personalExport();await this.native.exportJSON(JSON.stringify(data,null,2),'divzplit-cuenta.json');});}
 async deleteAccount(confirmation){return this.run(async()=>{if(confirmation.trim().toLowerCase()!==this.cloud.user.email.toLowerCase())throw new Error(this.t('Escribe el correo de esta cuenta para confirmar.'));await this.disablePush();await this.cloud.deleteAccount();await this.platform.flush();this.update({user:null,groups:[],groupId:null,page:'home',history:[],notices:[]});});}
}
