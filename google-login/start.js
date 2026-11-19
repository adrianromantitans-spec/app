import {cloudConfig} from '../config.js';
import {protectedGoogleURL,protectionCopy} from '../oauth-protection.js?v=google-broker-1';
const params=new URLSearchParams(location.hash.slice(1));history.replaceState(null,'',location.pathname+location.search);const language=['es','en','ro'].includes(params.get('lang'))?params.get('lang'):'en';
const copy={es:['Continuar con Google','Reintentar','Cancelar'],en:['Continue with Google','Retry','Cancel'],ro:['Continuă cu Google','Încearcă din nou','Anulează']}[language];
document.documentElement.lang=language;document.querySelector('#title').textContent=copy[0];document.querySelector('#retry').textContent=copy[1];document.querySelector('#cancel').textContent=copy[2];document.querySelector('#cancel').hidden=false;
let controller;
async function start(){
 const status=document.querySelector('#status'),retry=document.querySelector('#retry'),challenge=params.get('challenge');retry.hidden=true;
 if(cloudConfig.googleBroker?.enabled!==true||!/^[A-Za-z0-9_-]{43}$/.test(challenge||'')){status.textContent=protectionCopy.retry[language];return;}
 controller?.abort();controller=new AbortController();
 try{
  const auth=new URL(cloudConfig.url+'/auth/v1/authorize');auth.search=new URLSearchParams({provider:'google',redirect_to:new URL('../',location.href).href,code_challenge:challenge,code_challenge_method:'s256'}).toString();
  const url=await protectedGoogleURL({cloud:{config:cloudConfig},authorizeURL:auth.href,settings:{...cloudConfig.oauthProtection,enabled:true},host:document.querySelector('#challenge'),language,signal:controller.signal,broker:true,launchTicket:params.get('ticket'),onBrokerFlow:id=>{if(id!==params.get('flow'))throw Error(protectionCopy.retry[language]);}});location.replace(url);
 }catch(error){if(error.name!=='AbortError'){status.textContent=error.message;retry.hidden=false;}}
}
document.querySelector('#retry').addEventListener('click',start);document.querySelector('#cancel').addEventListener('click',()=>controller?.abort());start();
