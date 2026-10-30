// Calendar-based recurrences keep the original day (31 Jan -> 28 Feb -> 31 Mar).
export function nextOccurrence(date,frequency,anchorDay=Number(date.slice(8))) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['weekly','monthly','yearly'].includes(frequency)) throw new Error('Repetición no válida');
  const d=new Date(date+'T12:00:00Z');
  if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==date)throw new Error('Fecha no válida');
  if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+7);
  else {const month=d.getUTCMonth()+(frequency==='yearly'?12:1);d.setUTCDate(1);d.setUTCMonth(month);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(anchorDay,last));}
  return d.toISOString().slice(0,10);
}
export function materializeRecurring(group,until,canEdit=()=>true,actor=null) {
  let count=0;
  for(const source of [...group.expenses]) {
    const r=source.recurrence;if(!r?.active||!canEdit(source)||!['weekly','monthly','yearly'].includes(r.frequency))continue;
    let limit=0;
    while(r.nextDate<=until&&limit++<60&&group.expenses.length<1000) {
      const date=r.nextDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<=source.date)break;
      const next=nextOccurrence(date,r.frequency,r.anchorDay);
      const id=source.id+':'+date;
      if(!group.expenses.some(e=>e.id===id)) {
        // A new charge never inherits the original charge's receipt.
        const {recurrence,receipt,...base}=source;
        group.expenses.unshift({...base,...(actor?{createdBy:actor}:{}),id,date,seriesId:source.id});count++;
      }
      r.nextDate=next;
    }
  }
  return count;
}
export async function prepareReceipt(file) {
  if(!file||!file.size)return null;
  if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)||file.size>20*1024*1024)throw new Error('Elige una foto de hasta 20 MB (JPG, PNG, WebP o HEIC compatible con tu navegador).');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    if(image.width*image.height>80000000)throw new Error();
    const scale=Math.min(1,1800/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
    if(!blob||blob.size>1024*1024)throw new Error('La foto es demasiado grande. Recorta el ticket e inténtalo de nuevo.');
    return blob;
  } catch(e){if(e.message?.startsWith('La foto'))throw e;throw new Error('No se ha podido leer la foto. Prueba a guardarla como JPG.');}
  finally{URL.revokeObjectURL(url);}
}
export function receiptPath(path,groupId) {return typeof path==='string'&&path.startsWith(groupId+'/')&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(path);}
