// Host-free tests of the pinned React Native Animated graph, not an Android renderer.
// Only platform/bridge boundaries and default feature flags are stubbed.
const Module=require('node:module');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../..'),requireNative=Module.createRequire(root+'/package.json');const babel=requireNative('@babel/core');const rn=path.dirname(requireNative.resolve('react-native/package.json'));let tag=1;
global.__DEV__=false;const noop=()=>{};const helper={transformDataType:value=>typeof value==='string'&&value.endsWith('deg')?parseFloat(value)*Math.PI/180:value,API:new Proxy({},{get:()=>noop}),generateNewNodeTag:()=>tag++,generateNewAnimationId:()=>tag++,assertNativeAnimatedModule:noop,shouldUseNativeDriver:config=>config.useNativeDriver,nativeEventEmitter:{addListener:()=>({remove:noop})}};
const previous=Module._load;Module._load=function(request,parent,...args){
 if(request.endsWith('/NativeAnimatedHelper'))return {__esModule:true,default:helper};
 if(request.endsWith('/ReactNativeFeatureFlags'))return new Proxy({__esModule:true},{get:(obj,key)=>key==='__esModule'?true:()=>false});
 if(request.endsWith('/Utilities/Platform'))return {__esModule:true,default:{OS:'android'}};
 if(request.endsWith('/ReactNative/RendererProxy'))return {findNodeHandle:()=>1};
 if(request.endsWith('/ReactNative/FabricUIManager'))return {getFabricUIManager:()=>null};
 if(request.endsWith('/ReactPrivate/ReactNativePrivateInterface'))return {getNodeFromPublicInstance:()=>null};
 return previous.call(this,request,parent,...args);
};
const oldjs=Module._extensions['.js'];Module._extensions['.js']=function(mod,file){if(!file.startsWith(rn+'/'))return oldjs(mod,file);const code=babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,presets:[requireNative.resolve('@react-native/babel-preset')]}).code;mod._compile(code,file);};
const Value=requireNative(rn+'/Libraries/Animated/nodes/AnimatedValue').default,Style=requireNative(rn+'/Libraries/Animated/nodes/AnimatedStyle').default,Animation=requireNative(rn+'/Libraries/Animated/animations/Animation').default;
const flattenStyle=requireNative(rn+'/Libraries/StyleSheet/flattenStyle').default;
Module._load=previous;Module._extensions['.js']=oldjs;
module.exports={Value,Style,Animation,flattenStyle,babel,preset:requireNative.resolve('@react-native/babel-preset')};
