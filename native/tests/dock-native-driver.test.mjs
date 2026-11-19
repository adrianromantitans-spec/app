import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{Value,Props,Animation,babel,preset,flattenStyle}=require('./helpers/native-animated.cjs');
const noop=()=>{};
function renderDock(reduced){
 const effects=[],animations=[],graphs=[],collapse=new Value(0),element=(type,props,...children)=>({type,props:{...props,children:children.length?children:props?.children}});
 const react={createElement:element,useRef:value=>({current:value}),useEffect:fn=>effects.push(fn)};
 const animated={Value,View:'Animated.View',createAnimatedComponent:component=>'Animated.'+component,spring:(value,config)=>({start:()=>{animations.push(config);assert.equal(config.useNativeDriver,true);value.__makeNative();},stop:noop})};
 const platform={Animated:animated,StyleSheet:{absoluteFill:{}},View:'View',Pressable:'Pressable',useWindowDimensions:()=>({width:393,height:852})};
 const mod={exports:{}},localRequire=name=>name.startsWith('@babel/runtime/')?require(name):name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='react-native'?platform:name==='react-native-svg'?{__esModule:true,default:'Svg',Circle:'Circle',Defs:'Defs',LinearGradient:'LinearGradient',Rect:'Rect',Stop:'Stop'}:name==='./icons'?{Icon:'Icon'}:name.endsWith('.mjs')?require('../src/'+name.slice(2)):(()=>{throw Error(name)})();
 const source=readFileSync(new URL('../src/Dock.js',import.meta.url),'utf8');new Function('require','module','exports',babel.transformSync(source,{filename:'Dock.js',babelrc:false,configFile:false,presets:[preset]}).code)(localRequire,mod,mod.exports);
 const tree=mod.exports.default({c:{t:v=>v},ui:{Label:'Label'},page:'activity',bottom:12,onNavigate:noop,onAdd:noop,motion:{collapse,compact:false,expand:noop},reduced});
 function attach(node){if(!node||typeof node!=='object')return;if(String(node.type).startsWith('Animated.')){const props=Object.fromEntries(Object.entries(node.props).filter(([key,value])=>key!=='children'&&typeof value!=='function'));const graph=new Props(props,noop);graph.__attach();graphs.push({node,graph});}const children=node.props?.children;for(const child of Array.isArray(children)?children:[children])Array.isArray(child)?child.forEach(attach):attach(child);}
 attach(tree);for(const effect of effects)effect();return {collapse,animations,graphs,tree};
}
test('actual dock selector native animation cannot promote layout/fade/SVG collapse nodes to native',()=>{
 const result=renderDock(false);assert.equal(result.animations.length,1);assert.equal(result.collapse.__isNative,false);
 assert.doesNotThrow(()=>new Animation({useNativeDriver:false}).start(0,noop,noop,null,result.collapse));result.collapse.setValue(1);
 const plate=result.graphs.find(({node})=>node.type==='Animated.Rect').graph.__getValue();assert.equal(plate.width,66);assert.equal(plate.height,58);assert.equal(plate.rx,29);assert.equal(plate.x+plate.width/2,357/2);
 for(const {graph} of result.graphs)graph.__detach();
});
test('dock reduced motion positions the selector without starting a native spring',()=>{const result=renderDock(true);assert.equal(result.animations.length,0);assert.equal(result.collapse.__isNative,false);for(const {graph} of result.graphs)graph.__detach();});

test('tracked native lists forward every user scroll phase and keep modal/horizontal scroll isolated',()=>{
 const phases=['onScroll','onScrollBeginDrag','onScrollEndDrag','onMomentumScrollBegin','onMomentumScrollEnd'],calls=[];let events=Object.fromEntries(phases.map(name=>[name,e=>calls.push(['dock',name,e])]));
 const react={createContext:()=>({}),useContext:()=>events,forwardRef:fn=>fn,createElement:(type,props)=>({type,props})},mod={exports:{}},localRequire=name=>name.startsWith('@babel/runtime/')?require(name):name==='react'?react:name==='react/jsx-runtime'?{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}:name==='react-native'?{FlatList:'FlatList',ScrollView:'ScrollView',StyleSheet:{flatten:flattenStyle}}:name==='react-native-safe-area-context'?{useSafeAreaInsets:()=>({bottom:0})}:null;
 const source=readFileSync(new URL('../src/DockScroll.js',import.meta.url),'utf8');new Function('require','module','exports',babel.transformSync(source,{filename:'DockScroll.js',babelrc:false,configFile:false,presets:[preset]}).code)(localRequire,mod,mod.exports);
 const input=Object.fromEntries(phases.map(name=>[name,e=>calls.push(['owner',name,e])])),event={nativeEvent:{contentOffset:{y:50}}},ref={current:null};
 const list=mod.exports.TrackedFlatList(input,ref);for(const phase of phases)list.props[phase](event);assert.equal(calls.length,10);for(let i=0;i<phases.length;i++){assert.deepEqual(calls[i*2],['dock',phases[i],event]);assert.deepEqual(calls[i*2+1],['owner',phases[i],event]);}assert.equal(list.props.ref,ref);assert.equal(list.props.scrollEventThrottle,16);
 const horizontal=mod.exports.TrackedScrollView({...input,horizontal:true},ref);assert.equal(horizontal.props.onScroll,input.onScroll);events=null;const modal=mod.exports.TrackedScrollView(input,ref);assert.equal(modal.props.onScroll,input.onScroll);
});

test('actual dock and plus use opaque gradient stops and a solid selection fill',()=>{
 const r=renderDock(false),nodes=[];function visit(n){if(!n||typeof n!=='object')return;nodes.push(n);for(const c of Array.isArray(n.props?.children)?n.props.children:[n.props?.children])Array.isArray(c)?c.forEach(visit):visit(c);}visit(r.tree);
 const stops=nodes.filter(n=>n.type==='Stop');assert.ok(stops.length>=5);for(const n of stops)assert.equal(n.props.stopOpacity,1);for(const n of nodes.filter(n=>n.type==='Circle'))assert.ok(!/^#[a-f0-9]{8}$/i.test(n.props.fill));for(const {graph} of r.graphs)graph.__detach();
});
