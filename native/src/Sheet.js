import React,{useEffect,useRef,useState} from 'react';
import {Animated,Easing,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from './icons';
import {fontFor,palette} from './design.mjs';
import {sheetHeight} from './sheet-layout.mjs';
import ScreenEntrance from './ScreenEntrance';
export default function Sheet({c,title,onClose,children,error,reduced=false}){
 const insets=useSafeAreaInsets(),{height}=useWindowDimensions(),[available,setAvailable]=useState(height),[header,setHeader]=useState(86),[content,setContent]=useState(null);
 const progress=useRef(new Animated.Value(reduced?1:0)).current,measured=content!==null;
 useEffect(()=>{if(!measured&&!reduced)return;if(reduced){progress.setValue(1);return;}const animation=Animated.timing(progress,{toValue:1,duration:280,easing:Easing.bezier(.22,1,.36,1),useNativeDriver:true,isInteraction:false});animation.start();return()=>animation.stop();},[measured,reduced,progress]);
 const measure=(setter,value)=>setter(old=>old===value?old:value);
 return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
  <View style={styles.root}>
   <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'#25163840',opacity:progress}]}><Pressable accessibilityRole="button" accessibilityLabel={c.t('Cerrar')} onPress={onClose} style={StyleSheet.absoluteFill}/></Animated.View>
   <KeyboardAvoidingView pointerEvents="box-none" style={styles.root} behavior={Platform.OS==='ios'?'padding':'height'}>
    <View pointerEvents="box-none" onLayout={e=>measure(setAvailable,e.nativeEvent.layout.height)} style={styles.position}>
     <Animated.View testID="native-sheet" accessibilityViewIsModal style={[styles.panel,{height:sheetHeight(available,insets.top,header,content),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[height,0]})}]}]}>
      <View onLayout={e=>measure(setHeader,e.nativeEvent.layout.height)}><View style={styles.handle}/><View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.t('Cerrar')} onPress={onClose} style={styles.close}><Icon name="close" size={20} color="#AC96BE"/></Pressable></View></View>
      <ScrollView testID="sheet-scroll" style={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={false} onContentSizeChange={(_,h)=>measure(setContent,h)} contentContainerStyle={{paddingHorizontal:22,paddingBottom:22+insets.bottom}}>
       <ScreenEntrance key={title} reduced={reduced}>{!!error&&<Text accessibilityRole="alert" style={styles.error}>{c.t(error)}</Text>}{children}</ScreenEntrance>
      </ScrollView>
     </Animated.View>
    </View>
   </KeyboardAvoidingView>
  </View>
 </Modal>;
}
const styles=StyleSheet.create({root:{flex:1},position:{flex:1,justifyContent:'flex-end'},panel:{borderTopLeftRadius:28,borderTopRightRadius:28,backgroundColor:'#FDFBFF',borderWidth:1,borderColor:'#EAE4F0',overflow:'hidden'},scroll:{flex:1,minHeight:0},handle:{width:32,height:4,borderRadius:3,alignSelf:'center',backgroundColor:'#DED6E7',marginTop:8},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:22,paddingRight:12,paddingTop:12,paddingBottom:12,gap:12},title:{flex:1,fontFamily:fontFor(800),fontSize:23,letterSpacing:-.6,color:palette.ink,includeFontPadding:false},close:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},error:{fontFamily:fontFor(400),fontSize:13,color:'#8B2236',marginBottom:14}});
