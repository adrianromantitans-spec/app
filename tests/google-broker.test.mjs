import test from 'node:test';
import assert from 'node:assert/strict';
import {createBroker} from '../supabase/functions/google-broker/broker.mjs';
import {createSealer,randomToken,sha,s256} from '../supabase/functions/google-broker/crypto.mjs';
import {createAuthAdapter} from '../supabase/functions/google-broker/auth.mjs';
import {Cloud} from '../cloud.js';
import {protectedGoogleURL,validBrokerStartURL} from '../oauth-protection.js';
const origin='https://divzplit.com',root=origin+'/',base='https://fixture.supabase.co',clientId='fixture.apps.googleusercontent.com',callback=base+'/functions/v1/google-broker/callback';
const response=(data,status=200)=>Response.json(data,{status});
const session={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:'alex@example.test',identities:[{provider:'google',identity_data:{sub:'google-fixture-sub'}}]}};
async function fixture(extra={}){
 const flows=new Map(),calls=[],created=[],verifier=randomToken(),sealer=await createSealer(randomToken());let enforcement=true;
 const rpc=async(name,args)=>{
  calls.push({name,args});if(name==='divzplit_google_broker_ready')return enforcement;
  if(name==='divzplit_google_flow_start'||name==='divzplit_google_flow_prepare'){flows.set(args.p_id,{id:args.p_id,state:args.p_state,appChallenge:args.p_challenge,returnTo:args.p_return,nonceDigest:args.p_nonce,sealed:args.p_sealed,phase:name==='divzplit_google_flow_prepare'?'prepared':'pending',ticket:args.p_ticket});return;}
  if(name==='divzplit_google_launch_claim'){const f=[...flows.values()].find(f=>f.ticket===args.p_ticket&&f.appChallenge===args.p_challenge&&f.returnTo===args.p_return&&f.phase==='prepared');if(!f)throw Error('launch');f.phase='pending';f.ticket=null;return {...f};}
  if(name==='divzplit_google_callback_claim'){const f=[...flows.values()].find(f=>f.state===args.p_state&&f.phase==='pending');if(!f)throw Error('state');f.phase='callback_claimed';return {...f};}
  if(name==='divzplit_google_callback_ready'){const f=flows.get(args.p_id);assert.equal(f.phase,'callback_claimed');Object.assign(f,{phase:'ready',subject:args.p_subject,email:args.p_email,sealed:args.p_sealed,completion:args.p_completion});return;}
  if(name==='divzplit_google_completion_claim'){const f=[...flows.values()].find(f=>f.id===args.p_flow&&f.completion===args.p_code&&f.appChallenge===args.p_challenge&&f.returnTo===args.p_return&&f.phase==='ready');if(!f)throw Error('completion');f.phase='completion_claimed';return {...f};}
  if(name==='divzplit_google_authorize_provision'){const f=flows.get(args.p_id);assert.equal(f.phase,'completion_claimed');f.phase='authorizing';return {userId:session.user.id,create:true};}
  if(name==='divzplit_google_flow_finish'){const f=flows.get(args.p_id);f.sealed=null;f.phase=args.p_success||f.phase==='done'?'done':'failed';return;}
  throw Error('unknown');
 };
 const broker=createBroker({enabled:true,clientId,clientSecret:'fictional-server-client-secret',callbackURL:callback,preflight:async r=>{const body=await r.json();return body.token==='valid-turnstile'?response({}):response({error:'challenge_invalid'},400);},rpc,sealer,
  verifyGoogle:async(token,{nonceDigest})=>{if(token!=='signed-fixture-id-token')throw Error('signature');const f=[...flows.values()].find(f=>f.nonceDigest===nonceDigest);if(!f)throw Error('nonce');return {subject:'google-fixture-sub',email:'alex@example.test',name:'Alex'};},
  fetcher:async(url,options)=>{assert.equal(url,'https://oauth2.googleapis.com/token');const body=new URLSearchParams(options.body);const flow=[...flows.values()][0],context=await sealer.open(flow.sealed,flow.id);assert.equal(body.get('code_verifier'),context.googleVerifier);assert.equal(body.get('client_secret'),'fictional-server-client-secret');assert.equal(body.get('redirect_uri'),callback);return response({id_token:'signed-fixture-id-token',access_token:'fixture-google-access'});},
  supabase:{create:async(target,identity)=>created.push({target,identity}),signIn:async()=>({...session,provider_token:'must-not-leave-server'})},...extra});
 const post=(path,body,withOrigin=true)=>broker(new Request(base+'/functions/v1/google-broker/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(withOrigin?{Origin:origin}:{})},body:JSON.stringify(body)}));
 const begin=()=>post('begin',{token:'valid-turnstile',codeChallenge:awaitableChallenge,redirectTo:root});
 const awaitableChallenge=await s256(verifier);
 const start=async()=>{const r=await begin();assert.equal(r.status,200);return new URL((await r.json()).authorizeUrl);};
 const finishCallback=async url=>{const r=await broker(new Request(callback+'?'+new URLSearchParams({state:url.searchParams.get('state'),code:'fixture-code'})));return r;};
 return {broker,post,start,finishCallback,flows,calls,created,verifier,sealer,enforcement:value=>enforcement=value};
}
test('broker creates no user on callback; only the original app verifier can claim a session and provisioning authorization',async()=>{
 const f=await fixture(),url=await f.start();assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),callback);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 const returned=await f.finishCallback(url);assert.equal(returned.status,303);const dest=new URL(returned.headers.get('location'));assert.equal(dest.origin,origin);assert.deepEqual([...dest.searchParams.keys()],['broker_code','broker_flow']);assert.equal(f.created.length,0);
 const code=dest.searchParams.get('broker_code'),flowId=dest.searchParams.get('broker_flow');assert.equal((await f.post('complete',{code,flowId,verifier:randomToken(),redirectTo:root})).status,400);assert.equal(f.created.length,0);
 const r=await f.post('complete',{code,flowId:[...f.flows.keys()][0],verifier:f.verifier,redirectTo:root},false);assert.equal(r.status,200);const result=await r.json();assert.equal(result.user.id,session.user.id);assert.ok(!('provider_token' in result));assert.equal(f.created.length,1);assert.equal([...f.flows.values()][0].sealed,null);
 assert.equal((await f.post('complete',{code,flowId:[...f.flows.keys()][0],verifier:f.verifier,redirectTo:root})).status,400);assert.equal(f.created.length,1);
});
test('inactive enforcement, invalid challenge and unsafe return routes cannot start a broker flow',async()=>{
 const f=await fixture();f.enforcement(false);assert.equal((await f.post('begin',{token:'valid-turnstile',codeChallenge:await s256(f.verifier),redirectTo:root})).status,503);
 f.enforcement(true);assert.equal((await f.post('begin',{token:'invalid-turnstile',codeChallenge:await s256(f.verifier),redirectTo:root})).status,400);assert.equal((await f.post('begin',{token:'valid-turnstile',codeChallenge:await s256(f.verifier),redirectTo:'https://evil.example/'})).status,400);assert.equal(f.flows.size,0);
});
test('state replay and unverified provider responses cannot provision an account',async()=>{
 const f=await fixture({verifyGoogle:async()=>{throw Error('invalid signature');}}),url=await f.start();const r=await f.finishCallback(url);assert.equal(new URL(r.headers.get('location')).searchParams.get('broker_error'),'failed');assert.equal(f.created.length,0);
 assert.equal((await f.finishCallback(url)).status,400);assert.equal(f.created.length,0);
});
test('completion cannot substitute Google identity, response user ID, or redirect target',async()=>{
 const f=await fixture({supabase:{create:async()=>{},signIn:async()=>({...session,user:{...session.user,id:'attacker-id'}})}}),url=await f.start(),returned=await f.finishCallback(url),code=new URL(returned.headers.get('location')).searchParams.get('broker_code');
 assert.equal((await f.post('complete',{code,flowId:[...f.flows.keys()][0],verifier:f.verifier,redirectTo:'https://evil.example/'})).status,400);
 assert.equal((await f.post('complete',{code,flowId:[...f.flows.keys()][0],verifier:f.verifier,redirectTo:root})).status,400);
 assert.equal([...f.flows.values()][0].sealed,null);
});
test('encrypted contexts are authenticated to their flow and cannot be decrypted using another key',async()=>{
 const key=randomToken(),a=await createSealer(key),b=await createSealer(key),cipher=await a.seal({token:'secret-provider-token'},'flow-1');assert.ok(!cipher.includes('secret-provider-token'));assert.deepEqual(await b.open(cipher,'flow-1'),{token:'secret-provider-token'});await assert.rejects(a.open(cipher,'flow-2'));
 const other=await createSealer(randomToken());await assert.rejects(other.open(cipher,'flow-1'));
});
test('Auth adapter never confirms/updates an existing account or invents a provider session',async()=>{
 const calls=[],target={userId:session.user.id},identity={email:'alex@example.test',subject:'google-fixture-sub',name:'Alex'};
 const adapter=createAuthAdapter({url:base,key:'fictional-service-key',fetcher:async(url,o)=>{calls.push({url,body:JSON.parse(o.body||'null')});return response({id:target.userId});}});await adapter.create(target,identity);assert.equal(calls[0].body.email_confirm,false);assert.equal(calls[0].body.id,target.userId);assert.ok(!('password' in calls[0].body));
});
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('the broker never falls back through a disabled legacy preflight and validates the provider endpoint',async()=>{
 const f=await fixture(),good=await f.start();assert.equal(validBrokerStartURL(good.href,base),true);
 for(const [key,value] of [['redirect_uri','https://evil.example/'],['scope','openid email profile drive'],['code_challenge_method','plain'],['response_type','token']]){
  const bad=new URL(good);bad.searchParams.set(key,value);assert.equal(validBrokerStartURL(bad.href,base),false);
 }
 const duplicate=new URL(good);duplicate.searchParams.append('state',randomToken());assert.equal(validBrokerStartURL(duplicate.href,base),false);
 const auth=base+'/auth/v1/authorize?'+new URLSearchParams({provider:'google',redirect_to:root,code_challenge:await s256(f.verifier),code_challenge_method:'s256'});
 // No DOM/valid Site Key: broker must reject rather than return direct OAuth.
 await assert.rejects(protectedGoogleURL({cloud:{config:{url:base}},authorizeURL:auth,settings:{enabled:false},broker:true}));
});
test('shared client completes only an initiated broker return, without a Google token or Supabase session in the URL',async()=>{
 const temporaryStorage=store(),calls=[];const cloud=new Cloud({url:base,publishableKey:'sb_publishable_fixture',googleBroker:{enabled:true}},{storage:store(),temporaryStorage,fetcher:async(url,o)=>{calls.push({url,body:JSON.parse(o.body||'null')});return response(url.includes('/complete')?session:session.user);}});
 assert.equal(cloud.googleBrokerEnabled,true);await cloud.oauthURL('google',root);cloud.markGoogleBroker();cloud.bindGoogleBrokerFlow('11111111-1111-4111-8111-111111111111');const record=JSON.parse(temporaryStorage.getItem(cloud.storageKey+':oauth'));
 await cloud.finishGoogleBroker('?broker_code='+randomToken()+'&broker_flow=11111111-1111-4111-8111-111111111111',root);assert.equal(cloud.user.id,session.user.id);assert.equal(calls[0].body.verifier,record.verifier);assert.equal(temporaryStorage.getItem(cloud.storageKey+':oauth'),null);
 await assert.rejects(cloud.finishGoogleBroker('?broker_code='+randomToken(),root));assert.equal(calls.length,2);
});

test('native preparation proves verifier ownership and binds a one-time browser ticket to the expected flow',async()=>{
 const f=await fixture();const r=await f.post('prepare',{verifier:f.verifier,redirectTo:root},false);assert.equal(r.status,200);const prepared=await r.json();assert.deepEqual(Object.keys(prepared).sort(),['flowId','launchTicket']);assert.equal(f.created.length,0);
 const body={token:'valid-turnstile',codeChallenge:await s256(f.verifier),redirectTo:root,launchTicket:prepared.launchTicket};
 const started=await f.post('begin',body);assert.equal(started.status,200);const result=await started.json();assert.equal(result.flowId,prepared.flowId);assert.equal((await f.post('begin',body)).status,503);
});
test('an injected callback for another server flow cannot consume a pending client login',async()=>{
 const temporaryStorage=store();let calls=0;const cloud=new Cloud({url:base,publishableKey:'sb_publishable_fixture'},{storage:store(),temporaryStorage,fetcher:async()=>{calls++;return response(session);}});await cloud.oauthURL('google',root);cloud.markGoogleBroker();cloud.bindGoogleBrokerFlow('11111111-1111-4111-8111-111111111111');
 await assert.rejects(cloud.finishGoogleBroker('?broker_code='+randomToken()+'&broker_flow=22222222-2222-4222-8222-222222222222',root));assert.equal(calls,0);assert.ok(temporaryStorage.getItem(cloud.storageKey+':oauth'));assert.equal(cloud.user,null);
});
