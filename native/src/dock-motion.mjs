// Only user-driven vertical scroll may compact the dock. Layout/restore events are ignored.
export function createDockScroll({onCompact,schedule=setTimeout,cancel=clearTimeout,idleMs=280}){
 let dragging=false,momentum=false,lastY=null,timer=null,disposed=false;
 const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
 const idle=()=>{clear();timer=schedule(()=>{timer=null;if(!disposed&&!dragging&&!momentum)onCompact(false);},idleMs);};
 const yOf=event=>Math.max(0,Number(event?.nativeEvent?.contentOffset?.y)||0);
 return {
  onScrollBeginDrag(event){if(disposed)return;clear();dragging=true;lastY=yOf(event);},
  onScroll(event){if(disposed||!dragging&&!momentum)return;const y=yOf(event),distance=lastY===null?0:Math.abs(y-lastY);lastY=y;if(distance>=.5)onCompact(true);},
  onScrollEndDrag(){if(disposed)return;dragging=false;idle();},
  onMomentumScrollBegin(){if(disposed)return;clear();momentum=true;},
  onMomentumScrollEnd(){if(disposed)return;momentum=false;idle();},
  reset(){if(disposed)return;clear();dragging=momentum=false;lastY=null;onCompact(false);},
  dispose(){clear();dragging=momentum=false;disposed=true;}
 };
}
export function dockIndex(page){return page==='groups'||page==='groupSettings'?1:page==='activity'?3:page==='profile'||page==='notifications'?4:0;}
export function dockSlotLeft(width,index){return 5+(width-10)/5*(index+.5)-20;}
export function navigationDirection(previous,next){
 const routes=['home','groups','activity','profile'],from=routes.indexOf(previous),to=routes.indexOf(next);
 return from<0||to<0||from===to?0:Math.sign(to-from);
}
