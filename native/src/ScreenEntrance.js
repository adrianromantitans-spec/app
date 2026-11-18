import React,{useEffect,useRef} from 'react';
import {Animated,Easing} from 'react-native';
// Animate only compositor properties; never reflow text or rebuild layout per frame.
export default function ScreenEntrance({children,reduced=false,style}){
 const progress=useRef(new Animated.Value(reduced?1:0)).current;
 useEffect(()=>{if(reduced){progress.setValue(1);return;}const animation=Animated.timing(progress,{toValue:1,duration:220,easing:Easing.bezier(.22,1,.36,1),useNativeDriver:true,isInteraction:false});animation.start();return()=>animation.stop();},[progress,reduced]);
 return <Animated.View style={[style,{opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[10,0]})}]}]}>{children}</Animated.View>;
}
