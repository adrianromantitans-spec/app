import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
import * as model from '../../model.js';
import {Cloud,mapGroup} from '../../cloud.js';
import {legalMetadata} from '../../legal.js';

function fixture(){
 const group=structuredClone(model.seed().groups[0]);group.expenses=[];group.remote={ownerId:'owner',version:1};
 const storage=new Map();
 const cloud={user:{id:'owner',email:'test@example.invalid'},storageKey:'test',async saveGroup(g){return g;}};
 const c=new NativeController({cloud,model,i18n:{tr:v=>v},native:{},platform:{temporaryStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},flush:async()=>{}}});
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
