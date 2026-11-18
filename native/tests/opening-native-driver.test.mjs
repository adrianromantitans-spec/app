import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {referenceIntro} from '../src/design.mjs';
const require=createRequire(import.meta.url),{Value,Style,Animation,flattenStyle,babel,preset}=require('./helpers/native-animated.cjs');
const noop=()=>{};
test('React Native rejects the previous mixed native-opacity / JS-font graph at handoff',()=>{
 const opacity=new Value(0),flight=new Value(0),style=Style.from({opacity,fontSize:flight.interpolate({inputRange:[0,1],outputRange:[39.3,25]})});
 style.__attach();opacity.__makeNative();
 assert.equal(flight.__isNative,true);
 assert.throws(()=>new Animation({useNativeDriver:false}).start(0,noop,noop,null,flight),/Attempting to run JS driven animation/);
 style.__detach();
});
function renderOpening({reduced=false}={}){
 const effects=[],animations=[],graphs=[],values=[],timers=[],stateWrites=[];let state=0,finished=0;
 // Run the actual component at the held+ready handoff, with only hooks/platform views
 // replaced. Animated Value/Style/Animation are the pinned React Native classes.
 const element=(type,props,...children)=>({type,props:{...props,children:children.length?children:props?.children}});
 const react={createElement:element,useRef:v=>({current:v}),useState:v=>[state++===0?true:v,value=>stateWrites.push(value)],useEffect:fn=>effects.push(fn)};
 const composite=items=>({start:()=>items.forEach(item=>item.start()),stop:()=>items.forEach(item=>item.stop())});
 const Animated={Value:class extends Value{constructor(v){super(v);values.push(this);}},View:'Animated.View',Text:'Animated.Text',delay:()=>({start:noop,stop:noop}),parallel:composite,sequence:composite,timing:(value,config)=>({start:callback=>{
  animations.push({value,config});
  if(config.useNativeDriver)value.__makeNative();
  else new Animation(config).start(value.__getValue(),noop,noop,null,value);
  value.setValue(config.toValue);callback?.({finished:true});
 },stop:noop})};
 const platform={Animated,Easing:{bezier:()=>v=>v},Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{absoluteFill:{}},useWindowDimensions:()=>({width:393,height:852})};
 const source=readFileSync(new URL('../src/Opening.js',import.meta.url),'utf8'),compiled=babel.transformSync(source,{filename:'Opening.js',babelrc:false,configFile:false,presets:[preset]}).code;
 const mod={exports:{}},localRequire=name=>name.startsWith('@babel/runtime/')?require(name):name==='react'?react:name==='react/jsx-runtime'?{jsx:element,jsxs:element}:name==='react-native'?platform:name==='react-native-svg'?{__esModule:true,default:'Svg',Defs:'Defs',RadialGradient:'RadialGradient',Stop:'Stop',Rect:'Rect'}:name==='./design.mjs'?require('../src/design.mjs'):(()=>{throw Error('Unexpected import '+name)})();
 new Function('require','module','exports','setTimeout','clearTimeout',compiled)(localRequire,mod,mod.exports,fn=>{timers.push(fn);return timers.length;},noop);
 const tree=mod.exports.default({ready:true,anchor:{x:64,y:20,width:97,height:30,fontSize:25,letterSpacing:-1},onFinish:()=>finished++,reduced});
 function attach(node){if(!node||typeof node!=='object')return;if(node.type==='Animated.View'||node.type==='Animated.Text'){const graph=Style.from(flattenStyle(node.props.style));if(graph){graph.__attach();graphs.push(graph);}}const children=node.props?.children;for(const child of Array.isArray(children)?children:[children])attach(child);}
 attach(tree);for(const effect of effects)effect();
 return {animations,values,graphs,tree,stateWrites,get finished(){return finished;}};
}
test('actual Opening runs assembly, curtain and complete flight on the native driver with fixed glyph metrics',()=>{
 const result=renderOpening(),handoff=result.animations.find(a=>a.config.duration===referenceIntro.flight);
 assert.ok(result.animations.length>0);assert.ok(result.animations.every(a=>a.config.useNativeDriver&&a.value.__isNative));
 assert.ok(handoff);assert.equal(handoff.value.__getValue(),1);assert.equal(result.finished,1);
 for(const graph of result.graphs)if(graph.__isNative)assert.ok(!Object.keys(graph.__getValue()).some(k=>['fontSize','lineHeight','letterSpacing'].includes(k)),'Native style graph must never include font metrics');
 result.tree.props.onPress();assert.equal(result.finished,2);
 for(const graph of result.graphs)graph.__detach();
});
test('reduced motion finishes Opening without scheduling a font or native animation',()=>{
 const result=renderOpening({reduced:true});assert.equal(result.animations.length,0);assert.ok(result.finished>=1);
 for(const graph of result.graphs)graph.__detach();
});

test('opening handoff lands at the measured header and ignores per-frame text layout events',()=>{
 const result=renderOpening(),word=result.tree.props.children.find(n=>n?.props?.onLayout);
 assert.ok(word);word.props.onLayout({nativeEvent:{layout:{width:120,height:40}}});assert.equal(result.stateWrites.length,0);
 const graph=result.graphs.find(g=>g.__getValue().position==='absolute'&&g.__getValue().left!==undefined);
 const style=graph.__getValue();const scale=style.transform[2].scale;assert.ok(Math.abs(style.left+style.transform[0].translateX+145*(1-scale)/2-64)<1e-6);assert.ok(Math.abs(style.top+style.transform[1].translateY+48*(1-scale)/2-20)<1e-6);
 for(const graph of result.graphs)graph.__detach();
});

test('flight blends into fixed, exact header metrics without another font animation',()=>{
 const r=renderOpening(),target=r.tree.props.children.findLast(n=>n?.type==='Animated.View');
 const text=target.props.children[0],style=text.props.style[1];
 assert.equal(style.fontSize,25);assert.equal(style.lineHeight,30);assert.equal(style.letterSpacing,-1);
 const targetGraph=r.graphs.find(g=>g.__getValue().left===64&&g.__getValue().top===20);assert.equal(targetGraph.__getValue().opacity,1);
 for(const g of r.graphs)g.__detach();
});
