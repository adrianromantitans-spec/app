import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
import * as model from '../../model.js';
import {Cloud,mapGroup} from '../../cloud.js';
import {legalMetadata} from '../../legal.js';
import * as extras from '../../extras.js';
import * as planning from '../../planning.js';

function fixture(){
 const group=structuredClone(model.seed().groups[0]);group.expenses=[];group.remote={ownerId:'owner',version:1};
 const storage=new Map();
 const cloud={user:{id:'owner',email:'test@example.invalid'},storageKey:'test',async saveGroup(g){return g;},async paymentArchives(){return [];}};
 const c=new NativeController({cloud,model,extras,planning,i18n:{tr:v=>v},native:{},platform:{storage:{getItem:k=>storage.get(k)||null},temporaryStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},flush:async()=>{}}});
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
 const {c,group}=fixture();c.cloud=cloud;c.update({user:cloud.user});group.remote={ownerId:actor,version:1};
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
 c.group.remote.ownerId='another';cloud.user={id:'outsider'};c.update({user:cloud.user});
 await assert.rejects(c.changeExpense('past','delete',c.group.id),/permiso/);assert.equal(c.group.expenses.length,1);
});
test('simultaneous refreshes share one recurring save and unauthorized sources stay untouched',async()=>{
 const {c,cloud}=fixture();await c.saveExpense({...fields,date:'2020-01-31'},null,'series',{frequency:'monthly'});
 // The server snapshot is independent of client state, which is cleared on an account change.
 let reads=0,writes=0,stored=structuredClone(c.group);c.syncPush=async()=>{};
 cloud.listGroups=async()=>{reads++;return [structuredClone(stored)];};cloud.saveGroup=async draft=>{writes++;stored=structuredClone(draft);return draft;};
 await Promise.all([c.refresh(),c.refresh(),c.refresh()]);assert.equal(reads,1);assert.equal(writes,1);
 c.group.remote.ownerId='different';stored.remote.ownerId='different';cloud.user={id:'another'};const before=structuredClone(c.group.expenses);
 await c.refresh();assert.equal(writes,1);assert.deepEqual(c.group.expenses,before);
});

test('planning edits preserve poll options and votes and reject nonowner changes before HTTP',async()=>{
 const {c,cloud,group}=fixture();const poll={id:'poll',title:'Food',description:'',createdBy:'owner',options:[{id:'a',label:'A'},{id:'b',label:'B'}],votes:{marta:'a'},dueAt:'',remindAt:''};group.polls=[poll];
 let payload;cloud.planningAction=async(g,kind,action,item)=>{payload=item;const draft=structuredClone(g);draft.polls[0]={...draft.polls[0],...item};return draft;};
 await c.plan('polls','save',{id:'poll',title:'Dinner',options:['Replacement','Wrong'],description:'Tonight'},group.id,true);
 assert.deepEqual(payload.options,poll.options);assert.equal(payload.votes,undefined);assert.deepEqual(c.group.polls[0].votes,{marta:'a'});
 cloud.user={id:'outsider'};c.update({user:cloud.user});payload=null;
 await assert.rejects(c.plan('polls','save',{id:'poll',title:'Unauthorized'},group.id,true),/permiso/);assert.equal(payload,null);
 await assert.rejects(c.plan('polls','clear',{},group.id),/permiso/);
});
test('planning scheduling preserves existing seconds, validates future order and membership',async()=>{
 const {c,cloud,group}=fixture();group.tasks=[{id:'task',title:'Book',createdBy:'owner',done:true,assignee:'you',dueAt:'2099-07-10T14:35:29.000Z',remindAt:'',important:false}];
 let payload;cloud.planningAction=async(g,k,a,item)=>{payload=item;return {...g,tasks:[{...g.tasks[0],...item}]};};
 const dueAt=planning.localDateTime(group.tasks[0].dueAt);
 await c.plan('tasks','save',{id:'task',title:'Book hotel',assignee:'you',dueAt,important:true},group.id,true);
 assert.equal(payload.dueAt,'2099-07-10T14:35:29.000Z');assert.equal(payload.done,undefined);assert.equal(c.group.tasks[0].done,true);
 await assert.rejects(c.plan('tasks','save',{id:'task',title:'Book',assignee:'you',dueAt:'2099-01-01T10:00',remindAt:'2099-01-01T11:00'},group.id,true),/anterior/);
 await assert.rejects(c.plan('tasks','save',{id:'task',title:'Book',assignee:'outsider'},group.id,true),/persona/);
 await assert.rejects(c.plan('tasks','save',{id:'deleted',title:'Book',assignee:'you'},group.id,true),/ya no existe/);
});
test('new polls validate distinct choices and use stable item IDs on failed-save retries',async()=>{
 const {c,cloud,group}=fixture();group.polls=[];let requests=[];
 cloud.planningAction=async(g,k,a,item)=>{requests.push(item);throw new Error('Offline');};
 await assert.rejects(c.plan('polls','save',{id:'stable',title:'Dinner?',options:['A','a']},group.id),/diferentes/);assert.equal(requests.length,0);
 const fields={id:'stable',title:'Dinner?',options:['A','B']};
 await assert.rejects(c.plan('polls','save',fields,group.id),/Offline/);
 await assert.rejects(c.plan('polls','save',fields,group.id),/Offline/);
 assert.equal(requests[0].id,requests[1].id);assert.equal(c.group.polls.length,0);
});
test('closed polls cannot vote and a failed completion does not change the visible task',async()=>{
 const {c,cloud,group}=fixture();group.polls=[{id:'poll',dueAt:'2020-01-01T12:00:00Z',options:[{id:'a'}],votes:{}}];group.tasks=[{id:'task',done:false}];let writes=0;
 cloud.saveGroup=async()=>{writes++;throw new Error('Offline');};
 await assert.rejects(c.vote({id:'poll'},'a',group.id),/cerrada/);assert.equal(writes,0);
 await assert.rejects(c.task({id:'task'},group.id),/Offline/);assert.equal(c.group.tasks[0].done,false);
});
test('shopping applies versioned edits and ignores late replies after group or account changes',async()=>{
 const {c,cloud,group}=fixture();const row={id:'milk',title:'Milk',version:2,created_by:'owner',bought:false};c.update({shopping:[row],shoppingGroupId:group.id});let finish;
 cloud.shoppingAction=()=>new Promise(resolve=>finish=resolve);
 const pending=c.shoppingAction('edit',{id:'milk',version:2,title:'Milk 2',quantity:'1'},group.id);
 c.update({groups:[],groupId:null,shopping:[],shoppingGroupId:null});finish([{...row,title:'Old group'}]);await pending;assert.deepEqual(c.state.shopping,[]);
 c.update({groups:[group],groupId:group.id,shopping:[row],shoppingGroupId:group.id});
 const pendingAccount=c.shoppingAction('edit',{id:'milk',version:2,title:'Milk 3'},group.id);
 cloud.user={id:'new-account'};finish([{...row,title:'Old account'}]);await pendingAccount;assert.deepEqual(c.state.shopping,[]);assert.equal(c.state.user.id,'new-account');
});
test('shopping permissions, stale versions and linked-item locks reject before mutation',async()=>{
 const {c,cloud,group}=fixture();const row={id:'milk',version:3,created_by:'other',expense_id:'expense',bought:true};c.update({shopping:[row],shoppingGroupId:group.id});let requests=0;
 cloud.shoppingAction=async()=>{requests++;return [];};
 await assert.rejects(c.shoppingAction('check',{id:'milk',version:2,bought:false},group.id),/ha cambiado/);
 await assert.rejects(c.shoppingAction('check',{id:'milk',version:3,bought:false},group.id),/vinculado/);
 group.remote.ownerId='other';await assert.rejects(c.shoppingAction('delete',{id:'milk',version:3},group.id),/permiso/);
 await assert.rejects(c.shoppingAction('clear',{},group.id),/administrador/);assert.equal(requests,0);
});
test('only the latest shopping read can update a group and failed reads disable checkout',async()=>{
 const {c,cloud,group}=fixture();const replies=[];cloud.shoppingList=()=>new Promise(resolve=>replies.push(resolve));
 const first=c.shopping(),second=c.shopping();replies[1]([{id:'new'}]);await second;replies[0]([{id:'old'}]);await first;
 assert.equal(c.state.shopping[0].id,'new');assert.equal(c.state.shoppingLoading,false);
 cloud.shoppingList=async()=>{throw new Error('Offline');};await assert.rejects(c.shopping(),/Offline/);assert.equal(c.state.shoppingGroupId,null);assert.equal(c.state.shoppingError,'Offline');
});
test('shopping checkout uses a single atomic save and retries its stable expense ID',async()=>{
 const {c,cloud,group}=fixture();const row={id:'milk',version:1,bought:true,expense_id:null};c.update({shopping:[row],shoppingGroupId:group.id});let saved=null,calls=[];
 cloud.saveGroup=async(draft,checkout)=>{calls.push(checkout);if(!saved){saved=structuredClone(draft);throw new Error('Response lost');}return saved;};
 cloud.shoppingList=async()=>[{...row,expense_id:'stable-expense'}];
 await assert.rejects(c.saveExpense(fields,null,'stable-expense',{groupId:group.id,checkout:['milk']}),/Response lost/);
 assert.equal(c.group.expenses.length,0);assert.equal(c.state.shopping[0].expense_id,null);
 await c.saveExpense(fields,null,'stable-expense',{groupId:group.id,checkout:['milk']});
 assert.deepEqual(calls,[{expenseId:'stable-expense',items:['milk']},{expenseId:'stable-expense',items:['milk']}]);
 assert.equal(c.group.expenses.length,1);assert.equal(c.state.shopping[0].expense_id,'stable-expense');
});
test('checkout rejects changed selection and refresh failure cannot undo a confirmed expense',async()=>{
 const {c,cloud,group}=fixture();c.update({shopping:[{id:'milk',bought:false}],shoppingGroupId:group.id});let writes=0;
 cloud.saveGroup=async draft=>{writes++;return draft;};
 await assert.rejects(c.saveExpense(fields,null,'expense',{checkout:['milk']}),/ha cambiado/);assert.equal(writes,0);
 c.update({shopping:[{id:'milk',bought:true}]});cloud.shoppingList=async()=>{throw new Error('Offline');};
 await c.saveExpense(fields,null,'expense',{checkout:['milk']});assert.equal(writes,1);assert.equal(c.group.expenses.length,1);assert.match(c.state.notice,/se ha guardado/);
});
test('reminders enforce edit permissions and completion and preserve shopping request ID',async()=>{
 const {c,cloud,group}=fixture();group.tasks=[{id:'task',createdBy:'other',done:false}];group.remote.ownerId='other';let calls=0;
 cloud.remindPlan=async()=>{calls++;return 2;};
 await assert.rejects(c.remind('tasks','task',group.id),/permiso/);
 group.remote.ownerId='owner';group.tasks[0].done=true;await assert.rejects(c.remind('tasks','task',group.id),/terminado/);assert.equal(calls,0);
 c.update({shopping:[{id:'milk',bought:false}],shoppingGroupId:group.id});cloud.remindShopping=async(id,request)=>{assert.equal(id,group.id);assert.equal(request,'stable-reminder');return 2;};
 await c.remind('shopping',null,group.id,'stable-reminder');assert.match(c.state.notice,/Recordatorio enviado/);
});
test('native checkout reaches the existing atomic RPC with canonical identity and item IDs',async()=>{
 const actor='11111111-1111-4111-8111-111111111111',product='22222222-2222-4222-8222-222222222222',stored=new Map();let payload,endpoint;
 const storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 const cloud=new Cloud({url:'https://native-fixture.supabase.co',publishableKey:'sb_publishable_test_fixture'},{storage,fetcher:async(url,options)=>{
  endpoint=url;payload=JSON.parse(options.body);return new Response(JSON.stringify({document:payload.p_document,version:2,owner_id:actor}),{headers:{'Content-Type':'application/json'}});
 }});
 cloud.user={id:actor};cloud.persistSession({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600});
 const {c,group}=fixture();c.cloud=cloud;c.update({user:cloud.user});group.remote={ownerId:actor,version:1};c.update({shopping:[{id:product,bought:true}],shoppingGroupId:group.id});c.shopping=async()=>{};
 await c.saveExpense(fields,null,'stable-checkout',{groupId:group.id,checkout:[product]});
 assert.ok(endpoint.endsWith('/rpc/divzplit_shopping_checkout'));assert.equal(payload.p_version,1);assert.equal(payload.p_expense_id,'stable-checkout');assert.deepEqual(payload.p_items,[product]);
 assert.equal(payload.p_document.expenses[0].payer,actor);assert.equal(payload.p_document.expenses[0].createdBy,actor);assert.equal(c.group.remote.version,2);
});
test('confirmed checkout updates its group without switching back from a newly selected group',async()=>{
 const {c,cloud,group}=fixture(),other={...structuredClone(group),id:'other'};c.update({groups:[group,other],shopping:[{id:'milk',bought:true}],shoppingGroupId:group.id});let finish;
 cloud.saveGroup=draft=>new Promise(resolve=>finish=()=>resolve(draft));cloud.shoppingList=async()=>{throw new Error('Must not load another group');};
 const pending=c.saveExpense(fields,null,'expense',{groupId:group.id,checkout:['milk']});c.update({groupId:'other',shopping:[],shoppingGroupId:null});finish();await pending;
 assert.equal(c.state.groupId,'other');assert.equal(c.state.groups.find(g=>g.id===group.id).expenses.length,1);assert.deepEqual(c.state.shopping,[]);
});

test('native registration waits for confirmation and verification refreshes the signed-in account',async()=>{
 const {c,cloud}=fixture();cloud.user=null;c.update({user:null});let registered,verified,refreshes=0;
 cloud.signUp=async(...args)=>{registered=args;return false;};
 cloud.verifySignupCode=async(...args)=>{verified=args;cloud.user={id:'confirmed-user'};};
 c.refresh=async()=>refreshes++;
 assert.equal(await c.register({email:' alex@example.test ',password:'fixture-password',name:' Alex ',accepted:true,ageBand:'16_or_over'}),false);
 assert.equal(registered[0],'alex@example.test');assert.deepEqual(registered[4],{accepted:true,ageBand:'16_or_over'});assert.equal(refreshes,0);assert.equal(c.state.user,null);
 await c.confirmSignup('alex@example.test',' 123456 ');assert.deepEqual(verified,['alex@example.test','123456']);assert.equal(refreshes,1);assert.equal(c.state.user.id,'confirmed-user');assert.equal(c.state.notice,'');
});
test('a failed signup code keeps the native app signed out and permits retry',async()=>{
 const {c,cloud}=fixture();cloud.user=null;c.update({user:null});let reads=0;cloud.verifySignupCode=async()=>{throw new Error('Expired code');};c.refresh=async()=>reads++;
 await assert.rejects(c.confirmSignup('alex@example.test','123456'),/Expired/);assert.equal(c.state.user,null);assert.equal(c.state.busy,false);assert.equal(reads,0);
});
