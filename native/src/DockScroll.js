import React,{createContext,forwardRef,useContext} from 'react';
import {FlatList,ScrollView} from 'react-native';
export const DockScrollContext=createContext(null);
function tracked(Component){return forwardRef(function DockTrackedScroll(props,ref){
 const events=useContext(DockScrollContext);
 if(!events||props.horizontal)return <Component {...props} ref={ref}/>;
 const handlers={};for(const name of ['onScroll','onScrollBeginDrag','onScrollEndDrag','onMomentumScrollBegin','onMomentumScrollEnd'])handlers[name]=event=>{events[name](event);props[name]?.(event);};
 return <Component {...props} {...handlers} ref={ref} scrollEventThrottle={props.scrollEventThrottle??16}/>;
});}
export const TrackedScrollView=tracked(ScrollView);
export const TrackedFlatList=tracked(FlatList);
