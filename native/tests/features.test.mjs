import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
import {groupFields,reservedGroup,noticePage} from '../src/features.mjs';
import * as model from '../../model.js';
import * as planning from '../../planning.js';
import * as settlement from '../../settlement-plan.js';
import * as fxTools from '../../fx.js';
import {Cloud} from '../../cloud.js';
function fixture(){
 const g=structuredClone(model.seed().groups[0]);Object.assign(g,{expenses:[],payments:[],currency:'EUR',remote:{version:1,ownerId:'owner',memberName:'Owner'}});
 const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const cloud={user:{id:'owner',email:'owner@example.invalid'},storageKey:'fixture',recovering:false,saveGroup:async g=>g,requirePlanning:async()=>true,paymentArchives:async()=>[],readActivity:async()=>({events:[],requests:[],next:null}),notificationInbox:async()=>({items:[],next:null,unread:0})};
 const c=new NativeController({cloud,model,planning,settlement,fxTools,i18n:{tr:v=>v},native:{},platform:{storage,temporaryStorage:storage,flush:async()=>{}}});c.update({user:cloud.user,groups:[g],groupId:g.id,ready:true});return {c,cloud,g,storage};
}
const groupInput={name:'Trip',place:'Bucharest',emoji:'🚋',type:'Viaje',currency:'EUR',budget:'',date:'2027-01-01',endDate:'2027-01-03'};
function debt(f){model.addExpense(f.g,{title:'Dinner',amount:900,payer:'marta',participants:['you','marta'],date:'2026-11-17',category:'Comida'});f.c.update({activityGroupId:f.g.id,paymentRequests:[]});}
const quote=(currency,id='11111111-1111-4111-8111-111111111111')=>({id,currency,source:'ECB',rate:'1.2',rate_date:'2026-11-17',expires_at:'2099-11-17T20:00:00Z'});
test('group settings validate real dates, currency lock, budgets and preserve server membership',async()=>{
 const {c,cloud,g}=fixture();let draft;cloud.saveGroup=async value=>{draft=value;return value;};
 await c.editGroup(g.id,groupInput,1);assert.deepEqual(draft.members,g.members);assert.equal(draft.date,'2027-01-01');assert.equal(draft.budget,0);
 assert.throws(()=>groupFields({...groupInput,date:'2027-02-30'},g,model,planning));
 assert.throws(()=>groupFields({...groupInput,endDate:'2026-01-01'},g,model,planning));
 model.addExpense(c.group,{title:'Dinner',amount:100,payer:'you',participants:['you'],date:'2026-11-17',category:'Comida'});
 assert.throws(()=>groupFields({...groupInput,currency:'RON'},c.group,model,planning),/moneda/);
 assert.equal(groupFields({...groupInput,budget:'10.23'},null,model,planning).budget,1023);
});
test('group creation reuses the form ID and failed writes leave groups untouched',async()=>{
 const {c,cloud}=fixture();const before=c.state.groups.length,ids=[];cloud.createGroup=async values=>{ids.push(values.id);throw new Error('Offline');};
 await assert.rejects(c.createGroup({...groupInput,id:'stable'}),/Offline/);await assert.rejects(c.createGroup({...groupInput,id:'stable'}),/Offline/);
 assert.deepEqual(ids,['stable','stable']);assert.equal(c.state.groups.length,before);
});
test('group owner, typed confirmation and version guard run before destructive requests',async()=>{
 const {c,cloud,g}=fixture();let deletes=0;cloud.deleteGroup=async()=>{deletes++;};cloud.cleanupDeletedGroups=async()=>{};
 await assert.rejects(c.deleteGroup(g.id,'wrong',1),/nombre/);await assert.rejects(c.deleteGroup(g.id,g.name,2),/ha cambiado/);assert.equal(deletes,0);
 g.remote.ownerId='other';await assert.rejects(c.editGroup(g.id,groupInput,1),/propietario/);await assert.rejects(c.deleteGroup(g.id,g.name,1),/propietario/);
 g.remote.ownerId='owner';await c.deleteGroup(g.id,g.name,1);assert.equal(deletes,1);assert.equal(c.group,null);
});
test('invitation links reject other origins before joining, and revocation is owner only',async()=>{
 const {c,cloud,g}=fixture();let joins=0,revocations=0;cloud.join=async()=>{joins++;return g;};cloud.revokeInvites=async()=>{revocations++;};
 await assert.rejects(c.joinLink('https://evil.invalid/app/#invite='+'a'.repeat(64)),/enlace/);assert.equal(joins,0);
 await c.joinLink('https://divzplit.com/app/#invite='+'a'.repeat(64));assert.equal(joins,1);
 g.remote.ownerId='other';await assert.rejects(c.revoke(g.id),/propietario/);assert.equal(revocations,0);
});
test('pending payments reserve suggestions without changing actual balances',()=>{
 const f=fixture();debt(f);const before=model.balances(f.g);f.c.update({paymentRequests:[{id:'pending',from_id:'owner',to_id:'marta',amount:200}]});
 const reserved=reservedGroup(f.g,f.c.state.paymentRequests,'owner');assert.equal(model.balances(reserved).you,-250);assert.deepEqual(model.balances(f.g),before);assert.equal(f.c.settlementData()[0].amount,250);
 f.c.update({activityGroupId:null});assert.throws(()=>f.c.settlementData(),/Actualiza/);
});
test('FX results are scoped to group/selection and expired or replaced quotes cannot confirm',async()=>{
 const f=fixture();debt(f);const replies=[];f.cloud.exchangeQuote=currency=>new Promise(resolve=>replies.push(()=>resolve(quote(currency))));
 const first=f.c.loadFx('RON'),second=f.c.loadFx('GBP');replies[1]();await second;replies[0]();await first;assert.equal(f.c.state.fx.target,'GBP');
 const original=f.c.settlementData()[0],payment=f.c.paymentQuote(original);assert.equal(payment.targetAmount,540);assert.equal(payment.targetQuoteId,quote('GBP').id);
 f.c.state.fx.targetQuote.expires_at='2020-01-01T00:00:00Z';assert.throws(()=>f.c.paymentQuote(original),/caducado/);
 f.c.update({fx:null});assert.throws(()=>f.c.paymentQuote(payment),/Revisa/);
});
test('lost payment responses retry the same request ID and do not change balances prematurely',async()=>{
 const f=fixture();debt(f);const p=f.c.settlementData()[0];let saved=null,requests=0;
 f.cloud.requestPayment=async(g,p,id)=>{requests++;if(!saved){saved={id,from_id:'owner',to_id:p.to,amount:p.amount};throw new Error('Response lost');}};
 f.cloud.readActivity=async()=>({events:[],requests:saved?[saved]:[],next:null});
 await assert.rejects(f.c.requestPayment(p,'stable',f.g.id),/Response lost/);assert.equal(f.g.payments.length,0);
 await f.c.requestPayment(p,'stable',f.g.id);assert.equal(requests,2);assert.equal(f.c.state.paymentRequests[0].id,'stable');assert.equal(f.c.settlementData().length,0);assert.equal(f.g.payments.length,0);
 await f.c.requestPayment(p,'stable',f.g.id);assert.equal(requests,2);
});
test('confirmed payment with failed activity refresh reports success without inviting another write',async()=>{
 const f=fixture();debt(f);let writes=0;f.cloud.requestPayment=async()=>{writes++;};f.cloud.readActivity=async()=>{throw new Error('Offline');};
 await f.c.requestPayment(f.c.settlementData()[0],'stable',f.g.id);assert.equal(writes,1);assert.match(f.c.state.notice,/registrado/);assert.equal(f.c.state.activityGroupId,null);
});
test('payment responses enforce receiver/sender roles and never accept another group snapshot',async()=>{
 const f=fixture();debt(f);f.c.update({paymentRequests:[{id:'pending',from_id:'owner',to_id:'marta',amount:450}]});let responses=0;f.cloud.respondPayment=async()=>{responses++;return f.g;};
 await assert.rejects(f.c.respondPayment('pending','confirm',f.g.id),/permiso/);await assert.rejects(f.c.respondPayment('pending','cancel','other'),/grupo/);assert.equal(responses,0);
 await f.c.respondPayment('pending','cancel',f.g.id);assert.equal(responses,1);
});
test('native converted payment uses the shared two-quote RPC contract',async()=>{
 const f=fixture();debt(f);const stored=new Map(),storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};let payload,endpoint;
 const cloud=new Cloud({url:'https://fixture.supabase.co',publishableKey:'sb_publishable_test_fixture'},{storage,fetcher:async(url,options)=>{endpoint=url;payload=JSON.parse(options.body);return new Response(JSON.stringify({id:'request'}),{headers:{'Content-Type':'application/json'}});}});
 cloud.user={id:'owner'};cloud.collaborationReady=true;cloud.fxReady=true;cloud.persistSession({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600});f.c.cloud=cloud;f.c.activity=async()=>{};
 const target=quote('GBP');f.c.update({fx:{groupId:f.g.id,target:'GBP',baseQuote:null,targetQuote:target}});const p=f.c.paymentQuote(f.c.settlementData()[0]);
 await f.c.requestPayment(p,'stable',f.g.id);assert.ok(endpoint.endsWith('/rpc/divzplit_request_payment_fx'));assert.equal(payload.p_amount,450);assert.equal(payload.p_target_amount,540);assert.equal(payload.p_target_quote,target.id);assert.equal(payload.p_quote,null);assert.equal(payload.p_request_id,'stable');
});
test('activity pagination deduplicates events and rejects replies for an obsolete group',async()=>{
 const f=fixture();let calls=0;f.cloud.readActivity=async(id,cursor)=>{calls++;return cursor?{events:[{id:'a'},{id:'b'}],requests:[],next:null}:{events:[{id:'a'}],requests:[],next:{id:'a',created_at:'2026-11-17'}};};
 await f.c.activity();await f.c.activity(true);assert.deepEqual(f.c.state.history.map(e=>e.id),['a','b']);assert.equal(calls,2);
 let finish;f.cloud.readActivity=()=>new Promise(resolve=>finish=resolve);const pending=f.c.activity();f.c.update({groups:[],groupId:null,history:[]});finish({events:[{id:'old'}],requests:[]});await pending;assert.deepEqual(f.c.state.history,[]);
});
test('history and payment list cleanup use owner APIs and preserve financial documents',async()=>{
 const f=fixture();debt(f);const before=structuredClone(f.g);let calls=[];f.cloud.clearHistory=async()=>calls.push('history');f.cloud.clearPaymentList=async(g,kind)=>calls.push(kind);f.cloud.deleteHistory=async(g,id)=>calls.push(id);
 await f.c.manageHistory('history',null,f.g.id);await f.c.manageHistory('repayments',null,f.g.id);await f.c.manageHistory('delete','event',f.g.id);assert.deepEqual(calls,['history','repayments','event']);assert.deepEqual(f.g,before);
 f.g.remote.ownerId='other';await assert.rejects(f.c.manageHistory('pending',null,f.g.id),/administrador/);
});
test('notification pages deduplicate and metadata is trusted only for the opened group and kind',async()=>{
 const f=fixture();f.cloud.notificationInbox=async cursor=>cursor?{items:[{id:'a'},{id:'b'}],next:null,unread:1}:{items:[{id:'a',group_id:'wrong',kind:'tasks.added',subject:'Wrong group text'}],next:{id:'a'},unread:2};
 await f.c.inbox();await f.c.inbox(true);assert.deepEqual(f.c.state.notices.map(n=>n.id),['a','b']);
 f.cloud.openNotification=async()=>({group_id:f.g.id,kind:'polls.added'});await f.c.openNotice('a');assert.equal(f.c.state.noticeDetail.subject,undefined);assert.equal(f.c.state.noticeDetail.group_id,f.g.id);
 await f.c.noticeDestination();assert.equal(f.c.state.page,'polls');assert.equal(f.c.state.noticeDetail,null);
 assert.equal(noticePage('shopping.reminder'),'shopping');assert.equal(noticePage('payment.requested'),'activity');assert.equal(noticePage('expenses.added'),'expenses');
});
test('late notification openings cannot show data from a previous account',async()=>{
 const f=fixture();let finish;f.cloud.openNotification=()=>new Promise(resolve=>finish=resolve);const pending=f.c.openNotice('a');f.cloud.user={id:'new'};f.c.update({user:f.cloud.user,noticeDetail:null});finish({group_id:f.g.id,kind:'tasks.added'});await pending;assert.equal(f.c.state.noticeDetail,null);
});
test('notification preferences preserve supported categories and reject foreign muted groups',async()=>{
 const f=fixture();const prefs={expenses:true,polls:true,tasks:false,payments:true,muted_groups:[]};f.cloud.notificationSettings=async()=>prefs;await f.c.notificationPreferences();let payload;
 f.cloud.saveNotificationSettings=async(values,muted)=>{payload={values,muted};return {...values,muted_groups:muted};};await f.c.savePreferences({...prefs,expenses:false,shopping:true},[f.g.id]);assert.equal(payload.values.shopping,undefined);assert.equal(payload.values.expenses,false);assert.deepEqual(payload.muted,[f.g.id]);
 await assert.rejects(f.c.savePreferences(prefs,['foreign']),/grupo/);
});
test('recovery links use only stored PKCE state and cannot expose groups before reset',async()=>{
 const f=fixture();f.cloud.user=null;f.c.update({user:null,groups:[],groupId:null});f.storage.setItem('fixture:recovery-pkce','stored');let finished=0;
 f.cloud.finishOAuth=async()=>{finished++;f.cloud.user={id:'recovering'};f.cloud.recovering=true;};
 await f.c.handleURL('https://divzplit.com/?code=fixture',false);assert.equal(finished,1);assert.equal(f.c.state.user,null);assert.equal(f.c.state.recovering,true);
 f.cloud.listGroups=async()=>{throw new Error('Must not load private groups');};await f.c.refresh();assert.deepEqual(f.c.state.groups,[]);
});
test('email confirmation never adopts a session from a URL',async()=>{
 const f=fixture();f.cloud.user=null;f.c.update({user:null});let confirmation;
 f.cloud.acceptCallback=async hash=>{confirmation=hash;return true;};await f.c.handleURL('https://divzplit.com/#access_token=untrusted',false);assert.ok(confirmation);assert.equal(f.cloud.user,null);assert.match(f.c.state.notice,/confirmado/);
});
test('recovery verifies separately, checks confirmation and signs out after password change',async()=>{
 const f=fixture();f.cloud.user=null;f.c.update({user:null});let updates=0;
 f.cloud.verifyRecoveryCode=async()=>{f.cloud.user={id:'recovering'};f.cloud.recovering=true;};f.cloud.updatePassword=async()=>{updates++;f.cloud.recovering=false;};f.cloud.signOut=async()=>{f.cloud.user=null;};
 await f.c.verifyCode('owner@example.invalid','123456');assert.equal(f.c.state.recovering,true);assert.equal(f.c.state.user,null);
 await assert.rejects(f.c.resetPassword('short','short'),/10 caracteres/);await assert.rejects(f.c.resetPassword('long-password','different-password'),/coincidir/);assert.equal(updates,0);
 await f.c.resetPassword('long-password','long-password');assert.equal(updates,1);assert.equal(f.c.state.user,null);assert.equal(f.cloud.user,null);assert.equal(f.c.state.recovering,false);assert.match(f.c.state.notice,/actualizada/);
});
test('session loss clears account-specific groups, history and notices',async()=>{
 const f=fixture();f.c.update({history:[{id:'private'}],notices:[{id:'private'}]});await assert.rejects(f.c.run(async()=>{f.cloud.user=null;throw new Error('Session expired');}),/Session expired/);assert.equal(f.c.state.user,null);assert.deepEqual(f.c.state.groups,[]);assert.deepEqual(f.c.state.notices,[]);assert.deepEqual(f.c.state.history,[]);
});
test('an in-flight group refresh cannot expose a same-account recovery session',async()=>{
 const f=fixture();let finish;f.cloud.listGroups=()=>new Promise(resolve=>finish=resolve);const pending=f.c.refresh();f.cloud.recovering=true;f.c.update({user:null,groups:[],groupId:null,recovering:true});finish([f.g]);await pending;assert.deepEqual(f.c.state.groups,[]);assert.equal(f.c.state.user,null);
});
