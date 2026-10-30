import {money, uid, totalSpent, balances, settlements, addExpense, vote, seed} from './model.js';

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  chart:'<path d="M3 3v18h18M7 14l4-4 4 3 6-8"/>',
  wallet:'<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v12H6a3 3 0 0 1-3-3V6m17 7h-5v4h5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
  check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  receipt:'<path d="M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2-3-2Zm4 6h6m-6 4h6"/>',
  vote:'<path d="m9 5 3-3 6 6-3 3-6-6Zm-3 6H4l-2 5v5h20v-5l-2-5h-2M2 16h20m-14-3h8"/>',
  task:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3Z"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>',
  coffee:'<path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm13 0h1a3 3 0 1 1 0 6h-1M7 2v2m4-2v2m4-2v2"/>',
  bed:'<path d="M3 18v3m18-3v3M3 18V8h18v10H3Zm2-10V4h14v4M3 13h18m-9-5v5"/>',
  plane:'<path d="m22 2-7 20-4-9L2 9l20-7ZM11 13l6-6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey = 'nexo-local-v1';
let storageWarning = '';
let state;
try {
  const saved = localStorage.getItem(storageKey);
  state = saved ? JSON.parse(saved) : seed();
  if (state.version !== 1 || !Array.isArray(state.groups) || !state.groups.length) throw new Error();
  for (const g of state.groups) {
    if (!g.id || !g.name || !Array.isArray(g.members) || !g.members.some(m => m.id === 'you') || !Array.isArray(g.tasks) || !Array.isArray(g.polls) || !Array.isArray(g.payments)) throw new Error();
    balances(g);
  }
  if (!state.groups.some(g => g.id === state.activeGroup)) state.activeGroup = state.groups[0].id;
} catch {
  state = seed(); storageWarning = 'No pudimos recuperar los datos locales. Se ha abierto la demo; los datos anteriores no se sobrescribirán hasta que hagas un cambio.';
}
let page = 'home';
let tab = 'summary';
let expenseFilter = 'all';
let modalOpener;
const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const group = () => state.groups.find(g => g.id === state.activeGroup);
const member = id => group().members.find(m => m.id === id) || {name:'Miembro',initials:'?',color:'purple'};
const avatar = (m, small=false) => `<span class="avatar ${esc(m.color)} ${small?'small':''}" title="${esc(m.name)}">${esc(m.initials)}</span>`;
const avatars = members => `<div class="avatars">${members.slice(0,4).map(m=>avatar(m,true)).join('')}</div>`;
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel = date => date ? new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`)).replace('.','') : 'Sin fecha';
const categoryIcon = category => ({Alojamiento:'bed',Transporte:'plane',Comida:'coffee',Actividades:'spark',Otros:'receipt'}[category] || 'receipt');
let toastTimer;
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4500); }
function save() {try {localStorage.setItem(storageKey,JSON.stringify(state));} catch {toast('El navegador no permite guardar. Los cambios solo durarán durante esta sesión.');}}
function empty(title, description, action, label) { return `<div class="empty-state">${icon('spark')}<h3>${title}</h3><p>${description}</p>${action?`<button class="button primary" data-action="${action}">${icon('plus')}${label}</button>`:''}</div>`; }
function sectionTitle(title, subtitle, extra='') {return `<div class="section-heading"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${extra}</div>`;}

function render() {
  const g = group();
  const navigation = [['home','grid','Mi espacio'],['groups','users','Mis grupos'],['activity','chart','Actividad'],['budget','wallet','Presupuestos']];
  root.innerHTML = `<aside class="sidebar" aria-label="Navegación principal">
    <a class="brand" href="#" data-page="home"><span class="brand-symbol">n<span>↗</span></span>nexo<span class="brand-dot">.</span></a>
    <div class="workspace-label">TU PEQUEÑO UNIVERSO</div>
    <nav>${navigation.map(([id,ic,label])=>`<button class="nav-item ${page===id?'active':''}" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span>${id==='groups'?`<span class="nav-count">${state.groups.length}</span>`:''}</button>`).join('')}</nav>
    <div class="sidebar-group-label">TUS GRUPOS <button class="icon-button" data-action="new-group" aria-label="Crear un grupo">${icon('plus')}</button></div>
    <div class="sidebar-groups">${state.groups.map(item=>`<button class="group-nav ${item.id===g.id?'selected':''}" data-group="${esc(item.id)}"><span class="group-emoji">${esc(item.emoji)}</span><span>${esc(item.name)}</span>${item.id===g.id?'<span class="selected-dot"></span>':''}</button>`).join('')}</div>
    <div class="sidebar-bottom"><div class="together-card"><span class="little-spark">✳</span><h3>Menos líos.<br>Más buenos momentos.</h3><p>Lo mejor de hacer planes<br>es hacerlos juntos.</p><button data-action="new-group">Empieza algo bonito ${icon('arrow')}</button></div>
    <button class="profile" data-action="settings">${avatar({name:'Alex',initials:'AL',color:'purple'})}<span><strong>Alex</strong><small>Tu espacio personal</small></span>${icon('settings')}</button></div>
  </aside>
  <div class="main-shell"><header class="topbar"><div class="breadcrumb"><span class="mobile-logo">nexo.</span><span class="desktop-crumb">Tu espacio</span>${icon('chevron')}<strong>${navigation.find(n=>n[0]===page)?.[2]}</strong></div><div class="topbar-right"><span class="local-label"><span></span> Demo local</span><button class="top-avatar" data-action="settings" aria-label="Tu perfil y datos">${avatar({name:'Alex',initials:'AL',color:'purple'},true)}</button></div></header>
  <main id="main" tabindex="-1">${page==='home'?homeView():page==='groups'?groupsView():page==='activity'?activityView():budgetView()}</main>
  <footer class="page-footer"><span>Hecho para compartir algo más que gastos.</span><span>nexo ${icon('heart')}</span></footer>
  <nav class="mobile-nav" aria-label="Navegación móvil">${navigation.map(([id,ic,label])=>`<button class="${page===id?'active':''}" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav></div>`;
}

function homeView() {
  const g = group(); const spent = totalSpent(g); const ownBalance = balances(g).you || 0;
  const ownShare = g.expenses.reduce((sum,e)=>sum+(e.participants.includes('you')?Math.floor(e.amount/e.participants.length)+(e.participants.indexOf('you') < e.amount%e.participants.length ? 1 : 0):0),0);
  return `<div class="welcome-row"><div><div class="eyebrow">UN LUGAR PARA LO QUE COMPARTÍS</div><h1>Los buenos planes empiezan aquí<span class="purple-text">.</span></h1><p>Las cuentas claras. Los planes en marcha. Y tú, a disfrutar.</p></div><button class="button secondary" data-action="new-group">${icon('plus')} Crear grupo</button></div>
  <section class="trip-hero"><div class="hero-content"><div class="trip-badge"><span></span>${esc(g.type.toUpperCase())} EN GRUPO</div><h2>${esc(g.name)}</h2><div class="trip-meta"><span>${icon('pin')}${esc(g.place || 'Un plan por descubrir')}</span>${g.date?`<span>${icon('calendar')}${dateLabel(g.date)}${g.endDate?` — ${dateLabel(g.endDate)}`:''} ${g.date.slice(0,4)}</span>`:''}</div><div class="hero-bottom">${avatars(g.members)}<span>${g.members.length} personas, un gran plan</span><button class="hero-edit" data-action="edit-group" aria-label="Editar detalles del grupo">${icon('settings')}</button></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><span class="art-star star-one">✦</span><span class="art-star star-two">✳</span><div class="postcard back"><span>LET’S GO</span><div class="sun"></div><div class="hill"></div><div class="hill second"></div></div><div class="postcard front"><div class="postcard-image"><span class="art-cloud">☁</span><div class="tram"><div class="tram-roof"></div><div class="tram-windows"><i></i><i></i><i></i></div><div class="tram-line"></div><div class="tram-lights"><i></i><i></i></div><span>28</span></div><div class="street-line"></div></div><span>next stop: buenos momentos ♡</span></div><div class="floating-sticker">${esc(g.emoji)}</div></div></section>
  <section class="stats-grid" aria-label="Resumen del grupo"><article class="stat-card"><div class="stat-top"><span>Gastos del grupo</span><span class="stat-icon lavender">${icon('wallet')}</span></div><strong>${money(spent)}</strong><small>${g.expenses.length} gastos compartidos <span class="stat-detail">Entre todos, todo es más fácil</span></small></article>
  <article class="stat-card"><div class="stat-top"><span>Tu parte del plan</span><span class="stat-icon peach">${icon('receipt')}</span></div><strong>${money(ownShare)}</strong><small>Según los gastos en los que participas</small></article>
  <article class="stat-card"><div class="stat-top"><span>${ownBalance>0?'Te deben':ownBalance<0?'Tienes pendiente':'Todo en equilibrio'}</span><span class="stat-icon mint">${icon('chart')}</span></div><strong class="${ownBalance>=0?'green-text':''}">${money(Math.abs(ownBalance))}</strong><button class="text-button" data-action="settlements">${ownBalance===0?'Ver saldos del grupo':'Vamos a dejarlo a cero'} ${icon('arrow')}</button></article></section>
  <div class="group-toolbar"><div class="tabs" role="tablist" aria-label="Secciones del grupo">${[['summary','Resumen'],['expenses','Gastos'],['plans','Planes y votaciones'],['tasks','Tareas']].map(([id,label])=>`<button role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-tab="${id}">${label}${id==='tasks'?`<span>${g.tasks.filter(t=>!t.done).length}</span>`:''}</button>`).join('')}</div><button class="button primary" data-action="new-expense">${icon('plus')} Añadir gasto</button></div>
  <div class="tab-content" role="tabpanel">${tab==='summary'?summaryView():tab==='expenses'?expensesView():tab==='plans'?plansView():tasksView()}</div>`;
}

function summaryView() {
  return `<div class="dashboard-grid"><div class="dashboard-main"><section class="panel expenses-panel">${sectionTitle('Los últimos gastos','Cada cuenta, en su sitio.',`<button class="text-button" data-tab="expenses">Ver todos ${icon('arrow')}</button>`)}${expenseList(group().expenses.slice(0,4))}</section><section class="panel">${sectionTitle('Lo próximo que decidimos','Porque el mejor plan se elige entre todos.',`<span class="tiny-pill lavender">${icon('vote')} A votación</span>`)}${group().polls.length?pollCard(group().polls[0]):empty('¿Por dónde empezamos?','Propón un plan y deja que el grupo decida.','new-poll','Crear votación')}</section></div><div class="dashboard-side">${budgetCard()}<section class="panel task-panel">${sectionTitle('Pequeñas cosas por hacer','Un poco de cada uno, mucho de todos.',`<button class="icon-button" data-action="new-task" aria-label="Añadir tarea">${icon('plus')}</button>`)}${taskList(group().tasks.slice(0,4))}<button class="text-button full-width" data-tab="tasks">Ver todas las tareas ${icon('arrow')}</button></section><div class="tip-card"><span>✧</span><p><strong>El plan es disfrutar.</strong> Nexo se encarga de que nada se quede en el aire.</p></div></div></div>`;
}

function expenseList(items) {
  if (!items.length) return empty('Las cuentas empiezan aquí','Añade el primer gasto y Nexo calculará el reparto.','new-expense','Añadir gasto');
  return `<div class="expense-list">${items.map(e=>`<div class="expense-row"><span class="expense-icon ${e.category==='Alojamiento'?'lavender':e.category==='Transporte'?'blue-bg':'peach'}">${icon(categoryIcon(e.category))}</span><div class="expense-description"><strong>${esc(e.title)}</strong><small>Pagó ${esc(member(e.payer).name)} <span>·</span> ${dateLabel(e.date)}</small></div><div class="expense-value"><strong>${money(e.amount)}</strong><small>${e.participants.length} ${e.participants.length===1?'persona':'personas'}</small></div><button class="icon-button expense-detail-button" data-expense="${esc(e.id)}" aria-label="Ver detalle de ${esc(e.title)}">${icon('chevron')}</button></div>`).join('')}</div>`;
}

function expensesView() {
  const g = group(); const items = expenseFilter==='mine'?g.expenses.filter(e=>e.payer==='you'):g.expenses;
  return `<section class="panel">${sectionTitle('Las cuentas del grupo','Todos los gastos, con su reparto al céntimo.',`<button class="button secondary small-button" data-action="settlements">${icon('wallet')} Saldar cuentas</button>`)}<div class="filter-row"><button class="filter-chip ${expenseFilter==='all'?'active':''}" data-filter="all">Todos (${g.expenses.length})</button><button class="filter-chip ${expenseFilter==='mine'?'active':''}" data-filter="mine">Pagados por mí</button></div>${expenseList(items)}</section>`;
}

function budgetCard() {
  const g=group(); const spent=totalSpent(g); const percentage=g.budget?Math.round(spent/g.budget*100):0;
  return `<section class="panel budget-card">${sectionTitle('Un plan, un presupuesto','Sin sorpresas al volver.',`<span class="mini-icon">${icon('wallet')}</span>`)}<div class="budget-numbers"><strong>${money(spent)}</strong><span>de ${money(g.budget)}</span></div><div class="progress-track ${spent>g.budget?'over-budget':''}" role="progressbar" aria-label="Presupuesto utilizado" aria-valuenow="${Math.min(percentage,100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(percentage,100)}%"></span></div><div class="progress-labels"><span>${percentage}% del presupuesto</span><span>${spent>g.budget?'Por encima del plan':'Vamos bien ✨'}</span></div><div class="budget-remaining">${icon('spark')}<span>${spent>g.budget?'Habéis superado el presupuesto en':'Todavía quedan'} <strong>${money(Math.abs(g.budget-spent))}</strong>${spent>g.budget?'': ' para disfrutar.'}</span></div><button class="text-button" data-action="edit-budget">Ajustar presupuesto ${icon('arrow')}</button></section>`;
}

function pollCard(poll) {
  const entries=Object.values(poll.votes); const own=poll.votes.you;
  return `<article class="poll-card"><div class="poll-title"><span class="poll-symbol">💭</span><div><h3>${esc(poll.title)}</h3><p>${esc(poll.description || 'Tu opinión también cuenta.')}</p></div></div><div class="poll-options">${poll.options.map(option=>{const count=entries.filter(v=>v===option.id).length;return `<button class="poll-option ${own===option.id?'chosen':''}" data-poll="${esc(poll.id)}" data-option="${esc(option.id)}" aria-pressed="${own===option.id}"><span class="poll-fill" style="width:${entries.length?count/entries.length*100:0}%"></span><span class="option-text"><span>${esc(option.emoji || '✦')}</span>${esc(option.label)}</span><span class="option-count">${count}${own===option.id?icon('check'):'<span class="radio-dot"></span>'}</span></button>`;}).join('')}</div><div class="poll-footer">${avatars(group().members.filter(m=>poll.votes[m.id]))}<span>${entries.length} de ${group().members.length} han votado</span><span class="vote-status">${own?'Tu voto está guardado': '¡Solo faltas tú!'}</span></div></article>`;
}
function plansView() {return `<section class="panel">${sectionTitle('Los planes se hacen juntos','Propón, vota y encontrad vuestro próximo sí.',`<button class="button primary small-button" data-action="new-poll">${icon('plus')} Nueva votación</button>`)}${group().polls.length?`<div class="polls-grid">${group().polls.map(pollCard).join('')}</div>`:empty('Hay un plan por descubrir','Crea una votación con al menos dos opciones.','new-poll','Crear votación')}</section>`;}
function taskList(items) {
  if (!items.length) return empty('Por ahora, todo hecho','Añade una tarea para repartir la organización.','new-task','Añadir tarea');
  return `<div class="task-list">${items.map(t=>`<div class="task-row ${t.done?'done':''}"><label><input type="checkbox" data-task="${esc(t.id)}" ${t.done?'checked':''}><span class="custom-check">${icon('check')}</span><span>${esc(t.title)}</span></label>${avatar(member(t.assignee),true)}</div>`).join('')}</div>`;
}
function tasksView() {const done=group().tasks.filter(t=>t.done).length;return `<section class="panel">${sectionTitle('Un equipo para todo',`${done} de ${group().tasks.length} tareas completadas.`, `<button class="button primary small-button" data-action="new-task">${icon('plus')} Añadir tarea</button>`)}${taskList(group().tasks)}</section>`;}
function groupsView() {return `<div class="welcome-row"><div><div class="eyebrow">CADA GRUPO, SU HISTORIA</div><h1>La gente con la que compartes<span class="purple-text">.</span></h1><p>De la escapada del finde a las cuentas de casa.</p></div><button class="button primary" data-action="new-group">${icon('plus')} Crear grupo</button></div><div class="group-cards">${state.groups.map((g,i)=>`<button class="group-card" data-group="${esc(g.id)}"><div class="group-card-cover cover-${i%3}"><span>${esc(g.emoji)}</span><span class="tiny-pill">${esc(g.type)}</span></div><div class="group-card-body"><h2>${esc(g.name)} ${icon('arrow')}</h2><p>${icon('pin')}${esc(g.place || 'El próximo gran plan')}</p><div class="group-card-footer">${avatars(g.members)}<span>${g.members.length} personas</span></div><div class="group-card-total"><span>Compartido hasta ahora</span><strong>${money(totalSpent(g))}</strong></div></div></button>`).join('')}<button class="new-group-card" data-action="new-group"><span>${icon('plus')}</span><h3>El siguiente buen plan</h3><p>Empieza con un grupo.</p></button></div>`;}
function activityView() {const g=group();return `<div class="welcome-row"><div><div class="eyebrow">LO QUE VA PASANDO</div><h1>Cada pequeño paso cuenta<span class="purple-text">.</span></h1><p>La actividad de ${esc(g.name)}.</p></div><select class="group-select" aria-label="Seleccionar grupo" data-group-select>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><section class="panel">${sectionTitle('Gastos registrados','El historial de las cuentas del grupo.')}${expenseList(g.expenses)}</section><section class="panel activity-payments">${sectionTitle('Devoluciones registradas','Pagos que habéis marcado como realizados.')}${g.payments.length?g.payments.map(p=>`<div class="payment-row">${icon('check')}<span>${esc(member(p.from).name)} devolvió a ${esc(member(p.to).name)}</span><strong>${money(p.amount)}</strong><small>${dateLabel(p.date)}</small></div>`).join(''):'<p class="muted">Todavía no se han registrado devoluciones.</p>'}</section>`;}
function budgetView() {const g=group(); const spent=totalSpent(g); const categories=['Alojamiento','Transporte','Comida','Actividades','Otros'];return `<div class="welcome-row"><div><div class="eyebrow">DISFRUTAR, CON LAS CUENTAS CLARAS</div><h1>Un poquito de previsión<span class="purple-text">.</span></h1><p>El presupuesto de ${esc(g.name)}, de un vistazo.</p></div><select class="group-select" aria-label="Seleccionar grupo" data-group-select>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><div class="budget-layout">${budgetCard()}<section class="panel">${sectionTitle('¿En qué se va el plan?','Tus gastos agrupados por categoría.')}${categories.map(cat=>{const sum=g.expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);return `<div class="category-row"><span class="expense-icon lavender">${icon(categoryIcon(cat))}</span><div><span>${cat}</span><div class="progress-track"><span style="width:${spent?sum/spent*100:0}%"></span></div></div><strong>${money(sum)}</strong></div>`;}).join('')}</section></div>`;}

function openModal(title, content, subtitle='') {
  if (!modalRoot.contains(document.activeElement)) modalOpener = document.activeElement;
  modalRoot.innerHTML=`<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><div><div class="eyebrow">TODO CONECTADO</div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div>${content}</section></div>`;
  document.body.classList.add('modal-open');
  root.inert = true;
  setTimeout(()=>modalRoot.querySelector('input, select, textarea, button')?.focus(),30);
}
function closeModal() {modalRoot.innerHTML='';document.body.classList.remove('modal-open');root.inert=false;modalOpener?.focus();}
const actions = label => `<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">${label}${icon('arrow')}</button></div>`;
const memberOptions = () => group().members.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
function expenseModal() {
  openModal('Un gasto, bien repartido',`<form id="expense-form"><label class="field">¿Qué habéis pagado?<input name="title" placeholder="Ej. Cena de bienvenida" required maxlength="100"></label><div class="form-columns"><label class="field">Importe (€)<input name="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="0,00" required inputmode="decimal"></label><label class="field">Pagado por<select name="payer">${memberOptions()}</select></label></div><div class="form-columns"><label class="field">Categoría<select name="category">${['Comida','Transporte','Alojamiento','Actividades','Otros'].map(c=>`<option>${c}</option>`).join('')}</select></label><label class="field">Fecha<input type="date" name="date" value="${today()}" required></label></div><fieldset class="participants"><legend>Repartir a partes iguales entre</legend>${group().members.map(m=>`<label class="participant"><input type="checkbox" name="participants" value="${esc(m.id)}" checked>${avatar(m,true)}<span>${esc(m.name)}</span></label>`).join('')}</fieldset><div class="form-note">${icon('spark')} Cada céntimo cuenta: el reparto se ajusta automáticamente.</div>${actions('Guardar gasto')}</form>`,esc(group().name));
}
function groupModal(edit=false) {
  const g=group();
  openModal(edit?'Los detalles del plan':'Todo empieza con un grupo',`<form id="group-form" data-edit="${edit}"><div class="form-columns emoji-columns"><label class="field">Icono<select name="emoji">${['🚋','🌴','🪴','☀️','🏕️','🍕','🎉','🏠','✈️','⛷️'].map(e=>`<option ${edit&&g.emoji===e?'selected':''}>${e}</option>`).join('')}</select></label><label class="field">Nombre del grupo<input name="name" placeholder="Ej. Escapada al sur" value="${edit?esc(g.name):''}" maxlength="60" required></label></div><div class="form-columns"><label class="field">Tipo de grupo<select name="type">${['Viaje','Convivencia','Pareja','Plan con amigos'].map(t=>`<option ${edit&&g.type===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="field">Lugar<input name="place" placeholder="Ej. Málaga, España" value="${edit?esc(g.place):''}" maxlength="80"></label></div><div class="form-columns"><label class="field">Desde<input type="date" name="date" value="${edit?esc(g.date):''}"></label><label class="field">Hasta<input type="date" name="endDate" value="${edit?esc(g.endDate):''}"></label></div>${edit?'':`<label class="field">¿Quién se apunta? <span class="muted">Nombres separados por comas</span><input name="members" placeholder="Marta, Pablo, Lucía" maxlength="300"></label>`}<label class="field">Presupuesto total del grupo (€)<input name="budget" type="number" min="1" max="10000000" step="0.01" value="${edit?g.budget/100:''}" placeholder="1200" required></label><div class="form-note">${icon('users')} Demo local: los participantes y los datos se guardan solo en este navegador.</div>${actions(edit?'Guardar cambios':'Crear grupo')}</form>`);
}
function settlementsModal() {
  const items=settlements(group());
  openModal('Las cuentas claras',`<div class="settlement-list">${items.length?items.map((p,i)=>`<div class="settlement-row"><div>${avatar(member(p.from),true)}<strong>${esc(member(p.from).name)}</strong>${icon('arrow')}<strong>${esc(member(p.to).name)}</strong></div><div><strong>${money(p.amount)}</strong><button class="button secondary small-button" data-settle="${i}">Registrar pago</button></div></div>`).join(''):empty('¡Todo saldado!','El grupo está en equilibrio. A por el siguiente plan.')}<p class="form-note">${icon('wallet')} Nexo registra devoluciones; no envía dinero ni realiza transferencias.</p></div>`,'Menos transferencias para equilibrar los saldos.');
}
function expenseDetails(id) {
  const e=group().expenses.find(e=>e.id===id); if(!e)return;
  const base=Math.floor(e.amount/e.participants.length); const remainder=e.amount%e.participants.length;
  openModal(esc(e.title),`<div class="expense-detail-total">${money(e.amount)}<span>${esc(e.category)} · ${dateLabel(e.date)}</span></div><p class="detail-payer">Pagado por <strong>${esc(member(e.payer).name)}</strong></p><h3 class="detail-subtitle">Así se reparte</h3>${e.participants.map((id,i)=>`<div class="share-row">${avatar(member(id),true)}<span>${esc(member(id).name)}</span><strong>${money(base+(i<remainder?1:0))}</strong></div>`).join('')}<div class="modal-actions"><button class="button danger" data-delete-expense="${esc(e.id)}">Eliminar gasto</button><button class="button primary" data-action="close-modal">Entendido</button></div>`);
}
function settingsModal() {
  openModal('Tu espacio, a tu manera',`<div class="profile-detail">${avatar({name:'Alex',initials:'AL',color:'purple'})}<div><h3>Alex · Tu perfil de demo</h3><p>Moneda: euro (€) · Idioma: español</p></div></div><div class="privacy-note"><h3>Una primera versión para explorar</h3><p>Los grupos y sus cambios se guardan en este navegador. No hay cuentas, sincronización entre dispositivos ni invitaciones reales todavía. Solo tú puedes votar y marcar pagos desde esta demo.</p></div><button class="button secondary full-width" data-action="export">${icon('logout')} Exportar mis datos (JSON)</button><button class="text-button danger-text reset-button" data-action="reset">Restablecer los datos de ejemplo</button>`);
}

document.addEventListener('click', event => {
  const el=event.target.closest('button, a');
  if(!el)return;
  if(el.matches('a[href="#"]'))event.preventDefault();
  if(el.dataset.page){page=el.dataset.page; render(); window.scrollTo({top:0});return;}
  if(el.dataset.group){state.activeGroup=el.dataset.group;page='home';tab='summary';expenseFilter='all';save();render();window.scrollTo({top:0});return;}
  if(el.dataset.tab){tab=el.dataset.tab;render();return;}
  if(el.dataset.filter){expenseFilter=el.dataset.filter;render();return;}
  if(el.dataset.poll){const poll=group().polls.find(p=>p.id===el.dataset.poll);vote(poll,el.dataset.option,'you');save();render();toast(poll.votes.you?'Tu voto está guardado. Puedes cambiarlo cuando quieras.':'Has retirado tu voto.');return;}
  if(el.dataset.expense){expenseDetails(el.dataset.expense);return;}
  if(el.dataset.deleteExpense){const id=el.dataset.deleteExpense;openModal('¿Eliminar este gasto?',`<p class="dialog-copy">El reparto y los saldos del grupo se volverán a calcular. Esta acción no se puede deshacer.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button danger" data-confirm-delete="${esc(id)}">Sí, eliminar</button></div>`);return;}
  if(el.dataset.confirmDelete){group().expenses=group().expenses.filter(e=>e.id!==el.dataset.confirmDelete);save();closeModal();render();toast('Gasto eliminado. Los saldos están actualizados.');return;}
  if(el.dataset.settle!==undefined){const p=settlements(group())[Number(el.dataset.settle)];if(!p)return;openModal('¿Ya se ha realizado el pago?',`<p class="dialog-copy">Vas a registrar que <strong>${esc(member(p.from).name)}</strong> ha devuelto <strong>${money(p.amount)}</strong> a <strong>${esc(member(p.to).name)}</strong>.</p><p class="form-note">Confirma únicamente si el dinero ya ha llegado a su destino.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button primary" data-confirm-payment="${esc(JSON.stringify(p))}">Sí, registrar pago</button></div>`);return;}
  if(el.dataset.confirmPayment){const p=JSON.parse(el.dataset.confirmPayment);group().payments.unshift({...p,id:uid(),date:today()});save();closeModal();render();toast('Devolución registrada. Un poquito más cerca del equilibrio.');return;}
  switch(el.dataset.action){
    case 'close-modal':closeModal();break;
    case 'new-expense':expenseModal();break;
    case 'new-group':groupModal();break;
    case 'edit-group':groupModal(true);break;
    case 'settlements':settlementsModal();break;
    case 'edit-budget':openModal('Disfrutar, sin sorpresas',`<form id="budget-form"><label class="field">Presupuesto total del grupo (€)<input type="number" name="budget" min="1" max="10000000" step="0.01" value="${group().budget/100}" required></label><p class="form-note">${icon('users')} Como referencia: ${money(Math.round(group().budget/group().members.length))} por persona con el presupuesto actual.</p>${actions('Actualizar presupuesto')}</form>`,esc(group().name));break;
    case 'new-task':openModal('Una pequeña cosa por hacer',`<form id="task-form"><label class="field">¿Qué queda pendiente?<input name="title" placeholder="Ej. Reservar la excursión a Sintra" maxlength="120" required></label><label class="field">¿Quién se encarga?<select name="assignee">${memberOptions()}</select></label>${actions('Añadir tarea')}</form>`);break;
    case 'new-poll':openModal('¿Cuál es el plan?',`<form id="poll-form"><label class="field">La gran pregunta<input name="title" placeholder="¿Dónde cenamos el viernes?" maxlength="120" required></label><label class="field">Un poco de contexto <span class="muted">(opcional)</span><input name="description" placeholder="Algo rico, cerca del apartamento" maxlength="160"></label><label class="field">Opción 1<input name="option" placeholder="Pizzería del barrio" maxlength="100" required></label><label class="field">Opción 2<input name="option" placeholder="Restaurante portugués" maxlength="100" required></label><label class="field">Opción 3 <span class="muted">(opcional)</span><input name="option" placeholder="Otra buena idea" maxlength="100"></label>${actions('Crear votación')}</form>`);break;
    case 'settings':settingsModal();break;
    case 'export':{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nexo-datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Tus datos se han exportado.');break;}
    case 'reset':openModal('¿Volver al punto de partida?',`<p class="dialog-copy">Se eliminarán de este navegador tus grupos y cambios y volverán los datos de ejemplo. Puedes exportarlos antes desde tu perfil.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button danger" data-action="confirm-reset">Restablecer demo</button></div>`);break;
    case 'confirm-reset':state=seed();page='home';tab='summary';expenseFilter='all';save();closeModal();render();toast('La demo vuelve a estar como el primer día.');break;
  }
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.task){const t=group().tasks.find(t=>t.id===el.dataset.task);t.done=el.checked;save();render();toast(t.done?'¡Una cosa menos por hacer!':'Tarea marcada como pendiente.');}
  if(el.matches('[data-group-select]')){state.activeGroup=el.value;save();render();}
});
document.addEventListener('submit',event=>{
  const form=event.target;if(!form.closest('#modal-root'))return;event.preventDefault();const data=new FormData(form);
  try {
    if(form.id==='expense-form')addExpense(group(),{title:data.get('title'),amount:Math.round(Number(data.get('amount'))*100),payer:data.get('payer'),participants:data.getAll('participants'),category:data.get('category'),date:data.get('date')});
    if(form.id==='task-form'){const title=data.get('title').trim();if(!title)throw new Error('Escribe qué hay que hacer.');group().tasks.push({id:uid(),title,assignee:data.get('assignee'),done:false});}
    if(form.id==='poll-form'){const title=data.get('title').trim();const options=data.getAll('option').map(s=>s.trim()).filter(Boolean);if(!title||options.length<2)throw new Error('Escribe una pregunta y al menos dos opciones.');if(new Set(options.map(s=>s.toLowerCase())).size!==options.length)throw new Error('Las opciones deben ser diferentes.');group().polls.unshift({id:uid(),title,description:data.get('description').trim(),options:options.map(label=>({id:uid(),label,emoji:'✦'})),votes:{}});tab='plans';}
    if(form.id==='budget-form'){const budget=Math.round(Number(data.get('budget'))*100);if(!Number.isSafeInteger(budget)||budget<100)throw new Error('El presupuesto debe ser de al menos 1 €.');group().budget=budget;}
    if(form.id==='group-form'){
      const name=data.get('name').trim();if(!name)throw new Error('Ponle un nombre al grupo.');
      if(data.get('endDate')&&!data.get('date'))throw new Error('Indica también la fecha de inicio.');
      if(data.get('date')&&data.get('endDate')&&data.get('endDate')<data.get('date'))throw new Error('La fecha final debe ser posterior a la inicial.');
      const fields={name,emoji:data.get('emoji'),type:data.get('type'),place:data.get('place').trim(),date:data.get('date'),endDate:data.get('endDate'),budget:Math.round(Number(data.get('budget'))*100)};
      if(form.dataset.edit==='true')Object.assign(group(),fields);
      else {
        const names=data.get('members').split(',').map(n=>n.trim()).filter(Boolean);if(names.length>19)throw new Error('Puedes añadir hasta 19 personas más.');
        const colors=['pink','blue','orange','purple'];const g={...fields,id:uid(),members:[{id:'you',name:'Tú',initials:'AL',color:'purple'},...names.map((name,i)=>({id:uid(),name,initials:name.split(/\s+/).map(n=>n[0]).join('').slice(0,2).toUpperCase(),color:colors[i%4]}))],expenses:[],payments:[],tasks:[],polls:[]};state.groups.push(g);state.activeGroup=g.id;page='home';tab='summary';
      }
    }
    save();closeModal();render();toast(form.id==='group-form'?'El plan ya tiene su espacio.':'Listo. Todo está actualizado.');
  }catch(error){form.querySelector('.form-error').textContent=error.message;}
});
modalRoot.addEventListener('click',event=>{if(event.target.classList.contains('modal-overlay'))closeModal();});
document.addEventListener('keydown',event=>{
  const modal=modalRoot.querySelector('.modal');if(!modal)return;
  if(event.key==='Escape'){closeModal();return;}
  if(event.key==='Tab'){const items=[...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}
});
render();
if(storageWarning)toast(storageWarning);
