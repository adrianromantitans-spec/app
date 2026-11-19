import {useSafeAreaInsets} from 'react-native-safe-area-context';
import React,{createContext,forwardRef,useContext} from 'react';
import {FlatList,ScrollView,StyleSheet} from 'react-native';
export const DockScrollContext=createContext(null);
function tracked(Component){return forwardRef(function DockTrackedScroll(props,ref){
 const events=useContext(DockScrollContext),insets=useSafeAreaInsets();
 if(!events||props.horizontal)return <Component {...props} ref={ref}/>;
 // Keep the final row above the expanded 72px dock + 26px offset and a 16px gap.
 const content=StyleSheet.flatten(props.contentContainerStyle)||{},base=content.paddingBottom??content.paddingVertical??content.padding??0;
 const paddingBottom=Math.max(Number.isFinite(base)?base:0,Math.max(0,insets.bottom)+26+72+16);
 const handlers={};for(const name of ['onScroll','onScrollBeginDrag','onScrollEndDrag','onMomentumScrollBegin','onMomentumScrollEnd'])handlers[name]=event=>{events[name](event);props[name]?.(event);};
 return <Component {...props} {...handlers} contentContainerStyle={[props.contentContainerStyle,{paddingBottom}]} ref={ref} scrollEventThrottle={props.scrollEventThrottle??16}/>;
});}
export const TrackedScrollView=tracked(ScrollView);
export const TrackedFlatList=tracked(FlatList);
