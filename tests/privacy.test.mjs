import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {legalMetadata,TERMS_VERSION,PRIVACY_VERSION} from '../legal.js';
import {Cloud} from '../cloud.js';
const config={url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test',user_metadata:{display_name:'Ana'}};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const response=value=>new Response(JSON.stringify(value),{status:200});
function client(fetcher){return new Cloud(config,{fetcher,storage:storage(),temporaryStorage:storage()});}
function authed(fetcher){const c=client(fetcher);c.user=user;c.persistSession({access_token:'fixture',refresh_token:'refresh',expires_at:Date.now()/1000+3600});return c;}
test('acceptance is explicit and under-16 registration is rejected',()=>{
 assert.throws(()=>legalMetadata(false,'16_or_over','email'));
 assert.throws(()=>legalMetadata(true,'','google'));
 assert.throws(()=>legalMetadata(true,'under_16','email'),/16/);
 const m=legalMetadata(true,'16_or_over','google');assert.equal(m.terms_version,TERMS_VERSION);assert.equal(m.privacy_notice_version,PRIVACY_VERSION);assert.equal(m.legal_source,'google');assert.ok(Number.isFinite(Date.parse(m.terms_accepted_at)));
 assert.ok(!Object.keys(m).some(k=>/birth|marketing|consent/i.test(k)));
});
test('email registration records terms versions without changing confirmation or optional notification setup',async()=>{
 let sent;const c=client(async(url,o)=>{sent=JSON.parse(o.body);return response({user});});
 await c.signUp(user.email,'fixture-password','Ana','https://divzplit.com/',{accepted:true,ageBand:'16_or_over'});
 assert.equal(sent.data.terms_version,TERMS_VERSION);assert.equal(sent.data.display_name,'Ana');assert.equal(sent.data.notification_intro_pending,true);assert.equal(c.session,null);
 sent=null;await assert.rejects(()=>c.signUp(user.email,'fixture-password','Ana','https://divzplit.com/',{accepted:true,ageBand:'under_16'}));assert.equal(sent,null);
});
test('OAuth records acceptance only after a bound code is exchanged and an identity verified',async()=>{
 if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
 const calls=[];const c=client(async(url,o)=>{
  calls.push({url,body:o.body?JSON.parse(o.body):null});
  if(url.includes('/token?'))return response({access_token:'fixture',refresh_token:'refresh',expires_in:3600});
  return response(user);
 });
 await c.oauthURL('google','https://divzplit.com/',{accepted:true,ageBand:'16_or_over'});assert.equal(calls.length,0);
 await c.finishOAuth('?code=fixture-code','https://divzplit.com/');assert.ok(calls[0].url.includes('grant_type=pkce'));assert.equal(calls[1].body,null);assert.equal(calls[2].body.data.terms_version,TERMS_VERSION);
});
test('privacy export rejects cross-account responses and fails clearly when migration is not installed',async()=>{
 let c=authed(async()=>response({account:{id:'other'}}));await assert.rejects(()=>c.personalExport(),e=>e.code==='session');
 c=authed(async()=>new Response(JSON.stringify({code:'PGRST202'}),{status:404}));await assert.rejects(()=>c.personalExport(),/soporte/);
 c=authed(async()=>response({account:{id:user.id},groups:[]}));assert.equal((await c.personalExport()).account.id,user.id);
});
test('account deletion calls the rpc and drops the local session',async()=>{
 let called;const c=authed(async(url,o)=>{called={url,body:o.body};return response({deleted:true,shared_groups:1,removed_groups:0});});
 const result=await c.deleteAccount();
 assert.equal(called.url,'https://fixture.supabase.co/rest/v1/rpc/divzplit_delete_account');
 assert.equal(called.body,'{}');assert.equal(result.deleted,true);assert.equal(c.session,null);assert.equal(c.user,null);
 const missing=authed(async()=>new Response(JSON.stringify({code:'PGRST202'}),{status:404}));
 await assert.rejects(()=>missing.deleteAccount(),/activad/);
 const rejected=authed(async()=>response({deleted:false}));
 await assert.rejects(()=>rejected.deleteAccount(),/confirmar/);
});
