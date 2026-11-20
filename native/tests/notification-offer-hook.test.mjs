import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {NativeController} from '../src/session.mjs';
const require=createRequire(import.meta.url),{babel,preset}=require('./helpers/native-animated.cjs');
const compiled=babel.transformSync(readFileSync(new URL('../src/NotificationConsent.js',import.meta.url),'utf8'),{filename:'NotificationConsent.js',babelrc:false,configFile:false,presets:[preset]}).code;
function setup({active=true,opening=false,sheet=null,busy=false}={}){
 const values=new Map(),effects=[],shown=[],cloud={user:{id:'new-user'}},platform={storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},async flush(){}},native={async pushState(){return {permission:'default',enabled:false};}};
 const c=new NativeController({cloud,platform,native,i18n:{language:'es'}});c.update({ready:true,user:cloud.user,pushReady:true,busy});
 const react={useEffect:fn=>effects.push(fn),useState:()=>[active,()=>{}]},mod={exports:{}},load=name=>name==='react'?react:name==='react-native'?{AppState:{currentState:active?'active':'background',addEventListener:()=>({remove(){}})},View:'View'}:name.startsWith('@babel/runtime/')?require(name):{};
 new Function('require','module','exports',compiled)(load,mod,mod.exports);
 mod.exports.useNotificationOffer(c,c.state,opening,sheet,value=>shown.push(value));const cleanups=effects.map(fn=>fn());
 return {c,cloud,values,shown,cleanup:()=>cleanups.forEach(fn=>fn?.())};
}
test('actual notification hook presents consent for a fresh ready account without native permission side effects',async()=>{
 const f=setup();await new Promise(r=>setImmediate(r));assert.deepEqual(f.shown,[{kind:'deviceNotifications',offer:true}]);assert.equal(f.values.get('native-push-offer-seen:new-user'),'1');f.cleanup();
});
test('background, opening, busy and an existing sheet defer the automatic invitation',async()=>{
 for(const options of [{active:false},{opening:true},{busy:true},{sheet:{kind:'expense'}}]){
  const f=setup(options);await new Promise(r=>setImmediate(r));assert.equal(f.shown.length,0);assert.equal(f.values.size,0);f.cleanup();
 }
});
test('a late promise cannot mark a replacement account or open an obsolete offer',async()=>{
 const f=setup();f.cloud.user={id:'replacement'};f.c.update({user:f.cloud.user});await new Promise(r=>setImmediate(r));assert.equal(f.shown.length,0);assert.equal(f.values.size,0);f.cleanup();
});
