import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
import * as model from '../../model.js';
import {Cloud,mapGroup} from '../../cloud.js';
import {legalMetadata} from '../../legal.js';
import * as extras from '../../extras.js';

function fixture(){
 const group=structuredClone(model.seed().groups[0]);group.expenses=[];group.remote={ownerId:'owner',version:1};
 const storage=new Map();
 const cloud={user:{id:'owner',email:'test@example.invalid'},storageKey:'test',async saveGroup(g){return g;}};
 const c=new NativeController({cloud,model,extras,i18n:{tr:v=>v},native:{},platform:{storage:{getItem:k=>storage.get(k)||null},temporaryStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},flush:async()=>{}}});
 c.update({user:cloud.user,groups:[group],groupId:group.id});return {c,cloud,group,storage};
}
const fields={title:'Dinner',amount:1001,payer:'you',participants:['you','marta','pablo'],date:'2026-11-17',category:'Comida'};

test('failed financial save leaves the visible group untouched and unlocks retry',async()=>{
 const {c,cloud,group}=fixture();cloud.saveGroup=async()=>{throw new Error('Offline');};
 await assert.rejects(c.saveExpense(fields,null,'stable-id'),/Offline/);
 assert.equal(group.expenses.length,0);assert.equal(c.group.expenses.length,0);assert.equal(c.state.busy,false);
 cloud.saveGroup=async g=>g;await c.saveExpense(fields,null,'stable-id');
 assert.equal(c.group.expenses[0].id,'stable-id');
 assert.equal(Object.values(model.balances(c.group)).reduce((a,b)=>a+b,0),0);
});
test('a refreshed successful expense is updated rather than duplicated on form retry',async()=>{
 const {c}=fixture();await c.saveExpense(fields,null,'stable-id');await c.saveExpense(fields,null,'stable-id');
 assert.equal(c.group.expenses.length,1);assert.equal(c.group.expenses[0].amount,1001);
});
test('concurrent financial mutations are blocked until the server responds',async()=>{
 const {c,cloud}=fixture();let release;cloud.saveGroup=g=>new Promise(resolve=>{release=()=>resolve(g);});
 const saving=c.saveExpense(fields);await assert.rejects(c.saveExpense(fields),/operación actual/);release();await saving;
 assert.equal(c.group.expenses.length,1);
});
test('other member expenses cannot be edited by a nonowner',async()=>{
 const {c,cloud,group}=fixture();group.remote.ownerId='someone-else';
 group.expenses.push({...fields,id:'foreign',createdBy:'someone-else'});let called=false;cloud.saveGroup=async()=>{called=true;};
 await assert.rejects(c.saveExpense(fields,'foreign'),/permiso/);assert.equal(called,false);
});
test('activity consumes the existing events/requests API contract',async()=>{
 const {c,cloud}=fixture();const requests=[{id:'request',from_id:'owner',to_id:'friend',amount:100}];
 cloud.readActivity=async()=>({events:[{id:'event'}],requests});await c.activity();assert.deepEqual(c.state.paymentRequests,requests);assert.equal(c.state.history[0].id,'event');
});
test('OAuth callback rejects external origins and requires stored PKCE state',async()=>{
 const {c,cloud,storage}=fixture();cloud.user=null;let finished=0;cloud.finishOAuth=async()=>{finished++;};
 assert.equal(await c.handleURL('https://evil.invalid/?code=secret'),false);
 assert.equal(await c.handleURL('https://divzplit.com.evil.invalid/?code=secret'),false);
 await assert.rejects(c.handleURL('https://divzplit.com/?code=expired'),/caducado/);
 assert.equal(finished,0);storage.set('test:oauth','record');
 assert.equal(await c.handleURL('https://divzplit.com/?code=fresh',false),true);
 await c.handleURL('https://divzplit.com/?code=fresh',false);assert.equal(finished,1);
});
test('late activity replies do not overwrite a newly selected group',async()=>{
 const {c,cloud}=fixture();let complete;cloud.readActivity=()=>new Promise(resolve=>complete=resolve);
 const request=c.activity();c.update({groups:[],groupId:null});complete({events:[{id:'old'}],requests:[]});await request;
 assert.deepEqual(c.state.history,[]);
});

test('native expense submission uses the existing Cloud identity and version contract',async()=>{
 const actor='11111111-1111-4111-8111-111111111111';const stored=new Map();
 const storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 let payload;
 const cloud=new Cloud({url:'https://native-fixture.supabase.co',publishableKey:'sb_publishable_test_fixture'}, {storage,fetcher:async(url,options)=>{
  assert.ok(url.endsWith('/rpc/nexo_save_group'));payload=JSON.parse(options.body);
  return new Response(JSON.stringify({document:payload.p_document,version:2,owner_id:actor}),{headers:{'Content-Type':'application/json'}});
 }});
 cloud.user={id:actor};cloud.persistSession({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600});
 const {c,group}=fixture();c.cloud=cloud;group.remote={ownerId:actor,version:1};
 await c.saveExpense(fields,null,'stable-id');
 assert.equal(payload.p_version,1);assert.equal(payload.p_document.expenses[0].payer,actor);
 assert.equal(payload.p_document.expenses[0].createdBy,actor);assert.equal(c.group.expenses[0].payer,'you');
 assert.equal(c.group.remote.version,2);
 assert.deepEqual(mapGroup(payload.p_document,actor).expenses,c.group.expenses);
});

test('native registration consent accepts the exact existing legal age-band value',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/App.js',import.meta.url),'utf8');
 const choices=[...source.matchAll(/age\?'([^']+)':''/g)];assert.equal(choices.length,2);
 for(const choice of choices)assert.doesNotThrow(()=>legalMetadata(true,choice[1],'google'));
});

test('receipt upload survives a failed expense save without a second upload on retry',async()=>{
 const {c,cloud}=fixture();let uploads=0,saves=0;
 const photo={id:'selected-image',type:'image/jpeg',size:3,base64:'AQID'};
 cloud.uploadReceipt=async()=>{uploads++;return {path:'private/receipt.jpg'};};
 cloud.saveGroup=async group=>{if(++saves===1)throw new Error('Offline');return group;};
 await assert.rejects(c.saveExpense(fields,null,'expense',{photo,groupId:c.group.id}),/Offline/);
 assert.equal(c.group.expenses.length,0);
 await c.saveExpense(fields,null,'expense',{photo,groupId:c.group.id});
 assert.equal(uploads,1);assert.equal(c.group.expenses.length,1);assert.deepEqual(c.group.expenses[0].receipt,{path:'private/receipt.jpg'});
});
test('validation and group checks happen before uploading a photo or saving money',async()=>{
 const {c,cloud}=fixture();let uploads=0;cloud.uploadReceipt=async()=>{uploads++;};
 await assert.rejects(c.saveExpense({...fields,amount:0},null,'expense',{photo:{id:'image'}}));
 await assert.rejects(c.saveExpense(fields,null,'expense',{groupId:'different',photo:{id:'image'}}),/grupo ha cambiado/);
 assert.equal(uploads,0);assert.equal(c.group.expenses.length,0);
});
test('the old receipt is removed only after an edited expense is saved successfully',async()=>{
 const {c,cloud}=fixture();await c.saveExpense(fields,null,'expense');c.group.expenses[0].receipt={path:'old.jpg'};
 const calls=[];cloud.deleteReceipt=async()=>calls.push('delete');cloud.saveGroup=async()=>{calls.push('save');throw new Error('Offline');};
 await assert.rejects(c.saveExpense(fields,'expense',null,{removeReceipt:true}),/Offline/);
 assert.deepEqual(calls,['save']);assert.equal(c.group.expenses[0].receipt.path,'old.jpg');
 cloud.saveGroup=async group=>{calls.push('saved');return group;};await c.saveExpense(fields,'expense',null,{removeReceipt:true});
 assert.deepEqual(calls,['save','saved','delete']);assert.equal(c.group.expenses[0].receipt,undefined);
});
test('a changed account during upload cannot attach its predecessor receipt to a group',async()=>{
 const {c,cloud}=fixture();let saved=false;
 cloud.uploadReceipt=async()=>{cloud.user={id:'new-account'};return {path:'old-account/photo.jpg'};};cloud.saveGroup=async()=>{saved=true;};
 await assert.rejects(c.saveExpense(fields,null,'expense',{photo:{id:'image'}}),/grupo ha cambiado/);assert.equal(saved,false);
});
test('monthly recurrence preserves its calendar anchor and is not reactivated by editing',async()=>{
 const {c}=fixture();await c.saveExpense({...fields,date:'2026-01-31'},null,'series',{frequency:'monthly'});
 assert.deepEqual(c.group.expenses[0].recurrence,{frequency:'monthly',active:true,anchorDay:31,nextDate:'2026-02-28'});
 await assert.rejects(c.saveExpense({...fields,date:'2026-02-01'},'series'),/Detén/);
 await c.changeExpense('series','stop',c.group.id);
 await c.saveExpense({...fields,date:'2026-02-01'},'series',null,{frequency:'weekly'});
 assert.equal(c.group.expenses[0].recurrence.active,false);assert.equal(c.group.expenses[0].recurrence.frequency,'monthly');
});
test('refresh materializes authorized recurring charges once and never inherits a receipt',async()=>{
 const RealDate=globalThis.Date;
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-03-31T12:00:00Z']));}static now(){return new RealDate('2026-03-31T12:00:00Z').valueOf();}};
 try{
  const {c,cloud}=fixture();await c.saveExpense({...fields,date:'2026-01-31'},null,'series',{frequency:'monthly'});c.group.expenses[0].receipt={path:'original.jpg'};
  let stored=structuredClone(c.group),writes=0;c.syncPush=async()=>{};
  cloud.listGroups=async()=>[structuredClone(stored)];cloud.saveGroup=async draft=>{writes++;stored=structuredClone(draft);return draft;};
  await c.refresh();await c.refresh();
  assert.equal(writes,1);assert.deepEqual(c.group.expenses.map(e=>e.date),['2026-03-31','2026-02-28','2026-01-31']);
  for(const expense of c.group.expenses.slice(0,2)){assert.equal(expense.seriesId,'series');assert.equal(expense.createdBy,'owner');assert.equal(expense.receipt,undefined);}
  assert.equal(c.group.expenses.at(-1).recurrence.nextDate,'2026-04-30');
 }finally{globalThis.Date=RealDate;}
});
test('deleting a source leaves previously generated charges and enforces creator/owner permissions',async()=>{
 const {c,cloud}=fixture();await c.saveExpense(fields,null,'series');c.group.expenses.push({...fields,id:'past',seriesId:'series',createdBy:'owner'});
 await c.changeExpense('series','delete',c.group.id);assert.deepEqual(c.group.expenses.map(e=>e.id),['past']);
 c.group.remote.ownerId='another';cloud.user={id:'outsider'};
 await assert.rejects(c.changeExpense('past','delete',c.group.id),/permiso/);assert.equal(c.group.expenses.length,1);
});
test('simultaneous refreshes share one recurring save and unauthorized sources stay untouched',async()=>{
 const {c,cloud}=fixture();await c.saveExpense({...fields,date:'2020-01-31'},null,'series',{frequency:'monthly'});
 let reads=0,writes=0;c.syncPush=async()=>{};
 cloud.listGroups=async()=>{reads++;return [structuredClone(c.group)];};cloud.saveGroup=async draft=>{writes++;return draft;};
 await Promise.all([c.refresh(),c.refresh(),c.refresh()]);assert.equal(reads,1);assert.equal(writes,1);
 c.group.remote.ownerId='different';cloud.user={id:'another'};const before=structuredClone(c.group.expenses);
 await c.refresh();assert.equal(writes,1);assert.deepEqual(c.group.expenses,before);
});
