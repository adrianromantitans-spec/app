// OCR keeps its own high-detail image; the shared receipt remains small.
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');};
function paint(ctx,image,rotation,width,height) {
  ctx.translate(width/2,height/2);ctx.rotate(rotation*Math.PI/180);
  ctx.drawImage(image,-image.width/2,-image.height/2);
}
function paperBounds(image,rotation,width,height) {
  const scale=240/Math.max(width,height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.scale(scale,scale);paint(ctx,image,rotation,width,height);
  const pixels=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h),lum=new Uint8Array(w*h);
  const histogram=new Uint32Array(256);
  for(let i=0;i<lum.length;i++){const p=i*4;lum[i]=Math.round(pixels[p]*.299+pixels[p+1]*.587+pixels[p+2]*.114);histogram[lum[i]]++;}
  let sum=0,bright=200;
  for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=lum.length*.8){bright=Math.max(165,i-12);break;}}
  for(let i=0;i<mask.length;i++){
    const p=i*4,saturation=Math.max(pixels[p],pixels[p+1],pixels[p+2])-Math.min(pixels[p],pixels[p+1],pixels[p+2]);
    mask[i]=lum[i]>=bright&&saturation<75?1:0;
  }
  const queue=new Int32Array(w*h);let best=null;
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;
    let head=0,tail=1;queue[0]=i;mask[i]=0;
    let left=w,top=h,right=0,bottom=0;
    while(head<tail){
      const index=queue[head++],x=index%w,y=Math.floor(index/w);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of [x?index-1:-1,x<w-1?index+1:-1,y?index-w:-1,y<h-1?index+w:-1])if(next>=0&&mask[next]){mask[next]=0;queue[tail++]=next;}
    }
    if(!best||tail>best.count)best={left,top,right,bottom,count:tail};
  }
  if(!best)return null;
  const bw=best.right-best.left+1,bh=best.bottom-best.top+1,area=bw*bh;
  // Crop only a large, solid, bright paper region against a darker background.
  // White tables or uncertain shapes leave the complete photo untouched.
  if(area<mask.length*.12||area>mask.length*.9||best.count/area<.68)return null;
  let outside=0,count=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<best.left||x>best.right||y<best.top||y>best.bottom){outside+=lum[y*w+x];count++;}
  let inside=0;for(let y=best.top;y<=best.bottom;y++)for(let x=best.left;x<=best.right;x++)inside+=lum[y*w+x];
  if(!count||inside/area-outside/count<25)return null;
  const pad=.025;
  return {x:Math.max(0,best.left/w-pad),y:Math.max(0,best.top/h-pad),right:Math.min(1,(best.right+1)/w+pad),bottom:Math.min(1,(best.bottom+1)/h+pad)};
}
// Locate dark print on warm receipt paper, excluding bright screens and white
// keyboard legends. Projection profiles estimate the line angle, not the desk.
function receiptTextRegion(image,rotation,width,height) {
  const scale=Math.min(1,1100/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.scale(scale,scale);paint(ctx,image,rotation,width,height);
  const data=ctx.getImageData(0,0,w,h).data,stride=w+1,size=stride*(h+1);
  const ir=new Uint32Array(size),ig=new Uint32Array(size),ib=new Uint32Array(size);
  for(let y=0;y<h;y++){
    let r=0,g=0,b=0;
    for(let x=0;x<w;x++){
      const p=(y*w+x)*4,k=(y+1)*stride+x+1;r+=data[p];g+=data[p+1];b+=data[p+2];
      ir[k]=ir[k-stride]+r;ig[k]=ig[k-stride]+g;ib[k]=ib[k-stride]+b;
    }
  }
  const mask=new Uint8Array(w*h),queue=new Int32Array(w*h),points=[];
  const mean=(a,x1,y1,x2,y2)=>(a[y2*stride+x2]-a[y1*stride+x2]-a[y2*stride+x1]+a[y1*stride+x1])/((x2-x1)*(y2-y1));
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const x1=Math.max(0,x-10),y1=Math.max(0,y-10),x2=Math.min(w,x+11),y2=Math.min(h,y+11);
    const r=mean(ir,x1,y1,x2,y2),g=mean(ig,x1,y1,x2,y2),b=mean(ib,x1,y1,x2,y2),average=.299*r+.587*g+.114*b,p=(y*w+x)*4;
    const gray=.299*data[p]+.587*data[p+1]+.114*data[p+2];
    if(average>95&&average<235&&r-b>r*.12&&r-g<r*.23&&gray<average-24&&gray<average*.76)mask[y*w+x]=1;
  }
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;
    let head=0,tail=1,left=w,top=h,right=0,bottom=0;queue[0]=i;mask[i]=0;
    while(head<tail){
      const index=queue[head++],x=index%w,y=Math.floor(index/w);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of [x?index-1:-1,x<w-1?index+1:-1,y?index-w:-1,y<h-1?index+w:-1])if(next>=0&&mask[next]){mask[next]=0;queue[tail++]=next;}
    }
    if(tail>=3&&tail<2500&&right-left<90&&bottom-top<75&&bottom-top>=2)for(let j=0;j<tail;j++)points.push(queue[j]);
  }
  if(points.length<350)return null;
  const xs=new Float32Array(points.length),ys=new Float32Array(points.length);
  for(let i=0;i<points.length;i++){xs[i]=points[i]%w-w/2;ys[i]=Math.floor(points[i]/w)-h/2;}
  const offset=w+h,bins=new Uint32Array(offset*2+1);
  const score=angle=>{
    bins.fill(0);const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    for(let i=0;i<xs.length;i++)bins[Math.round(-xs[i]*s+ys[i]*c)+offset]++;
    let result=0;for(const n of bins)result+=n*n;return result;
  };
  let angle=0,best=0;const scores=[];
  for(let a=-40;a<=40;a+=2){const value=score(a);scores.push(value);if(value>best){best=value;angle=a;}}
  const coarse=angle;for(let a=coarse-2;a<=coarse+2;a+=.2){const value=score(a);if(value>best){best=value;angle=a;}}
  scores.sort((a,b)=>a-b);if(best<scores[Math.floor(scores.length/2)]*1.12)return null;
  const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const rw=w*Math.abs(c)+h*Math.abs(s),rh=w*Math.abs(s)+h*Math.abs(c);
  for(let i=0;i<xs.length;i++){const x=xs[i],y=ys[i];xs[i]=x*c+y*s+rw/2;ys[i]=-x*s+y*c+rh/2;}
  xs.sort();ys.sort();const low=Math.floor(xs.length*.015),high=Math.floor(xs.length*.985);
  const padX=(xs[high]-xs[low])*.06,padY=(ys[high]-ys[low])*.035;
  return {angle,rotation:rotation-angle,x:Math.max(0,(xs[low]-padX)/rw),y:Math.max(0,(ys[low]-padY)/rh),right:Math.min(1,(xs[high]+padX)/rw),bottom:Math.min(1,(ys[high]+padY)/rh)};
}

// Remove only repeated dot leaders; isolated decimal points stay intact.
function cleanPrint(pixels,width,height,removeLeaders) {
  const data=pixels.data,stride=width+1,integral=new Uint32Array(stride*(height+1));
  for(let y=0;y<height;y++){
    let sum=0;for(let x=0;x<width;x++){const p=(y*width+x)*4;sum+=Math.round(.299*data[p]+.587*data[p+1]+.114*data[p+2]);const k=(y+1)*stride+x+1;integral[k]=integral[k-stride]+sum;}
  }
  const ink=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const x1=Math.max(0,x-15),x2=Math.min(width,x+16),y1=Math.max(0,y-15),y2=Math.min(height,y+16),p=(y*width+x)*4;
    const average=(integral[y2*stride+x2]-integral[y1*stride+x2]-integral[y2*stride+x1]+integral[y1*stride+x1])/((x2-x1)*(y2-y1));
    const gray=.299*data[p]+.587*data[p+1]+.114*data[p+2];ink[y*width+x]=gray<average-13?1:0;
    data[p]=data[p+1]=data[p+2]=ink[y*width+x]?0:255;
  }
  if(!removeLeaders)return;
  const queue=new Int32Array(width*height),dots=[];
  for(let i=0;i<ink.length;i++){
    if(!ink[i])continue;
    let head=0,tail=1,left=width,top=height,right=0,bottom=0;queue[0]=i;ink[i]=0;
    while(head<tail){
      const index=queue[head++],x=index%width,y=Math.floor(index/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      for(const next of [x?index-1:-1,x<width-1?index+1:-1,y?index-width:-1,y<height-1?index+width:-1])if(next>=0&&ink[next]){ink[next]=0;queue[tail++]=next;}
    }
    const w=right-left+1,h=bottom-top+1;
    if(tail>=2&&w<20&&h<20&&w/h>.45&&w/h<2.2)dots.push({left,top,right,bottom,cy:(top+bottom)/2,w,h});
  }
  dots.sort((a,b)=>a.left-b.left);
  const used=new Set();
  for(let i=0;i<dots.length;i++){
    if(used.has(i))continue;
    const run=[i];let last=dots[i];
    for(let j=i+1;j<dots.length;j++){
      const dot=dots[j],gap=dot.left-last.right;
      if(gap>Math.max(12,last.w*5))break;
      if(used.has(j)||gap<1||Math.abs(dot.cy-last.cy)>Math.max(3,last.h)||dot.w/last.w>2||dot.w/last.w<.5)continue;
      run.push(j);last=dot;
    }
    if(run.length<8)continue;
    for(const index of run){
      used.add(index);const dot=dots[index];
      for(let y=dot.top;y<=dot.bottom;y++)for(let x=dot.left;x<=dot.right;x++){const p=(y*width+x)*4;data[p]=data[p+1]=data[p+2]=255;}
    }
  }
}

export async function receiptTextRows(blob,{signal}={}) {
  cancelled(signal);const url=URL.createObjectURL(blob);
  try {
    const image=new Image();image.src=url;await image.decode();cancelled(signal);
    const scale=Math.min(1,1400/Math.max(image.width,image.height)),w=Math.round(image.width*scale),h=Math.round(image.height*scale);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
    const pixels=ctx.getImageData(0,0,w,h);cleanPrint(pixels,w,h,false);
    const ink=new Uint8Array(w*h),queue=new Int32Array(w*h),letters=[];
    for(let i=0;i<ink.length;i++)ink[i]=pixels.data[i*4]<128?1:0;
    for(let i=0;i<ink.length;i++){
      if(!ink[i])continue;
      let head=0,tail=1,left=w,top=h,right=0,bottom=0;queue[0]=i;ink[i]=0;
      while(head<tail){
        const index=queue[head++],x=index%w,y=Math.floor(index/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        for(const next of [x?index-1:-1,x<w-1?index+1:-1,y?index-w:-1,y<h-1?index+w:-1])if(next>=0&&ink[next]){ink[next]=0;queue[tail++]=next;}
      }
      const height=bottom-top+1,width=right-left+1;
      if(tail>=5&&height>=h*.008&&height<h*.18&&width<w*.2&&width>1)letters.push({left,right,top,bottom,height,cy:(top+bottom)/2});
    }
    letters.sort((a,b)=>b.height-a.height);const rows=[];
    for(const letter of letters){
      let row=rows.find(row=>Math.abs(row.cy-letter.cy)<row.height*.32&&Math.min(row.bottom,letter.bottom)-Math.max(row.top,letter.top)>Math.min(row.height,letter.height)*.45);
      if(!row){rows.push({...letter,count:1});continue;}
      row.top=Math.min(row.top,letter.top);row.bottom=Math.max(row.bottom,letter.bottom);row.left=Math.min(row.left,letter.left);row.right=Math.max(row.right,letter.right);row.cy=(row.cy*row.count+letter.cy)/(row.count+1);row.count++;
    }
    return rows.filter(row=>row.count>=3&&row.right-row.left>w*.15).sort((a,b)=>b.height-a.height).slice(0,8).map(row=>({x:0,y:Math.max(0,(row.top-h*.004)/h),right:1,bottom:Math.min(1,(row.bottom+h*.004)/h)}));
  } finally {URL.revokeObjectURL(url);}
}

export async function prepareOCRImage(blob,{signal,rotation=0,crop=null,enhance=false,autoCrop=true,maxDimension=4200,isolateText=false,stretchX=1,binarize=false,removeLeaders=false}={}) {
  cancelled(signal);
  const url=URL.createObjectURL(blob);
  try {
    const image=new Image();image.src=url;await image.decode();cancelled(signal);
    if(!image.width||!image.height||image.width*image.height>80000000)throw new Error('OCR_IMAGE');
    rotation=((rotation%360)+360)%360;
    const side=rotation===90||rotation===270;
    let width=side?image.height:image.width,height=side?image.width:image.height;
    const textRegion=isolateText?receiptTextRegion(image,rotation,width,height):null;
    if(textRegion){
      rotation=textRegion.rotation;
      const a=rotation*Math.PI/180;width=image.width*Math.abs(Math.cos(a))+image.height*Math.abs(Math.sin(a));height=image.width*Math.abs(Math.sin(a))+image.height*Math.abs(Math.cos(a));
    }
    const bounds=textRegion||crop||(autoCrop?paperBounds(image,rotation,width,height):null)||{x:0,y:0,right:1,bottom:1};
    const left=Math.max(0,Math.min(.99,bounds.x)),top=Math.max(0,Math.min(.99,bounds.y));
    const cw=Math.max(.01,Math.min(1,bounds.right)-left)*width,ch=Math.max(.01,Math.min(1,bounds.bottom)-top)*height;
    const scale=Math.min(2,maxDimension/Math.max(cw*stretchX,ch),Math.sqrt(6000000/(cw*ch*stretchX)));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(cw*scale*stretchX));canvas.height=Math.max(1,Math.round(ch*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:enhance});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.scale(scale*stretchX,scale);ctx.translate(-left*width,-top*height);paint(ctx,image,rotation,width,height);ctx.restore();
    if(enhance){
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),histogram=new Uint32Array(256),data=pixels.data;
      for(let p=0;p<data.length;p+=4){const gray=Math.round(.299*data[p]+.587*data[p+1]+.114*data[p+2]);histogram[gray]++;data[p]=gray;}
      let sum=0,lo=0,hi=255;const count=data.length/4;
      for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=count*.01){lo=i;break;}}
      sum=0;for(let i=255;i>=0;i--){sum+=histogram[i];if(sum>=count*.01){hi=i;break;}}
      const contrast=255/Math.max(80,hi-lo);
      for(let p=0;p<data.length;p+=4){const gray=Math.max(0,Math.min(255,Math.round((data[p]-lo)*contrast)));data[p]=data[p+1]=data[p+2]=gray;}
      ctx.putImageData(pixels,0,0);
    }
    if(binarize||removeLeaders){const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);cleanPrint(pixels,canvas.width,canvas.height,removeLeaders);ctx.putImageData(pixels,0,0);}
    cancelled(signal);
    const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    cancelled(signal);if(!result)throw new Error('OCR_IMAGE');return result;
  } finally {URL.revokeObjectURL(url);}
}
