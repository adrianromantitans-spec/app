import {expenseShares,money,currencyOf,currencyDigits,currencyScale} from './model.js?v=language-90';
import {language,locale,tr} from './i18n.js?v=language-90';
import {activityEventLabel} from './activity-ui.js?v=activity-102';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// New Activity copy reads the shared live language selection, like the landing's own copy.
const copy={
 'Todo lo que pasa, de un vistazo.':['Everything at a glance.','Tot ce se întâmplă, dintr-o privire.'],
 'Gastos del grupo':['Group expenses','Cheltuielile grupului'],
 'Tu parte':['Your share','Partea ta'],
 'Del gasto total':['Of total expenses','Din cheltuielile totale'],
 'Pendientes':['Pending','În așteptare'],
 'Por confirmar':['To confirm','De confirmat'],
 'El gasto, en perspectiva':['Spending in perspective','Cheltuielile, în perspectivă'],
 'Todo el viaje':['Whole trip','Toată călătoria'],
 'Todo el periodo':['All time','Toată perioada'],
 'Por categoría':['By category','Pe categorii'],
 'Quién pagó':['Who paid','Cine a plătit'],
 'Distribución de gastos':['Expense breakdown','Distribuția cheltuielilor'],
 'Total del grupo':['Group total','Totalul grupului'],
 'Pagado por ti':['Paid by you','Plătit de tine'],
 'Importes pagados por el grupo. Las devoluciones se muestran por separado.':['Amounts paid by the group. Repayments are shown separately.','Sume plătite de grup. Rambursările sunt afișate separat.'],
 'Todavía no hay gastos para mostrar.':['There are no expenses to show yet.','Nu există încă cheltuieli de afișat.'],
 'Todo al día':['All up to date','Totul este la zi'],
 'No hay pagos pendientes de confirmar.':['There are no payments waiting for confirmation.','Nu există plăți în așteptarea confirmării.'],
 'Últimos movimientos':['Latest activity','Ultimele mișcări'],
 'Gastos recientes':['Recent expenses','Cheltuieli recente'],
 'Ver historial completo':['View full history','Vezi istoricul complet'],
 'Pagado por':['Paid by','Plătit de'],
 'Últimos cambios del grupo':['Latest group changes','Ultimele modificări ale grupului'],
};
export const activityText=key=>language==='es'?key:copy[key]?.[language==='ro'?1:0]??tr(key);
export function activitySummary(group){
 const categories=new Map(),payers=new Map();let total=0,ownShare=0;
 for(const expense of group.expenses||[]){
  total+=expense.amount;ownShare+=expenseShares(expense).you||0;
  const category=expense.category||'Otros';
  categories.set(category,(categories.get(category)||0)+expense.amount);
  payers.set(expense.payer,(payers.get(expense.payer)||0)+expense.amount);
 }
 const descending=entries=>[...entries].map(([key,amount])=>({key,amount})).sort((a,b)=>b.amount-a.amount||String(a.key).localeCompare(String(b.key)));
 return {total,ownShare,count:(group.expenses||[]).length,categories:descending(categories),payers:descending(payers)};
}
export function activityChartView(group,{mode='categories',selection=null}={}){
 const summary=activitySummary(group),currency=currencyOf(group),people=mode==='people';
 const entries=(people?summary.payers:summary.categories).map((entry,index)=>{
  const self=people&&entry.key==='you',person=group.members.find(m=>m.id===entry.key);
  const label=people?(self?tr('Tú'):person?.name||tr('Miembro')):tr(entry.key);
  const color=self?'#187552':index<3?['#8050bd','#b28bdd','#e0cdef'][index]:`hsl(${255+(index*29)%60} 45% ${40+(index*11)%40}%)`;
  return {...entry,label,color,self};
 });
 const selected=entries.find(e=>e.key===selection),amount=selected?.amount??summary.total;
 const description=selected?(selected.self?activityText('Pagado por ti'):selected.label):activityText('Total del grupo');
 let accumulated=0;const gradient=summary.total?entries.map(e=>{const start=accumulated;accumulated+=e.amount/summary.total*100;return `${e.color} ${start}% ${accumulated}%`;}).join(','):'';
 const format=value=>money(value,currency),percent=value=>new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0}).format(value);
 const number=new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:currencyDigits(currency),maximumFractionDigits:currencyDigits(currency)}).formatToParts(amount/currencyScale(currency)).filter(part=>part.type!=='currency').map(part=>part.value).join('').trim();
 const label=entries.length?entries.map(e=>e.label+': '+format(e.amount)).join('; '):activityText('Todavía no hay gastos para mostrar.');
 return `<div class="concept-tabs" role="group" aria-label="${esc(activityText('Distribución de gastos'))}">${[['categories','Por categoría'],['people','Quién pagó']].map(([value,text])=>`<button type="button" aria-pressed="${value===mode}" data-activity-mode="${value}">${esc(activityText(text))}</button>`).join('')}</div><div class="concept-chart"><div class="concept-ring" role="img" aria-label="${esc(label)}" style="background:${gradient?'conic-gradient(from -90deg,'+gradient+')':'#eee7f4'}"><div class="concept-ring-center"><span class="concept-ring-currency">${esc(currency)}</span><strong>${esc(number)}</strong><small>${esc(description)}</small></div></div><div class="concept-legend">${entries.length?entries.map(e=>`<button type="button" aria-pressed="${e.key===selection}" data-activity-segment="${esc(e.key)}"><i style="background:${e.color}" aria-hidden="true"></i><span>${esc(e.label)}<strong>${esc(format(e.amount))}<em>${esc(percent(e.amount/summary.total))}</em></strong></span></button>`).join(''):`<p class="muted">${esc(activityText('Todavía no hay gastos para mostrar.'))}</p>`}</div></div><span class="activity-chart-status" role="status">${esc(description+': '+format(amount))}</span><p class="concept-chart-note">${esc(activityText('Importes pagados por el grupo. Las devoluciones se muestran por separado.'))}</p>`;
}
export function activityTimelineView(group,events,{name,viewerId}={}){
 const history=events.length>0;
 const time=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:0;};
 const items=(history?events:group.expenses).slice().sort((a,b)=>time(history?b.created_at:b.date)-time(history?a.created_at:a.date)).slice(0,5);
 const rows=items.map(item=>{
  if(!history){const payer=name(item.payer);return {id:item.id,title:item.title,by:item.payer==='you'?activityText('Pagado por ti'):activityText('Pagado por')+' '+payer,initials:group.members.find(m=>m.id===item.payer)?.initials||payer.slice(0,2).toUpperCase(),date:item.date,amount:item.amount,currency:currencyOf(group),self:item.payer==='you'};}
  const snapshot=item.after_data||item.before_data||{},expense=item.kind?.startsWith('expenses.');
  return {id:item.id,title:expense&&snapshot.title?snapshot.title:activityEventLabel(item.kind),by:(item.actor_name||tr('Miembro'))+' · '+activityEventLabel(item.kind),initials:(item.actor_name||'?').slice(0,2).toUpperCase(),date:item.created_at,amount:expense&&Number.isSafeInteger(snapshot.amount)?snapshot.amount:null,currency:item.currency||currencyOf(group),self:expense&&((viewerId&&snapshot.payer===viewerId)||snapshot.payer==='you')};
 });
 let previousDay='';
 return `<div class="concept-timeline-title"><h2>${esc(activityText(history?'Últimos movimientos':'Gastos recientes'))}</h2><span>${esc(history?activityText('Últimos cambios del grupo'):tr('Gastos'))}</span></div>${rows.length?rows.map(row=>{
  // Date-only expenses are local calendar days; timestamps retain their actual time.
  const date=new Date(row.date?.length===10?row.date+'T12:00:00':row.date),valid=Number.isFinite(date.getTime());
  const day=valid?new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(date):'';
  const heading=day&&day!==previousDay?`<div class="concept-day">${esc(day)}</div>`:'';previousDay=day;
  return `${heading}<article class="concept-event"><span class="concept-avatar" aria-hidden="true">${esc(row.initials)}</span><div class="concept-event-copy"><strong>${esc(row.title)}</strong><small>${esc(row.by)}</small></div>${row.amount!==null?`<div class="concept-event-value ${row.self?'self':''}">${esc(money(row.amount,row.currency))}${valid&&history?`<small><time datetime="${esc(row.date)}">${esc(new Intl.DateTimeFormat(locale,{timeStyle:'short'}).format(date))}</time></small>`:''}</div>`:''}</article>`;
 }).join(''):`<p class="muted">${esc(tr('Los nuevos cambios del grupo aparecerán aquí.'))}</p>`}`;
}

// Fit the number to the hole after rendering and whenever the chart is resized.
export function fitActivityAmount(container){
 const value=container.querySelector('.concept-ring-center strong');if(!value||!value.clientWidth)return;
 value.style.removeProperty('font-size');
 let size=parseFloat(getComputedStyle(value).fontSize);
 while(value.scrollWidth>value.clientWidth&&size>6){size-=.5;value.style.fontSize=size+'px';}
}
