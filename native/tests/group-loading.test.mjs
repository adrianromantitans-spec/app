import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
import {Cloud,CloudError,mapGroup} from '../../cloud.js';
import * as model from '../../model.js';
import * as extras from '../../extras.js';
const actor='11111111-1111-4111-8111-111111111111';
function fixture(){
 const group=structuredClone(model.seed().groups[0]);group.expenses=[];group.remote={ownerId:actor,version:1,memberName:'Adrian'};
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const cloud={user:{id:actor,email:'fixture@example.invalid'},listGroups:async()=>[structuredClone(group)],saveGroup:async value=>value,restore:async()=>{}};
 const c=new NativeController({cloud,model,extras,i18n:{language:'ro'},platform:{storage,temporaryStorage:storage,flush:async()=>{}},native:{copy:async()=>{}}});c.syncPush=async()=>{};
 return {c,cloud,group,storage};
}
test('initial read failure is a retryable load failure, not an empty account',async()=>{
 const {c,cloud,group}=fixture();cloud.listGroups=async()=>{throw new CloudError('Could not complete the operation. Check your connection and try again.','42501',403);};
 await c.start();assert.equal(c.state.ready,true);assert.equal(c.state.groupsLoaded,false);assert.equal(c.state.groupsLoading,false);assert.equal(c.state.groups.length,0);assert.match(c.state.groupsError,/Operațiunea/);assert.deepEqual(c.state.groupDiagnostic,{stage:'groups',status:403,code:'42501'});
 cloud.listGroups=async()=>[structuredClone(group)];await c.refresh();assert.equal(c.group.id,group.id);assert.equal(c.state.groupsLoaded,true);assert.equal(c.state.groupsError,'');assert.equal(c.state.error,'');assert.equal(c.state.groupDiagnostic,null);
});
test('background read failure retains same-account server groups and retry clears the failure',async()=>{
 const {c,cloud,group}=fixture();await c.refresh();cloud.listGroups=async()=>{throw new CloudError('Offline','network');};await assert.rejects(c.refresh(),/Offline/);
 assert.equal(c.group.id,group.id);assert.equal(c.state.groupsLoaded,true);assert.equal(c.state.groupsLoading,false);assert.equal(c.state.groupsError,'Offline');
 cloud.listGroups=async()=>[];await c.refresh();assert.deepEqual(c.state.groups,[]);assert.equal(c.state.groupsLoaded,true);assert.equal(c.state.groupsError,'');
});
function recurring(group){group.expenses=[{id:'series',title:'Rent',amount:100,payer:'you',participants:['you'],date:'2020-01-01',category:'Otros',createdBy:actor,recurrence:{frequency:'yearly',active:true,nextDate:'2021-01-01',anchorDay:1}}];}
test('failed recurrence writes never hide read groups or publish unconfirmed expenses',async()=>{
 const {c,cloud,group}=fixture();recurring(group);cloud.saveGroup=async()=>{throw new CloudError('Conflict','NEXO_CONFLICT',409);};await c.start();
 assert.equal(c.state.groupsLoaded,true);assert.equal(c.state.groupsLoading,false);assert.equal(c.state.error,'');assert.equal(c.group.expenses.length,1);assert.equal(c.group.expenses[0].recurrence.nextDate,'2021-01-01');assert.ok(c.state.groupSyncWarning);assert.deepEqual(c.state.groupDiagnostic,{stage:'recurring',status:409,code:'NEXO_CONFLICT'});
});
test('groups become usable before recurrence writes finish, without changing selection',async()=>{
 const {c,cloud,group}=fixture();recurring(group);let finish;cloud.saveGroup=()=>new Promise(resolve=>finish=resolve);const pending=c.refresh();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.state.ready,true);assert.equal(c.state.groupsLoaded,true);assert.equal(c.group.expenses.length,1);
 const other={...structuredClone(group),id:'other',expenses:[]};c.update({groups:[...c.state.groups,other],groupId:other.id});finish({...structuredClone(group),remote:{...group.remote,version:2}});await pending;assert.equal(c.state.groupId,other.id);
});
test('account changes clear old groups immediately and late private reads cannot replace new data',async()=>{
 const {c,cloud,group}=fixture();await c.refresh();let oldReply;cloud.listGroups=()=>new Promise(resolve=>oldReply=resolve);const old=c.refresh();await new Promise(resolve=>setImmediate(resolve));
 cloud.user={id:'another',email:'another@example.invalid'};let nextReply;cloud.listGroups=()=>new Promise(resolve=>nextReply=resolve);const next=c.refresh();assert.deepEqual(c.state.groups,[]);assert.equal(c.state.groupsLoaded,false);assert.equal(c.state.user.id,'another');
 oldReply([group]);await old;assert.deepEqual(c.state.groups,[]);nextReply([]);await next;assert.equal(c.state.groupsLoaded,true);assert.deepEqual(c.state.groups,[]);
});
test('group diagnostic copies only stage/status/code, not sessions or user data',async()=>{
 const {c,cloud}=fixture();let copied;c.native.copy=async text=>{copied=JSON.parse(text);};cloud.listGroups=async()=>{throw new CloudError('Server detail with private data','42501',403);};await c.start();await c.copyGroupDiagnostic();
 assert.deepEqual(copied,{app:'DivZplit Android',stage:'groups',status:403,code:'42501'});assert.ok(!JSON.stringify(copied).includes('private'));assert.ok(!JSON.stringify(copied).includes('@'));
});
test('native controller reads existing shared Cloud groups with the real authenticated REST contract',async()=>{
 const {c,group,storage}=fixture(),canonical=mapGroup(group,actor,true);let request;
 const cloud=new Cloud({url:'https://native-fixture.supabase.co',publishableKey:'sb_publishable_fixture'},{storage,fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify([{id:group.id,owner_id:actor,version:8,document:canonical}]));}});
 cloud.user={id:actor,email:'fixture@example.invalid'};cloud.persistSession({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600});c.cloud=cloud;await c.refresh();
 assert.equal(c.group.id,group.id);assert.equal(c.group.remote.version,8);assert.ok(request.url.includes('/rest/v1/nexo_groups?select=id,owner_id,document,version'));assert.equal(request.options.headers.Authorization,'Bearer fixture-access');assert.equal(request.options.headers.apikey,'sb_publishable_fixture');
});
