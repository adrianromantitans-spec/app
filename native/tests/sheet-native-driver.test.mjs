import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{Value,Props,babel,preset}=require('./helpers/native-animated.cjs');
const noop=()=>{},element=(type,props,...children)=>({type,props:{...props,children:children.length?children:props?.children}});
function renderFile(file,{reduced=false,available=568,content=900}={}){
 const effects=[],animations=[],graphs=[];let state=0,closed=0;
 const react={createElement:element,useRef:v=>({current:v}),useEffect:fn=>effects.push(fn),useState:v=>[[available,86,content][state++],noop]};
 const platform={Animated:{Value,View:'Animated.View',timing:(value,config)=>({start:()=>{animations.push(config);if(config.useNativeDriver)value.__makeNative();},stop:noop})},Easing:{bezier:()=>v=>v},StyleSheet:{absoluteFill:{},create:v=>v},useWindowDimensions:()=>({width:320,height:568}),Platform:{OS:'android'},View:'View',Text:'Text',Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',KeyboardAvoidingView:'KeyboardAvoidingView'};
 const localRequire=name=>name.startsWith('@babel/runtime/')?require(name):name==='react'?react:name==='react/jsx-runtime'?{jsx:element,jsxs:element}:name==='react-native'?platform:name==='react-native-safe-area-context'?{useSafeAreaInsets:()=>({top:24,bottom:48})}:name==='./icons'?{Icon:'Icon'}:name==='./ScreenEntrance'?{__esModule:true,default:'ScreenEntrance'}:name.endsWith('.mjs')?require('../src/'+name.slice(2)):(()=>{throw Error(name)})();
 const mod={exports:{}},source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');new Function('require','module','exports',babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[preset]}).code)(localRequire,mod,mod.exports);
 const tree=mod.exports.default({c:{t:v=>v},title:'Add expense',onClose:()=>closed++,children:'form',reduced});
 const nodes=[];function walk(n){if(!n||typeof n!=='object')return;nodes.push(n);if(n.type==='Animated.View'){const props=Object.fromEntries(Object.entries(n.props).filter(([k,v])=>k!=='children'&&typeof v!=='function'));const graph=new Props(props,noop);graph.__attach();graphs.push(graph);}const children=n.props?.children;for(const child of Array.isArray(children)?children:[children])Array.isArray(child)?child.forEach(walk):walk(child);}
 walk(tree);for(const effect of effects)effect();return {tree,nodes,animations,graphs,get closed(){return closed;}};
}
test('actual sheet uses a finite scrolling viewport, bottom safe padding and native compositor entrance',()=>{
 const r=renderFile('Sheet.js'),panel=r.nodes.find(n=>n.props?.testID==='native-sheet'),scroll=r.nodes.find(n=>n.type==='ScrollView'),keyboard=r.nodes.find(n=>n.type==='KeyboardAvoidingView');
 assert.equal(panel.props.style[1].height,532);assert.equal(scroll.props.contentContainerStyle.paddingBottom,70);assert.equal(scroll.props.keyboardShouldPersistTaps,'handled');assert.equal(keyboard.props.behavior,'height');assert.equal(r.tree.props.animationType,'none');assert.equal(r.tree.props.navigationBarTranslucent,true);assert.equal(r.tree.props.statusBarTranslucent,true);
 assert.ok(r.animations.length>0&&r.animations.every(a=>a.useNativeDriver&&a.isInteraction===false));r.tree.props.onRequestClose();assert.equal(r.closed,1);for(const g of r.graphs)g.__detach();
});
test('sheet and page reduced-motion entrances schedule no animation; page motion is native',()=>{
 for(const file of ['Sheet.js','ScreenEntrance.js'])for(const reduced of [true,false]){const r=renderFile(file,{reduced});assert.equal(r.animations.length,reduced?0:1);for(const a of r.animations)assert.equal(a.useNativeDriver,true);for(const g of r.graphs)g.__detach();}
});
