import {turnstileToken} from './oauth-protection.js?v=turnstile-loader-2';
import {captchaText} from './auth-captcha-copy.js';
// Supabase validates this token itself. Do not consume it in a second Siteverify call.
export async function browserAuthCaptcha({siteKey,language='en'}){
 if(!/^0x[0-9A-Za-z_-]{10,80}$/.test(siteKey||''))throw Error(captchaText('unavailable',language));
 const dialog=document.createElement('dialog'),title=document.createElement('h2'),host=document.createElement('div'),cancel=document.createElement('button');
 dialog.className='auth-captcha-dialog';title.textContent=captchaText('checking',language);title.id='auth-captcha-title';dialog.setAttribute('aria-labelledby',title.id);cancel.type='button';cancel.className='button secondary';cancel.textContent=captchaText('cancel',language);dialog.append(title,host,cancel);
 const controller=new AbortController(),abort=event=>{event?.preventDefault();controller.abort();};cancel.addEventListener('click',abort);dialog.addEventListener('cancel',abort);document.body.append(dialog);
 try{
  dialog.showModal();
  return await turnstileToken({host,siteKey,language,action:'email_auth',challenge:crypto.randomUUID(),signal:controller.signal});
 }catch(error){throw Object.assign(Error(captchaText(controller.signal.aborted?'cancelled':'rejected',language)),{code:controller.signal.aborted?'CAPTCHA_CANCELLED':'CAPTCHA_FAILED'});}
 finally{controller.abort();dialog.close();dialog.remove();}
}
