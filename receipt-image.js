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
export async function prepareOCRImage(blob,{signal,rotation=0,crop=null,enhance=false,autoCrop=true,maxDimension=4200}={}) {
  cancelled(signal);
  const url=URL.createObjectURL(blob);
  try {
    const image=new Image();image.src=url;await image.decode();cancelled(signal);
    if(!image.width||!image.height||image.width*image.height>80000000)throw new Error('OCR_IMAGE');
    rotation=((rotation%360)+360)%360;
    const side=rotation===90||rotation===270,width=side?image.height:image.width,height=side?image.width:image.height;
    const bounds=crop||(autoCrop?paperBounds(image,rotation,width,height):null)||{x:0,y:0,right:1,bottom:1};
    const left=Math.max(0,Math.min(.99,bounds.x)),top=Math.max(0,Math.min(.99,bounds.y));
    const cw=Math.max(.01,Math.min(1,bounds.right)-left)*width,ch=Math.max(.01,Math.min(1,bounds.bottom)-top)*height;
    const scale=Math.min(2,maxDimension/Math.max(cw,ch),Math.sqrt(6000000/(cw*ch)));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(cw*scale));canvas.height=Math.max(1,Math.round(ch*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:enhance});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.scale(scale,scale);ctx.translate(-left*width,-top*height);paint(ctx,image,rotation,width,height);ctx.restore();
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
    cancelled(signal);
    const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    cancelled(signal);if(!result)throw new Error('OCR_IMAGE');return result;
  } finally {URL.revokeObjectURL(url);}
}
