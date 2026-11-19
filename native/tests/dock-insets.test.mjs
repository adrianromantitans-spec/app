import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{babel,preset,flattenStyle}=require('./helpers/native-animated.cjs');
function render({bottom=0,tracked=true,horizontal=false,padding=120}={}){
 const react={createElement:(type,props)=>({type,props}),createContext:()=>({}),useContext:()=>tracked?{}:null,forwardRef:f=>f};
 const localRequire=name=>name.startsWith('@babel/runtime/')?require(name):name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='react-native'?{FlatList:'FlatList',ScrollView:'ScrollView',StyleSheet:{flatten:flattenStyle}}:name==='react-native-safe-area-context'?{useSafeAreaInsets:()=>({bottom})}:null;
 const mod={exports:{}};new Function('require','module','exports',babel.transformSync(readFileSync(new URL('../src/DockScroll.js',import.meta.url),'utf8'),{filename:'DockScroll.js',babelrc:false,configFile:false,presets:[preset]}).code)(localRequire,mod,mod.exports);
 const original=[{paddingHorizontal:20,paddingBottom:130},{paddingBottom:padding}];return {original,node:mod.exports.TrackedScrollView({contentContainerStyle:original,horizontal},'fixture-ref')};
}
test('tracked content clears the dock/system inset without reducing existing larger spacing',()=>{
 for(const bottom of [0,24,48,64]){const {node}=render({bottom}),style=flattenStyle(node.props.contentContainerStyle);assert.ok(style.paddingBottom>=bottom+26+72+16);assert.ok(style.paddingBottom>=120);assert.equal(style.paddingHorizontal,20);assert.equal(node.props.ref,'fixture-ref');}
 assert.equal(flattenStyle(render({bottom:64,padding:300}).node.props.contentContainerStyle).paddingBottom,300);
});
test('auth/untracked and horizontal scrollers retain original padding',()=>{
 for(const options of [{tracked:false},{horizontal:true}]){const {node,original}=render(options);assert.equal(node.props.contentContainerStyle,original);}
});
