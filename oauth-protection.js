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
  script.onload=()=>{const api=window.turnstile;if(!api?.render){clearTimeout(timer);script.remove();reject(Error('Widget unavailable'));return;}const ready=()=>{clearTimeout(timer);resolve(api);};try{if(typeof api.ready==='function')api.ready(ready);else ready();}catch{clearTimeout(timer);script.remove();reject(Error('Widget unavailable'));}};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Widget unavailable'));};document.head.append(script);
 }).catch(error=>{loading=null;throw error;});
 return loading;
}
export async function turnstileToken({host,siteKey,challenge,language,signal,load=loadTurnstile}){
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
  try{widget=api.render(host,{sitekey:siteKey,action:'google_oauth',cData:challenge,language:['es','en','ro'].includes(language)?language:'en',theme:'light',size:'compact',appearance:'interaction-only','response-field':false,
   callback:token=>finish(null,token),'error-callback':()=>{finish(Error('Challenge failed'));return true;},'expired-callback':()=>finish(Error('Challenge expired')),'timeout-callback':()=>finish(Error('Challenge timed out'))});
   // Test adapters or a cached widget may complete synchronously.
   if(settled&&widget!==undefined)api.remove(widget);
  }catch(error){finish(error);}
 });
}
export async function protectedGoogleURL({cloud,authorizeURL,settings,host,language='en',signal,token=turnstileToken,fetcher=globalThis.fetch}){
 if(settings?.enabled!==true)return authorizeURL;
 if(!/^0x[0-9A-Za-z_-]{10,80}$/.test(settings.siteKey||'')||!host)throw Error(text('retry',language));
 const url=new URL(authorizeURL),redirectTo=url.searchParams.get('redirect_to'),challenge=url.searchParams.get('code_challenge');
 if(url.origin!==cloud.config.url||url.pathname!=='/auth/v1/authorize'||url.searchParams.get('provider')!=='google'||url.searchParams.get('code_challenge_method')!=='s256'||!/^[-_A-Za-z0-9]{43}$/.test(challenge||''))throw Error(text('retry',language));
 const status=host.ownerDocument.createElement('p'),widget=host.ownerDocument.createElement('div');status.className='form-note';status.setAttribute('role','status');status.textContent=text('checking',language);widget.className='oauth-turnstile';host.replaceChildren(status,widget);
 try{
  const challengeToken=await token({host:widget,siteKey:settings.siteKey,challenge,language,signal});if(signal?.aborted)throw abortError();
  const timeout=new AbortController(),cancel=()=>timeout.abort(),timer=setTimeout(()=>timeout.abort(),15000);signal?.addEventListener('abort',cancel,{once:true});
  let response;
  try{response=await fetcher(cloud.config.url+'/functions/v1/oauth-turnstile',{method:'POST',headers:{'Content-Type':'application/json',apikey:cloud.config.publishableKey},body:JSON.stringify({token:challengeToken,codeChallenge:challenge,redirectTo}),signal:timeout.signal,redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  if(signal?.aborted)throw abortError();if(response.status===429)throw Object.assign(Error(text('wait',language)),{limited:true});
  if(!response.ok)throw Error('Verification rejected');const result=await response.json();
  // The backend may only return the exact original provider/PKCE/redirect URL.
  if(result?.authorizeUrl!==authorizeURL)throw Error('Unexpected authorization URL');return result.authorizeUrl;
 }catch(error){if(signal?.aborted)throw abortError();if(error.limited)throw error;throw Error(text('retry',language));}
 finally{host.replaceChildren();}
}
