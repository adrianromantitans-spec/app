// Small Supabase REST client: no third-party scripts or privileged browser keys.
export function validateConfig(config) {
  if (!config?.url && !config?.publishableKey) return null;
  let url;
  try { url = new URL(config.url); } catch { throw new Error('La configuración de cuentas no es válida.'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('La URL de cuentas no es válida.');
  const key = config.publishableKey;
  let allowed = typeof key === 'string' && key.startsWith('sb_publishable_');
  if (typeof key === 'string' && key.startsWith('eyJ')) {
    try { allowed = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'anon'; } catch { allowed = false; }
  }
  if (!allowed) throw new Error('Solo se admite una clave pública publishable o anon.');
  return {url:url.origin, publishableKey:key};
}

export class CloudError extends Error {
  constructor(message, code='network', status=0) { super(message); this.code=code; this.status=status; }
}

function browserStorage(name) {try {return globalThis[name];} catch {return null;}}

function messageFor(error, status) {
  const code = error?.error_code || error?.code;
  if (code === 'NEXO_CONFLICT') return 'Alguien ha actualizado el grupo. Hemos recargado los datos; revisa tu cambio y vuelve a guardarlo.';
  if (code === 'NEXO_INVITE') return 'Este enlace ha caducado, se ha revocado o ya no admite más personas. Pide uno nuevo.';
  if (code === 'NEXO_OWNER') return 'Solo quien creó el grupo puede modificar sus detalles o gestionar invitaciones.';
  if (code === 'NEXO_FORBIDDEN' || status === 403) return 'No tienes acceso a este grupo.';
  if (code === 'email_address_not_authorized') return 'El servicio de correo todavía no permite enviar confirmaciones a esta dirección. Hace falta configurar el envío de correos de la aplicación.';
  if (code === 'email_address_invalid') return 'Revisa tu dirección de correo electrónico.';
  if (code === 'weak_password') return 'Elige una contraseña más segura, con al menos 10 caracteres, mayúsculas, minúsculas y números.';
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'El registro por correo no está disponible en este momento.';
  if (code === 'unexpected_failure' && /confirmation email/i.test(error?.msg || error?.message || '')) return 'El servicio no ha podido enviar el correo de confirmación. Hay que revisar la configuración de envío de la aplicación.';
  if (code === 'email_not_confirmed') return 'Confirma tu correo antes de entrar. Revisa también la carpeta de spam.';
  if (code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.';
  if (status === 429 || code === 'over_email_send_rate_limit') return 'Demasiados intentos. Espera un poco antes de volver a intentarlo.';
  if (status === 401) return 'Tu sesión ha caducado. Vuelve a entrar en tu cuenta.';
  if (code === '23514' || code === '22023') return 'Revisa los datos. El servidor no ha podido aceptar el cambio.';
  return 'No se ha podido completar la operación. Comprueba la conexión e inténtalo de nuevo.';
}

export function mapGroup(document, viewerId, toRemote=false) {
  const g = structuredClone(document);
  const remap = id => toRemote ? (id === 'you' ? viewerId : id) : (id === viewerId ? 'you' : id);
  g.members = g.members.map(m => ({...m, id:remap(m.id)}));
  if (!toRemote) g.members = g.members.map(m => m.id === 'you' ? {...m,name:'Tú'} : m);
  g.expenses = g.expenses.map(e => ({...e,payer:remap(e.payer),participants:e.participants.map(remap)}));
  g.tasks = g.tasks.map(t => ({...t,assignee:remap(t.assignee)}));
  g.payments = g.payments.map(p => ({...p,from:remap(p.from),to:remap(p.to)}));
  g.polls = g.polls.map(p => ({...p,votes:Object.fromEntries(Object.entries(p.votes).map(([id,v])=>[remap(id),v]))}));
  delete g.remote;
  return g;
}

export class Cloud {
  constructor(config, {fetcher=globalThis.fetch, storage=browserStorage('localStorage'), temporaryStorage=browserStorage('sessionStorage')}={}) {
    this.config=validateConfig(config); this.fetcher=fetcher.bind(globalThis); this.storage=storage;
    this.temporaryStorage=temporaryStorage;
    this.session=null; this.user=null; this.refreshing=null;
    this.storageKey=this.config ? `nexo-session-v1:${new URL(this.config.url).host}` : '';
  }
  get enabled() { return !!this.config; }
  persistSession(session) {
    this.session=session;
    try { if (session) this.storage.setItem(this.storageKey,JSON.stringify(session)); else this.storage.removeItem(this.storageKey); }
    catch { /* A memory-only session is still usable; the UI explains it. */ }
  }
  async request(path, {method='GET', body, authenticated=true, retry=true, timeoutMs=15000}={}) {
    if (!this.enabled) throw new CloudError('Las cuentas compartidas todavía no están disponibles.');
    if (authenticated) await this.ensureSession();
    const headers={'apikey':this.config.publishableKey,'Content-Type':'application/json'};
    if (authenticated && this.session?.access_token) headers.Authorization=`Bearer ${this.session.access_token}`;
    let response;
    const controller=new AbortController();
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try { response=await this.fetcher(this.config.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,referrerPolicy:'no-referrer',cache:'no-store'}); }
    catch (error) {
      if(path.startsWith('/auth/v1/signup')) throw new CloudError((timedOut || error?.name==='TimeoutError')?'El registro está tardando demasiado. No podemos confirmar si se ha creado la cuenta. Revisa tu correo antes de volver a intentarlo.':'No se ha podido conectar con el servicio de registro. Comprueba tu conexión o prueba con otra red. Si ya recibiste el correo de confirmación, úsalo antes de repetir el registro.',(timedOut || error?.name==='TimeoutError')?'signup_timeout':'signup_network');
      throw new CloudError('No hay conexión con tus grupos. No se ha confirmado ningún cambio.');
    }
    finally {clearTimeout(timer);}
    let result; try {result=await response.json();} catch {result=null;}
    if (!response.ok) {
      if (response.status===401 && authenticated && retry && this.session?.refresh_token) {
        await this.refresh(); return this.request(path,{method,body,authenticated,retry:false});
      }
      let code=result?.error_code || result?.code;
      // PostgreSQL custom errors use P0001; the stable message contains our code.
      if (result?.message?.startsWith('NEXO_')) code=result.message;
      if (response.status===401 && authenticated) {this.persistSession(null);this.user=null;}
      throw new CloudError(messageFor({...result,code},response.status),code,response.status);
    }
    return result;
  }
  sessionFrom(result) {
    if (!result?.access_token || !result?.refresh_token) return null;
    return {access_token:result.access_token, refresh_token:result.refresh_token, expires_at:result.expires_at || Math.floor(Date.now()/1000)+(result.expires_in || 3600)};
  }
  async restore() {
    if (!this.enabled) return null;
    this.user=null;
    try {this.session=JSON.parse(this.storage.getItem(this.storageKey) || 'null');} catch {this.session=null;}
    if (!this.session?.refresh_token || !this.session?.access_token) {this.persistSession(null);return null;}
    return this.loadUser();
  }
  async acceptCallback(hash) {
    const params=new URLSearchParams(hash.replace(/^#/,''));
    if (params.get('error')) throw new CloudError('No se pudo confirmar el correo. Solicita un nuevo enlace o vuelve a entrar.');
    // A confirmation link confirms the email at Auth. Do not adopt a session
    // supplied in a URL: an unsolicited link must not switch somebody's account.
    // Ask for an explicit password sign-in after returning from confirmation.
    return params.has('access_token');
  }
  async providers() {
    const settings=await this.request('/auth/v1/settings',{authenticated:false});
    return {google:settings.external?.google===true,apple:settings.external?.apple===true};
  }
  async oauthURL(provider,redirect) {
    if (!['google','apple'].includes(provider)) throw new CloudError('Esta forma de acceso no está disponible.');
    if (!this.enabled) throw new CloudError('El acceso con cuenta todavía no está disponible.');
    if (!globalThis.crypto?.subtle) throw new CloudError('Abre Nexo en un navegador con conexión segura para continuar.');
    if (!this.temporaryStorage) throw new CloudError('Permite el almacenamiento de este sitio para continuar con Google o Apple.');
    const redirectURL=new URL(redirect);
    if (redirectURL.protocol!=='https:' && !(redirectURL.protocol==='http:'&&['localhost','127.0.0.1'].includes(redirectURL.hostname))) throw new CloudError('El enlace de vuelta a Nexo debe ser seguro.');
    redirectURL.search='';redirectURL.hash='';
    const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const verifier=base64url(crypto.getRandomValues(new Uint8Array(64)));
    const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    try {
      const record=JSON.stringify({verifier,provider,redirect:redirectURL.href,createdAt:Date.now()});
      this.temporaryStorage.setItem(this.storageKey+':oauth',record);
      if (this.temporaryStorage.getItem(this.storageKey+':oauth')!==record) throw new Error();
    } catch {throw new CloudError('Permite el almacenamiento de este sitio para continuar con Google o Apple.');}
    const url=new URL(this.config.url+'/auth/v1/authorize');
    url.search=new URLSearchParams({provider,redirect_to:redirectURL.href,code_challenge:challenge,code_challenge_method:'s256'}).toString();
    return url.href;
  }
  async finishOAuth(search,redirect) {
    const params=new URLSearchParams(search);
    if (params.has('error')) throw new CloudError(params.get('error')==='access_denied'?'Has cancelado el acceso. Puedes volver a intentarlo o entrar con tu correo.':'No se ha podido completar el acceso con Google o Apple. Vuelve a intentarlo.');
    const code=params.get('code');if (!code) return false;
    let record;
    try {
      record=JSON.parse(this.temporaryStorage?.getItem(this.storageKey+':oauth') || 'null');
      this.temporaryStorage?.removeItem(this.storageKey+':oauth');
    } catch {record=null;}
    if (!record || !/^[A-Za-z0-9_-]{43,128}$/.test(record.verifier) || !['google','apple'].includes(record.provider) || record.redirect!==redirect || !Number.isFinite(record.createdAt) || Date.now()-record.createdAt>15*60*1000 || record.createdAt>Date.now()+60000) throw new CloudError('Este enlace de acceso ha caducado o se abrió en otro navegador. Vuelve a continuar con Google o Apple.');
    const result=await this.request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:record.verifier},authenticated:false});
    const session=this.sessionFrom(result);
    if (!session) throw new CloudError('No se ha podido abrir la sesión. Vuelve a intentarlo.');
    this.persistSession(session);await this.loadUser();
    const metadata=this.user.user_metadata || {};
    const name=metadata.full_name || metadata.name;
    if (!metadata.display_name && typeof name==='string' && name.trim()) {
      try {this.user=await this.request('/auth/v1/user',{method:'PUT',body:{data:{display_name:name.trim().slice(0,40)}}});}
      catch(error) {if(!this.session)throw error; /* The optional name must not block a valid sign-in. */}
    }
    return true;
  }
  async ensureSession() {
    if (!this.session?.access_token) throw new CloudError('Entra en tu cuenta para continuar.','session',401);
    if (this.session.expires_at < Date.now()/1000+60) await this.refresh();
  }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    const token=this.session?.refresh_token;
    if (!token) throw new CloudError('Vuelve a entrar en tu cuenta.','session',401);
    this.refreshing=(async()=>{
      try {
        const result=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:token},authenticated:false});
        const session=this.sessionFrom(result);
        if (!session) throw new CloudError('Vuelve a entrar en tu cuenta.','session',401);
        this.persistSession(session);
      } catch (error) {if (error.status===400 || error.status===401) {this.persistSession(null);this.user=null;}throw error;}
      finally {this.refreshing=null;}
    })();
    return this.refreshing;
  }
  async loadUser() {this.user=await this.request('/auth/v1/user');return this.user;}
  async signIn(email,password) {
    const result=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},authenticated:false});
    const session=this.sessionFrom(result);if (!session) throw new CloudError('No se ha podido abrir la sesión.');
    this.persistSession(session);await this.loadUser();return this.user;
  }
  async signUp(email,password,name,redirect) {
    const result=await this.request('/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email,password,data:{display_name:name}},authenticated:false,timeoutMs:45000});
    const session=this.sessionFrom(result);
    if (session) {this.persistSession(session);await this.loadUser();}
    return !!session;
  }
  async signOut() {
    try {if (this.session) await this.request('/auth/v1/logout',{method:'POST'});}
    finally {this.persistSession(null);this.user=null;}
  }
  async rpc(name,args) {return this.request('/rest/v1/rpc/'+name,{method:'POST',body:args});}
  async groupRpc(name,args) {
    const viewerId=this.user?.id;
    const row=await this.rpc(name,args);
    if (this.user?.id!==viewerId) throw new CloudError('La cuenta ha cambiado. Vuelve a cargar tus grupos.','session',401);
    return this.rowToGroup(row,viewerId);
  }
  rowToGroup(row,viewerId=this.user?.id) {
    if (!viewerId) throw new CloudError('Vuelve a entrar en tu cuenta.','session',401);
    return {...mapGroup(row.document,viewerId),remote:{ownerId:row.owner_id,version:row.version,memberName:row.document.members.find(m=>m.id===viewerId)?.name}};
  }
  async listGroups() {
    const viewerId=this.user?.id;
    const rows=await this.request('/rest/v1/nexo_groups?select=id,owner_id,document,version&order=created_at.asc');
    if (this.user?.id!==viewerId) throw new CloudError('La cuenta ha cambiado. Vuelve a cargar tus grupos.','session',401);
    return rows.map(row=>this.rowToGroup(row,viewerId));
  }
  async createGroup(group) {
    const fields=Object.fromEntries(['name','emoji','type','place','date','endDate','budget'].map(key=>[key,group[key]]));
    fields.requestId=group.id;
    return this.groupRpc('nexo_create_group',{p_fields:fields});
  }
  async saveGroup(group) {
    const document=mapGroup(group,this.user.id,true);
    // The server owns names, membership and identity. Restore the canonical name.
    const me=document.members.find(m=>m.id===this.user.id);
    if (me) {me.name=group.remote.memberName;}
    return this.groupRpc('nexo_save_group',{p_id:group.id,p_version:group.remote.version,p_document:document});
  }
  async invite(groupId) {return this.rpc('nexo_create_invite',{p_id:groupId});}
  async revokeInvites(groupId) {return this.rpc('nexo_revoke_invites',{p_id:groupId});}
  async join(token) {return this.groupRpc('nexo_join_group',{p_token:token});}
}
