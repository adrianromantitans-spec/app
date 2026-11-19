import test from 'node:test';
import assert from 'node:assert/strict';
import {Cloud} from '../cloud.js';
import {captchaText} from '../auth-captcha-copy.js';
import {setLanguage} from '../i18n.js?v=signup-locale-2';
const config={url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
const json=(body,status=200)=>Response.json(body,{status});
function fixture({proof=async()=>'fixture-challenge-token',reply}={}){
 const calls=[];let challenges=0;
 const cloud=new Cloud(config,{captcha:async()=>{challenges++;return proof();},storage:{getItem:()=>null,setItem(){},removeItem(){}},fetcher:async(url,options)=>{
  const body=JSON.parse(options.body||'null');calls.push({url,body});
  if(reply)return reply(calls.length,body);
  return body?.gotrue_meta_security?.captcha_token?json({user:{id:'pending'}}):json({error_code:'captcha_failed',msg:'captcha protection: request disallowed (no captcha_token found)'},400);
 }});return {cloud,calls,challenges:()=>challenges};
}
test('actual hosted captcha_failed signup rejection collects a fresh proof, then retries once',async()=>{
 const f=fixture();assert.equal(await f.cloud.signUp('new@example.test','fictional-password','Alex','https://divzplit.com/'),false);
 assert.equal(f.calls.length,2);assert.equal(f.challenges(),1);
 const first=f.calls[0],second=f.calls[1];assert.equal(first.url,second.url);assert.ok(!first.body.gotrue_meta_security);
 assert.deepEqual(second.body,{...first.body,gotrue_meta_security:{captcha_token:'fixture-challenge-token'}});
 assert.equal(f.cloud.pendingSignup.email,'new@example.test');assert.equal(f.cloud.user,null);
 assert.ok(!second.url.includes('fixture-challenge-token'));
});
test('projects without required CAPTCHA perform signup once and do not show a challenge',async()=>{
 const f=fixture({reply:()=>json({user:{id:'pending'}})});await f.cloud.signUp('new@example.test','fictional-password','Alex','https://divzplit.com/');assert.equal(f.calls.length,1);assert.equal(f.challenges(),0);
});
test('invalid, expired or reused proof never loops, creates pending state or claims a network error',async()=>{
 const f=fixture({reply:()=>json({error_code:'captcha_failed'},400)});
 await assert.rejects(f.cloud.signUp('new@example.test','fictional-password','Alex','https://divzplit.com/'),e=>e.code==='captcha_failed'&&e.status===400&&!e.message.includes('conexión'));
 assert.equal(f.calls.length,2);assert.equal(f.challenges(),1);assert.equal(f.cloud.pendingSignup,undefined);
});
test('cancelled/unavailable verification makes no retry; localized errors contain no server details',async()=>{
 for(const lang of ['es','en','ro'])for(const code of ['CAPTCHA_CANCELLED','CAPTCHA_FAILED','MISSING_BRIDGE']){
  setLanguage(lang);const f=fixture({proof:async()=>{throw Object.assign(Error('raw private error'),{code});}});
  await assert.rejects(f.cloud.signUp('new@example.test','fictional-password','Alex','https://divzplit.com/'),e=>e.message===captchaText(code==='CAPTCHA_CANCELLED'?'cancelled':code==='CAPTCHA_FAILED'?'rejected':'unavailable',lang));
  assert.equal(f.calls.length,1);assert.equal(f.cloud.session,null);
 }setLanguage('es');
});
test('password login, recovery and resending request proof only after explicit rejection',async()=>{
 for(const path of ['/auth/v1/token?grant_type=password','/auth/v1/recover','/auth/v1/resend']){
  const f=fixture();await f.cloud.request(path,{method:'POST',authenticated:false,body:{email:'new@example.test'}});assert.equal(f.calls.length,2);assert.equal(f.challenges(),1);
 }
 for(const path of ['/auth/v1/verify','/auth/v1/token?grant_type=refresh_token','/auth/v1/token?grant_type=pkce','/rest/v1/rpc/unrelated']){
  const f=fixture();await assert.rejects(f.cloud.request(path,{method:'POST',authenticated:false,body:{}}));assert.equal(f.challenges(),0);
 }
});
test('network and server failures never automatically repeat account creation or show CAPTCHA',async()=>{
 for(const reply of [()=>{throw new TypeError('Network request failed');},()=>json({error_code:'unexpected_failure'},500),()=>json({error_code:'over_email_send_rate_limit'},429)]){
  const f=fixture({reply});await assert.rejects(f.cloud.signUp('new@example.test','fictional-password','Alex','https://divzplit.com/'));assert.equal(f.calls.length,1);assert.equal(f.challenges(),0);
 }
});
test('a client missing its native verification bridge shows a CAPTCHA error instead of a connection error',async()=>{
 const f=fixture();f.cloud.captcha=null;await assert.rejects(f.cloud.signUp('new@example.test','fictional-password','Alex','https://divzplit.com/'),e=>e.code==='captcha_failed'&&e.status===400&&e.message.includes('CAPTCHA'));assert.equal(f.calls.length,1);
});
