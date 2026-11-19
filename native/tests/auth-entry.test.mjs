import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{Value,babel,preset,flattenStyle}=require('./helpers/native-animated.cjs');
const noop=()=>{},element=(type,props,...children)=>({type,props:{...props,children:children.length?children:props?.children}});
function load({mode='welcome',provider='google',reduced=false,ready=true,user=null,broken=false,measured=false,values={}}={}){
 let index=0;const writes=[];const state={ready,user,page:'home',groups:[],busy:false},effects=[];
 const react={createElement:element,useCallback:f=>f,useRef:v=>({current:v}),useEffect:f=>effects.push(f),useSyncExternalStore:()=>state,useState:v=>{const i=index++;return [Object.hasOwn(values,i)?values[i]:i===0?mode:i===8?provider:i===9?{google:true,apple:true}:i===10&&measured?780:v,value=>writes.push({index:i,value})];}};
 const platform=new Proxy({Animated:{Value},StyleSheet:{create:v=>v,flatten:flattenStyle,absoluteFill:{}},Platform:{OS:'android'},useWindowDimensions:()=>({width:393,height:852})},{get:(o,k)=>o[k]||k});
 const stub=new Proxy({__esModule:true,default:'Mock'},{get:(o,k)=>o[k]||k});
 const localRequire=name=>name.startsWith('@babel/runtime/')?require(name):name==='react'?react:name==='react/jsx-runtime'?{jsx:element,jsxs:element}:name==='react-native'?platform:name==='react-native-safe-area-context'?{useSafeAreaInsets:()=>({bottom:24})}:name==='./NotificationConsent'?(()=>{const m={exports:{}},code=babel.transformSync(readFileSync(new URL('../src/NotificationConsent.js',import.meta.url),'utf8'),{filename:'NotificationConsent.js',babelrc:false,configFile:false,presets:[preset]}).code;new Function('require','module','exports',code)(localRequire,m,m.exports);return m.exports;})():name==='./Dock'?{__esModule:true,default:'Dock',useDockMotion:()=>({events:{}})}:name.endsWith('.mjs')?require('../src/'+name.slice(2)):name==='./ReferenceScreens'?new Proxy({__esModule:true,welcomePicture:()=>({uri:'fixture'})},{get:(o,k)=>o[k]||k}):name==='./Opening'?{__esModule:true,default:'Opening'}:name==='./Sheet'?{__esModule:true,default:'Sheet'}:stub;
 let source=readFileSync(new URL('../src/App.js',import.meta.url),'utf8');if(broken)source=source.replace('function Auth({c,intro,onMeasure,reduced})','function Auth({c,intro,onMeasure})');
 const mod={exports:{}},compiled=babel.transformSync(source,{filename:'App.js',babelrc:false,configFile:false,presets:[preset]}).code;
 new Function('require','module','exports',compiled+'\nexports.AuthForTest=Auth;exports.ApplicationForTest=Application;')(localRequire,mod,mod.exports);
 const c={state,subscribe:noop,snapshot:()=>state,t:v=>v,group:null,model:{},cloud:{},i18n:{language:'en'}};
 return {c,writes,auth:()=>mod.exports.AuthForTest({c,intro:false,onMeasure:noop,reduced}),application:()=>{index=0;react.useState=v=>[v,noop];return mod.exports.ApplicationForTest({controller:c,reduced});}};
}
function nodes(tree){const result=[];function visit(n){if(!n||typeof n!=='object')return;result.push(n);for(const c of Array.isArray(n.props?.children)?n.props.children:[n.props?.children])Array.isArray(c)?c.forEach(visit):visit(c);}visit(tree);return result;}
test('reproduces the shipped Google icon ReferenceError when the auth motion prop is missing',()=>{assert.throws(()=>load({broken:true}).auth(),/reduced is not defined/);});
test('actual welcome/login social consent renders and receives the auth reduced-motion preference',()=>{
 for(const mode of ['welcome','login'])for(const provider of ['google','apple'])for(const reduced of [false,true]){
  const sheet=nodes(load({mode,provider,reduced}).auth()).find(n=>n.type==='Sheet');assert.ok(sheet);assert.equal(sheet.props.reduced,reduced);assert.equal(sheet.props.title,provider==='google'?'Continuar con Google':'Continuar con Apple');
 }
});
test('guest entry is static and only a restored signed-in session mounts the custom opening',()=>{
 for(const [ready,user,expected] of [[false,null,0],[false,{id:'viewer'},0],[true,null,0],[true,{id:'viewer'},1]]){
  const tree=load({ready,user}).application(),all=nodes(tree);assert.equal(all.filter(n=>n.type==='Opening').length,expected);if(!ready)assert.equal(all.filter(n=>n.type==='Dock').length,0);
  const auth=all.find(n=>typeof n.type==='function'&&n.type.name==='Auth');if(auth){assert.equal(auth.props.intro,false);assert.equal(auth.props.reduced,false);}
 }
});

test('guest brand is first revealed at its measured position, never at an estimated window height',()=>{
 const unmeasured=nodes(load({provider:null}).auth()),measured=nodes(load({provider:null,measured:true}).auth());
 assert.equal(unmeasured.filter(n=>typeof n.type==='function'&&n.type.name==='Brand').length,0);const brand=measured.find(n=>typeof n.type==='function'&&n.type.name==='Brand');assert.ok(brand);assert.equal(brand.props.hidden,false);
});

// Exercise the actual native Auth handlers, not a second implementation of the form.
test('native signup clears the password and shows a code form with a fixed pending email',async()=>{
 const f=load({mode:'register',provider:null,values:{1:'alex@example.test',2:'fixture-password',4:'Alex',5:true,6:true}});let supplied;f.c.register=async fields=>{supplied=fields;return false;};
 const submit=nodes(f.auth()).filter(n=>n.props?.onPress&&JSON.stringify(n.props?.children).includes('Crear cuenta'))[0];assert.ok(submit);await submit.props.onPress();
 assert.equal(supplied.email,'alex@example.test');assert.ok(f.writes.some(w=>w.index===2&&w.value===''));assert.ok(f.writes.some(w=>w.index===0&&w.value==='signupCode'));
 const code=load({mode:'signupCode',provider:null,values:{1:'alex@example.test',7:'123456'}});let verified;code.c.confirmSignup=async(...args)=>{verified=args;};code.c.resendSignup=async()=>{};
 const tree=nodes(code.auth()),fields=tree.filter(n=>n.props?.autoComplete);assert.equal(fields.length,1);assert.equal(fields[0].props.autoComplete,'one-time-code');assert.equal(fields[0].props.maxLength,10);
 const verify=tree.find(n=>n.props?.onPress&&JSON.stringify(n.props?.children).includes('Verificar código'));assert.ok(verify);await verify.props.onPress();assert.deepEqual(verified,['alex@example.test','123456']);
});
