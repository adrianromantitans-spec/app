import {prepareOCRImage} from './receipt-image.js?v=ocr-16';
// The pinned Tesseract 6 worker and language models are hosted with the app.
// Only image bytes are sent to this local worker; OCR text is never persisted.
export async function readReceipt(blob,{signal,onProgress=()=>{},rotation=0,crop=null}={}) {
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(!globalThis.Worker||!globalThis.WebAssembly)throw new Error('OCR_UNAVAILABLE');
  const base=new URL('./vendor/ocr/',import.meta.url);
  let worker=null;
  let pending=null,cancelled=null,sequence=0,attempt=0;
  const fail=error=>{cancelled=error;worker?.terminate();pending?.reject(error);pending=null;};
  const abort=()=>fail(new DOMException('Cancelled','AbortError'));
  const timeout=setTimeout(()=>fail(new Error('OCR_TIMEOUT')),90000);
  signal?.addEventListener('abort',abort,{once:true});
  const onMessage=({data:message})=>{
    if(message.status==='progress'){
      const progress=message.data?.status==='recognizing text'?Math.min(99,Math.round(30+(message.data.progress||0)*69)):null;
      onProgress(progress,attempt);return;
    }
    if(!pending||pending.id!==message.jobId)return;
    const job=pending;pending=null;
    if(message.status==='resolve')job.resolve(message.data);
    else job.reject(new Error('OCR_FAILED'));
  };
  const job=(action,payload)=>new Promise((resolve,reject)=>{
    if(cancelled||signal?.aborted){reject(cancelled||new DOMException('Cancelled','AbortError'));return;}
    const id=String(++sequence);pending={id,resolve,reject};
    worker.postMessage({workerId:'receipt',jobId:id,action,payload});
  });
  try {
    onProgress(null);
    const image=await prepareOCRImage(blob,{signal,rotation,crop});
    if(cancelled)throw cancelled;
    worker=new Worker(new URL('worker.min.js',base));
    worker.onerror=event=>{event.preventDefault();fail(new Error('OCR_FAILED'));};
    worker.onmessage=onMessage;
    await job('load',{options:{lstmOnly:true,corePath:base.href,logging:false}});
    await job('loadLanguage',{langs:'spa+eng+ron',options:{langPath:new URL('lang/',base).href,gzip:false,cacheMethod:'write',lstmOnly:true}});
    await job('initialize',{langs:'spa+eng+ron',oem:1,config:{}});
    let best=null;
    const recognize=async(source,mode)=>{
      attempt++;onProgress(null,attempt);
      await job('setParameters',{params:{tessedit_pageseg_mode:String(mode),preserve_interword_spaces:'1',user_defined_dpi:'300'}});
      const result=await job('recognize',{image:new Uint8Array(await source.arrayBuffer()),options:{rotateAuto:true},output:{text:true}});
      const text=result.text||'',confidence=result.confidence||0,details=parseReceipt(text);
      const words=(text.match(/[A-Za-zÀ-ž]{3,}/g)||[]).length;
      const reliable=confidence>=45&&words>=3;
      const score=(details.amount!==null&&reliable?1000:0)+(details.date?60:0)+(details.title?30:0)+confidence+Math.min(words,30);
      const candidate={text,confidence,score,reliable,total:details.amount!==null};
      if(!best||candidate.score>best.score)best=candidate;
      return candidate.total&&candidate.reliable;
    };
    if(await recognize(image,3))return best;
    const enhanced=await prepareOCRImage(image,{signal,autoCrop:false,enhance:true});
    if(await recognize(enhanced,6))return best;
    if(await recognize(enhanced,11))return best;
    // Deskew does not correct photos taken sideways or upside down.
    if(!(best.total&&best.reliable))for(const angle of [180,90,270]){
      const turned=await prepareOCRImage(enhanced,{signal,autoCrop:false,rotation:angle});
      if(await recognize(turned,6))break;
    }
    return best;
  } finally {
    clearTimeout(timeout);signal?.removeEventListener('abort',abort);worker?.terminate();
  }
}

const plain=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function centsFromText(text) {
  let value=text.replace(/[^\d.,]/g,'');
  if(!value)return null;
  const decimal=value.match(/[.,](\d{1,2})$/);
  if(decimal){const fractional=decimal[1].padEnd(2,'0');value=value.slice(0,decimal.index).replace(/[.,]/g,'')+'.'+fractional;}
  else value=value.replace(/[.,]/g,'');
  const cents=Math.round(Number(value)*100);
  return Number.isSafeInteger(cents)&&cents>0&&cents<=100000000?cents:null;
}
function dateFromText(text) {
  const dates=[...text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g)];
  for(const match of dates){
    let year=match[1]||match[6],month=match[2]||match[5],day=match[3]||match[4];
    if(year.length===2)year='20'+year;
    if(Number(year)<2000||Number(year)>2100)continue;
    const iso=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    const date=new Date(iso+'T12:00:00Z');
    if(!Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===iso)return iso;
  }
  return null;
}
export function parseReceipt(text='') {
  const lines=String(text).slice(0,50000).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const normal=plain(lines.join('\n'));
  const eur=/\bEUR\b|€/.test(normal),ron=/\bRON\b|\bLEI\b/.test(normal);
  const currency=eur&&!ron?'EUR':ron&&!eur?'RON':null;
  const candidates=[];
  for(let index=0;index<lines.length;index++){
    const line=plain(lines[index]).replace(/\bT[O0]TA[L1I]\b/g,'TOTAL');
    // Taxes, subtotals and cash/change are never treated as the final bill.
    if(!/\bTOTAL\b|\bAMOUNT\s+DUE\b|\bIMPORTE\s+A\s+PAGAR\b|\bDE\s+PLATA\b/.test(line))continue;
    if(/SUB\s*TOTAL|\b(?:TVA|IVA|VAT|TAX|AHORRO|SAVINGS|ARTICOLE|ITEMS|PRODUSE|DESCUENTO|DISCOUNT)\b|\bTOTAL\s+(?:CASH|CARD|EFECTIVO|TARJETA|NUMERAR|REST|CHANGE)\b/.test(line))continue;
    const tail=line.replace(/^.*?(?:\bTOTAL\b|\bAMOUNT\s+DUE\b|\bIMPORTE\s+A\s+PAGAR\b|\bDE\s+PLATA\b)/,'');
    const next=plain(lines[index+1]||'');
    const source=(/\d/.test(tail)?tail:/^(?:(?:EUR|RON|LEI|€)\s*)?\d[\d\s.,]*(?:\s*(?:EUR|RON|LEI|€))?$/.test(next)?next:'').replace(/(\d)\s*([.,])\s*(?=\d)/g,'$1$2');
    const amounts=[...source.matchAll(/\d+(?:[ .,'’]\d{3})*(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}/g)];
    if(!amounts.length||/[/:]|\d\s*%|(?:^|\s)[−-]\s*\d/.test(source)||/\b(?:REFUND|DEVOLUCION|STORNO)\b/.test(line))continue;
    const amount=centsFromText(amounts.at(-1)[0]);
    if(amount)candidates.push({amount,score:/GRAND\s+TOTAL|TOTAL\s+(?:A\s+PAGAR|DE\s+PLATA|PLATA|GENERAL)|AMOUNT\s+DUE|IMPORTE\s+A\s+PAGAR/.test(line)?2:1,index});
  }
  candidates.sort((a,b)=>b.score-a.score||b.index-a.index);
  const title=lines.slice(0,8).find(line=>{
    const clean=plain(line).replace(/\bT[O0]TA[L1I]\b/g,'TOTAL');
    return line.length>=3&&line.length<=100&&(clean.match(/[A-Z]/g)||[]).length>=3&&(clean.match(/[A-Z0-9]/g)||[]).length/clean.replace(/\s/g,'').length>=.7&&!/\b(?:TOTAL|SUBTOTAL|RECEIPT|TICKET|FACTURA|FISCAL|BON|FECHA|DATE|DATA|HORA|TIME|TVA|IVA|VAT|CIF|CUI|NIF|TEL|TELEFON|PHONE|CLIENTE|CLIENT|DUPLICADO|COPIA|ADDRESS|ADRESA|STRADA|CALLE|CARRER)\b/.test(clean)&&!dateFromText(line)&&!/\d+[.,]\d{2}\b/.test(clean)&&!/^[\d\s#*\-]+$/.test(clean);
  })||null;
  return {title,amount:candidates[0]?.amount??null,date:dateFromText(lines.join('\n')),currency,currencyAmbiguous:eur&&ron};
}
