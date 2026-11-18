import React,{useEffect,useRef,useState} from 'react';
import {Animated,Easing,Pressable,StyleSheet,useWindowDimensions,View,Text} from 'react-native';
import Svg,{Defs,RadialGradient,Stop,Rect} from 'react-native-svg';
import {openingZFrames} from './opening-motion.mjs';
import {palette,introSize,referenceIntro as reference} from './design.mjs';
// Preserve the web's assembly keyframes, 57% hold and 1161ms handoff.
export default function Opening({ready,anchor,onFinish,reduced}){
 const {width,height}=useWindowDimensions(),initialWidth=useRef(width),[held,setHeld]=useState(false),flying=useRef(false),overlay=useRef(null);
 const [frame,setFrame]=useState({x:0,y:0,width,height});
 const left=useRef(new Animated.Value(0)).current,z=useRef(new Animated.Value(0)).current,wordA=useRef(new Animated.Value(0)).current,flight=useRef(new Animated.Value(0)).current;
 const [size,setSize]=useState({width:145,height:48}),font=introSize(width),side=Math.min(28,Math.max(0,(width-size.width)/2-12));
 const ease=Easing.bezier(.22,1,.36,1),assembly=Easing.bezier(.16,1,.3,1),zFrames=useRef(openingZFrames()).current,zi=key=>z.interpolate({inputRange:zFrames.inputRange,outputRange:zFrames[key]});
 useEffect(()=>{
  if(reduced){onFinish();return;}
  const tick=(value,toValue,duration,easing=ease)=>Animated.timing(value,{toValue,duration,easing,useNativeDriver:true,isInteraction:false});
  const animation=Animated.parallel([
   tick(left,1,reference.assembly,assembly),tick(wordA,1,reference.opacityEnd,assembly),
   tick(z,1,reference.z,value=>value)
  ]);animation.start();const timer=setTimeout(()=>setHeld(true),reference.hold);
  return()=>{clearTimeout(timer);animation.stop();};
 },[]);
 useEffect(()=>{if(reduced||Math.abs(width-initialWidth.current)>40){onFinish();return;}if(ready&&held&&anchor){flying.current=true;const a=Animated.timing(flight,{toValue:1,duration:reference.flight,easing:ease,useNativeDriver:true,isInteraction:false});a.start(({finished})=>{if(finished)onFinish();});return()=>a.stop();}},[ready,held,anchor?.x,anchor?.y,anchor?.width,width,reduced,frame.x,frame.y,frame.width,frame.height]);
 const originX=(frame.width-size.width)/2,originY=(frame.height-size.height)/2;
 const scale=(anchor?.fontSize||font)/font;
 // Compensate for the default centre origin so the scaled word lands at the
 // header's top-left. Fixed glyph metrics let the entire flight run natively.
 const tx=anchor?anchor.x-frame.x-originX+size.width*(scale-1)/2:0,ty=anchor?anchor.y-frame.y-originY+size.height*(scale-1)/2:0;
 const measureFrame=()=>overlay.current?.measureInWindow((x,y,w,h)=>setFrame(old=>old.x===x&&old.y===y&&old.width===w&&old.height===h?old:{x,y,width:w,height:h}));
 const text={fontFamily:'ManropeExtraBold',fontWeight:'normal',fontSize:font,lineHeight:font*1.2,includeFontPadding:false,color:reference.ink,letterSpacing:-2.5};
 return <Pressable testID="opening-overlay" ref={overlay} onLayout={measureFrame} onPress={onFinish} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
  <Animated.View style={[StyleSheet.absoluteFill,{opacity:flight.interpolate({inputRange:[0,1],outputRange:[1,0]})}]}><Svg width="100%" height="100%"><Defs><RadialGradient id="intro-curtain" cx="50%" cy="42%" rx="70.7107%" ry="82.0244%"><Stop offset="0" stopColor={reference.curtain[0]}/><Stop offset=".48" stopColor={reference.curtain[1]}/><Stop offset="1" stopColor={reference.curtain[2]}/></RadialGradient></Defs><Rect width="100%" height="100%" fill="url(#intro-curtain)"/></Svg></Animated.View>
  <Animated.View onLayout={event=>{if(flying.current)return;const {width:w,height:h}=event.nativeEvent.layout;setSize(old=>old.width===w&&old.height===h?old:{width:w,height:h});}} style={{position:'absolute',left:originX,top:originY,flexDirection:'row',opacity:flight.interpolate({inputRange:[0,.85,1],outputRange:[1,1,0]}),transform:[{translateX:flight.interpolate({inputRange:[0,1],outputRange:[0,tx]})},{translateY:flight.interpolate({inputRange:[0,1],outputRange:[0,ty]})},{scale:flight.interpolate({inputRange:[0,1],outputRange:[1,scale]})}]}}>
   {/* All glyph metrics stay fixed; assembly and flight use native transforms/opacity. */}
   <Animated.View style={{opacity:wordA,transform:[{translateX:left.interpolate({inputRange:[0,1],outputRange:[-side,0]})}]}}><Animated.Text style={text}>Div</Animated.Text></Animated.View>
   <Animated.View style={{transformOrigin:'50% 85%',opacity:zi('opacity'),transform:[{translateY:zi('y')},{rotate:zi('rotate')},{scale:zi('scale')}]}}><Animated.Text style={[text,{color:reference.accent}]}>Z</Animated.Text></Animated.View>
   <Animated.View style={{opacity:wordA,transform:[{translateX:left.interpolate({inputRange:[0,1],outputRange:[side,0]})}]}}><Animated.Text style={text}>plit<Text style={{color:reference.accent}}>.</Text></Animated.Text></Animated.View>
  </Animated.View>
  {/* Blend into the exact header metrics over the last 15% of the same flight,
      avoiding a spacing snap when the fixed-size native scale hands over. */}
  {anchor&&<Animated.View style={{position:'absolute',left:anchor.x-frame.x,top:anchor.y-frame.y,flexDirection:'row',opacity:flight.interpolate({inputRange:[0,.85,1],outputRange:[0,0,1]})}}><Text style={[text,{color:palette.ink,fontSize:anchor.fontSize,lineHeight:anchor.fontSize*1.2,letterSpacing:anchor.letterSpacing}]}>Div</Text><Text style={[text,{color:reference.accent,fontSize:anchor.fontSize,lineHeight:anchor.fontSize*1.2,letterSpacing:anchor.letterSpacing}]}>Z</Text><Text style={[text,{color:palette.ink,fontSize:anchor.fontSize,lineHeight:anchor.fontSize*1.2,letterSpacing:anchor.letterSpacing}]}>plit<Text style={{color:reference.accent}}>.</Text></Text></Animated.View>}
 </Pressable>;
}
