// Sample the website's per-keyframe cubic-bezier once, then let the native
// interpolation graph run the whole Z rise without JS callbacks between segments.
function bezier(x,x1=.22,y1=1,x2=.36,y2=1){
 const sample=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
 let low=0,high=1;for(let i=0;i<24;i++){const middle=(low+high)/2;if(sample(middle,x1,x2)<x)low=middle;else high=middle;}
 return sample((low+high)/2,y1,y2);
}
export function openingZFrames(){
 const stops=[0,.25,.38,.76,.9,1],rows=[[45,85,.8,0],[45,85,.8,0],[34,75,.9,1],[-5,-9,1,1],[1,3,1,1],[0,0,1,1]],inputRange=[0],values=[rows[0]];
 for(let segment=1;segment<stops.length;segment++)for(let i=1;i<=24;i++){
  const t=i/24,e=i===24?1:bezier(t);inputRange.push(stops[segment-1]+(stops[segment]-stops[segment-1])*t);
  values.push(rows[segment-1].map((v,axis)=>v+(rows[segment][axis]-v)*e));
 }
 return {inputRange,y:values.map(v=>v[0]),rotate:values.map(v=>v[1]+'deg'),scale:values.map(v=>v[2]),opacity:values.map(v=>v[3])};
}
