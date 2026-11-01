import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDispatcher,validEndpoint,pushPayload} from '../supabase/functions/push-dispatch/dispatch.mjs';
const notificationId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
const secret='test-dispatch-key-that-is-at-least-32-characters';
const job={id:notificationId,lease:userId,notification_id:notificationId,user_id:userId,language:'ro',kind:'tasks.added',endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'fixture',auth:'fixture'}};
test('push destinations cannot target local services, arbitrary hosts or credential URLs',()=>{
 for(const endpoint of [job.endpoint,'https://web.push.apple.com/test','https://updates.push.services.mozilla.com/wpush/v2/test','https://wns2-test.notify.windows.com/w/?token=test'])assert.equal(validEndpoint(endpoint),true,endpoint);
 for(const endpoint of ['https://127.0.0.1/test','https://fcm.googleapis.com.evil.test/a','http://fcm.googleapis.com/a','https://user@fcm.googleapis.com/a','https://fcm.googleapis.com:444/a','file:///etc/passwd'])assert.equal(validEndpoint(endpoint),false,endpoint);
 const payload=JSON.parse(pushPayload(job));assert.match(payload.body,/sarcină/);assert.equal(payload.userId,userId);assert.equal(payload.notificationId,notificationId);assert.equal(payload.url,undefined);
});
test('only a valid server dispatch key consumes queue jobs',async()=>{
 let calls=0;const handler=createDispatcher({secret,rpc:async()=>{calls++;return [];},send:async()=>{}});
 assert.equal((await handler(new Request('https://worker.test',{method:'POST'}))).status,401);assert.equal(calls,0);
 assert.equal((await handler(new Request('https://worker.test',{method:'GET',headers:{'x-dispatch-key':secret}}))).status,405);assert.equal(calls,0);
 assert.equal((await handler(new Request('https://worker.test',{method:'POST',headers:{'x-dispatch-key':secret}}))).status,200);assert.equal(calls,1);
});
test('expired endpoints are disabled; temporary failures retry without leaking response bodies',async()=>{
 const finished=[];let sends=0;
 const handler=createDispatcher({secret,rpc:async(name,args)=>name==='divzplit_claim_push'?[job,{...job,id:userId,endpoint:'https://web.push.apple.com/test'}]:finished.push(args),send:async()=>{sends++;throw {statusCode:sends===1?410:503,body:'private response'};}});
 const response=await handler(new Request('https://worker.test',{method:'POST',headers:{'x-dispatch-key':secret}}));assert.deepEqual(await response.json(),{sent:0,failed:2});
 assert.equal(finished[0].p_disable,true);assert.equal(finished[0].p_retry,false);assert.equal(finished[1].p_retry,true);assert.equal(finished[1].p_disable,false);
});
test('service worker shows only the bound account and opens only the app scope',async()=>{
 const events={},stored=new Map(),shown=[],opened=[];const scope='https://example.test/app/';
 const cache={match:async key=>stored.get(key)?.clone(),put:async(key,value)=>stored.set(key,value),delete:async key=>stored.delete(key)};
 const self={registration:{scope,showNotification:async(...args)=>shown.push(args)},clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async url=>opened.push(url)},skipWaiting:()=>{},addEventListener:(name,handler)=>events[name]=handler};
 vm.runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{self,caches:{open:async()=>cache},URL,Response});
 async function emit(type,props){let pending;events[type]({...props,waitUntil:promise=>pending=promise});await pending;}
 await emit('push',{data:{json:()=>({...job,notificationId,userId,body:'Hola'})}});assert.equal(shown.length,0);
 await emit('message',{source:{url:scope},data:{type:'SET_PUSH_ACCOUNT',userId},ports:[{postMessage:()=>{}}]});
 await emit('push',{data:{json:()=>({notificationId,userId,body:'Hola',url:'https://evil.test'})}});assert.equal(shown.length,1);
 await emit('push',{data:{json:()=>({notificationId,userId:notificationId,body:'Wrong account'})}});assert.equal(shown.length,1);
 await emit('notificationclick',{notification:{data:shown[0][1].data,close:()=>{}}});assert.equal(new URL(opened[0]).origin,'https://example.test');assert.equal(new URL(opened[0]).pathname,'/app/');
 await emit('message',{source:{url:scope},data:{type:'CLEAR_PUSH_ACCOUNT'},ports:[{postMessage:()=>{}}]});
 await emit('push',{data:{json:()=>({notificationId,userId,body:'After logout'})}});assert.equal(shown.length,1);
});

test('deployment preparation keeps secrets local, pairs VAPID keys and refuses key rotation',async()=>{
 const {mkdtemp,readFile:read,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');const {spawnSync}=await import('node:child_process');const {createECDH}=await import('node:crypto');
 const parent=await mkdtemp(path.join(tmpdir(),'divzplit-push-')),directory=path.join(parent,'private');
 try{
  const run=()=>spawnSync(process.execPath,['scripts/prepare-push.mjs','abcdefghijklmnopqrst',directory],{encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stderr);
  const env=Object.fromEntries((await read(path.join(directory,'push.env'),'utf8')).trim().split('\n').map(line=>line.split('=')));
  const key=createECDH('prime256v1');key.setPrivateKey(Buffer.from(env.VAPID_PRIVATE_KEY,'base64url'));assert.equal(key.getPublicKey().toString('base64url'),env.VAPID_PUBLIC_KEY);
  assert.ok(env.PUSH_DISPATCH_SECRET.length>=32);assert.ok(!first.stdout.includes(env.VAPID_PRIVATE_KEY));assert.ok(!first.stdout.includes(env.PUSH_DISPATCH_SECRET));
  const sql=await read(path.join(directory,'activate-push.sql'),'utf8');assert.ok(sql.includes('vault.decrypted_secrets'));assert.ok(sql.includes(env.VAPID_PUBLIC_KEY));assert.ok(sql.trim().endsWith('commit;'));
  const second=run();assert.equal(second.status,1);assert.ok((await read(path.join(directory,'push.env'),'utf8')).includes(env.VAPID_PRIVATE_KEY));
 }finally{await rm(parent,{recursive:true,force:true});}
});

test('task and poll reminder pushes use reminder copy in all supported languages',()=>{
 for(const kind of ['tasks.reminder','polls.reminder'])for(const language of ['es','en','ro']){
  const payload=JSON.parse(pushPayload({...job,kind,language}));
  assert.match(payload.body,language==='es'?/recordatorio/:language==='en'?/reminder/:/memento/);
  assert.equal(payload.notificationId,notificationId);assert.equal(payload.userId,userId);
 }
});
