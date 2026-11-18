import React,{useEffect,useRef,useState} from 'react';
import {Animated,Easing,Pressable,StyleSheet,useWindowDimensions,View,Text} from 'react-native';
import Svg,{Defs,RadialGradient,Stop,Rect} from 'react-native-svg';
import {introSize,referenceIntro as reference} from './design.mjs';
// Preserve the web's assembly keyframes, 57% hold and 1161ms handoff.
export default function Opening({ready,anchor,onFinish,reduced}){
 const {width,height}=useWindowDimensions(),initialWidth=useRef(width),[held,setHeld]=useState(false),flying=useRef(false),overlay=useRef(null);
 const [frame,setFrame]=useState({x:0,y:0,width,height});
 const left=useRef(new Animated.Value(0)).current,zY=useRef(new Animated.Value(45)).current,zR=useRef(new Animated.Value(85)).current,zS=useRef(new Animated.Value(.8)).current,zA=useRef(new Animated.Value(0)).current,wordA=useRef(new Animated.Value(0)).current,flight=useRef(new Animated.Value(0)).current;
 const [size,setSize]=useState({width:145,height:48}),font=introSize(width),side=Math.min(28,Math.max(0,(width-size.width)/2-12));
 const ease=Easing.bezier(.22,1,.36,1),assembly=Easing.bezier(.16,1,.3,1);
 useEffect(()=>{
  if(reduced){onFinish();return;}
  const tick=(value,toValue,duration,easing=ease)=>Animated.timing(value,{toValue,duration,easing,useNativeDriver:true});
  const animation=Animated.parallel([
   tick(left,1,reference.assembly,assembly),tick(wordA,1,reference.opacityEnd,assembly),
   Animated.sequence([Animated.delay(387.5),tick(zA,1,201.5)]),
   Animated.sequence([Animated.delay(387.5),tick(zY,34,201.5),tick(zY,-5,589),tick(zY,1,217),tick(zY,0,155)]),
   Animated.sequence([Animated.delay(387.5),tick(zR,75,201.5),tick(zR,-9,589),tick(zR,3,217),tick(zR,0,155)]),
   Animated.sequence([Animated.delay(387.5),tick(zS,.9,201.5),tick(zS,1,589)])
  ]);animation.start();const timer=setTimeout(()=>setHeld(true),reference.hold);
  return()=>{clearTimeout(timer);animation.stop();};
 },[]);
 useEffect(()=>{if(reduced||Math.abs(width-initialWidth.current)>40){onFinish();return;}if(ready&&held&&anchor){flying.current=true;const a=Animated.timing(flight,{toValue:1,duration:reference.flight,easing:ease,useNativeDriver:false});a.start(({finished})=>{if(finished)onFinish();});return()=>a.stop();}},[ready,held,anchor?.x,anchor?.y,anchor?.width,width,reduced,frame.x,frame.y,frame.width,frame.height]);
 const originX=(frame.width-size.width)/2,originY=(frame.height-size.height)/2;
 const tx=anchor?anchor.x-frame.x-originX:0,ty=anchor?anchor.y-frame.y-originY:0;
 const measureFrame=()=>overlay.current?.measureInWindow((x,y,w,h)=>setFrame(old=>old.x===x&&old.y===y&&old.width===w&&old.height===h?old:{x,y,width:w,height:h}));
 const text={fontFamily:'ManropeExtraBold',fontWeight:'normal',fontSize:flight.interpolate({inputRange:[0,1],outputRange:[font,anchor?.fontSize||font]}),lineHeight:flight.interpolate({inputRange:[0,1],outputRange:[font*1.2,(anchor?.fontSize||font)*1.2]}),includeFontPadding:false,color:reference.ink,letterSpacing:flight.interpolate({inputRange:[0,1],outputRange:[-2.5,anchor?.letterSpacing??-2.5]})};
 return <Pressable ref={overlay} onLayout={measureFrame} onPress={onFinish} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
  <Animated.View style={[StyleSheet.absoluteFill,{opacity:flight.interpolate({inputRange:[0,1],outputRange:[1,0]})}]}><Svg width="100%" height="100%"><Defs><RadialGradient id="intro-curtain" cx="50%" cy="42%" rx="70%" ry="70%"><Stop offset="0" stopColor={reference.curtain[0]}/><Stop offset=".48" stopColor={reference.curtain[1]}/><Stop offset="1" stopColor={reference.curtain[2]}/></RadialGradient></Defs><Rect width="100%" height="100%" fill="url(#intro-curtain)"/></Svg></Animated.View>
  <Animated.View onLayout={event=>{if(flying.current)return;const {width:w,height:h}=event.nativeEvent.layout;setSize(old=>old.width===w&&old.height===h?old:{width:w,height:h});}} style={{position:'absolute',left:originX,top:originY,flexDirection:'row',transform:[{translateX:flight.interpolate({inputRange:[0,1],outputRange:[0,tx]})},{translateY:flight.interpolate({inputRange:[0,1],outputRange:[0,ty]})}]}}>
   {/* Native transforms/opacity must not share an AnimatedProps graph with JS-driven font metrics. */}
   <Animated.View style={{opacity:wordA,transform:[{translateX:left.interpolate({inputRange:[0,1],outputRange:[-side,0]})}]}}><Animated.Text style={text}>Div</Animated.Text></Animated.View>
   <Animated.View style={{opacity:zA,transform:[{translateY:zY},{rotate:zR.interpolate({inputRange:[-360,360],outputRange:['-360deg','360deg']})},{scale:zS}]}}><Animated.Text style={[text,{color:reference.accent}]}>Z</Animated.Text></Animated.View>
   <Animated.View style={{opacity:wordA,transform:[{translateX:left.interpolate({inputRange:[0,1],outputRange:[side,0]})}]}}><Animated.Text style={text}>plit<Text style={{color:reference.accent}}>.</Text></Animated.Text></Animated.View>
  </Animated.View>
 </Pressable>;
}
