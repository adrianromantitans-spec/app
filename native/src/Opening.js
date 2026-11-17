import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
// Same assembly durations/keyframes and 1539 + 1161 ms handoff as the existing web intro.
export default function Opening({ready,anchor,onFinish,reduced}){
 const {width,height}=useWindowDimensions(),initialWidth=useRef(width),[held,setHeld]=useState(false);
 const left=useRef(new Animated.Value(0)).current,zY=useRef(new Animated.Value(45)).current,zR=useRef(new Animated.Value(85)).current,zS=useRef(new Animated.Value(.8)).current,zA=useRef(new Animated.Value(0)).current,wordA=useRef(new Animated.Value(0)).current,flight=useRef(new Animated.Value(0)).current;
 const [size,setSize]=useState({width:250,height:70});const font=Math.min(60,width*.13),side=Math.min(28,Math.max(0,(width-size.width)/2-12));
 const ease=Easing.bezier(.22,1,.36,1),assembly=Easing.bezier(.16,1,.3,1);
 useEffect(()=>{
  if(reduced){onFinish();return;}
  const tick=(value,toValue,duration,easing=ease)=>Animated.timing(value,{toValue,duration,easing,useNativeDriver:true});
  const animation=Animated.parallel([
   tick(left,1,1350,assembly),tick(wordA,1,405,assembly),
   Animated.sequence([Animated.delay(387.5),tick(zA,1,201.5)]),
   Animated.sequence([Animated.delay(387.5),tick(zY,34,201.5),tick(zY,-5,589),tick(zY,1,217),tick(zY,0,155)]),
   Animated.sequence([Animated.delay(387.5),tick(zR,75,201.5),tick(zR,-9,589),tick(zR,3,217),tick(zR,0,155)]),
   Animated.sequence([Animated.delay(387.5),tick(zS,.9,201.5),tick(zS,1,961)])
  ]);animation.start();const timer=setTimeout(()=>setHeld(true),1539);
  return()=>{clearTimeout(timer);animation.stop();};
 },[]);
 useEffect(()=>{if(reduced||Math.abs(width-initialWidth.current)>40){onFinish();return;}if(ready&&held&&anchor){const a=Animated.timing(flight,{toValue:1,duration:1161,easing:ease,useNativeDriver:true});a.start(({finished})=>{if(finished)onFinish();});return()=>a.stop();}},[ready,held,anchor?.x,anchor?.y,width,reduced]);
 const targetScale=22/font,tx=anchor?anchor.x+anchor.width/2-width/2:0,ty=anchor?anchor.y+anchor.height/2-height/2:0;
 const text={fontFamily:'Manrope',fontWeight:'800',fontSize:font,color:'#19161d',letterSpacing:-font*.045};
 return <View pointerEvents="auto" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
  <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'#F8F5FD',opacity:flight.interpolate({inputRange:[0,1],outputRange:[1,0]})}]}/>
  <Animated.View onLayout={event=>setSize(event.nativeEvent.layout)} style={{position:'absolute',left:(width-size.width)/2,top:(height-size.height)/2,flexDirection:'row',transform:[{translateX:flight.interpolate({inputRange:[0,1],outputRange:[0,tx]})},{translateY:flight.interpolate({inputRange:[0,1],outputRange:[0,ty]})},{scale:flight.interpolate({inputRange:[0,1],outputRange:[1,targetScale]})}]}}>
   <Animated.Text style={[text,{opacity:wordA,transform:[{translateX:left.interpolate({inputRange:[0,1],outputRange:[-side,0]})}]}]}>Div</Animated.Text>
   <Animated.Text style={[text,{color:'#5C7043',opacity:zA,transform:[{translateY:zY},{rotate:zR.interpolate({inputRange:[-360,360],outputRange:['-360deg','360deg']})},{scale:zS}]}]}>Z</Animated.Text>
   <Animated.Text style={[text,{opacity:wordA,transform:[{translateX:left.interpolate({inputRange:[0,1],outputRange:[side,0]})}]}]}>plit.</Animated.Text>
  </Animated.View>
 </View>;
}
