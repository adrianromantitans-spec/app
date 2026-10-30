import {prepareOCRImage} from './receipt-image.js?v=ocr-17';
import {tr,ui} from './i18n.js?v=ocr-17';
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
export function closeReceiptCrop(form) {
  form.receiptEditorAttempt=null;
  const editor=form.querySelector('.receipt-crop-editor');if(editor){editor.replaceChildren();editor.hidden=true;}
  const read=form.querySelector('[data-receipt-action=read]');if(read&&!form.receiptOCRController)read.disabled=false;
}
export function applyReceiptCrop(form) {
  const box=form.receiptEditorBox;
  if(!box||box.right-box.x<.04||box.bottom-box.y<.04)return false;
  form.receiptOCRCrop={...box};closeReceiptCrop(form);return true;
}
export async function openReceiptCrop(form,rotate=false) {
  const attempt={};form.receiptEditorAttempt=attempt;
  if(rotate){form.receiptOCRRotation=((form.receiptOCRRotation||0)+90)%360;form.receiptOCRCrop=null;}
  const editor=form.querySelector('.receipt-crop-editor');editor.hidden=false;
  const read=form.querySelector('[data-receipt-action=read]');read.disabled=true;
  editor.innerHTML=tr('<p class="receipt-read-status">Preparando la foto para recortar…</p>');
  try {
    const blob=await prepareOCRImage(form.receiptOCRSource||form.receiptBlob,{rotation:form.receiptOCRRotation||0,autoCrop:false,maxDimension:1000});
    const url=URL.createObjectURL(blob);let image;
    try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
    if(!form.isConnected||form.receiptEditorAttempt!==attempt)return;
    editor.innerHTML=ui`<p>Arrastra sobre la foto para marcar solo el ticket. Con el teclado, usa las flechas para mover el recorte y + o − para ajustar su tamaño.</p><canvas tabindex="0" role="img" aria-label="Seleccionar la zona del ticket"></canvas><p class="form-note">El recorte solo se usa para leer; se conserva la foto adjunta.</p><div class="receipt-reader-actions"><button type="button" class="button secondary" data-receipt-action="read-crop">Leer esta zona</button><button type="button" class="text-button" data-receipt-action="crop-cancel">Volver</button></div>`;
    const canvas=editor.querySelector('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');
    form.receiptEditorBox={...(form.receiptOCRCrop||{x:0,y:0,right:1,bottom:1})};
    const draw=()=>{
      const b=form.receiptEditorBox,w=canvas.width,h=canvas.height;
      ctx.clearRect(0,0,w,h);ctx.drawImage(image,0,0);ctx.fillStyle='#21152f99';
      ctx.fillRect(0,0,w,b.y*h);ctx.fillRect(0,b.bottom*h,w,(1-b.bottom)*h);
      ctx.fillRect(0,b.y*h,b.x*w,(b.bottom-b.y)*h);ctx.fillRect(b.right*w,b.y*h,(1-b.right)*w,(b.bottom-b.y)*h);
      ctx.strokeStyle='#9763ff';ctx.lineWidth=Math.max(3,w/150);ctx.setLineDash([10,5]);
      ctx.strokeRect(b.x*w,b.y*h,(b.right-b.x)*w,(b.bottom-b.y)*h);
    };
    const point=event=>{const r=canvas.getBoundingClientRect();return {x:clamp((event.clientX-r.left)/r.width),y:clamp((event.clientY-r.top)/r.height)};};
    let start=null,previous=null;
    canvas.addEventListener('pointerdown',event=>{event.preventDefault();start=point(event);previous={...form.receiptEditorBox};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{
      if(!start)return;const p=point(event);
      form.receiptEditorBox={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),right:Math.max(start.x,p.x),bottom:Math.max(start.y,p.y)};draw();
    });
    const end=()=>{if(!start)return;const b=form.receiptEditorBox;if(b.right-b.x<.04||b.bottom-b.y<.04)form.receiptEditorBox=previous;start=null;draw();};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('keydown',event=>{
      const b=form.receiptEditorBox,w=b.right-b.x,h=b.bottom-b.y;
      if(event.key.startsWith('Arrow')){
        event.preventDefault();let dx=event.key==='ArrowLeft'?-.02:event.key==='ArrowRight'?.02:0,dy=event.key==='ArrowUp'?-.02:event.key==='ArrowDown'?.02:0;
        dx=clamp(dx,-b.x,1-b.right);dy=clamp(dy,-b.y,1-b.bottom);b.x+=dx;b.right+=dx;b.y+=dy;b.bottom+=dy;
      }else if(['+','=','-','−'].includes(event.key)){
        event.preventDefault();const inset=['+','='].includes(event.key)?.02:-.02;
        if(inset<0||w>.1&&h>.1){b.x=clamp(b.x+inset);b.y=clamp(b.y+inset);b.right=clamp(b.right-inset);b.bottom=clamp(b.bottom-inset);}
      }else return;
      draw();
    });
    draw();canvas.focus({preventScroll:true});
  }catch(error){
    if(form.isConnected&&form.receiptEditorAttempt===attempt){closeReceiptCrop(form);form.querySelector('.receipt-read-status').textContent=tr('No se ha podido preparar la foto. Prueba con otra imagen.');}
  }
}
