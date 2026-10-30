import {locale,tr} from './i18n.js?v=languages-6';
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

export function balances(group) {
  const result = Object.fromEntries(group.members.map(m => [m.id, 0]));
  for (const expense of group.expenses) {
    result[expense.payer] += expense.amount;
    for (const [id, share] of Object.entries(splitAmount(expense.amount, expense.participants))) result[id] -= share;
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

export function addExpense(group, {title, amount, payer, participants, category, date}) {
  const ids = group.members.map(m => m.id);
  if (!title?.trim() || title.length > 100 || !ids.includes(payer) || !participants.every(id => ids.includes(id)) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(tr('Revisa los datos del gasto'));
  splitAmount(amount, participants);
  const expense = {id:uid(), title:title.trim(), amount, payer, participants, category, date};
  group.expenses.unshift(expense);
  return expense;
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
