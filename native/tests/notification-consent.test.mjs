import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
function fixture(){
 const values=new Map(),calls=[];
 const cloud={user:{id:'owner'},rpc:async(name,args)=>{calls.push([name,args]);return {enabled:true};}};
 const native={pushState:async()=>({permission:'default',enabled:false}),pushPermission:async()=>{calls.push(['permission']);return 'granted';},pushToken:async()=>{calls.push(['token']);return 'fixture-token';},pushBind:async id=>calls.push(['bind',id]),pushClear:async()=>calls.push(['clear'])};
 const platform={storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},flush:async()=>calls.push(['persist'])};
 const c=new NativeController({cloud,native,platform,i18n:{language:'es'}});c.update({user:cloud.user,ready:true,pushReady:true});return {c,cloud,native,platform,values,calls};
}
test('notification offer has no permission/token side effects; dismissal persists across controllers',async()=>{
 const {c,cloud,native,platform,calls}=fixture();assert.equal(await c.shouldOfferPush(),true);assert.deepEqual(calls,[]);c.markPushOfferSeen();assert.equal(await c.shouldOfferPush(),false);
 const next=new NativeController({cloud,native,platform,i18n:{language:'es'}});next.update({user:cloud.user,ready:true,pushReady:true});assert.equal(await next.shouldOfferPush(),false);
});
test('notification offer respects service, guest/recovery, existing opt-in, denied and unknown OS states',async()=>{
 for(const mode of ['service','guest','recovery','already','denied','unknown','native-enabled']){
  const {c,cloud,native}=fixture();if(mode==='service')c.update({pushReady:false});if(mode==='guest')cloud.user=null;if(mode==='recovery')cloud.recovering=true;if(mode==='already')c.update({pushEnabled:true});
  if(['denied','unknown','native-enabled'].includes(mode))native.pushState=async()=>({permission:mode==='denied'?'denied':mode==='unknown'?'unknown':'granted',enabled:mode==='native-enabled'});
  assert.equal(await c.shouldOfferPush(),false,mode);
 }
 const {c,native}=fixture();native.pushState=async()=>({permission:'granted',enabled:false});assert.equal(await c.shouldOfferPush(),true);
});
test('late OS state cannot offer for another account or override dismissal',async()=>{
 const {c,cloud,native}=fixture();let resolve;native.pushState=()=>new Promise(r=>resolve=r);let pending=c.shouldOfferPush();cloud.user={id:'other'};resolve({permission:'default'});assert.equal(await pending,false);
 cloud.user={id:'owner'};pending=c.shouldOfferPush();c.markPushOfferSeen();resolve({permission:'default'});assert.equal(await pending,false);
});
test('accepting registers only after grant; denial never fetches token or registers',async()=>{
 const {c,calls}=fixture();assert.equal(await c.enablePush(),true);assert.deepEqual(calls.map(x=>x[0]),['persist','permission','token','divzplit_register_native_push','bind']);assert.equal(c.state.pushEnabled,true);
 const denied=fixture();denied.native.pushPermission=async()=> 'denied';assert.equal(await denied.c.enablePush(),false);assert.equal(denied.c.state.pushPermission,'denied');assert.equal(denied.c.state.pushEnabled,false);assert.deepEqual(denied.calls.map(x=>x[0]),['persist']);assert.equal(await denied.c.shouldOfferPush(),false);
});
test('account changes at each permission/registration stage never enable a stale device session',async()=>{
 for(const stage of ['pushPermission','pushToken','rpc','pushBind']){
  const {c,cloud,native,calls}=fixture();const target=stage==='rpc'?cloud:native,original=target[stage];target[stage]=async(...args)=>{const result=await original(...args);cloud.user={id:'other'};return result;};assert.equal(await c.enablePush(),false,stage);assert.equal(c.state.pushEnabled,false,stage);
  if(stage==='pushPermission')assert.ok(!calls.some(x=>x[0]==='token'));if(stage==='pushToken')assert.ok(!calls.some(x=>x[0]==='divzplit_register_native_push'));if(stage==='rpc')assert.ok(!calls.some(x=>x[0]==='bind'));if(stage!=='pushPermission')assert.ok(calls.some(x=>x[0]==='clear'));
 }
});
test('registration failure stays disabled and allows explicit retry without repeating automatic offer',async()=>{
 const {c,cloud}=fixture();cloud.rpc=async()=>{throw Error('Offline');};await assert.rejects(c.enablePush(),/Offline/);assert.equal(c.state.pushEnabled,false);assert.equal(c.state.busy,false);assert.equal(await c.shouldOfferPush(),false);cloud.rpc=async()=>true;assert.equal(await c.enablePush(),true);
});
