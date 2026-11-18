import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Pressable,StyleSheet,useWindowDimensions,View} from 'react-native';
import Svg,{Circle,Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {Icon} from './icons';
import {createDockScroll,dockIndex,dockSlotLeft} from './dock-motion.mjs';
import {palette,referenceSurface,gradientBounds} from './design.mjs';
const AnimatedRect=Animated.createAnimatedComponent(Rect);
export function useDockMotion({enabled,reduced,page}){
 const collapse=useRef(new Animated.Value(0)).current,target=useRef(false),[compact,setCompact]=useState(false),[reader,setReader]=useState(true);
 useEffect(()=>{let live=true;AccessibilityInfo.isScreenReaderEnabled().then(value=>{if(live)setReader(value);}).catch(()=>{});const listener=AccessibilityInfo.addEventListener('screenReaderChanged',setReader);return()=>{live=false;listener.remove();};},[]);
 const animate=useCallback(value=>{
  if(!enabled||reduced||reader){target.current=false;collapse.stopAnimation();collapse.setValue(0);setCompact(false);return;}
  value=!!value;if(target.current===value)return;
  target.current=value;setCompact(value);collapse.stopAnimation();
  Animated.spring(collapse,{toValue:value?1:0,stiffness:240,damping:28,mass:1,overshootClamping:true,useNativeDriver:false,isInteraction:false}).start();
 },[collapse,enabled,reduced,reader]);
 const events=useMemo(()=>createDockScroll({onCompact:animate}),[animate,page]);
 useEffect(()=>{events.reset();return()=>events.dispose();},[events]);
 useEffect(()=>()=>collapse.stopAnimation(),[collapse]);
 return {collapse,compact,events,expand:()=>events.reset()};
}
export default function Dock({c,ui,page,bottom,onNavigate,onAdd,motion,reduced}){
 const {Label}=ui,{width:windowWidth}=useWindowDimensions(),width=Math.max(240,windowWidth-36),index=dockIndex(page),selection=useRef(new Animated.Value(dockSlotLeft(width,index))).current;
 useEffect(()=>{
  selection.stopAnimation();const toValue=dockSlotLeft(width,index);
  if(reduced){selection.setValue(toValue);return;}
  const animation=Animated.spring(selection,{toValue,stiffness:420,damping:36,mass:1,useNativeDriver:true,isInteraction:false});animation.start();return()=>animation.stop();
 },[index,width,reduced,selection]);
 const a=motion.collapse,interpolate=(from,to)=>a.interpolate({inputRange:[0,1],outputRange:[from,to]}),fade=a.interpolate({inputRange:[0,.45,1],outputRange:[1,0,0]}),x=interpolate(1,(width-66)/2),y=interpolate(1,13),w=interpolate(width-2,66),h=interpolate(70,58),radius=interpolate(28,29);
 return <View testID="native-dock" pointerEvents="box-none" style={{position:'absolute',left:18,bottom,width,height:72}}>
  {/* Layout morph is JS driven; SVG coordinates have actual numeric bounds, no percentage padding bug. */}
  <Svg pointerEvents="none" width={width} height={72} style={StyleSheet.absoluteFill}><Defs><LinearGradient id="native-dock-glass" gradientUnits="userSpaceOnUse" {...gradientBounds(width,72,135)}><Stop offset="0" stopColor="#FFFFFF" stopOpacity={.72}/><Stop offset=".55" stopColor="#FFFFFF" stopOpacity={.47}/><Stop offset="1" stopColor="#F2E9FF" stopOpacity={.61}/></LinearGradient></Defs><AnimatedRect x={x} y={y} width={w} height={h} rx={radius} fill="url(#native-dock-glass)" stroke="#FFFFFF" strokeOpacity={.86} strokeWidth={2}/></Svg>
  {/* Keep the native-driven selector isolated from the JS-driven collapse opacity. */}
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity:fade}]}><Animated.View testID="dock-selector" style={{position:'absolute',left:0,top:6.75,width:40,height:40,transform:[{translateX:selection}]}}><Svg width={40} height={40}><Circle cx={20} cy={20} r={19} fill={referenceSurface.dock.selector} stroke="#E9DDFA99" strokeWidth={1}/></Svg></Animated.View></Animated.View>
  <View pointerEvents="box-none" style={{height:72,paddingHorizontal:5,flexDirection:'row',alignItems:'center'}}>{[['home','home','Inicio'],['groups','groups','Planes'],['plus','plus','Añadir'],['activity','activity','Actividad'],['profile','profile','Cuenta']].map(([route,icon,label],slot)=>{
   const plus=route==='plus',selected=!plus&&slot===index;
   return <Animated.View key={route} pointerEvents={!plus&&motion.compact?'none':'box-none'} accessibilityElementsHidden={!plus&&motion.compact} importantForAccessibility={!plus&&motion.compact?'no-hide-descendants':'auto'} style={{flex:1,height:58,opacity:plus?1:fade}}><Pressable accessibilityRole="button" accessibilityLabel={c.t(label)} accessibilityState={{selected}} onPressIn={motion.expand} onPress={()=>{motion.expand();plus?onAdd():onNavigate(route);}} style={({pressed})=>({height:58,alignItems:'center',justifyContent:'center',gap:5,opacity:pressed ? .72 : 1})}>
    {plus?<Animated.View style={{width:52,height:52,alignItems:'center',justifyContent:'center',transform:[{translateY:interpolate(0,6)}]}}><Svg pointerEvents="none" width={52} height={52} style={StyleSheet.absoluteFill}><Defs><LinearGradient id="native-dock-add" gradientUnits="userSpaceOnUse" {...gradientBounds(52,52,145)}><Stop offset="0" stopColor="#A570ED" stopOpacity={.72}/><Stop offset="1" stopColor="#8552DB" stopOpacity={.88}/></LinearGradient></Defs><Circle cx={26} cy={26} r={25} fill="url(#native-dock-add)" stroke="#FFFFFF80" strokeWidth={2}/></Svg><View pointerEvents="none" style={{zIndex:1}}><Icon name="plus" size={26} color="#FFF"/></View></Animated.View>:<><View style={{width:22,height:22,alignItems:'center',justifyContent:'center'}}><Icon name={icon} size={22} color={selected?palette.purple:referenceSurface.dock.ink}/></View><Label style={{fontSize:9,lineHeight:13.5,fontWeight:'600',color:selected?palette.purple:referenceSurface.dock.ink}}>{c.t(label)}</Label></>}
   </Pressable></Animated.View>;
  })}</View>
 </View>;
}
