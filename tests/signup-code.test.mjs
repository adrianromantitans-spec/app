import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Cloud} from '../cloud.js';
const email='alex@example.test',confirmed={id:'fixture-user',email,email_confirmed_at:'2026-11-19T10:00:00Z'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
function fixture(){
 const calls=[],saved=new Map();let reply={access_token:'verified-fixture',refresh_token:'refresh-fixture',user:confirmed},status=200;
 const cloud=new Cloud({url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'},{storage:{setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k),removeItem:k=>saved.delete(k)},fetcher:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),headers:options.headers});return url.includes('/signup?')?response({user:{id:'pending'}}):response(reply,status);}});
 return {cloud,calls,saved,reply:(body,code=200)=>{reply=body;status=code;}};
}
test('signup code confirms the pending email and opens a session without another password request',async()=>{
 const {cloud,calls,saved}=fixture();assert.equal(await cloud.signUp(email,'fixture-password','Alex','https://example.test/'),false);
 assert.equal(cloud.user,null);assert.equal(saved.size,0);assert.deepEqual(Object.keys(cloud.pendingSignup).sort(),['email','sentAt']);
 await cloud.verifySignupCode('ALEX@example.test','123456');
 assert.equal(cloud.user.id,confirmed.id);assert.equal(cloud.session.access_token,'verified-fixture');assert.equal(cloud.pendingSignup,null);
 assert.deepEqual(calls[1].body,{email,token:'123456',type:'signup'});assert.equal(calls[1].headers.Authorization,undefined);
 assert.equal(calls.filter(call=>call.url.includes('grant_type=password')).length,0);assert.equal(saved.size,1);
});
test('invalid/missing pending email and malformed codes never contact Auth',async()=>{
 const {cloud,calls}=fixture();await assert.rejects(cloud.verifySignupCode(email,'123456'));assert.equal(calls.length,0);
 await cloud.signUp(email,'fixture-password','Alex','https://example.test/');
 for(const [address,code] of [['other@example.test','123456'],[email,'123'],[email,'123456<script>'],[email,'abcdef']])await assert.rejects(cloud.verifySignupCode(address,code));
 assert.equal(calls.length,1);assert.equal(cloud.session,null);
});
test('failed, unconfirmed, mismatched and incomplete Auth responses cannot become a signup session',async()=>{
 for(const reply of [{access_token:'a',refresh_token:'r',user:{...confirmed,email:'other@example.test'}},{access_token:'a',refresh_token:'r',user:{...confirmed,email_confirmed_at:null}},{user:confirmed},{access_token:'a',refresh_token:'r'}]){
  const f=fixture();await f.cloud.signUp(email,'fixture-password','Alex','https://example.test/');f.reply(reply);
  await assert.rejects(f.cloud.verifySignupCode(email,'123456'));assert.equal(f.cloud.session,null);assert.equal(f.cloud.user,null);assert.equal(f.saved.size,0);assert.equal(f.cloud.pendingSignup.email,email);
 }
 const f=fixture();await f.cloud.signUp(email,'fixture-password','Alex','https://example.test/');f.reply({error_code:'otp_expired'},403);
 await assert.rejects(f.cloud.verifySignupCode(email,'123456'),error=>error.code==='otp_expired');assert.equal(f.cloud.pendingSignup.email,email);
 f.reply({access_token:'a',refresh_token:'r',user:confirmed});await f.cloud.verifySignupCode(email,'654321');assert.equal(f.cloud.user.id,confirmed.id);
});
test('resend uses signup type, the original address and a minute cooldown without saving credentials',async()=>{
 const f=fixture();await f.cloud.signUp(email,'fixture-password','Alex','https://example.test/');
 await assert.rejects(f.cloud.resendSignupCode(),error=>error.status===429);assert.equal(f.calls.length,1);
 f.cloud.pendingSignup.sentAt-=61000;const old=f.cloud.pendingSignup.sentAt;f.reply({error_code:'over_email_send_rate_limit'},429);
 await assert.rejects(f.cloud.resendSignupCode(),error=>error.status===429);assert.equal(f.cloud.pendingSignup.sentAt,old);
 f.reply({});await f.cloud.resendSignupCode();assert.deepEqual(f.calls.at(-1).body,{type:'signup',email});assert.ok(f.cloud.pendingSignup.sentAt>old);assert.equal(f.cloud.session,null);
});
test('a code must never switch an already signed-in account or accept a superseded signup',async()=>{
 const f=fixture();await f.cloud.signUp(email,'fixture-password','Alex','https://example.test/');f.cloud.user={id:'existing'};
 await assert.rejects(f.cloud.verifySignupCode(email,'123456'));assert.equal(f.calls.length,1);
 f.cloud.user=null;let complete;f.cloud.fetcher=()=>new Promise(resolve=>complete=resolve);
 const request=f.cloud.verifySignupCode(email,'123456');f.cloud.pendingSignup={email:'new@example.test',sentAt:Date.now()};complete(response({access_token:'a',refresh_token:'r',user:confirmed}));
 await assert.rejects(request);assert.equal(f.cloud.user,null);assert.equal(f.saved.size,0);
});
test('signup confirmation template contains a code and localized guidance, never a login link',()=>{
 const html=readFileSync(new URL('../supabase/templates/confirm-signup.html',import.meta.url),'utf8');
 assert.match(html,/\{\{ \.Token \}\}/);assert.doesNotMatch(html,/ConfirmationURL|TokenHash/);for(const text of ['Vuelve a DivZplit','Return to DivZplit','Revino la DivZplit'])assert.ok(html.includes(text));
});
