// Browser-only preflight. Never import this into React Native or treat its result
// as evidence in a Before User Created hook. See docs/OAUTH-ANTIBOT.md.
const abortError=()=>Object.assign(new Error('Cancelled'),{name:'AbortError'});
export const protectionCopy={
 checking:{es:'Comprobando el acceso…',en:'Checking access…',ro:'Se verifică accesul…'},
 retry:{es:'No se ha podido verificar el acceso. Vuelve a intentarlo.',en:'Access could not be verified. Please try again.',ro:'Accesul nu a putut fi verificat. Încearcă din nou.'},
 wait:{es:'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',en:'Too many attempts. Wait a minute and try again.',ro:'Prea multe încercări. Așteaptă un minut și încearcă din nou.'}
};
const text=(key,language)=>protectionCopy[key][language]||protectionCopy[key].en;
let loading;
export function loadTurnstile({document=globalThis.document,window=globalThis.window}={}){
 if(window.turnstile?.render)return Promise.resolve(window.turnstile);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.referrerPolicy='no-referrer';
  const timer=setTimeout(()=>{script.remove();reject(Error('Widget unavailable'));},15000);
  // With async/defer + render=explicit, script.onload is the readiness signal.
  // Cloudflare's real API throws if ready() is called in this loading mode.
  script.onload=()=>{const api=window.turnstile;clearTimeout(timer);if(!api?.render){script.remove();reject(Error('Widget unavailable'));return;}resolve(api);};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Widget unavailable'));};document.head.append(script);
 }).catch(error=>{loading=null;throw error;});
 return loading;
}
export async function turnstileToken({host,siteKey,challenge,language,signal,action='google_oauth',load=loadTurnstile}){
 if(signal?.aborted)throw abortError();
 const api=await new Promise((resolve,reject)=>{
  const cancel=()=>{signal?.removeEventListener('abort',cancel);reject(abortError());};signal?.addEventListener('abort',cancel,{once:true});
  Promise.resolve().then(load).then(value=>{signal?.removeEventListener('abort',cancel);resolve(value);},error=>{signal?.removeEventListener('abort',cancel);reject(error);});
 });if(signal?.aborted)throw abortError();
 return new Promise((resolve,reject)=>{
  let widget,settled=false;
  const finish=(error,token)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(widget!==undefined)api.remove(widget);host.replaceChildren();error?reject(error):resolve(token);};
  const cancel=()=>finish(abortError());const timer=setTimeout(()=>finish(Error('Widget timed out')),120000);
  signal?.addEventListener('abort',cancel,{once:true});
  try{widget=api.render(host,{sitekey:siteKey,action,cData:challenge,language:['es','en','ro'].includes(language)?language:'en',theme:'light',size:'compact',appearance:'interaction-only','response-field':false,
   callback:token=>finish(null,token),'error-callback':()=>{finish(Error('Challenge failed'));return true;},'expired-callback':()=>finish(Error('Challenge expired')),'timeout-callback':()=>finish(Error('Challenge timed out'))});
   // Test adapters or a cached widget may complete synchronously.
   if(settled&&widget!==undefined)api.remove(widget);
  }catch(error){finish(error);}
 });
}
export async function protectedGoogleURL({cloud,authorizeURL,settings,host,language='en',signal,token=turnstileToken,fetcher=globalThis.fetch,broker=false,onBrokerFlow,launchTicket}){
 if(settings?.enabled!==true&&!broker)return authorizeURL;
 if(!/^0x[0-9A-Za-z_-]{10,80}$/.test(settings.siteKey||'')||!host)throw Error(text('retry',language));
 const url=new URL(authorizeURL),redirectTo=url.searchParams.get('redirect_to'),challenge=url.searchParams.get('code_challenge');
 if(url.origin!==cloud.config.url||url.pathname!=='/auth/v1/authorize'||url.searchParams.get('provider')!=='google'||url.searchParams.get('code_challenge_method')!=='s256'||!/^[-_A-Za-z0-9]{43}$/.test(challenge||''))throw Error(text('retry',language));
 const status=host.ownerDocument.createElement('p'),widget=host.ownerDocument.createElement('div');status.className='form-note';status.setAttribute('role','status');status.textContent=text('checking',language);widget.className='oauth-turnstile';host.replaceChildren(status,widget);
 try{
  const challengeToken=await token({host:widget,siteKey:settings.siteKey,challenge,language,signal});if(signal?.aborted)throw abortError();
  const timeout=new AbortController(),cancel=()=>timeout.abort(),timer=setTimeout(()=>timeout.abort(),15000);signal?.addEventListener('abort',cancel,{once:true});
  let response;
  try{response=await fetcher(cloud.config.url+(broker?'/functions/v1/google-broker/begin':'/functions/v1/oauth-turnstile'),{method:'POST',headers:{'Content-Type':'application/json',apikey:cloud.config.publishableKey},body:JSON.stringify({token:challengeToken,codeChallenge:challenge,redirectTo,...(launchTicket?{launchTicket}:{})}),signal:timeout.signal,redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  if(signal?.aborted)throw abortError();if(response.status===429)throw Object.assign(Error(text('wait',language)),{limited:true});
  if(!response.ok)throw Error('Verification rejected');const result=await response.json();
  // Legacy preflight returns the exact URL; broker returns a fixed Google endpoint.
  if(broker){if(!validBrokerStartURL(result?.authorizeUrl,cloud.config.url)||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result.flowId||'')||typeof onBrokerFlow!=='function')throw Error('Unexpected broker URL');onBrokerFlow(result.flowId);}
  else if(result?.authorizeUrl!==authorizeURL)throw Error('Unexpected authorization URL');return result.authorizeUrl;
 }catch(error){if(signal?.aborted)throw abortError();if(error.limited)throw error;throw Error(text('retry',language));}
 finally{host.replaceChildren();}
}

export function validBrokerStartURL(value,supabaseURL){
 try{const url=new URL(value);const p=url.searchParams,allowed=['client_id','redirect_uri','response_type','scope','state','nonce','code_challenge','code_challenge_method','access_type','prompt'];return url.origin==='https://accounts.google.com'&&url.pathname==='/o/oauth2/v2/auth'&&[...p.keys()].every(k=>allowed.includes(k)&&p.getAll(k).length===1)&&p.get('redirect_uri')===supabaseURL+'/functions/v1/google-broker/callback'&&p.get('response_type')==='code'&&p.get('scope')==='openid email profile'&&p.get('code_challenge_method')==='S256'&&p.get('access_type')==='online'&&p.get('prompt')==='select_account'&&/^[A-Za-z0-9_-]{43}$/.test(p.get('state')||'')&&/^[0-9a-f]{64}$/.test(p.get('nonce')||'')&&/^[A-Za-z0-9_-]{43}$/.test(p.get('code_challenge')||'')&&typeof p.get('client_id')==='string'&&p.get('client_id').endsWith('.apps.googleusercontent.com')&&!url.hash&&!url.username&&!url.password;}
 catch{return false;}
}
