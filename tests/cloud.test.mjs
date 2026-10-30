import test from 'node:test';
import assert from 'node:assert/strict';
import {Cloud, CloudError, validateConfig, mapGroup} from '../cloud.js';
import {seed} from '../model.js';
import {cloudConfig} from '../config.js';

const config={url:'https://nexo-test.supabase.co',publishableKey:'sb_publishable_test_fixture'};
const actor='11111111-1111-4111-8111-111111111111';
const user={id:actor,email:'ana@example.test',user_metadata:{display_name:'Ana'}};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k) || null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const session=()=>({access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600});
const authed=(fetcher)=>{const c=new Cloud(config,{storage:storage(),fetcher});c.user=user;c.persistSession(session());return c;};

test('cloud is opt-in and rejects privileged keys and untrusted URLs',()=>{
  assert.doesNotThrow(()=>validateConfig(cloudConfig));
  assert.equal(validateConfig({url:'',publishableKey:''}),null);
  assert.deepEqual(validateConfig(config),config);
  for(const url of ['http://nexo-test.supabase.co','https://example.com','https://nexo-test.supabase.co/path','https://user:pass@nexo-test.supabase.co']) assert.throws(()=>validateConfig({...config,url}));
  for(const publishableKey of ['sb_secret_private','private','eyJ.invalid.invalid']) assert.throws(()=>validateConfig({...config,publishableKey}));
  const encode=role=>'eyJ.'+btoa(JSON.stringify({role}))+'.signature';
  assert.throws(()=>validateConfig({...config,publishableKey:encode('service_role')}));
  assert.ok(validateConfig({...config,publishableKey:encode('anon')}));
});
test('identity mapping covers expenses, tasks, payments and vote keys without touching text',()=>{
  const g=seed().groups[0];g.name='you';g.payments=[{id:'test',from:'you',to:'marta',amount:1}];g.polls[0].votes.you='o1';
  const remote=mapGroup(g,actor,true);
  assert.equal(remote.name,'you');assert.equal(remote.members[0].id,actor);
  assert.equal(remote.expenses[0].payer,actor);assert.equal(remote.expenses[0].participants[0],actor);
  assert.equal(remote.tasks[0].assignee,actor);assert.equal(remote.payments[0].from,actor);
  assert.equal(remote.polls[0].votes[actor],'o1');assert.equal(remote.polls[0].votes.you,undefined);
  assert.deepEqual(mapGroup(remote,actor),g);assert.equal(g.members[0].id,'you');
});
test('sign-in verifies the current user, persists a session and restores it',async()=>{
  const store=storage();const seen=[];
  const fetcher=async(url,options)=>{seen.push({url,options});return url.includes('/token')?response({...session(),user}):response(user);};
  const c=new Cloud(config,{storage:store,fetcher});await c.signIn(user.email,'test-password');
  assert.equal(c.user.id,actor);assert.equal(seen[1].options.headers.Authorization,'Bearer test-access');
  const restored=new Cloud(config,{storage:store,fetcher});await restored.restore();assert.equal(restored.user.id,actor);
});
test('signup waiting for email confirmation does not invent a session',async()=>{
  let args;const c=new Cloud(config,{storage:storage(),fetcher:async(url,options)=>{args={url,body:JSON.parse(options.body)};return response({user});}});
  assert.equal(await c.signUp('ana@example.test','long-password','Ana','https://example.test/app/'),false);
  assert.equal(c.session,null);assert.equal(c.user,null);assert.equal(args.body.data.display_name,'Ana');
  assert.ok(args.url.includes('redirect_to='));
});
test('an email callback cannot log someone into an account supplied in a URL',async()=>{
  const c=new Cloud(config,{storage:storage(),fetcher:async()=>response(user)});
  assert.equal(await c.acceptCallback('#invite=abc'),false);
  assert.equal(await c.acceptCallback('#access_token=test&refresh_token=refresh&expires_in=3600'),true);
  assert.equal(c.user,null);assert.equal(c.session,null);
  await assert.rejects(()=>c.acceptCallback('#error=access_denied'),CloudError);
});
test('simultaneous expired-session requests share one refresh operation',async()=>{
  let refreshes=0;
  const c=authed(async(url)=>{
    if(url.includes('refresh_token')){refreshes++;await new Promise(resolve=>setTimeout(resolve,5));return response({...session(),access_token:'fresh'});}
    return response([]);
  });c.session.expires_at=0;
  await Promise.all([c.request('/one'),c.request('/two')]);assert.equal(refreshes,1);assert.equal(c.session.access_token,'fresh');
});
test('one 401 is retried after refresh and a persistent 401 clears the session',async()=>{
  let calls=0;
  const c=authed(async url=>url.includes('refresh_token')?response(session()):(calls++,response({message:'denied'},401)));
  await assert.rejects(()=>c.request('/private'),error=>error.status===401);
  assert.equal(calls,2);assert.equal(c.session,null);assert.equal(c.user,null);
});
test('network failures and backend text are safe, user-facing errors',async()=>{
  const c=authed(async()=>{throw new Error('private transport details');});
  await assert.rejects(()=>c.request('/private'),error=>!error.message.includes('private transport'));
  const bad=authed(async()=>response({message:'sensitive database details'},500));
  await assert.rejects(()=>bad.request('/private'),error=>!error.message.includes('sensitive'));
});
test('save uses canonical identities, the expected revision and no client membership edits',async()=>{
  const canonical=mapGroup(seed().groups[0],actor,true);canonical.id='group-id';canonical.members[0].name='Ana';
  let body;
  const c=authed(async(url,options)=>{body=JSON.parse(options.body);return response({document:canonical,owner_id:actor,version:4});});
  const local=c.rowToGroup({document:canonical,owner_id:actor,version:3});
  assert.equal(local.members[0].name,'Tú');local.name='Un plan nuevo';
  await c.saveGroup(local);
  assert.equal(body.p_version,3);assert.equal(body.p_document.members[0].name,'Ana');
  assert.equal(body.p_document.members[0].id,actor);assert.equal(body.p_document.remote,undefined);
});
test('conflicts and invalid invites are distinguishable and never become a successful save',async()=>{
  for(const code of ['NEXO_CONFLICT','NEXO_INVITE','NEXO_OWNER']) {
    const c=authed(async()=>response({code:'P0001',message:code},400));
    await assert.rejects(()=>c.rpc('test',{}),error=>error.code===code);
  }
});
test('group lists are not delivered to an account that changed during the request',async()=>{
  let finish;const c=authed(()=>new Promise(resolve=>finish=resolve));
  const request=c.listGroups();await new Promise(resolve=>setTimeout(resolve,0));
  c.user={id:'another-user'};finish(response([]));
  await assert.rejects(()=>request,error=>error.code==='session');
});
test('sign-out clears local authentication even when server logout is unreachable',async()=>{
  const c=authed(async()=>{throw new Error('offline');});
  await assert.rejects(()=>c.signOut());assert.equal(c.user,null);assert.equal(c.session,null);
});
test('restoring a signed-out tab removes the previous account identity',async()=>{
  const c=authed(async()=>response(user));
  c.storage.removeItem(c.storageKey);
  assert.equal(await c.restore(),null);assert.equal(c.user,null);
});
test('provider availability comes from Auth settings rather than assuming Google or Apple works',async()=>{
  const c=new Cloud(config,{storage:storage(),fetcher:async()=>response({external:{google:true,apple:false,email:true}})});
  assert.deepEqual(await c.providers(),{google:true,apple:false});
});
test('OAuth stores a verifier only in this tab and sends its SHA-256 challenge in the authorize URL',async()=>{
  const temporaryStorage=storage();
  const c=new Cloud(config,{storage:storage(),temporaryStorage});
  const url=new URL(await c.oauthURL('google','https://example.test/app/'));
  assert.equal(url.origin,config.url);assert.equal(url.pathname,'/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('code_challenge_method'),'s256');
  const record=JSON.parse(temporaryStorage.getItem(c.storageKey+':oauth'));
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(record.verifier))).toString('base64url');
  assert.equal(url.searchParams.get('code_challenge'),hash);
  assert.equal(c.storage.getItem(c.storageKey+':oauth'),null);
  assert.ok(!url.href.includes(record.verifier));assert.ok(!url.href.includes(config.publishableKey));
});
test('an OAuth code is exchanged with its bound verifier, verified, and cannot be replayed',async()=>{
  const seen=[];const temporaryStorage=storage();
  const c=new Cloud(config,{storage:storage(),temporaryStorage,fetcher:async(url,options)=>{
    seen.push({url,options});return url.includes('/token')?response({...session(),user}):response(user);
  }});
  await c.oauthURL('apple','https://example.test/app/');
  const {verifier}=JSON.parse(temporaryStorage.getItem(c.storageKey+':oauth'));
  assert.equal(await c.finishOAuth('?code=provider-code','https://example.test/app/'),true);
  assert.equal(c.user.id,actor);
  assert.deepEqual(JSON.parse(seen[0].options.body),{auth_code:'provider-code',code_verifier:verifier});
  assert.ok(seen[0].url.includes('grant_type=pkce'));assert.equal(seen[1].options.headers.Authorization,'Bearer test-access');
  assert.equal(temporaryStorage.getItem(c.storageKey+':oauth'),null);
  await assert.rejects(()=>c.finishOAuth('?code=provider-code','https://example.test/app/'),CloudError);
});
test('OAuth refuses unsolicited, expired and wrong-page callbacks before any token exchange',async()=>{
  let calls=0;const temporaryStorage=storage();
  const c=new Cloud(config,{storage:storage(),temporaryStorage,fetcher:async()=>{calls++;return response({});}});
  await assert.rejects(()=>c.finishOAuth('?code=unbound','https://example.test/app/'),CloudError);
  await c.oauthURL('google','https://example.test/app/');
  const record=JSON.parse(temporaryStorage.getItem(c.storageKey+':oauth'));
  temporaryStorage.setItem(c.storageKey+':oauth',JSON.stringify({...record,createdAt:Date.now()-16*60000}));
  await assert.rejects(()=>c.finishOAuth('?code=expired','https://example.test/app/'),CloudError);
  await c.oauthURL('google','https://example.test/app/');
  await assert.rejects(()=>c.finishOAuth('?code=wrong-route','https://example.test/other/'),CloudError);
  await assert.rejects(()=>c.finishOAuth('?error=access_denied','https://example.test/app/'),error=>error.message.includes('cancelado'));
  assert.equal(calls,0);assert.equal(c.session,null);
});
test('OAuth requires safe storage, a secure return URL and a supported provider',async()=>{
  const blocked={setItem(){throw new Error('blocked');},getItem(){return null;}};
  const c=new Cloud(config,{storage:storage(),temporaryStorage:blocked});
  await assert.rejects(()=>c.oauthURL('google','https://example.test/app/'),CloudError);
  await assert.rejects(()=>c.oauthURL('google','http://example.test/app/'),CloudError);
  await assert.rejects(()=>c.oauthURL('other','https://example.test/app/'),CloudError);
});
test('a social profile name is normalized using only the signed-in user endpoint',async()=>{
  let updated=false;const temporaryStorage=storage();
  const socialUser={...user,user_metadata:{full_name:'Ana Social'}};
  const c=new Cloud(config,{storage:storage(),temporaryStorage,fetcher:async(url,options)=>{
    if(url.includes('/token'))return response({...session(),user:socialUser});
    if(options.method==='PUT'){
      assert.equal(options.headers.Authorization,'Bearer test-access');
      assert.deepEqual(JSON.parse(options.body),{data:{display_name:'Ana Social'}});updated=true;
      return response({...socialUser,user_metadata:{...socialUser.user_metadata,display_name:'Ana Social'}});
    }
    return response(socialUser);
  }});
  await c.oauthURL('google','https://example.test/app/');
  await c.finishOAuth('?code=valid','https://example.test/app/');
  assert.equal(updated,true);assert.equal(c.user.user_metadata.display_name,'Ana Social');
});

 test('signup distinguishes a lost response from rejection and does not retry registration',async()=>{
   let calls=0;
   const c=new Cloud(config,{fetcher:async()=>{calls++;throw new DOMException('transport details','TimeoutError');},storage:storage()});
   await assert.rejects(()=>c.signUp('ana@example.test','fixture-password','Ana','https://example.test/'),e=>e.code==='signup_timeout'&&e.message.includes('Revisa tu correo'));
   assert.equal(calls,1);assert.equal(c.session,null);
 });

test('signup reports email delivery configuration errors without exposing backend details',async()=>{
 const c=new Cloud(config,{storage:storage(),fetcher:async()=>response({code:500,error_code:'unexpected_failure',msg:'Error sending confirmation email'},500)});
 await assert.rejects(()=>c.signUp('ana@example.test','fixture-password','Ana','https://example.test/'),e=>e.code==='unexpected_failure'&&e.message.includes('configuración de envío'));
});

test('browser fetch is invoked with its global receiver',async()=>{
 let called=false;
 const c=new Cloud(config,{storage:storage(),fetcher:async function(){assert.equal(this,globalThis);called=true;return response({external:{email:true}});}});
 await c.providers();assert.equal(called,true);
});
