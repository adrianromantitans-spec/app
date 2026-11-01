import {tr} from './i18n.js?v=planning-30';

// Zero means no budget; monetary amounts remain integer minor units.
export function optionalBudget(value) {
 if(String(value??'').trim()==='')return 0;
 const text=String(value).trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error(tr('Indica un presupuesto válido o deja el campo vacío.'));
 const amount=Math.round(Number(text)*100);
 if(!Number.isSafeInteger(amount)||amount<100||amount>1000000000)throw new Error(tr('Indica un presupuesto válido o deja el campo vacío.'));
 return amount;
}
export function localDateTime(iso) {
 if(!iso)return '';
 const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
export function planClosed(item,now=Date.now()) {return !!item?.dueAt&&new Date(item.dueAt).getTime()<=now;}
export function planningFields(values,previous={},now=Date.now()) {
 const result={important:!!values.important};
 for(const key of ['dueAt','remindAt']) {
  const raw=values[key]||'';
  if(!raw){result[key]='';continue;}
  const date=new Date(raw);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)||!Number.isFinite(date.getTime())||localDateTime(date.toISOString())!==raw)throw new Error(tr('Revisa la fecha y la hora.'));
  // Preserve original seconds when the minute shown in the editor is unchanged.
  result[key]=localDateTime(previous[key])===raw?previous[key]:date.toISOString();
  if(result[key]!==previous[key]&&date.getTime()<=now)throw new Error(tr('Elige una fecha y hora futuras.'));
 }
 if(result.remindAt&&(!result.dueAt||new Date(result.remindAt)>=new Date(result.dueAt)))throw new Error(tr('El recordatorio debe ser anterior a la fecha límite.'));
 return result;
}
