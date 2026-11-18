// A finite viewport is essential: an unconstrained native ScrollView can lay out
// below Android's navigation bar instead of scrolling its last controls into view.
export function sheetHeight(available,top,header,content){
 const cap=Math.max(1,available-Math.max(0,top)-12);
 return content===null?cap:Math.max(1,Math.min(cap,header+content));
}
