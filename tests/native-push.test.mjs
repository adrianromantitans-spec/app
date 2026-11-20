import test from 'node:test';
import assert from 'node:assert/strict';
import {NotificationCentre,pushEnvironment} from '../notifications.js';
import {createNativeDispatcher,validToken} from '../supabase/functions/native-push-dispatch/dispatch.mjs';
import {createFcmSender} from '../supabase/functions/native-push-dispatch/fcm.mjs';
const account='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const token='fictional_native_token_123456789';
test('native notifications use each device language for all event categories and reminders',async()=>{
 const expected={
  es:['Hay productos nuevos en la lista de la compra.','Hay novedades en los gastos de tu grupo.','Tienes una nueva votación en tu grupo.','Tienes una nueva tarea asignada.','Hay novedades sobre un pago de tu grupo.','Quedan productos por comprar en tu grupo.','Tienes un recordatorio de tu grupo.'],
  en:['There are new products on the shopping list.','There are expense updates in your group.','There is a new poll in your group.','You have a new task assigned.','There is a payment update in your group.','There are still products to buy in your group.','You have a reminder from your group.'],
  ro:['Sunt produse noi în lista de cumpărături.','Sunt noutăți despre cheltuielile grupului.','Ai un sondaj nou în grup.','Ai o sarcină nouă atribuită.','Sunt noutăți despre o plată din grup.','Mai sunt produse de cumpărat în grup.','Ai un memento din grupul tău.']
 };
 const kinds=['shopping.added','expenses.added','polls.created','tasks.assigned','payments.requested','shopping.reminder','tasks.reminder'];
 for(const language of ['es','en','ro']){
  const sent=[];const dispatch=createNativeDispatcher({secret:'s'.repeat(40),rpc:async name=>name==='divzplit_claim_native_push'?kinds.map((kind,i)=>({id:String(i),lease:'fixture',notification_id:account,user_id:other,kind,language,token})):true,send:async(t,payload)=>sent.push(payload.body)});
  const response=await dispatch(new Request('https://fixture.invalid/',{method:'POST',headers:{'x-dispatch-key':'s'.repeat(40)}}));assert.equal(response.status,200);assert.deepEqual(sent,expected[language]);assert.ok(sent.every(body=>!body.includes('DivZplit')));
 }
});
function setup(permission='granted'){
 const calls=[];
 globalThis.document={querySelector:()=>null};
 globalThis.divzplitNativePush={permission,state:async()=>({userId:account,token,enabled:true,permission}),requestPermission:async()=>permission,token:async()=>{calls.push('token');return token;},bind:async user=>calls.push(['bind',user]),clear:async()=>calls.push('clear')};
 const c=new NotificationCentre({cloud:{rpc:async(name,args)=>calls.push([name,args])},openModal(){},toast(){},groups:()=>[],closeModal(){}});
 c.account=account;c.settings={push_ready:true};c.deviceSync=Promise.resolve();c.showPreferences=()=>{};return {c,calls};
}
test('native notification permission, registration and binding preserve consent and account boundaries',async()=>{
 try{
  const {c,calls}=setup();assert.equal(pushEnvironment().native,true);await c.enable();
  assert.equal(c.enabled,true);assert.equal(calls[0],'token');assert.equal(calls[1][0],'divzplit_register_native_push');assert.deepEqual(calls[2],['bind',account]);
  await c.disconnect();assert.equal(c.account,null);assert.ok(calls.includes('clear'));assert.equal(calls.at(-1)[0],'divzplit_remove_native_push');
  const denied=setup('denied');await denied.c.enable();assert.equal(denied.c.enabled,false);assert.deepEqual(denied.calls,[]);
  const mismatch=setup();globalThis.divzplitNativePush.state=async()=>({userId:other,enabled:true,token,permission:'granted'});await mismatch.c.syncDevice(account);assert.equal(mismatch.c.enabled,false);assert.deepEqual(mismatch.calls,['clear']);
  const switched=setup();let release,started;
  const begun=new Promise(r=>started=r);const gate=new Promise(r=>release=r);
  switched.c.cloud.rpc=async(name,args)=>{switched.calls.push([name,args]);if(name==='divzplit_register_native_push'){started();await gate;}};
  const enable=switched.c.enable();await begun;switched.c.account=other;release();await enable;
  assert.ok(!switched.calls.some(x=>Array.isArray(x)&&x[0]==='bind'));assert.equal(switched.calls.at(-1)[0],'divzplit_remove_native_push');
 }finally{delete globalThis.divzplitNativePush;delete globalThis.document;}
});
test('native sender authenticates before claiming, validates payloads and handles token expiry/retry',async()=>{
 const secret='x'.repeat(40),done=[];let claims=0;
 const jobs=[200,410,429].map((status,i)=>({id:String(i),lease:'lease',notification_id:account,user_id:other,kind:'expenses.added',language:'ro',token:token+status,status}));
 const handler=createNativeDispatcher({secret,rpc:async(name,args)=>{if(name==='divzplit_claim_native_push'){claims++;return jobs;}done.push(args);},send:async(t,payload)=>{assert.equal(payload.userId,other);assert.equal(payload.notificationId,account);assert.equal(payload.title,'DivZplit');if(!t.endsWith('200'))throw Object.assign(new Error('fixture'),{statusCode:Number(t.slice(-3))});}});
 assert.equal((await handler(new Request('https://fixture.test',{method:'POST'}))).status,401);assert.equal(claims,0);
 const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{'x-dispatch-key':secret}}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{sent:1,failed:2});
 assert.equal(done.find(x=>x.p_status===410).p_disable,true);assert.equal(done.find(x=>x.p_status===429).p_retry,true);
 assert.ok(validToken(token));for(const bad of ['https://evil.test/', '', 'x\n'.repeat(30),null])assert.equal(validToken(bad),false);
});
test('FCM signs a service-account assertion, caches OAuth access and uses only fixed Google endpoints',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const der=await crypto.subtle.exportKey('pkcs8',keys.privateKey),private_key='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(der).toString('base64')+'\n-----END PRIVATE KEY-----';
 const credentials={project_id:'divzplit-1ce52',client_email:'fixture@divzplit-1ce52.iam.gserviceaccount.com',private_key};let authCalls=0,deliveries=0;
 const fetcher=async(url,options)=>{
  assert.equal(options.redirect,'error');
  if(url==='https://oauth2.googleapis.com/token'){
   authCalls++;const assertion=new URLSearchParams(options.body).get('assertion'),[h,p,s]=assertion.split('.');
   assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(s,'base64url'),new TextEncoder().encode(h+'.'+p)));
   const payload=JSON.parse(Buffer.from(p,'base64url'));assert.equal(payload.iss,credentials.client_email);assert.equal(payload.aud,url);
   return Response.json({access_token:'fictional-server-access',expires_in:3600});
  }
  assert.equal(url,'https://fcm.googleapis.com/v1/projects/divzplit-1ce52/messages:send');deliveries++;
  const body=JSON.parse(options.body);assert.equal(body.message.token,token);assert.equal(body.message.notification,undefined,'must be data-only for local account checks');
  assert.equal(options.headers.Authorization,'Bearer fictional-server-access');return Response.json({name:'fixture'});
 };
 const send=createFcmSender({credentials,projectId:credentials.project_id,fetcher});await Promise.all([send(token,{body:'test'}),send(token,{body:'test'})]);assert.equal(authCalls,1);assert.equal(deliveries,2);
 assert.throws(()=>createFcmSender({credentials,projectId:'different-project',fetcher}));
 const expired=createFcmSender({credentials,projectId:credentials.project_id,fetcher:async(url,o)=>url.includes('oauth2')?fetcher(url,o):Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404})});
 await assert.rejects(expired(token,{body:'test'}),error=>error.statusCode===410);
});
