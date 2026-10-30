import {locale,tr} from './i18n.js?v=glass-8';
export const currencies = ['EUR','RON'];
export function currencyOf(group) {
  const currency=group?.currency??'EUR';
  if(!currencies.includes(currency))throw new Error(tr('Moneda no disponible. Elige EUR o RON.'));
  return currency;
}
export const currencyUnit = group => currencyOf(group)==='RON'?'RON':'€';
export const canChangeCurrency = group => !group?.expenses?.length&&!group?.payments?.length;
export function checkCurrencyChange(group,currency) {
  if(!currencies.includes(currency))throw new Error(tr('Moneda no disponible. Elige EUR o RON.'));
  if(currency!==currencyOf(group)&&!canChangeCurrency(group))throw new Error(tr('La moneda no se puede cambiar después de registrar gastos o pagos. Crea otro grupo para usar otra moneda.'));
}
export const money = (cents,currency='EUR') => {
  if(!currencies.includes(currency))throw new Error(tr('Moneda no disponible. Elige EUR o RON.'));
  return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(cents/100);
};
export const uid = () => globalThis.crypto.randomUUID();
export const totalSpent = (group) => group.expenses.reduce((sum, item) => sum + item.amount, 0);

export function splitAmount(amount, participants) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !participants.length || new Set(participants).size !== participants.length) throw new Error(tr('Importe o participantes no válidos'));
  const base = Math.floor(amount / participants.length);
  return Object.fromEntries(participants.map((id, i) => [id, base + (i < amount % participants.length ? 1 : 0)]));
}

export function expenseShares(expense) {
  const {amount,participants,split}=expense;
  if(!split||split.mode==='equal')return splitAmount(amount,participants);
  splitAmount(amount,participants);
  const values=split.values;
  if(!['amounts','percent','shares'].includes(split.mode)||!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length!==participants.length||Object.keys(values).some(id=>!participants.includes(id)))throw new Error(tr('Revisa el reparto personalizado.'));
  const weights=participants.map(id=>values[id]);
  if(weights.some(value=>!Number.isSafeInteger(value)||value<0||value>(split.mode==='percent'?10000:split.mode==='shares'?1000000:100000000))||(split.mode==='shares'&&weights.some(value=>value<1)))throw new Error(tr('Revisa el reparto personalizado.'));
  const sum=weights.reduce((a,b)=>a+b,0);
  if(split.mode==='amounts'){
    if(sum!==amount)throw new Error(tr('Los importes individuales deben sumar el total del gasto.'));
    return Object.fromEntries(participants.map((id,i)=>[id,weights[i]]));
  }
  if(split.mode==='percent'&&sum!==10000)throw new Error(tr('Los porcentajes deben sumar exactamente 100 %.'));
  if(sum<=0)throw new Error(tr('Revisa el reparto personalizado.'));
  const denominator=BigInt(sum);
  const shares=weights.map((value,index)=>{const numerator=BigInt(amount)*BigInt(value);return {index,cents:Number(numerator/denominator),remainder:numerator%denominator};});
  let left=amount-shares.reduce((sum,item)=>sum+item.cents,0);
  const ranked=[...shares].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
  for(let i=0;i<left;i++)ranked[i].cents++;
  return Object.fromEntries(participants.map((id,i)=>[id,shares[i].cents]));
}
export function decimalUnits(value) {
  const text=String(value).trim().replace(',','.');
  if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error(tr('Introduce un número válido con un máximo de dos decimales.'));
  const [whole,fraction='']=text.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(result))throw new Error(tr('Revisa el reparto personalizado.'));
  return result;
}
export function balances(group) {
  const result = Object.fromEntries(group.members.map(m => [m.id, 0]));
  for (const expense of group.expenses) {
    result[expense.payer] += expense.amount;
    for (const [id, share] of Object.entries(expenseShares(expense))) result[id] -= share;
  }
  for (const payment of group.payments) {
    result[payment.from] += payment.amount;
    result[payment.to] -= payment.amount;
  }
  return result;
}

export function settlements(group) {
  const entries = Object.entries(balances(group));
  const debtors = entries.filter(([, amount]) => amount < 0).map(([id, n]) => ({id, amount:-n}));
  const creditors = entries.filter(([, amount]) => amount > 0).map(([id, amount]) => ({id, amount}));
  const transfers = [];
  for (const debtor of debtors) {
    for (const creditor of creditors) {
      const amount = Math.min(debtor.amount, creditor.amount);
      if (amount > 0) transfers.push({from:debtor.id, to:creditor.id, amount});
      debtor.amount -= amount; creditor.amount -= amount;
    }
  }
  return transfers;
}

export function validateExpense(group,{title,amount,payer,participants,category,date,split}) {
  const ids=group.members.map(m=>m.id);
  if(typeof title!=='string'||!title.trim()||title.length>100||!ids.includes(payer)||!Array.isArray(participants)||!participants.every(id=>ids.includes(id))||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['Comida','Transporte','Alojamiento','Actividades','Otros'].includes(category)||!Number.isSafeInteger(amount)||amount<1||amount>100000000)throw new Error(tr('Revisa los datos del gasto'));
  const calendar=new Date(date+'T12:00:00Z');if(Number.isNaN(calendar.valueOf())||calendar.toISOString().slice(0,10)!==date)throw new Error(tr('Revisa los datos del gasto'));
  const expense={title:title.trim(),amount,payer,participants:[...participants],category,date};
  if(split&&split.mode!=='equal')expense.split=structuredClone(split);
  expenseShares(expense);
  return expense;
}
export function addExpense(group,fields) {
  const expense={id:uid(),...validateExpense(group,fields)};
  group.expenses.unshift(expense);return expense;
}
export function updateExpense(group,id,fields) {
  const index=group.expenses.findIndex(e=>e.id===id);
  if(index<0)throw new Error(tr('Este gasto ya no existe. Actualiza el grupo.'));
  const previous=group.expenses[index];
  if(previous.recurrence?.active&&fields.date!==previous.date)throw new Error(tr('Detén la repetición antes de cambiar la fecha del gasto original.'));
  const updated={...previous,...validateExpense(group,fields)};
  if(!fields.split||fields.split.mode==='equal')delete updated.split;
  group.expenses[index]=updated;return updated;
}

export function vote(poll, optionId, memberId) {
  if (!poll.options.some(o => o.id === optionId)) return;
  if (poll.votes[memberId] === optionId) delete poll.votes[memberId];
  else poll.votes[memberId] = optionId;
}

export function seed() {
  const members = [{id:'you', name:'Tú', initials:'AL', color:'purple'}, {id:'marta',name:'Marta',initials:'MA',color:'pink'}, {id:'pablo',name:'Pablo',initials:'PA',color:'blue'}, {id:'lucia',name:'Lucía',initials:'LU',color:'orange'}];
  return {version:1, activeGroup:'lisboa', groups:[{
    id:'lisboa', name:'Escapada a Lisboa', emoji:'🚋', type:'Viaje', place:'Lisboa, Portugal', date:'2027-06-12', endDate:'2027-06-15', budget:160000, members,
    expenses:[
      {id:'e1',title:'Apartamento en Alfama',amount:48000,payer:'you',participants:['you','marta','pablo','lucia'],category:'Alojamiento',date:'2026-10-30'},
      {id:'e2',title:'Billetes de avión',amount:31200,payer:'pablo',participants:['you','marta','pablo','lucia'],category:'Transporte',date:'2026-10-29'},
      {id:'e3',title:'Reserva de la cena',amount:6400,payer:'marta',participants:['you','marta','pablo','lucia'],category:'Comida',date:'2026-10-28'}
    ], payments:[],
    polls:[{id:'p1',title:'¿Qué hacemos el sábado?',description:'Un día libre y muchas ganas de explorar.',options:[{id:'o1',label:'Excursión a Sintra',emoji:'🏰'},{id:'o2',label:'Playa en Cascais',emoji:'🏖️'},{id:'o3',label:'Perdernos por Lisboa',emoji:'🌇'}],votes:{marta:'o1',pablo:'o2',lucia:'o1'}}],
    tasks:[{id:'t1',title:'Reservar el alojamiento',assignee:'you',done:true},{id:'t2',title:'Mirar cómo llegar del aeropuerto',assignee:'pablo',done:false},{id:'t3',title:'Buscar sitios para cenar',assignee:'marta',done:false},{id:'t4',title:'Preparar la playlist del viaje',assignee:'lucia',done:false}]
  },{
    id:'piso', name:'Nuestro pisito',emoji:'🪴',type:'Convivencia',place:'Madrid, España',date:'',endDate:'',budget:120000,members:members.slice(0,2),expenses:[],payments:[],polls:[],tasks:[{id:'t5',title:'Hacer la compra de la semana',assignee:'you',done:false}]
  },{
    id:'verano',name:'Verano sin prisa',emoji:'☀️',type:'Viaje',place:'Costa Brava, España',date:'2027-08-08',endDate:'2027-08-12',budget:200000,members,expenses:[],payments:[],polls:[],tasks:[]
  }]};
}
