import {openReceiptCrop,closeReceiptCrop,applyReceiptCrop} from './receipt-crop.js?v=ocr-16';
import {tr,ui} from './i18n.js?v=ocr-16';
import {readReceipt,parseReceipt} from './receipt-ocr.js?v=ocr-16';
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function receiptTools() {
  return ui`<section class="receipt-tools" hidden aria-label="Leer ticket"><p>Extrae el importe, la fecha y el comercio. La lectura se hace en tu dispositivo.</p><div class="receipt-reader-actions"><button type="button" class="button secondary" data-receipt-action="read">Leer ticket</button><button type="button" class="text-button" data-receipt-action="cancel" hidden>Cancelar lectura</button><button type="button" class="text-button" data-receipt-action="crop">Recortar para leer</button><button type="button" class="text-button" data-receipt-action="rotate">Girar foto</button></div><div class="receipt-crop-editor" hidden></div><p class="receipt-read-status" role="status" aria-live="polite"></p><div class="receipt-suggestions"></div></section>`;
}
export function cancelReceiptReader(form) {
  form?.receiptOCRController?.abort();
  if(form){form.receiptOCRController=null;form.receiptEditorAttempt=null;}
}
export function resetReceiptReader(form) {
  cancelReceiptReader(form);closeReceiptCrop(form);form.receiptOCRRotation=0;form.receiptOCRCrop=null;
  const tools=form.querySelector('.receipt-tools');
  if(!tools)return;
  tools.hidden=!form.receiptBlob;
  tools.querySelector('.receipt-read-status').textContent='';
  tools.querySelector('.receipt-suggestions').replaceChildren();
  tools.querySelector('[data-receipt-action=read]').disabled=false;
  tools.querySelector('[data-receipt-action=cancel]').hidden=true;
}
export async function handleReceiptAction(button,currency,onApplied) {
  const form=button.form;
  if(!form?.receiptBlob)return;
  const tools=form.querySelector('.receipt-tools');
  const status=tools.querySelector('.receipt-read-status');
  const results=tools.querySelector('.receipt-suggestions');
  if(button.dataset.receiptAction==='cancel'){form.receiptOCRController?.abort();return;}
  if(['crop','rotate'].includes(button.dataset.receiptAction)){
    cancelReceiptReader(form);results.replaceChildren();status.textContent='';
    tools.querySelector('[data-receipt-action=cancel]').hidden=true;
    await openReceiptCrop(form,button.dataset.receiptAction==='rotate');return;
  }
  if(button.dataset.receiptAction==='crop-cancel'){closeReceiptCrop(form);return;}
  if(button.dataset.receiptAction==='read-crop'){
    if(applyReceiptCrop(form))await handleReceiptAction(tools.querySelector('[data-receipt-action=read]'),currency,onApplied);
    return;
  }

  if(button.dataset.receiptAction==='apply'){
    const fields=[...results.querySelectorAll('[data-ocr-use]:checked')].map(box=>box.dataset.ocrUse);
    if(!fields.length){status.textContent=tr('Selecciona al menos un dato para usar.');return;}
    for(const name of fields){
      const input=results.querySelector(`[data-ocr-value="${name}"]`);
      if(!input.value.trim()||!input.checkValidity()){input.reportValidity();status.textContent=tr('Revisa los datos seleccionados.');return;}
    }
    for(const name of fields){
      if(form.elements[name].readOnly)continue;
      form.elements[name].value=results.querySelector(`[data-ocr-value="${name}"]`).value;
      form.elements[name].dispatchEvent(new Event('input',{bubbles:true}));
    }
    onApplied(form);results.replaceChildren();
    status.textContent=tr('Datos copiados. Revísalos y guarda el gasto cuando esté listo.');
    return;
  }
  cancelReceiptReader(form);
  const controller=new AbortController();form.receiptOCRController=controller;
  const active=()=>form.isConnected&&form.receiptOCRController===controller;
  const readButton=tools.querySelector('[data-receipt-action=read]');
  const cancelButton=tools.querySelector('[data-receipt-action=cancel]');
  readButton.disabled=true;cancelButton.hidden=false;results.replaceChildren();
  try {
    const result=await readReceipt(form.receiptOCRSource||form.receiptBlob,{signal:controller.signal,rotation:form.receiptOCRRotation||0,crop:form.receiptOCRCrop,onProgress:(progress,attempt)=>{
      if(active())status.textContent=attempt>1?tr('Mejorando la lectura del ticket…'):progress===null?tr('Preparando el lector… La primera vez puede tardar un poco.'):ui`Leyendo ticket… ${progress}%`;
    }});
    if(!active())return;
    const data=result.confidence>=25?parseReceipt(result.text):{title:null,amount:null,date:null,currency:null,currencyAmbiguous:false};
    if(data.amount===null&&data.date===null)data.title=null;
    const mismatch=data.currencyAmbiguous||(data.currency&&data.currency!==currency);
    const labels={title:tr('Comercio o concepto'),amount:ui`Importe (${data.currency||currency})`,date:tr('Fecha')};
    const rows=Object.entries({title:data.title,amount:data.amount===null?null:(data.amount/100).toFixed(2),date:data.date}).filter(([,value])=>value!==null);
    status.textContent=data.amount!==null?tr('Lectura terminada. Revisa los datos y elige cuáles usar.'):tr('No se ha podido identificar el total. Pulsa «Recortar para leer» y marca solo el ticket, sin el fondo.');
    results.innerHTML=(mismatch?tr('<p class="form-note receipt-currency-warning">La moneda del ticket no coincide o no está clara. Introduce el importe en la moneda del grupo; no se convierte automáticamente.</p>'):'')+
      (rows.length?`<div class="receipt-detected-fields">${rows.map(([name,value])=>{
        const locked=form.elements[name].readOnly||(name==='amount'&&mismatch);
        const checked=result.confidence>=45&&!locked&&(!form.elements[name].value||name==='date'&&form.dataset.edit!=='true'&&!form.receiptEditedFields?.has('date'));
        return `<div class="receipt-detected-field"><label class="participant"><input type="checkbox" data-ocr-use="${name}" ${locked?'disabled':''} ${checked?'checked':''}><span>${escapeHTML(labels[name])}</span></label><input class="receipt-detected-value" aria-label="${escapeHTML(labels[name])}" data-ocr-value="${name}" type="${name==='amount'?'number':name==='date'?'date':'text'}" value="${escapeHTML(value)}" ${locked?'disabled':''} ${name==='amount'?'min="0.01" max="1000000" step="0.01" inputmode="decimal"':name==='title'?'maxlength="100"':''}></div>`;
      }).join('')}</div><button type="button" class="button secondary full-width" data-receipt-action="apply">${tr('Usar datos seleccionados')}</button>`:'')+
      `<details class="receipt-ocr-text"><summary>${tr('Ver texto reconocido')}</summary><pre>${escapeHTML(result.text.slice(0,20000))}</pre></details>`;
  } catch(error) {
    if(active())status.textContent=error.name==='AbortError'?tr('Lectura cancelada. Puedes seguir introduciendo el gasto a mano.'):tr('No se ha podido leer el ticket. Prueba con una foto más nítida o introduce el gasto a mano.');
  } finally {
    if(active()){form.receiptOCRController=null;readButton.disabled=false;cancelButton.hidden=true;}
  }
}
