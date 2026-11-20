import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeController} from '../src/session.mjs';
function fixture(){
 const calls=[],saved=[],cloud={user:{id:'owner'},rpc:async(name,args)=>calls.push({name,args})};
 const native={pushState:async()=>({enabled:true,permission:'granted',userId:'owner',token:'fixture-token-for-language'}),pushToken:async()=>'fixture-token-for-language',pushBind:async()=>{}};
 const i18n={language:'es',setLanguage(value){this.language=value==='auto'?'ro':value;}};
 const c=new NativeController({cloud,native,i18n,platform:{storage:{},flush:async()=>saved.push(i18n.language)}});c.update({user:cloud.user,ready:true,pushReady:true,pushEnabled:true});return {c,cloud,native,i18n,calls,saved};
}
test('changing language immediately refreshes the opted-in device with the resolved ES/EN/RO locale',async()=>{
 const f=fixture();for(const value of ['en','es','ro','auto']){await f.c.language(value);await f.c.pushLanguageSync;assert.equal(f.calls.at(-1).name,'divzplit_register_native_push');assert.equal(f.calls.at(-1).args.p_language,value==='auto'?'ro':value);}
 assert.deepEqual(f.saved,['en','es','ro','ro']);
});
test('a slow previous registration cannot overwrite a later language selection',async()=>{
 const f=fixture();let release,started;const begun=new Promise(r=>started=r);f.cloud.rpc=async(name,args)=>{f.calls.push({name,args});if(f.calls.length===1){started();await new Promise(r=>release=r);}};
 const old=f.c.registerNativePush('fixture-token-for-language','owner');await begun;await f.c.language('ro');const latest=f.c.pushLanguageSync;
 assert.equal(f.calls.length,1);release();await old;await latest;assert.deepEqual(f.calls.map(c=>c.args.p_language),['es','ro']);
});
test('language preference stays usable offline and normal device synchronization retries it',async()=>{
 const f=fixture();f.cloud.rpc=async()=>{throw Error('Offline');};await f.c.language('en');await f.c.pushLanguageSync;assert.equal(f.i18n.language,'en');assert.equal(f.c.state.pushEnabled,true);
 f.cloud.rpc=async(name,args)=>name==='divzplit_native_push_status'?{enabled:true}:f.calls.push({name,args});await f.c.syncPush();assert.equal(f.calls[0].args.p_language,'en');
 await f.c.language('ro');await f.c.pushLanguageSync;assert.equal(f.calls.at(-1).args.p_language,'ro');
});
test('no language registration is made for a guest, denied, opted-out or mismatched device',async()=>{
 for(const mode of ['guest','recovery','disabled','unavailable','denied','mismatch','device-disabled']){
  const f=fixture();if(mode==='guest')f.cloud.user=null;if(mode==='recovery')f.cloud.recovering=true;if(mode==='disabled'){f.c.update({pushEnabled:false});f.native.pushState=async()=>({enabled:false});}if(mode==='unavailable')f.c.update({pushReady:false});
  if(['denied','mismatch','device-disabled'].includes(mode))f.native.pushState=async()=>({permission:mode==='denied'?'denied':'granted',enabled:mode!=='device-disabled',userId:mode==='mismatch'?'other':'owner',token:'fixture-token-for-language'});
  await f.c.language('en');await f.c.pushLanguageSync;assert.equal(f.calls.length,0,mode);
 }
});
test('changing accounts or opting out before a queued update discards the obsolete write',async()=>{
 for(const mode of ['account','disabled']){
  const f=fixture();let finish;f.native.pushState=()=>new Promise(r=>finish=r);await f.c.language('en');await new Promise(r=>setImmediate(r));
  if(mode==='account'){f.cloud.user={id:'other'};f.c.update({user:f.cloud.user});}else {f.c.update({pushEnabled:false});f.native.pushState=async()=>({enabled:false});}
  finish({permission:'granted',enabled:mode!=='disabled',userId:'owner',token:'fixture-token-for-language'});await f.c.pushLanguageSync;assert.equal(f.calls.length,0,mode);
 }
});
test('changing language during a normal device refresh still wins after its older write',async()=>{
 const f=fixture();let release,started;const begun=new Promise(r=>started=r);let registrations=0;
 f.native.pushToken=async()=>'fixture-token-for-language';f.native.pushBind=async()=>{};
 f.cloud.rpc=async(name,args)=>{if(name==='divzplit_native_push_status')return {enabled:true};f.calls.push({name,args});if(++registrations===1){started();await new Promise(r=>release=r);}};
 const refresh=f.c.syncPush();await begun;assert.equal(f.c.state.pushEnabled,false);
 await f.c.language('ro');const latest=f.c.pushLanguageSync;release();await refresh;await latest;
 assert.deepEqual(f.calls.map(c=>c.args.p_language),['es','ro']);
});
