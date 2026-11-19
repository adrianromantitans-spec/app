import {cloudConfig} from '../config.js';
import {turnstileToken} from '../oauth-protection.js?v=auth-captcha-1';
import {captchaText} from '../auth-captcha-copy.js';
const params=new URLSearchParams(location.hash.slice(1));history.replaceState(null,'',location.pathname);
const nonce=params.get('nonce'),language=['es','en','ro'].includes(params.get('lang'))?params.get('lang'):'en';
document.documentElement.lang=language;document.querySelector('#title').textContent=captchaText('checking',language);
const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});
if(!/^[A-Za-z0-9_-]{43}$/.test(nonce||''))document.querySelector('#status').textContent=captchaText('unavailable',language);
else{
 window.divzplitCaptcha={nonce,status:'waiting'};
 try{
  const token=await turnstileToken({host:document.querySelector('#challenge'),siteKey:cloudConfig.oauthProtection?.siteKey,language,action:'email_auth',challenge:nonce,signal:controller.signal});
  // Read only by the native main-frame evaluator. No token in a URL, storage,
  // JavaScript interface, console message or additional verification request.
  window.divzplitCaptcha={nonce,status:'ready',token};
 }catch{window.divzplitCaptcha={nonce,status:'failed'};document.querySelector('#status').textContent=captchaText('rejected',language);}
}
