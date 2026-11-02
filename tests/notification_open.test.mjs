import test from 'node:test';
import assert from 'node:assert/strict';
import {NotificationCentre} from '../notifications.js';
const account='11111111-1111-4111-8111-111111111111',group='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
function fixture(cloud={}){
 let slot=null;const modals=[],routes=[],original=globalThis.document;
 globalThis.document={querySelector:()=>slot};
 const centre=new NotificationCentre({cloud,groups:()=>[{id:group,name:'Casa'}],openGroup:async(...args)=>routes.push(args),openModal:(title,html)=>{if(slot)slot.isConnected=false;slot={isConnected:true};modals.push({title,html});}});
 centre.account=account;centre.poll=async()=>{};
 return {centre,modals,routes,close:()=>{slot.isConnected=false;},restore:()=>{centre.reset();globalThis.document=original;}};
}
test('an alert opens its escaped detail; entering a group requires an explicit action',async()=>{
 const f=fixture({openNotification:async()=>({group_id:group,kind:'polls.added'})});
 try{
  f.centre.items=[{id,group_id:group,kind:'polls.added',subject:'¿Cena <script>mal</script>?',actor_name:'Ana',group_name:'Casa'}];
  await f.centre.open(id);
  assert.equal(f.routes.length,0);
  assert.match(f.modals.at(-1).html,/&lt;script&gt;mal&lt;\/script&gt;/);
  assert.doesNotMatch(f.modals.at(-1).html,/<form|planning-list-dialog/);
  await f.centre.handle({dataset:{notificationAction:'view-group'}});
  assert.deepEqual(f.routes,[[group,'polls.added']]);
 }finally{f.restore();}
});
test('a push can find an older alert without mistaking the current inbox page for its content',async()=>{
 let reads=0;const f=fixture({openNotification:async()=>({group_id:group,kind:'tasks.reminder'}),notificationInbox:async()=>{reads++;return {items:[{id,group_id:group,kind:'tasks.reminder',subject:'Pagar internet'}],next:null};}});
 try{f.centre.next={created_at:'2026-11-01',id};await f.centre.open(id);assert.equal(reads,1);assert.match(f.modals.at(-1).html,/Pagar internet/);assert.equal(f.routes.length,0);}finally{f.restore();}
});
test('closing during a delayed response does not reopen the alert',async()=>{
 let finish;const f=fixture({openNotification:()=>new Promise(resolve=>{finish=resolve;})});
 try{const pending=f.centre.open(id);f.close();finish({group_id:group,kind:'polls.added'});await pending;assert.equal(f.modals.length,1);assert.equal(f.routes.length,0);}finally{f.restore();}
});
test('a response from the previous account cannot display its alert',async()=>{
 let finish;const f=fixture({openNotification:()=>new Promise(resolve=>{finish=resolve;})});
 try{const pending=f.centre.open(id);f.centre.reset();finish({group_id:group,kind:'polls.added'});await pending;assert.equal(f.modals.length,1);assert.equal(f.routes.length,0);}finally{f.restore();}
});
