import {tr,ui,locale} from './i18n.js?v=language-90';
import {money} from './model.js?v=language-90';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={
 'tasks.reminder':'Recordatorio de tarea','polls.reminder':'Recordatorio de votación',
 'group.created':'Grupo creado','group.updated':'Detalles del grupo modificados',
 'expenses.added':'Gasto añadido','expenses.updated':'Gasto modificado','expenses.deleted':'Gasto eliminado',
 'payments.added':'Pago confirmado','tasks.added':'Tarea añadida','tasks.updated':'Tarea modificada','tasks.deleted':'Tarea eliminada',
 'polls.added':'Votación añadida','polls.updated':'Votación modificada','polls.deleted':'Votación eliminada',
 'members.added':'Miembro incorporado','members.updated':'Miembro actualizado','members.deleted':'Miembro eliminado',
 'payment.requested':'Pago marcado como enviado','payment.rejected':'Pago no recibido','payment.cancelled':'Solicitud de pago cancelada'
};
export const activityEventLabel=kind=>tr(labels[kind]||'Cambio en el grupo');
const fields={fx:'Pago convertido',dueAt:'Fecha límite',remindAt:'Recordatorio',important:'Importante',title:'Concepto',amount:'Importe',payer:'Pagado por',participants:'Participantes',split:'Reparto',date:'Fecha',category:'Categoría',receipt:'Ticket',recurrence:'Repetición',done:'Completada',assignee:'Responsable',votes:'Votos',options:'Opciones',name:'Nombre',place:'Lugar',budget:'Presupuesto',currency:'Moneda',emoji:'Icono',type:'Tipo de grupo',endDate:'Fecha de vuelta',from:'De',to:'Para',from_id:'De',to_id:'Para',status:'Estado'};
export function paymentRequestsView(requests,viewerId,name,currency) {
 if(!requests.length)return `<p class="muted">${tr('No hay pagos pendientes de confirmar.')}</p>`;
 return `<div class="payment-requests">${requests.map(r=>`<article class="payment-request"><div><strong>${esc(name(r.from_id))} → ${esc(name(r.to_id))}</strong><span>${esc(r.fx?money(r.fx.amount,r.fx.currency||'EUR'):money(r.amount,r.currency||currency))}</span>${r.fx?`<small>${esc(money(r.amount,r.currency||currency))} · ${tr('Cambio aplicado')}: 1 ${esc(r.fx.currency||'EUR')} = ${esc(new Intl.NumberFormat(locale,{maximumFractionDigits:10}).format(Number(r.fx.rate)))} ${esc(r.currency||currency)} · ${esc(r.fx.baseDate&&r.fx.targetDate&&r.fx.baseDate!==r.fx.targetDate?(r.currency||currency)+': '+r.fx.baseDate+' · '+(r.fx.currency||'EUR')+': '+r.fx.targetDate:r.fx.date)} · ${esc(r.fx.source)}</small>`:''}<small>${tr('Pendiente de confirmar por quien recibe el dinero')}</small></div>${r.to_id===viewerId?ui`<div class="payment-actions"><button class="button primary small-button" data-payment-response="confirm" data-request-id="${esc(r.id)}">Confirmar recepción</button><button class="button secondary small-button" data-payment-response="reject" data-request-id="${esc(r.id)}">No lo he recibido</button></div>`:r.from_id===viewerId?ui`<button class="text-button" data-payment-response="cancel" data-request-id="${esc(r.id)}">Cancelar solicitud</button>`:''}</article>`).join('')}</div>`;
}
function valueText(key,value,event,name,snapshot) {
 if((value===null||value===undefined)&&snapshot&&key==='split')return tr('A partes iguales');
 if((value===null||value===undefined)&&snapshot&&key==='receipt')return tr('Sin ticket');
 if(value===null||value===undefined)return '—';
 if(key==='fx')return money(value.amount,value.currency||'EUR')+' · 1 '+(value.currency||'EUR')+' = '+value.rate+' '+event.currency+' · '+(value.baseDate&&value.targetDate&&value.baseDate!==value.targetDate?event.currency+': '+value.baseDate+' · '+value.currency+': '+value.targetDate:value.date)+' · '+value.source;
 if(key==='budget'&&!value)return tr('Sin presupuesto establecido.');
 if(key==='amount'||key==='budget')return money(value,event.currency);
 if(['payer','assignee','from','to','from_id','to_id'].includes(key))return name(value);
 if(key==='participants')return value.map(name).join(', ');
 if(['dueAt','remindAt'].includes(key))return value?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):tr('Sin fecha');
 if(key==='important')return tr(value?'Sí':'No');
 if(key==='done')return tr(value?'Sí':'No');
 if(key==='receipt')return tr('Con ticket');
 if(key==='recurrence')return tr(value.active?'Activa':'Detenida');
 if(key==='split')return tr(({amounts:'Importes personalizados',percent:'Porcentajes',shares:'Partes',equal:'A partes iguales'})[value.mode]||'A partes iguales')+': '+Object.entries(value.values||{}).map(([id,n])=>name(id)+' '+(value.mode==='amounts'?money(n,event.currency):value.mode==='percent'?n/100+'%':n)).join(', ');
 if(key==='votes'){const options=[...(event.before_data?.options||[]),...(event.after_data?.options||[])];return Object.entries(value).map(([id,option])=>name(id)+': '+(options.find(o=>o.id===option)?.label||tr('Sin voto'))).join(', ')||tr('Sin votos');}
 if(key==='options')return value.map(o=>o.label).join(', ');
 if(key==='status')return tr(({pending:'Pendiente',confirmed:'Confirmado',rejected:'No recibido',cancelled:'Cancelado'})[value]||value);
 return ['category','type'].includes(key)?tr(String(value)):String(value);
}
export function historyView(events,admin,name,more=false) {
 if(!events.length)return `<p class="muted">${tr('Los nuevos cambios del grupo aparecerán aquí.')}</p>`;
 return `<div class="history-list">${events.map(e=>{
  const before=e.before_data||{},after=e.after_data||{};
  const diff=Object.keys(fields).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
  const timestamp=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(e.created_at));
  return `<article class="history-entry"><div class="history-heading"><strong>${esc(tr(labels[e.kind]||'Cambio en el grupo'))}</strong>${admin?`<button class="text-button danger-text" data-delete-history="${esc(e.id)}">${tr('Borrar entrada')}</button>`:''}</div><p class="history-meta">${esc(e.actor_name)} · <time datetime="${esc(e.created_at)}">${esc(timestamp)}</time></p>${diff.length?`<details><summary>${tr('Ver cambios')}</summary><dl>${diff.map(k=>`<div><dt>${esc(tr(fields[k]))}</dt><dd><span>${esc(valueText(k,before[k],e,name,e.before_data))}</span><span aria-hidden="true"> → </span><span>${esc(valueText(k,after[k],e,name,e.after_data))}</span></dd></div>`).join('')}</dl></details>`:''}</article>`;
 }).join('')}</div>${more?`<button class="button secondary history-more" data-action="more-history">${tr('Ver más cambios')}</button>`:''}`;
}
