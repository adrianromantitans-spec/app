import {tr,ui,locale,languageName,initializeLanguage} from './i18n.js?v=glass-8';
import {nextOccurrence,materializeRecurring,prepareReceipt} from './extras.js?v=glass-8';
import {money as formatMoney, currencyOf,currencyUnit,canChangeCurrency,checkCurrencyChange, uid, totalSpent, balances, settlements, addExpense, updateExpense, validateExpense, expenseShares, decimalUnits, vote, seed} from './model.js?v=glass-8';
import {Cloud} from './cloud.js?v=glass-8';
import {cloudConfig} from './config.js';
import {welcomePage,socialButtons} from './auth-ui.js?v=glass-8';

initializeLanguage();

let cloud;
let configError='';
try {cloud=new Cloud(cloudConfig);} catch (error) {configError=error.message;cloud=new Cloud({});}
let accountUser=null;
let remoteBusy=false;
let authLoading=cloud.enabled;
let syncMessage='';
let authMode=location.hash==='#registro'?'signup':'login';
let authStage=location.hash==='#registro'?'signup':location.hash==='#acceso'?'login':'welcome';
let brandIntroShown=false;
let demoMode=false;
let providers=null;
let providerError=false;
let pendingInvite='';
let inviteError='';
const remoteBaseline=new Map();

const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z"/>',
  person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
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
  if (state.version !== 1 || !Array.isArray(state.groups)) throw new Error();
  for (const g of state.groups) {
    if (!g.id || !g.name || !Array.isArray(g.members) || !g.members.some(m => m.id === 'you') || !Array.isArray(g.tasks) || !Array.isArray(g.polls) || !Array.isArray(g.payments)) throw new Error();
    balances(g);
  }
  if (!state.groups.some(g => g.id === state.activeGroup)) state.activeGroup = state.groups[0]?.id||null;
} catch {
  state = seed(); storageWarning = tr('No pudimos recuperar los datos locales. Se ha abierto la demo; los datos anteriores no se sobrescribirán hasta que hagas un cambio.');
}
let page = 'home';
const demoState=structuredClone(state);
let tab = 'summary';
let expenseFilter = 'all';
let modalOpener;
const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const group = () => state.groups.find(g => g.id === state.activeGroup);
const money=(cents,currency=currencyOf(group()))=>formatMoney(cents,currency);
const memberName=m=>m.id==='you'?tr('Tú'):m.name;
const member = id => {const m=group().members.find(m => m.id === id) || {name:tr('Miembro'),initials:'?',color:'purple'};return {...m,name:memberName(m)};};
const avatar = (m, small=false) => `<span class="avatar ${esc(m.color)} ${small?'small':''}" title="${esc(memberName(m))}">${esc(m.initials)}</span>`;
const avatars = members => `<div class="avatars">${members.slice(0,4).map(m=>avatar(m,true)).join('')}</div>`;
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel = date => date ? new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`)) : tr('Sin fecha');
const categoryIcon = category => ({Alojamiento:'bed',Transporte:'plane',Comida:'coffee',Actividades:'spark',Otros:'receipt'}[category] || 'receipt');
let toastTimer;
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4500); }
async function save() {
  if (!accountUser) {
    try {localStorage.setItem(storageKey,JSON.stringify(state));}
    catch {toast(tr('El navegador no permite guardar. Los cambios solo durarán durante esta sesión.'));}
    Object.assign(demoState,structuredClone(state));
    return;
  }
  remoteBusy=true;setSync(tr('Guardando…'));
  try {
    for (let i=0;i<state.groups.length;i++) {
      const g=state.groups[i];
      if (remoteBaseline.get(g.id)===JSON.stringify(g)) continue;
      const saved=g.remote ? await cloud.saveGroup(g) : await cloud.createGroup(g);
      state.groups[i]=saved;
      remoteBaseline.delete(g.id);remoteBaseline.set(saved.id,JSON.stringify(saved));
      if (state.activeGroup===g.id) state.activeGroup=saved.id;
    }
    rememberActiveGroup();setSync(tr('Actualizado'));
  } catch (error) {
    if (!cloud.session) {accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();closeModal();}
    else {
      state.groups=[...remoteBaseline.values()].map(value=>JSON.parse(value));
      if (!state.groups.some(g=>g.id===state.activeGroup)) state.activeGroup=state.groups[0]?.id || null;
      try {await loadSharedGroups();} catch { /* Keep only the last server-confirmed state. */ }
    }
    setSync(tr('Cambio no confirmado'));render();throw error;
  } finally {remoteBusy=false;}
}
function empty(title, description, action, label) { return `<div class="empty-state">${icon('spark')}<h3>${title}</h3><p>${description}</p>${action?`<button class="button primary" data-action="${action}">${icon('plus')}${label}</button>`:''}</div>`; }
function sectionTitle(title, subtitle, extra='') {return `<div class="section-heading"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${extra}</div>`;}

function render() {
  if(cloud.recovering){renderRecovery(true);return;}
  if (!accountUser&&!demoMode) {if(authStage==='recover'){renderRecovery(false);return;}renderWelcome();return;}
  const g = group();
  const navigation = [['home','home',tr('Inicio')],['groups','users',tr('Grupos')],['activity','chart',tr('Actividad')],['budget','wallet',tr('Presupuestos')],['profile','person',tr('Perfil')]];
  const mobileNavigation=navigation.filter(([id])=>id!=='budget');
  const mobileActive=page==='budget'?'home':page;
  root.innerHTML = ui`<aside class="sidebar" aria-label="Navegación principal">
    <a class="brand" href="#" data-page="home"><span class="brand-wordmark">Div<span class="brand-z">Z</span>plit<span class="brand-dot">.</span></span></a>
    <button class="button primary sidebar-create" data-action="quick-add">${icon('plus')} ${tr('Crear')}</button><div class="workspace-label">TU PEQUEÑO UNIVERSO</div>
    <nav>${navigation.map(([id,ic,label])=>`<button class="nav-item ${page===id?'active':''}" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span>${id==='groups'?`<span class="nav-count">${state.groups.length}</span>`:''}</button>`).join('')}</nav>
    <div class="sidebar-group-label">TUS GRUPOS <button class="icon-button" data-action="new-group" aria-label="Crear un grupo">${icon('plus')}</button></div>
    <div class="sidebar-groups">${state.groups.map(item=>`<button class="group-nav ${item.id===g?.id?'selected':''}" data-group="${esc(item.id)}"><span class="group-emoji">${esc(item.emoji)}</span><span>${esc(item.name)}</span>${item.id===g?.id?'<span class="selected-dot"></span>':''}</button>`).join('')}</div>
    <div class="sidebar-bottom"><div class="together-card"><span class="little-spark">✳</span><h3>Menos líos.<br>Más buenos momentos.</h3><p>Lo mejor de hacer planes<br>es hacerlos juntos.</p><button data-action="new-group">Empieza algo bonito ${icon('arrow')}</button></div>
    <button class="profile" data-action="settings">${avatar(currentProfile())}<span><strong>${esc(currentProfile().name)}</strong><small>${accountUser?tr('Tu cuenta compartida'):tr('Tu espacio de demo')}</small></span>${icon('settings')}</button></div>
  </aside>
  <div class="main-shell"><header class="topbar"><div class="breadcrumb"><span class="mobile-logo brand-wordmark">Div<span class="brand-z">Z</span>plit<span class="brand-dot">.</span></span><span class="desktop-crumb">Tu espacio</span>${icon('chevron')}<strong>${navigation.find(n=>n[0]===page)?.[2]}</strong></div><div class="topbar-right">${!accountUser?tr('<button class="button secondary account-button" data-action="account">Entrar</button>'):''}<button class="top-avatar" data-action="settings" aria-label="Tu perfil y datos">${avatar(currentProfile(),true)}</button></div></header>
  <main id="main" tabindex="-1">${accountBanner()}${page==='profile'?profileView():!state.groups.length?emptyAccount():page==='home'?homeView():page==='groups'?groupsView():page==='activity'?activityView():budgetView()}</main>
  <footer class="page-footer"><span>Hecho para compartir algo más que gastos.</span><span>DivZplit ${icon('heart')}</span></footer>
  <nav class="mobile-nav" aria-label="Navegación móvil">${mobileNavigation.map(([id,ic,label],index)=>`${index===2?ui`<div class="nav-add-slot"><button class="nav-add" data-action="quick-add" aria-label="Añadir" aria-haspopup="dialog" aria-expanded="false">${icon('plus')}</button></div>`:''}<button class="mobile-nav-item ${mobileActive===id?'active':''}" data-page="${id}" ${mobileActive===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav></div>`;
  root.inert=authLoading || !!modalRoot.firstElementChild;
}

function homeView() {
  const g = group(); const spent = totalSpent(g); const ownBalance = balances(g).you || 0;
  const ownShare = g.expenses.reduce((sum,e)=>sum+(expenseShares(e).you||0),0);
  return ui`<div class="welcome-row"><div><div class="eyebrow">UN LUGAR PARA LO QUE COMPARTÍS</div><h1>${ui`Hola, ${esc(currentProfile().name)}`}</h1><p>Tus planes, en un mismo lugar.</p></div><button class="button secondary" data-action="new-group">${icon('plus')} Crear grupo</button></div>
  <section class="trip-hero"><div class="hero-content"><div class="trip-badge"><span></span>${esc(tr(g.type).toUpperCase())} EN GRUPO</div><h2>${esc(g.name)}</h2><div class="trip-meta"><span>${icon('pin')}${esc(g.place || tr('Un plan por descubrir'))}</span>${g.date?`<span>${icon('calendar')}${dateLabel(g.date)}${g.endDate?` — ${dateLabel(g.endDate)}`:''} ${g.date.slice(0,4)}</span>`:''}</div><div class="hero-bottom">${avatars(g.members)}<span>${g.members.length} personas, un gran plan</span>${canManage()?ui`<button class="hero-edit" data-action="edit-group" aria-label="Editar detalles del grupo">${icon('settings')}</button>`:''}${accountUser&&canManage()?ui`<button class="button secondary invite-button" data-action="invite">${icon('users')} Invitar</button>`:''}</div></div><div class="hero-art" aria-hidden="true">${g.emoji==='🚋'||/lisboa|lisbon/i.test(g.place||'')?'<img class="hero-destination-image" src="./assets/lisbon.png" width="1536" height="1024" alt="" decoding="async" fetchpriority="low">':`<div class="hero-generic-scene"><span class="scene-circle"></span><span class="scene-group-emoji">${esc(g.emoji)}</span><span class="scene-little-star">✳</span></div>`}</div></section>
  <section class="stats-grid" aria-label="Resumen del grupo"><article class="stat-card spent-stat"><span class="stat-icon lavender">${icon('wallet')}</span><div class="stat-copy"><span class="stat-label">Gastos del grupo</span><strong>${money(spent)}</strong><small>${ui`${g.expenses.length} gastos compartidos`}</small></div></article><article class="stat-card balance-stat"><span class="stat-icon mint">${icon('arrow')}</span><div class="stat-copy"><span class="stat-label">${ownBalance>0?tr('Te deben'):ownBalance<0?tr('Tienes pendiente'):tr('Todo en equilibrio')}</span><strong class="${ownBalance>=0?'green-text':''}">${money(Math.abs(ownBalance))}</strong><button class="text-button" data-action="settlements">${ownBalance===0?tr('Ver saldos del grupo'):tr('Vamos a dejarlo a cero')}</button></div></article></section>
  <div class="stats-context"><span>${tr('Tu parte del plan')}: <strong>${money(ownShare)}</strong></span><button class="text-button" data-page="budget">${tr('Presupuestos')} ${icon('arrow')}</button></div>
  <div class="group-toolbar" data-label="${tr('EL PLAN, EN MARCHA')}"><div class="tabs" role="tablist" aria-label="Secciones del grupo">${[['summary',tr('Resumen')],['expenses',tr('Gastos')],['plans',tr('Planes y votaciones')],['tasks',tr('Tareas')]].map(([id,label])=>`<button role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-tab="${id}">${label}${id==='tasks'?`<span>${g.tasks.filter(t=>!t.done).length}</span>`:''}</button>`).join('')}</div><button class="button primary" data-action="new-expense">${icon('plus')} Añadir gasto</button></div>
  <div class="tab-content" role="tabpanel">${tab==='summary'?summaryView():tab==='expenses'?expensesView():tab==='plans'?plansView():tasksView()}</div>`;
}

function summaryView() {
  return ui`<div class="dashboard-grid"><div class="dashboard-main"><section class="panel expenses-panel">${sectionTitle(tr('Los últimos gastos'),tr('Cada cuenta, en su sitio.'),ui`<div class="section-actions"><button class="text-button" data-tab="expenses">Ver todos ${icon('arrow')}</button><button class="icon-button expense-add-inline" data-action="new-expense" aria-label="Añadir gasto">${icon('plus')}</button></div>`)}${expenseList(group().expenses.slice(0,4))}</section><section class="panel">${sectionTitle(tr('Lo próximo que decidimos'),tr('Porque el mejor plan se elige entre todos.'),ui`<span class="tiny-pill lavender">${icon('vote')} A votación</span>`)}${group().polls.length?pollCard(group().polls[0]):empty(tr('¿Por dónde empezamos?'),tr('Propón un plan y deja que el grupo decida.'),'new-poll',tr('Crear votación'))}</section></div><div class="dashboard-side">${budgetCard()}<section class="panel task-panel">${sectionTitle(tr('Pequeñas cosas por hacer'),tr('Un poco de cada uno, mucho de todos.'),ui`<button class="icon-button" data-action="new-task" aria-label="Añadir tarea">${icon('plus')}</button>`)}${taskList(group().tasks.slice(0,4))}<button class="text-button full-width" data-tab="tasks">Ver todas las tareas ${icon('arrow')}</button></section><div class="tip-card"><span>✧</span><p><strong>El plan es disfrutar.</strong> DivZplit se encarga de que nada se quede en el aire.</p></div></div></div>`;
}

function expenseList(items) {
  if (!items.length) return empty(tr('Las cuentas empiezan aquí'),tr('Añade el primer gasto y DivZplit calculará el reparto.'),'new-expense',tr('Añadir gasto'));
  return `<div class="expense-list">${items.map(e=>ui`<div class="expense-row"><span class="expense-icon ${e.category==='Alojamiento'?'lavender':e.category==='Transporte'?'blue-bg':'peach'}">${icon(categoryIcon(e.category))}</span><div class="expense-description"><strong>${esc(e.title)}${e.recurrence?' ↻':''}${e.receipt?tr(' · Ticket'):''}</strong><small>Pagó ${esc(member(e.payer).name)} <span>·</span> ${dateLabel(e.date)}</small></div><div class="expense-value"><strong>${money(e.amount)}</strong><small>${e.participants.length} ${e.participants.length===1?tr('persona'):tr('personas')}</small></div><button class="icon-button expense-detail-button" data-expense="${esc(e.id)}" aria-label="Ver detalle de ${esc(e.title)}">${icon('chevron')}</button></div>`).join('')}</div>`;
}

function expensesView() {
  const g = group(); const items = expenseFilter==='mine'?g.expenses.filter(e=>e.payer==='you'):g.expenses;
  return ui`<section class="panel">${sectionTitle(tr('Las cuentas del grupo'),tr('Todos los gastos, con su reparto al céntimo.'),ui`<button class="button secondary small-button" data-action="settlements">${icon('wallet')} Saldar cuentas</button>`)}<div class="filter-row"><button class="filter-chip ${expenseFilter==='all'?'active':''}" data-filter="all">Todos (${g.expenses.length})</button><button class="filter-chip ${expenseFilter==='mine'?'active':''}" data-filter="mine">Pagados por mí</button></div>${expenseList(items)}</section>`;
}

function budgetCard() {
  const g=group(); const spent=totalSpent(g); const percentage=g.budget?Math.round(spent/g.budget*100):0;
  return ui`<section class="panel budget-card">${sectionTitle(tr('Un plan, un presupuesto'),tr('Sin sorpresas al volver.'),`<span class="mini-icon">${icon('wallet')}</span>`)}<div class="budget-numbers"><strong>${money(spent)}</strong><span>de ${money(g.budget)}</span></div><div class="progress-track ${spent>g.budget?'over-budget':''}" role="progressbar" aria-label="Presupuesto utilizado" aria-valuenow="${Math.min(percentage,100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(percentage,100)}%"></span></div><div class="progress-labels"><span>${percentage}% del presupuesto</span><span>${spent>g.budget?tr('Por encima del plan'):tr('Vamos bien ✨')}</span></div><div class="budget-remaining">${icon('spark')}<span>${spent>g.budget?tr('Habéis superado el presupuesto en'):tr('Todavía quedan')} <strong>${money(Math.abs(g.budget-spent))}</strong>${spent>g.budget?'': tr(' para disfrutar.')}</span></div>${canManage()?ui`<button class="text-button" data-action="edit-budget">Ajustar presupuesto ${icon('arrow')}</button>`:''}</section>`;
}

function pollCard(poll) {
  const entries=Object.values(poll.votes); const own=poll.votes.you;
  return ui`<article class="poll-card"><div class="poll-title"><span class="poll-symbol">💭</span><div><h3>${esc(poll.title)}</h3><p>${esc(poll.description || tr('Tu opinión también cuenta.'))}</p></div></div><div class="poll-options">${poll.options.map(option=>{const count=entries.filter(v=>v===option.id).length;return `<button class="poll-option ${own===option.id?'chosen':''}" data-poll="${esc(poll.id)}" data-option="${esc(option.id)}" aria-pressed="${own===option.id}"><span class="poll-fill" style="width:${entries.length?count/entries.length*100:0}%"></span><span class="option-text"><span>${esc(option.emoji || '✦')}</span>${esc(option.label)}</span><span class="option-count">${count}${own===option.id?icon('check'):'<span class="radio-dot"></span>'}</span></button>`;}).join('')}</div><div class="poll-footer">${avatars(group().members.filter(m=>poll.votes[m.id]))}<span>${entries.length} de ${group().members.length} han votado</span><span class="vote-status">${own?tr('Tu voto está guardado'): tr('¡Solo faltas tú!')}</span></div></article>`;
}
function plansView() {return `<section class="panel">${sectionTitle(tr('Los planes se hacen juntos'),tr('Propón, vota y encontrad vuestro próximo sí.'),ui`<button class="button primary small-button" data-action="new-poll">${icon('plus')} Nueva votación</button>`)}${group().polls.length?`<div class="polls-grid">${group().polls.map(pollCard).join('')}</div>`:empty(tr('Hay un plan por descubrir'),tr('Crea una votación con al menos dos opciones.'),'new-poll',tr('Crear votación'))}</section>`;}
function taskList(items) {
  if (!items.length) return empty(tr('Por ahora, todo hecho'),tr('Añade una tarea para repartir la organización.'),'new-task',tr('Añadir tarea'));
  return `<div class="task-list">${items.map(t=>`<div class="task-row ${t.done?'done':''}"><label><input type="checkbox" data-task="${esc(t.id)}" ${t.done?'checked':''}><span class="custom-check">${icon('check')}</span><span>${esc(t.title)}</span></label>${avatar(member(t.assignee),true)}</div>`).join('')}</div>`;
}
function tasksView() {const done=group().tasks.filter(t=>t.done).length;return `<section class="panel">${sectionTitle(tr('Un equipo para todo'),ui`${done} de ${group().tasks.length} tareas completadas.`, ui`<button class="button primary small-button" data-action="new-task">${icon('plus')} Añadir tarea</button>`)}${taskList(group().tasks)}</section>`;}
function groupsView() {return ui`<div class="welcome-row"><div><div class="eyebrow">CADA GRUPO, SU HISTORIA</div><h1>La gente con la que compartes<span class="purple-text">.</span></h1><p>De la escapada del finde a las cuentas de casa.</p></div><button class="button primary" data-action="new-group">${icon('plus')} Crear grupo</button></div><div class="group-cards">${state.groups.map((g,i)=>ui`<button class="group-card" data-group="${esc(g.id)}"><div class="group-card-cover cover-${i%3}"><span>${esc(g.emoji)}</span><span class="tiny-pill">${esc(tr(g.type))}</span></div><div class="group-card-body"><h2>${esc(g.name)} ${icon('arrow')}</h2><p>${icon('pin')}${esc(g.place || tr('El próximo gran plan'))}</p><div class="group-card-footer">${avatars(g.members)}<span>${g.members.length} personas</span></div><div class="group-card-total"><span>Compartido hasta ahora</span><strong>${money(totalSpent(g),currencyOf(g))}</strong></div></div></button>`).join('')}<button class="new-group-card" data-action="new-group"><span>${icon('plus')}</span><h3>El siguiente buen plan</h3><p>Empieza con un grupo.</p></button></div>`;}
function activityView() {const g=group();return ui`<div class="welcome-row"><div><div class="eyebrow">LO QUE VA PASANDO</div><h1>Cada pequeño paso cuenta<span class="purple-text">.</span></h1><p>La actividad de ${esc(g.name)}.</p></div><select class="group-select" aria-label="Seleccionar grupo" data-group-select>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g?.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><section class="panel">${sectionTitle(tr('Gastos registrados'),tr('El historial de las cuentas del grupo.'))}${expenseList(g.expenses)}</section><section class="panel activity-payments">${sectionTitle(tr('Devoluciones registradas'),tr('Pagos que habéis marcado como realizados.'))}${g.payments.length?g.payments.map(p=>ui`<div class="payment-row">${icon('check')}<span>${esc(member(p.from).name)} devolvió a ${esc(member(p.to).name)}</span><strong>${money(p.amount)}</strong><small>${dateLabel(p.date)}</small></div>`).join(''):tr('<p class="muted">Todavía no se han registrado devoluciones.</p>')}</section>`;}
function budgetView() {const g=group(); const spent=totalSpent(g); const categories=['Alojamiento','Transporte','Comida','Actividades','Otros'];return ui`<div class="welcome-row"><div><div class="eyebrow">DISFRUTAR, CON LAS CUENTAS CLARAS</div><h1>Un poquito de previsión<span class="purple-text">.</span></h1><p>El presupuesto de ${esc(g.name)}, de un vistazo.</p></div><select class="group-select" aria-label="Seleccionar grupo" data-group-select>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g?.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><div class="budget-layout">${budgetCard()}<section class="panel">${sectionTitle(tr('¿En qué se va el plan?'),tr('Tus gastos agrupados por categoría.'))}${categories.map(cat=>{const sum=g.expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);return `<div class="category-row"><span class="expense-icon lavender">${icon(categoryIcon(cat))}</span><div><span>${tr(cat)}</span><div class="progress-track"><span style="width:${spent?sum/spent*100:0}%"></span></div></div><strong>${money(sum)}</strong></div>`;}).join('')}</section></div>`;}

function openModal(title, content, subtitle='') {
  if (!modalRoot.contains(document.activeElement)) modalOpener = document.activeElement;
  root.querySelector('.nav-add')?.setAttribute('aria-expanded','false');
  modalRoot.innerHTML=ui`<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><div><div class="eyebrow">TODO CONECTADO</div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div>${content}</section></div>`;
  document.body.classList.add('modal-open');
  root.inert = true;
  setTimeout(()=>modalRoot.querySelector('input, select, textarea, button')?.focus(),30);
}
function closeModal() {root.querySelector('.nav-add')?.setAttribute('aria-expanded','false');const previewForm=modalRoot.querySelector('#expense-form');if(previewForm?.receiptPreviewURL)URL.revokeObjectURL(previewForm.receiptPreviewURL);modalRoot.innerHTML='';document.body.classList.remove('modal-open');root.inert=false;modalOpener?.focus();}
const actions = label => ui`<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">${label}${icon('arrow')}</button></div>`;
const memberOptions = () => group().members.map(m=>`<option value="${esc(m.id)}">${esc(memberName(m))}</option>`).join('');
function canEditExpense(e) {return !!e&&(!accountUser||canManage()||e.createdBy===accountUser.id);}
function expenseModal(id=null) {
  const existing=id?group().expenses.find(e=>e.id===id):null;
  if(id&&!canEditExpense(existing)){toast(tr('No puedes editar este gasto.'));return;}
  const editing=!!existing;
  const participantMembers=existing?[...existing.participants.map(id=>group().members.find(m=>m.id===id)).filter(Boolean),...group().members.filter(m=>!existing.participants.includes(m.id))]:group().members;
  openModal(tr(editing?'Editar gasto':'Un gasto, bien repartido'),ui`<form id="expense-form" data-entity-id="${existing?.id||uid()}" data-edit="${editing}"><label class="field">¿Qué habéis pagado?<input name="title" placeholder="Ej. Cena de bienvenida" required maxlength="100"></label><div class="form-columns"><label class="field">Importe (${currencyUnit(group())})<input name="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="0,00" required inputmode="decimal"></label><label class="field">Pagado por<select name="payer">${memberOptions()}</select></label></div><div class="form-columns"><label class="field">Categoría<select name="category">${['Comida','Transporte','Alojamiento','Actividades','Otros'].map(c=>`<option value="${esc(c)}">${tr(c)}</option>`).join('')}</select></label><label class="field">Fecha<input type="date" name="date" value="${today()}" required ${existing?.recurrence?.active?'readonly':''}></label></div><label class="field">Tipo de reparto<select name="splitMode"><option value="equal">Partes iguales</option><option value="amounts">Importes individuales</option><option value="percent">Porcentajes</option><option value="shares">Por partes</option></select></label><fieldset class="participants"><legend>Participantes del gasto</legend>${participantMembers.map(m=>`<label class="participant"><input type="checkbox" name="participants" value="${esc(m.id)}" ${!existing||existing.participants.includes(m.id)?'checked':''}>${avatar(m,true)}<span>${esc(memberName(m))}</span></label>`).join('')}</fieldset><div class="split-fields"></div><p class="split-total" aria-live="polite"></p><label class="field">Repetir<select name="frequency" ${editing?'disabled':''}><option value="">No repetir</option><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select><span class="muted">${tr(existing?.recurrence?.active?'Los cambios se aplicarán al gasto original y a sus futuras repeticiones. Las cuotas ya creadas no cambian.':existing?.seriesId?'Solo se modificará esta cuota; la repetición original no cambia.':editing?(existing?.recurrence?'La repetición está detenida. Editar no la reactivará.':'Los cambios solo afectan a este gasto.'):'Se registrará al abrir la app cuando venza, con este importe y reparto. Podrás detenerlo desde el gasto original.')}</span></label><label class="field">Foto del ticket (opcional)<input type="file" name="receipt" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"><span class="muted">Elige una foto o usa la cámara. Hasta 20 MB; la optimizamos antes de subirla.</span></label>${existing?.receipt?ui`<label class="participant"><input type="checkbox" name="removeReceipt">Quitar la foto actual</label>`:''}<div class="receipt-preview" aria-live="polite"></div><div class="form-note">${icon('spark')} Cada céntimo cuenta: el reparto se ajusta automáticamente.</div>${actions(tr(editing?'Guardar cambios':'Guardar gasto'))}</form>`,esc(group().name));
  const form=modalRoot.querySelector('#expense-form');
  form.splitDrafts={};
  if(existing){
    for(const key of ['title','payer','category','date'])form.elements[key].value=existing[key];
    form.elements.amount.value=(existing.amount/100).toFixed(2);
    form.elements.frequency.value=existing.recurrence?.frequency||'';
    form.elements.splitMode.value=existing.split?.mode||'equal';
    if(existing.split)form.splitDrafts[existing.split.mode]=Object.fromEntries(Object.entries(existing.split.values).map(([key,value])=>[key,existing.split.mode==='shares'?String(value):(value/100).toFixed(2)]));
  }
  renderSplitFields(form);
}
function renderSplitFields(form) {
  const prior=form.dataset.splitMode;
  if(prior&&prior!=='equal')form.splitDrafts[prior]={...(form.splitDrafts[prior]||{}),...Object.fromEntries([...form.querySelectorAll('[data-split-member]')].map(input=>[input.dataset.splitMember,input.value]))};
  const mode=form.elements.splitMode.value;form.dataset.splitMode=mode;
  const selected=[...form.querySelectorAll('input[name=participants]:checked')].map(input=>input.value);
  const values=form.splitDrafts[mode]||{};
  form.querySelector('.split-fields').innerHTML=mode==='equal'?'':selected.map(id=>{
    const label=mode==='percent'?'Porcentaje':mode==='shares'?'Número de partes':ui`Importe (${currencyUnit(group())})`;
    return ui`<label class="field split-row"><span>${esc(memberName(member(id)))}</span><span>${tr(label)}<input type="number" data-split-member="${esc(id)}" name="split:${esc(id)}" value="${esc(values[id]??(mode==='shares'?'1':'0'))}" step="${mode==='shares'?'1':'0.01'}" min="${mode==='shares'?'1':'0'}" max="${mode==='percent'?'100':mode==='shares'?'1000000':'1000000'}" inputmode="decimal" aria-label="${esc(memberName(member(id)))}" required></span></label>`;
  }).join('');
  updateSplitTotal(form);
}
function readSplit(form,participants) {
  const mode=form.elements.splitMode.value;if(mode==='equal')return {mode};
  const values=Object.fromEntries(participants.map(id=>{const value=form.elements['split:'+id]?.value??'';if(mode==='shares'&&!/^\d+$/.test(value))throw new Error(tr('Introduce un número entero de partes.'));return [id,mode==='shares'?Number(value):decimalUnits(value)];}));
  return {mode,values};
}
function updateSplitTotal(form) {
  const output=form.querySelector('.split-total');if(!output)return;
  const mode=form.elements.splitMode.value;
  if(mode==='equal'){output.textContent=tr('El gasto se divide a partes iguales entre los participantes seleccionados.');return;}
  try{
    const ids=[...form.querySelectorAll('input[name=participants]:checked')].map(input=>input.value);
    const split=readSplit(form,ids);const sum=Object.values(split.values).reduce((a,b)=>a+b,0);
    output.textContent=mode==='percent'?ui`Total: ${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(sum/100)} % de 100 %`:mode==='amounts'?ui`Total asignado: ${money(sum)} de ${money(decimalUnits(form.elements.amount.value||'0'))}`:ui`Total de partes: ${sum}`;
  }catch{output.textContent=tr('Completa el reparto para comprobar el total.');}
}
function groupModal(edit=false) {
  const g=group() || {};
  const selectedCurrency=currencyOf(edit?g:undefined);
  openModal(edit?tr('Los detalles del plan'):tr('Todo empieza con un grupo'),ui`<form id="group-form" data-entity-id="${uid()}" data-edit="${edit}"><div class="form-columns emoji-columns"><label class="field">Icono<select name="emoji">${['🚋','🌴','🪴','☀️','🏕️','🍕','🎉','🏠','✈️','⛷️'].map(e=>`<option ${edit&&g.emoji===e?'selected':''}>${e}</option>`).join('')}</select></label><label class="field">Nombre del grupo<input name="name" placeholder="Ej. Escapada al sur" value="${edit?esc(g.name):''}" maxlength="60" required></label></div><div class="form-columns"><label class="field">Tipo de grupo<select name="type">${['Viaje','Convivencia','Pareja','Plan con amigos'].map(t=>`<option value="${esc(t)}" ${edit&&g.type===t?'selected':''}>${tr(t)}</option>`).join('')}</select></label><label class="field">Lugar<input name="place" placeholder="Ej. Málaga, España" value="${edit?esc(g.place):''}" maxlength="80"></label></div><div class="form-columns"><label class="field">Desde<input type="date" name="date" value="${edit?esc(g.date):''}"></label><label class="field">Hasta<input type="date" name="endDate" value="${edit?esc(g.endDate):''}"></label></div>${edit||accountUser?'':ui`<label class="field">¿Quién se apunta? <span class="muted">Nombres separados por comas</span><input name="members" placeholder="Marta, Pablo, Lucía" maxlength="300"></label>`}<label class="field">Moneda del grupo<select name="currency" ${edit&&!canChangeCurrency(g)?'disabled':''}><option value="EUR" ${selectedCurrency==='EUR'?'selected':''}>${tr('Euro (€)')}</option><option value="RON" ${selectedCurrency==='RON'?'selected':''}>${tr('Leu rumano (RON)')}</option></select><span class="muted">${tr(edit&&!canChangeCurrency(g)?'La moneda no se puede cambiar después de registrar gastos o pagos. Crea otro grupo para usar otra moneda.':'La moneda se comparte con todo el grupo. No se convierten importes automáticamente.')}</span></label><label class="field"><span class="budget-currency-label">${ui`Presupuesto total del grupo (${selectedCurrency==='RON'?'RON':'€'})`}</span><input name="budget" type="number" min="1" max="10000000" step="0.01" value="${edit?g.budget/100:''}" placeholder="1200" required></label><div class="form-note">${icon('users')} ${accountUser?tr('Comparte un enlace de invitación después de crear el grupo. Cada persona entrará con su cuenta.'):tr('Demo local: los participantes y los datos se guardan solo en este navegador.')}</div>${actions(edit?tr('Guardar cambios'):tr('Crear grupo'))}${edit&&canManage()?ui`<button type="button" class="text-button danger-text delete-group-link" data-action="delete-group">Eliminar grupo</button>`:''}</form>`);
}
function settlementsModal() {
  const items=settlements(group());
  openModal(tr('Las cuentas claras'),ui`<div class="settlement-list">${items.length?items.map((p,i)=>`<div class="settlement-row"><div>${avatar(member(p.from),true)}<strong>${esc(member(p.from).name)}</strong>${icon('arrow')}<strong>${esc(member(p.to).name)}</strong></div><div><strong>${money(p.amount)}</strong>${!accountUser||p.from==='you'||p.to==='you'?ui`<button class="button secondary small-button" data-settle="${i}">Registrar pago</button>`:''}</div></div>`).join(''):empty(tr('¡Todo saldado!'),tr('El grupo está en equilibrio. A por el siguiente plan.'))}<p class="form-note">${icon('wallet')} DivZplit registra devoluciones; no envía dinero ni realiza transferencias.</p></div>`,tr('Menos transferencias para equilibrar los saldos.'));
}
function expenseDetails(id) {
  const e=group().expenses.find(e=>e.id===id); if(!e)return;
  const shares=expenseShares(e);
  openModal(esc(e.title),ui`<div class="expense-detail-total">${money(e.amount)}<span>${esc(tr(e.category))} · ${dateLabel(e.date)}</span></div><p class="detail-payer">Pagado por <strong>${esc(member(e.payer).name)}</strong></p>${e.receipt?ui`<button class="button secondary full-width" data-view-receipt="${esc(e.id)}">${icon('receipt')} Ver foto del ticket</button>`:''}${e.recurrence?`<div class="recurrence-info"><strong>${({weekly:tr('Cada semana'),monthly:tr('Cada mes'),yearly:tr('Cada año')})[e.recurrence.frequency]||tr('Recurrente')}</strong><p>${e.recurrence.active?tr('Próximo gasto: ')+dateLabel(e.recurrence.nextDate):tr('Repetición detenida')}</p>${e.recurrence.active&&(!accountUser||canManage()||e.createdBy===accountUser.id)?ui`<button class="text-button" data-stop-recurrence="${esc(e.id)}">Detener repetición</button>`:''}</div>`:e.seriesId?tr('<p class="form-note">Generado a partir de un gasto recurrente.</p>'):''}<h3 class="detail-subtitle">Así se reparte</h3>${e.participants.map((id,i)=>`<div class="share-row">${avatar(member(id),true)}<span>${esc(member(id).name)}</span><strong>${money(shares[id])}</strong></div>`).join('')}<div class="modal-actions">${canEditExpense(e)?ui`<button class="button secondary" data-edit-expense="${esc(e.id)}">Editar gasto</button><button class="button danger" data-delete-expense="${esc(e.id)}">Eliminar gasto</button>`:''}<button class="button primary" data-action="close-modal">Entendido</button></div>`);
}
function profileContent() {
  const profile=currentProfile();
  return ui`<div class="profile-detail">${avatar(profile)}<div><h3>${esc(profile.name)}${accountUser?'':tr(' · Tu perfil de demo')}</h3><p>${accountUser?esc(accountUser.email):tr('Moneda:')+' '+tr(currencyOf(group())==='RON'?'Leu rumano (RON)':'Euro (€)')+' · '+tr('Idioma:')+' '+languageName}</p></div></div><div class="privacy-note"><h3>${accountUser?tr('Vuestros planes, en el mismo sitio'):tr('Explora DivZplit a tu ritmo')}</h3><p>${accountUser?tr('Tus grupos se guardan en tu cuenta. Los cambios se comprueban cada ocho segundos mientras usas DivZplit. Solo sus miembros pueden acceder. Los grupos de ejemplo de la demo no se suben a tu cuenta.'):tr('Esta demo guarda los cambios en este navegador. Entra o crea una cuenta para organizar grupos compartidos con otras personas.')}</p></div>${accountUser?ui`<button class="button secondary full-width" data-action="signout">Cerrar sesión</button>`:ui`<button class="button primary full-width" data-action="account">Entrar o crear una cuenta</button>`}<button class="button secondary full-width export-account" data-action="export">${icon('logout')} Exportar mis datos (JSON)</button>${!accountUser?ui`<button class="text-button danger-text reset-button" data-action="reset">Restablecer los datos de ejemplo</button>`:''}`;
}
function settingsModal() {openModal(tr('Tu espacio, a tu manera'),profileContent());}
function profileView() {
  return ui`<div class="welcome-row"><div><div class="eyebrow">TU ESPACIO</div><h1>Tu perfil, a tu manera.</h1><p>Tu cuenta y tus datos, siempre a mano.</p></div></div><section class="panel profile-panel">${profileContent()}</section>`;
}
function quickAddModal() {
  const g=group();
  openModal(tr('¿Qué quieres añadir?'),ui`<div class="quick-add-content">${g?ui`<p class="quick-add-context">En el grupo: <strong>${esc(g.name)}</strong></p>${state.groups.length>1?ui`<label class="field">Seleccionar grupo<select data-quick-group>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>`:''}<div class="quick-actions">${[['new-expense','receipt',tr('Añadir gasto'),tr('Reparte una cuenta con tu grupo.')],['new-task','task',tr('Añadir tarea'),tr('Que no se os quede nada pendiente.')],['new-poll','vote',tr('Crear votación'),tr('Decidid juntos el próximo plan.')]].map(([action,ic,title,description])=>`<button class="quick-action" data-action="${action}"><span class="quick-action-icon">${icon(ic)}</span><span><strong>${title}</strong><small>${description}</small></span>${icon('chevron')}</button>`).join('')}</div>`:ui`<p class="form-note">Crea un grupo para empezar a compartir gastos y planes.</p>`}<button class="quick-action quick-new-group" data-action="new-group"><span class="quick-action-icon">${icon('users')}</span><span><strong>${tr('Crear grupo')}</strong><small>${tr('Todo empieza con tu gente.')}</small></span>${icon('plus')}</button></div>`);
  root.querySelector('.nav-add')?.setAttribute('aria-expanded','true');
}

document.addEventListener('click', event => {onAppClick(event).catch(handleActionError);});
async function onAppClick(event) {
  const el=event.target.closest('button, a');
  if(!el)return;
  if(remoteBusy || authLoading){event.preventDefault();toast(tr('Espera un momento; estamos conectando con tus grupos.'));return;}
  if(el.matches('a[href="#"],a[data-action]'))event.preventDefault();
  if(el.dataset.page){page=el.dataset.page; render();document.querySelector('#main')?.focus({preventScroll:true}); window.scrollTo({top:0});return;}
  if(el.dataset.group){state.activeGroup=el.dataset.group;page='home';tab='summary';expenseFilter='all';await save();render();window.scrollTo({top:0});return;}
  if(el.dataset.tab){tab=el.dataset.tab;render();return;}
  if(el.dataset.filter){expenseFilter=el.dataset.filter;render();return;}
  if(el.dataset.poll){const poll=group().polls.find(p=>p.id===el.dataset.poll);vote(poll,el.dataset.option,'you');await save();render();toast(poll.votes.you?tr('Tu voto está guardado. Puedes cambiarlo cuando quieras.'):tr('Has retirado tu voto.'));return;}
  if(el.dataset.editExpense){expenseModal(el.dataset.editExpense);return;}
  if(el.dataset.expense){expenseDetails(el.dataset.expense);return;}
  if(el.dataset.deleteExpense){const id=el.dataset.deleteExpense;openModal(tr('¿Eliminar este gasto?'),ui`<p class="dialog-copy">El reparto y los saldos del grupo se volverán a calcular. Esta acción no se puede deshacer.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button danger" data-confirm-delete="${esc(id)}">Sí, eliminar</button></div>`);return;}
  if(el.dataset.confirmDelete){const g=group();const receipt=g.expenses.find(e=>e.id===el.dataset.confirmDelete)?.receipt;g.expenses=g.expenses.filter(e=>e.id!==el.dataset.confirmDelete);await save();let removed=true;if(accountUser&&receipt?.path){try{await cloud.deleteReceipt(g.id,receipt.path);}catch{removed=false;}}closeModal();render();toast(removed?tr('Gasto eliminado. Los saldos están actualizados.'):tr('Gasto eliminado; no se pudo borrar su foto del almacenamiento.'));return;}
  if(el.dataset.settle!==undefined){const p=settlements(group())[Number(el.dataset.settle)];if(!p)return;openModal(tr('¿Ya se ha realizado el pago?'),ui`<p class="dialog-copy">Vas a registrar que <strong>${esc(member(p.from).name)}</strong> ha devuelto <strong>${money(p.amount)}</strong> a <strong>${esc(member(p.to).name)}</strong>.</p><p class="form-note">Confirma únicamente si el dinero ya ha llegado a su destino.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button primary" data-confirm-payment="${esc(JSON.stringify(p))}">Sí, registrar pago</button></div>`);return;}
  if(el.dataset.confirmPayment){const p=JSON.parse(el.dataset.confirmPayment);group().payments.unshift({...p,id:uid(),date:today()});await save();closeModal();render();toast(tr('Devolución registrada. Un poquito más cerca del equilibrio.'));return;}
  if(el.dataset.viewReceipt){await viewReceipt(el.dataset.viewReceipt);return;}
  if(el.dataset.stopRecurrence){const e=group().expenses.find(e=>e.id===el.dataset.stopRecurrence);if(e?.recurrence&&(!accountUser||canManage()||e.createdBy===accountUser.id)){e.recurrence.active=false;await save();expenseDetails(e.id);toast(tr('Repetición detenida. Los gastos anteriores se conservan.'));}return;}
  switch(el.dataset.action){
    case 'close-modal':closeModal();break;
    case 'quick-add':quickAddModal();break;
    case 'delete-group':deleteGroupModal();break;
    case 'new-expense':expenseModal();break;
    case 'new-group':groupModal();break;
    case 'edit-group':groupModal(true);break;
    case 'settlements':settlementsModal();break;
    case 'edit-budget':openModal(tr('Disfrutar, sin sorpresas'),ui`<form id="budget-form"><label class="field">Presupuesto total del grupo (${currencyUnit(group())})<input type="number" name="budget" min="1" max="10000000" step="0.01" value="${group().budget/100}" required></label><p class="form-note">${icon('users')} Como referencia: ${money(Math.round(group().budget/group().members.length))} por persona con el presupuesto actual.</p>${actions(tr('Actualizar presupuesto'))}</form>`,esc(group().name));break;
    case 'new-task':openModal(tr('Una pequeña cosa por hacer'),ui`<form id="task-form" data-entity-id="${uid()}"><label class="field">¿Qué queda pendiente?<input name="title" placeholder="Ej. Reservar la excursión a Sintra" maxlength="120" required></label><label class="field">¿Quién se encarga?<select name="assignee">${memberOptions()}</select></label>${actions(tr('Añadir tarea'))}</form>`);break;
    case 'new-poll':openModal(tr('¿Cuál es el plan?'),ui`<form id="poll-form" data-entity-id="${uid()}"><label class="field">La gran pregunta<input name="title" placeholder="¿Dónde cenamos el viernes?" maxlength="120" required></label><label class="field">Un poco de contexto <span class="muted">(opcional)</span><input name="description" placeholder="Algo rico, cerca del apartamento" maxlength="160"></label><label class="field">Opción 1<input name="option" placeholder="Pizzería del barrio" maxlength="100" required></label><label class="field">Opción 2<input name="option" placeholder="Restaurante portugués" maxlength="100" required></label><label class="field">Opción 3 <span class="muted">(opcional)</span><input name="option" placeholder="Otra buena idea" maxlength="100"></label>${actions(tr('Crear votación'))}</form>`);break;
    case 'settings':settingsModal();break;
    case 'account':accountModal();break;
    case 'demo':demoMode=true;page='home';await processRecurrences();closeModal();render();break;
    case 'welcome':demoMode=false;authStage='welcome';history.pushState(null,'',location.pathname+location.search);closeModal();render();break;
    case 'oauth-google':await beginOAuth('google');break;
    case 'oauth-apple':await beginOAuth('apple');break;
    case 'retry-providers':await refreshProviders();break;
    case 'signup':authMode='signup';authStage='signup';if(!demoMode)history.pushState(null,'','#registro');accountModal();break;
    case 'login':authMode='login';authStage='login';if(!demoMode)history.pushState(null,'','#acceso');accountModal();break;
    case 'signout':await signOutAccount();break;
    case 'invite':inviteModal();break;
    case 'generate-invite':await generateInvite();break;
    case 'recover':authStage='recover';demoMode=false;closeModal();render();break;
    case 'copy-invite':await copyInvite();break;
    case 'revoke-invites':await revokeInvites();break;
    case 'accept-invite':await acceptInvite();break;
    case 'dismiss-invite':clearInvite();render();break;
    case 'export':{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='divzplit-datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(tr('Tus datos se han exportado.'));break;}
    case 'reset':if(accountUser)return;openModal(tr('¿Volver al punto de partida?'),ui`<p class="dialog-copy">Se eliminarán de este navegador tus grupos y cambios y volverán los datos de ejemplo. Puedes exportarlos antes desde tu perfil.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button danger" data-action="confirm-reset">Restablecer demo</button></div>`);break;
    case 'confirm-reset':if(accountUser)return;state=seed();page='home';tab='summary';expenseFilter='all';await save();closeModal();render();toast(tr('La demo vuelve a estar como el primer día.'));break;
  }
}
document.addEventListener('change',event=>{onAppChange(event).catch(handleActionError);});
async function onAppChange(event) {
  const el=event.target;
  if(remoteBusy || authLoading){render();return;}
  if(el.matches('[data-quick-group]')){state.activeGroup=el.value;await save();render();modalOpener=[...root.querySelectorAll('[data-action=quick-add]')].find(button=>button.getClientRects().length);quickAddModal();return;}
  if(el.form?.id==='expense-form'&&(el.name==='splitMode'||el.name==='participants')){renderSplitFields(el.form);return;}
  if(el.name==='removeReceipt'&&el.checked){const file=el.form.elements.receipt;file.value='';await receiptChanged(file);return;}
  if(el.matches('select[name=currency]')){const label=el.form.querySelector('.budget-currency-label');if(label)label.textContent=ui`Presupuesto total del grupo (${el.value==='RON'?'RON':'€'})`;return;}
  if(el.matches('input[name=receipt]')){await receiptChanged(el);return;}
  if(el.dataset.task){const t=group().tasks.find(t=>t.id===el.dataset.task);t.done=el.checked;await save();render();toast(t.done?tr('¡Una cosa menos por hacer!'):tr('Tarea marcada como pendiente.'));}
  if(el.matches('[data-group-select]')){state.activeGroup=el.value;await save();render();}
}
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.closest('#modal-root')&&!['account-form','recovery-form','password-form'].includes(form.id))return;event.preventDefault();if(remoteBusy||authLoading)return;const data=new FormData(form);
  if(await handleDeleteGroupForm(form,data))return;
  if(await handleRecoveryForm(form,data))return;
  if(await handleAccountForm(form,data))return;
  try {
    if(form.id==='expense-form'){
      if(form.receiptPending)throw new Error(tr('Espera a que termine de prepararse la foto.'));
      remoteBusy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;
      try {
        const fields={title:data.get('title'),amount:Math.round(Number(data.get('amount'))*100),payer:data.get('payer'),participants:data.getAll('participants'),category:data.get('category'),date:data.get('date')};
        const existing=form.dataset.edit==='true'?group()?.expenses.find(e=>e.id===form.dataset.entityId):null;
        if(form.dataset.edit==='true'&&!canEditExpense(existing))throw new Error(tr('No puedes editar este gasto.'));
        fields.split=readSplit(form,fields.participants);
        validateExpense(group(),fields);
        if(existing?.recurrence?.active&&existing.date!==fields.date)throw new Error(tr('Detén la repetición antes de cambiar la fecha del gasto original.'));
        if(accountUser&&fields.split.mode!=='equal')await cloud.requireExpenseTools();
        const frequency=data.get('frequency');
        if(frequency&&!['weekly','monthly','yearly'].includes(frequency))throw new Error(tr('Repetición no válida.'));
        const recurrence=frequency?{frequency,active:true,anchorDay:Number(fields.date.slice(8)),nextDate:nextOccurrence(fields.date,frequency)}:null;
        let receipt=form.uploadedReceipt||(existing&&!data.get('removeReceipt')?existing.receipt:undefined);
        if(form.receiptBlob)receipt=form.uploadedReceipt;
        if(form.receiptBlob&&!receipt){
          if(accountUser){submit.textContent=tr('Subiendo ticket…');receipt=await cloud.uploadReceipt(group().id,form.receiptUploadId||uid(),form.receiptBlob);form.uploadedReceipt=receipt;}
          else receipt={dataURL:await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(form.receiptBlob);})};
        }
        const added=existing?updateExpense(group(),existing.id,fields):addExpense(group(),fields);added.id=form.dataset.entityId;
        if(accountUser&&!existing)added.createdBy=accountUser.id;
        if(receipt)added.receipt=receipt;else delete added.receipt;
        if(recurrence&&!existing)added.recurrence=recurrence;
        form.intendedExpense=structuredClone(added);
        if(existing?.receipt?.path&&existing.receipt.path!==receipt?.path)form.oldReceipt={groupId:group().id,path:existing.receipt.path};
      }finally{remoteBusy=false;submit.disabled=false;submit.innerHTML=tr(form.dataset.edit==='true'?'Guardar cambios':'Guardar gasto')+icon('arrow');}
    }
    if(form.id==='task-form'){const title=data.get('title').trim();if(!title)throw new Error(tr('Escribe qué hay que hacer.'));group().tasks.push({id:accountUser?form.dataset.entityId:uid(),title,assignee:data.get('assignee'),done:false});}
    if(form.id==='poll-form'){const title=data.get('title').trim();const options=data.getAll('option').map(s=>s.trim()).filter(Boolean);if(!title||options.length<2)throw new Error(tr('Escribe una pregunta y al menos dos opciones.'));if(new Set(options.map(s=>s.toLowerCase())).size!==options.length)throw new Error(tr('Las opciones deben ser diferentes.'));group().polls.unshift({id:accountUser?form.dataset.entityId:uid(),title,description:data.get('description').trim(),options:options.map(label=>({id:uid(),label,emoji:'✦'})),votes:{}});tab='plans';}
    if(form.id==='budget-form'){const budget=Math.round(Number(data.get('budget'))*100);if(!Number.isSafeInteger(budget)||budget<100)throw new Error(ui`El presupuesto debe ser de al menos 1 ${currencyUnit(group())}.`);group().budget=budget;}
    if(form.id==='group-form'){
      const name=data.get('name').trim();if(!name)throw new Error(tr('Ponle un nombre al grupo.'));
      if(data.get('endDate')&&!data.get('date'))throw new Error(tr('Indica también la fecha de inicio.'));
      if(data.get('date')&&data.get('endDate')&&data.get('endDate')<data.get('date'))throw new Error(tr('La fecha final debe ser posterior a la inicial.'));
      const currency=data.get('currency')||(form.dataset.edit==='true'?currencyOf(group()):'EUR');
      checkCurrencyChange(form.dataset.edit==='true'?group():null,currency);
      const fields={currency,name,emoji:data.get('emoji'),type:data.get('type'),place:data.get('place').trim(),date:data.get('date'),endDate:data.get('endDate'),budget:Math.round(Number(data.get('budget'))*100)};
      if(form.dataset.edit==='true')Object.assign(group(),fields);
      else {
        const names=String(data.get('members') || '').split(',').map(n=>n.trim()).filter(Boolean);if(names.length>19)throw new Error(tr('Puedes añadir hasta 19 personas más.'));
        const colors=['pink','blue','orange','purple'];const g={...fields,id:accountUser?form.dataset.entityId:uid(),members:[{id:'you',name:'Tú',initials:'AL',color:'purple'},...names.map((name,i)=>({id:uid(),name,initials:name.split(/\s+/).map(n=>n[0]).join('').slice(0,2).toUpperCase(),color:colors[i%4]}))],expenses:[],payments:[],tasks:[],polls:[]};state.groups.push(g);state.activeGroup=g.id;page='home';tab='summary';
      }
    }
    await save();if(form.oldReceipt&&accountUser)cloud.deleteReceipt(form.oldReceipt.groupId,form.oldReceipt.path).catch(()=>{});closeModal();render();toast(form.id==='group-form'?tr('El plan ya tiene su espacio.'):tr('Listo. Todo está actualizado.'));
  }catch(error){
    // A response can be lost after the server commits. Stable form IDs let a
    // reload confirm the saved record instead of creating another one on retry.
    const id=form.dataset.entityId;
    const collection={'expense-form':'expenses','task-form':'tasks','poll-form':'polls'}[form.id];
    const confirmed=accountUser&&id&&((form.id==='group-form'&&form.dataset.edit!=='true'&&state.groups.some(g=>g.id===id))||(collection&&group()?.[collection]?.some(item=>item.id===id&&(form.dataset.edit!=='true'||sameJSON(item,form.intendedExpense)))));
    if(confirmed){closeModal();render();toast(tr('El servidor ha confirmado el registro. No se ha creado ningún duplicado.'));}
    else if(form.isConnected) form.querySelector('.form-error').textContent=error.message;
    else toast(error.message);
  }
});
modalRoot.addEventListener('click',event=>{if(event.target.classList.contains('modal-overlay'))closeModal();});
document.addEventListener('keydown',event=>{
  const modal=modalRoot.querySelector('.modal');if(!modal)return;
  if(event.key==='Escape'){closeModal();return;}
  if(event.key==='Tab'){const items=[...modal.querySelectorAll('button, input, select, textarea, a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}
});
render();
if(storageWarning)toast(storageWarning);
startAccount();
refreshProviders();

function currentProfile() {
  const metadata=accountUser?.user_metadata || {};
  const raw=metadata.display_name || metadata.full_name || metadata.name;
  const name=(typeof raw==='string'?raw.trim().slice(0,40):'') || (accountUser?tr('Miembro'):'Alex');
  return {name,initials:name.split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase(),color:'purple'};
}
function handleActionError(error) {
  if (accountUser&&!cloud.session) {
    accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();closeModal();render();
  }
  toast(error.message);
}
function sameJSON(a,b) {
  const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;
  return JSON.stringify(sort(a))===JSON.stringify(sort(b));
}
function deleteGroupModal() {
  const g=group();if(!g||!canManage())return;
  openModal(tr('¿Eliminar este grupo?'),ui`<form id="delete-group-form" data-id="${esc(g.id)}" data-version="${g.remote?.version||0}" data-name="${esc(g.name)}"><p class="delete-group-warning">Se eliminarán el grupo, sus gastos, tareas, votaciones e invitaciones para todos los miembros. Esta acción no se puede deshacer.</p>${settlements(g).length?ui`<p class="form-note">Hay saldos pendientes. Eliminar el grupo no realiza pagos ni salda las deudas.</p>`:''}<p class="form-note">${ui`${g.expenses.length} gastos · Total: ${money(totalSpent(g))}`}</p><label class="field">Escribe el nombre del grupo para confirmar<input name="confirmation" autocomplete="off" required maxlength="60"></label><p class="delete-group-name">${esc(g.name)}</p>${actions(tr('Eliminar grupo definitivamente'))}</form>`,esc(g.name));
}
async function handleDeleteGroupForm(form,data) {
  if(form.id!=='delete-group-form')return false;
  if(data.get('confirmation')!==form.dataset.name){form.querySelector('.form-error').textContent=tr('El nombre no coincide. Escríbelo exactamente como aparece.');return true;}
  const id=form.dataset.id,g=state.groups.find(g=>g.id===id);
  if(!g||accountUser&&g.remote?.ownerId!==accountUser.id){form.querySelector('.form-error').textContent=tr('Solo el propietario puede eliminar este grupo.');return true;}
  remoteBusy=true;const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent=tr('Eliminando grupo…');
  try{
    if(accountUser)await cloud.deleteGroup({...g,remote:{...g.remote,version:Number(form.dataset.version)}});
    state.groups=state.groups.filter(g=>g.id!==id);remoteBaseline.delete(id);state.activeGroup=state.groups[0]?.id||null;page='home';tab='summary';
    if(accountUser){rememberActiveGroup();cloud.cleanupDeletedGroups().catch(()=>{});}else await save();
    closeModal();render();toast(tr('Grupo eliminado.'));
  }catch(error){
    form.querySelector('.form-error').textContent=error.code==='NEXO_CONFLICT'?tr('El grupo ha cambiado. Cierra esta ventana, actualiza y revisa los datos antes de eliminarlo.'):error.message;
  }finally{remoteBusy=false;if(button.isConnected){button.disabled=false;button.textContent=tr('Eliminar grupo definitivamente');}}
  return true;
}
document.addEventListener('input',event=>{if(event.target.form?.id==='expense-form'&&(event.target.name==='amount'||event.target.dataset.splitMember))updateSplitTotal(event.target.form);});
async function processRecurrences() {
  let changed=false;
  for(const g of state.groups){
    const before=JSON.stringify(g);materializeRecurring(g,today(),e=>!accountUser||g.remote?.ownerId===accountUser.id||e.createdBy===accountUser.id,accountUser?.id);if(before!==JSON.stringify(g))changed=true;
  }
  if(changed)await save();
}
async function receiptChanged(input) {
  const form=input.form;const attempt={};form.receiptAttempt=attempt;
  form.receiptBlob=null;form.uploadedReceipt=null;form.receiptUploadId=uid();
  if(input.files[0]?.size&&form.elements.removeReceipt)form.elements.removeReceipt.checked=false;
  const preview=form.querySelector('.receipt-preview');preview.replaceChildren();
  if(form.receiptPreviewURL)URL.revokeObjectURL(form.receiptPreviewURL);
  try {
    form.receiptPending=prepareReceipt(input.files[0]);const blob=await form.receiptPending;
    if(form.receiptAttempt!==attempt||!form.isConnected)return;
    if(blob){form.receiptBlob=blob;form.receiptPreviewURL=URL.createObjectURL(blob);const img=document.createElement('img');img.src=form.receiptPreviewURL;img.alt=tr('Vista previa del ticket');preview.append(img);}
  }catch(error){if(form.receiptAttempt===attempt){input.value='';toast(error.message);}}
  finally{if(form.receiptAttempt===attempt)form.receiptPending=null;}
}
async function viewReceipt(id) {
  const g=group();const e=g.expenses.find(e=>e.id===id);if(!e?.receipt)return;
  openModal(tr('Foto del ticket'),tr('<p class="receipt-loading" role="status">Abriendo ticket…</p>'));const container=modalRoot.querySelector('.modal');
  try {
    let url;
    if(accountUser)url=await cloud.receiptURL(g.id,e.receipt.path);
    else if(typeof e.receipt.dataURL==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(e.receipt.dataURL))url=e.receipt.dataURL;
    else throw new Error(tr('No se ha encontrado la foto del ticket.'));
    if(!container.isConnected)return;
    const img=document.createElement('img');img.className='receipt-photo';img.alt=tr('Ticket de ')+e.title;img.src=url;img.referrerPolicy='no-referrer';img.onerror=()=>{if(container.isConnected)container.querySelector('.receipt-loading').textContent=tr('No se ha podido cargar la foto. Cierra esta ventana y vuelve a intentarlo.');};img.onload=()=>container.querySelector('.receipt-loading')?.remove();container.append(img);
  }catch(error){if(container.isConnected)container.querySelector('.receipt-loading').textContent=error.message;}
}
function renderRecovery(reset) {
  const form=reset?ui`<form id="password-form"><label class="field">Nueva contraseña<input type="password" name="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><label class="field">Repetir contraseña<input type="password" name="confirm" autocomplete="new-password" minlength="10" maxlength="128" required></label><p class="form-error" role="alert"></p><button class="button primary full-width" type="submit">Guardar contraseña</button></form>`:ui`<form id="recovery-form"><label class="field">Correo electrónico<input type="email" name="email" autocomplete="email" required maxlength="254"></label><p class="form-note">Abre el enlace del correo en este mismo navegador. No cierres esta pestaña hasta recibirlo.</p><p class="form-error" role="alert"></p><button class="button primary full-width" type="submit">Enviar enlace de recuperación</button></form>`;
  root.innerHTML=welcomePage({stage:'recover',form,social:'',notice:'',signup:false,title:reset?tr('Elige una contraseña'):tr('Recupera tu cuenta'),description:reset?tr('Una contraseña nueva para volver a tus planes.'):tr('Te ayudamos a volver a entrar.')});
  const prompt=root.querySelector('.signup-prompt');
  if(reset){prompt.remove();const back=root.querySelector('.auth-back');back.dataset.action='signout';back.textContent=tr('← Cancelar recuperación');}
  else prompt.innerHTML=tr('¿Recuerdas tu contraseña? <a href="#acceso" data-action="login">Iniciar sesión</a>');
  root.inert=!!modalRoot.firstElementChild;
}
async function handleRecoveryForm(form,data) {
  if(!['recovery-form','password-form'].includes(form.id))return false;
  remoteBusy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;const original=submit.textContent;submit.textContent=tr('Un momento…');
  try {
    if(form.id==='recovery-form'){
      await cloud.recoverPassword(data.get('email').trim(),new URL('./',location.href).href);
      openModal(tr('Revisa tu correo'),tr('<p class="form-note">Si existe una cuenta con esa dirección, recibirás un enlace para elegir una nueva contraseña. Ábrelo en este mismo navegador. Revisa también spam.</p><button class="button primary full-width" data-action="close-modal">Entendido</button>'));
    }else{
      const password=data.get('password');if(password.length<10||password!==data.get('confirm'))throw new Error(tr('Las contraseñas deben coincidir y tener al menos 10 caracteres.'));
      await cloud.updatePassword(password);try{await cloud.signOut();}catch{/* local session is cleared even when sign-out is unreachable */}accountUser=null;authStage='login';authMode='login';history.replaceState(null,'',location.pathname+location.search+'#acceso');render();toast(tr('Contraseña actualizada. Entra con tu nueva contraseña.'));
    }
  }catch(e){form.querySelector('.form-error').textContent=e.message;}
  finally{remoteBusy=false;if(submit.isConnected){submit.disabled=false;submit.textContent=original;}}
  return true;
}
function canManage() {return !accountUser || group()?.remote?.ownerId===accountUser.id;}
function setSync(message) {syncMessage=message;}

function rememberActiveGroup() {
  try {sessionStorage.setItem('nexo-active-'+accountUser.id,state.activeGroup || '');} catch {}
}
function emptyAccount() {
  return ui`<section class="panel account-empty"><div class="eyebrow">ESTO ACABA DE EMPEZAR</div>${empty(tr('Tu próximo plan empieza aquí'),tr('Crea un grupo y comparte una invitación. Cada persona tendrá su propio acceso.'),'new-group',tr('Crear mi primer grupo'))}</section>`;
}
function accountBanner() {
  if (pendingInvite) return ui`<div class="account-banner invite-banner"><div><strong>Un buen plan te está esperando.</strong><p>${accountUser?tr('Acepta la invitación para unirte al grupo.'):tr('Entra o crea una cuenta para aceptar la invitación.')}</p></div><button class="button primary" data-action="${accountUser?'accept-invite':'account'}">${accountUser?tr('Aceptar invitación'):tr('Entrar y unirme')}</button><button class="icon-button" data-action="dismiss-invite" aria-label="Descartar invitación">${icon('close')}</button></div>`;
  if (inviteError) return `<div class="account-banner" role="alert">${esc(inviteError)}</div>`;
  return '';
}
function accountForm() {
  const signup=authMode==='signup';
  if(!cloud.enabled) return tr('<div class="privacy-note"><p>El acceso con cuenta todavía no está disponible. Puedes explorar DivZplit con la demo.</p></div>');
  return ui`<form id="account-form" data-mode="${authMode}">${signup?tr('<label class="field">¿Cómo te llamas?<input name="name" autocomplete="nickname" maxlength="40" placeholder="Tu nombre" required></label>'):''}<label class="field">Correo electrónico<input type="email" name="email" autocomplete="email" maxlength="254" placeholder="tu@correo.com" required></label><label class="field">Contraseña<input type="password" name="password" autocomplete="${signup?'new-password':'current-password'}" minlength="${signup?10:1}" maxlength="128" placeholder="${signup?tr('Al menos 10 caracteres'):tr('Tu contraseña')}" required></label><p class="form-note">${signup?tr('Te enviaremos un correo para confirmar tu cuenta.'):tr('Entra para recuperar tus grupos, también en otro móvil.')}</p><p class="form-error" role="alert"></p><button class="button primary full-width auth-submit" type="submit">${signup?tr('Crear cuenta'):tr('Iniciar sesión')} ${icon('arrow')}</button>${signup?'':tr('<button type="button" class="text-button forgot-password" data-action="recover">¿Has olvidado tu contraseña?</button>')}</form>`;
}
function renderWelcome() {
  let notice='';
  if(pendingInvite) notice=tr('<div class="auth-invite-note">✦ Te han invitado a un grupo. Entra o crea una cuenta para unirte.</div>');
  else if(inviteError) notice=`<p class="form-error" role="alert">${esc(inviteError)}</p>`;
  const animate=!brandIntroShown&&!authLoading;
  if(!authLoading)brandIntroShown=true;
  root.innerHTML=welcomePage({stage:authStage,animate,loading:authLoading,signup:authMode==='signup',form:accountForm(),social:socialButtons({providers,error:providerError,enabled:cloud.enabled}),notice});
  root.inert=!!modalRoot.firstElementChild;
}
function accountModal() {
  if(accountUser){settingsModal();return;}
  if(!demoMode){closeModal();render();document.querySelector('#account-form input')?.focus();return;}
  openModal(authMode==='signup'?tr('Crea tu cuenta'):tr('Inicia sesión'),ui`<div class="social-providers">${socialButtons({providers,error:providerError,enabled:cloud.enabled})}</div><div class="auth-divider"><span>o continúa con tu correo</span></div>${accountForm()}<div class="account-switch">${authMode==='signup'?tr('¿Ya tienes cuenta?'):tr('¿Es tu primera vez?')} <button class="text-button" data-action="${authMode==='signup'?'login':'signup'}">${authMode==='signup'?tr('Iniciar sesión'):tr('Crear cuenta')}</button></div>`);
}
async function refreshProviders() {
  if(!cloud.enabled)return;
  try {providers=await cloud.providers();providerError=false;}
  catch {providerError=true;}
  document.querySelectorAll('.social-providers').forEach(el=>el.innerHTML=socialButtons({providers,error:providerError,enabled:cloud.enabled}));
}
async function beginOAuth(provider) {
  remoteBusy=true;
  try {
    const latest=await cloud.providers();providers=latest;
    if(!latest[provider]) {await refreshProviders();throw new Error(ui`${provider==='google'?'Google':'Apple'} todavía no está disponible. Puedes usar tu correo.`);}
    const url=await cloud.oauthURL(provider,new URL('./',location.href).href);
    location.assign(url);
  } finally {remoteBusy=false;}
}
async function handleAccountForm(form,data) {
  if (form.id!=='account-form') return false;
  remoteBusy=true;
  const submit=form.querySelector('[type="submit"]');const originalSubmit=submit.innerHTML;submit.disabled=true;submit.textContent=form.dataset.mode==='signup'?tr('Creando tu cuenta…'):tr('Iniciando sesión…');form.setAttribute('aria-busy','true');const existingError=form.querySelector('.form-error');if(existingError)existingError.textContent='';
  try {
    const email=data.get('email').trim();
    const password=data.get('password');
    if (form.dataset.mode==='signup') {
      const name=data.get('name').trim();if (!name) throw new Error(tr('Escribe tu nombre.'));
      const signedIn=await cloud.signUp(email,password,name,new URL('./',location.href).href);
      if (!signedIn) {
        openModal(tr('Revisa tu correo'),ui`<div class="privacy-note"><h3>Un paso más para empezar</h3><p>Si el correo puede registrarse, recibirás un enlace para confirmar tu cuenta. Revisa también la carpeta de spam. Si ya tienes cuenta, puedes entrar directamente.</p></div><button class="button primary full-width" data-action="login">Ya he confirmado: entrar</button>`);
        return true;
      }
    } else await cloud.signIn(email,password);
    await connectAccount();closeModal();render();toast(tr('¡Ya estás dentro! Tus planes tienen su propio espacio.'));
  } catch(error) {
    if (accountUser) {setSync(tr('Sin conexión · Reintentar'));render();}
    const alert=form.querySelector('.form-error');if (alert?.isConnected) alert.textContent=error.message;
    else toast(error.message);
  } finally {remoteBusy=false;if(submit.isConnected){submit.disabled=false;submit.innerHTML=originalSubmit;form.removeAttribute('aria-busy');}}
  return true;
}
async function connectAccount() {
  accountUser=cloud.user;demoMode=false;
  state={version:1,activeGroup:null,groups:[]};remoteBaseline.clear();page='home';tab='summary';
  try {state.activeGroup=sessionStorage.getItem('nexo-active-'+accountUser.id);} catch {}
  await loadSharedGroups();await processRecurrences();setSync(tr('Actualizado'));
  cloud.cleanupDeletedGroups().catch(()=>{});
}
async function loadSharedGroups() {
  const groups=await cloud.listGroups();
  state.groups=groups;
  if (!groups.some(g=>g.id===state.activeGroup)) state.activeGroup=groups[0]?.id || null;
  remoteBaseline.clear();groups.forEach(g=>remoteBaseline.set(g.id,JSON.stringify(g)));
}
async function refreshShared() {
  if(!accountUser&&demoMode&&!remoteBusy&&!modalRoot.firstElementChild&&!document.hidden){const before=JSON.stringify(state.groups);await processRecurrences();if(before!==JSON.stringify(state.groups))render();return;}
  if (!accountUser||remoteBusy||authLoading||modalRoot.firstElementChild||document.hidden) return;
  remoteBusy=true;
  const before=JSON.stringify(state.groups);
  try {
    await loadSharedGroups();await processRecurrences();setSync(tr('Actualizado'));
    if (before!==JSON.stringify(state.groups)) render();
  } catch(error) {
    setSync(tr('Sin conexión · Reintentar'));
    if (!cloud.session) {accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();render();toast(tr('Tu sesión ha caducado. Vuelve a entrar.'));}
  } finally {remoteBusy=false;}
}
async function signOutAccount() {
  remoteBusy=true;
  try {await cloud.signOut();}
  catch {toast(tr('Has salido de este navegador. No se pudo cerrar la sesión en el servidor.'));}
  finally {
    accountUser=null;demoMode=false;authStage='welcome';authMode='login';history.replaceState(null,'',location.pathname+location.search);remoteBaseline.clear();state=structuredClone(demoState);page='home';tab='summary';
    remoteBusy=false;closeModal();render();
  }
}
function clearInvite() {
  pendingInvite='';inviteError='';try {sessionStorage.removeItem('nexo-pending-invite');} catch {}
}
function inviteModal() {
  if (!accountUser||!canManage()) {toast(tr('Solo quien creó el grupo puede invitar a otras personas.'));return;}
  openModal(tr('Los buenos planes se comparten'),ui`<div class="privacy-note"><h3>${esc(group().name)}</h3><p>Crea un enlace y envíalo a tus amigos. Cada persona tendrá que entrar con su cuenta para unirse. El enlace dura siete días y admite hasta 20 nuevas personas.</p><p>Generar uno nuevo invalida los enlaces anteriores. Quien tenga el enlace podrá unirse: compártelo solo con tu grupo.</p></div><button class="button primary full-width" data-action="generate-invite">Generar enlace de invitación</button><button class="text-button danger-text reset-button" data-action="revoke-invites">Desactivar los enlaces actuales</button>`);
}
async function generateInvite() {
  if (!canManage())return;
  remoteBusy=true;
  try {
    const result=await cloud.invite(group().id);
    const url=new URL('./',location.href);url.search='';url.hash='invite='+result.token;
    openModal(tr('Una invitación a buenos momentos'),ui`<label class="field">Enlace para tu grupo<input id="invite-link" readonly value="${esc(url.href)}" aria-label="Enlace de invitación"></label><p class="form-note">Válido hasta el ${esc(new Date(result.expires_at).toLocaleDateString(locale))}. Hasta 20 personas. Los enlaces anteriores ya no funcionan.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cerrar</button><a class="button secondary whatsapp-share" href="https://wa.me/?text=${encodeURIComponent(tr('Únete a ')+group().name+tr(' en DivZplit para compartir los gastos: ')+url.href)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><button class="button primary" data-action="copy-invite">Copiar enlace</button></div>`);
  } finally {remoteBusy=false;}
}
async function copyInvite() {
  const input=document.querySelector('#invite-link');if(!input)return;
  try {await navigator.clipboard.writeText(input.value);toast(tr('Enlace copiado. ¡Pásalo a tu gente!'));}
  catch {input.focus();input.select();toast(tr('Mantén pulsado el enlace o usa Ctrl+C para copiarlo.'));}
}
async function revokeInvites() {
  if (!canManage())return;remoteBusy=true;
  try {await cloud.revokeInvites(group().id);closeModal();toast(tr('Enlaces desactivados. Los miembros actuales conservan su acceso.'));}
  finally {remoteBusy=false;}
}
async function acceptInvite() {
  if (!accountUser){accountModal();return;}
  remoteBusy=true;
  try {
    const joined=await cloud.join(pendingInvite);state.activeGroup=joined.id;
    clearInvite();await loadSharedGroups();rememberActiveGroup();page='home';tab='summary';render();toast(tr('¡Ya formas parte del grupo!'));
  } catch(error) {render();throw error;}
  finally {remoteBusy=false;}
}
async function startAccount() {
  const hash=location.hash;
  const callbackSearch=location.search;
  let returnedFromEmail=false;
  const params=new URLSearchParams(hash.replace(/^#/,''));
  try {pendingInvite=sessionStorage.getItem('nexo-pending-invite') || '';} catch {}
  if (params.has('invite')) {
    const token=params.get('invite');
    if (/^[a-f0-9]{64}$/.test(token)) {pendingInvite=token;try{sessionStorage.setItem('nexo-pending-invite',token);}catch{}}
    else inviteError=tr('El enlace de invitación no está completo. Pide a tu amigo que lo copie de nuevo.');
  }
  const cleanURL=new URL(location.href);
  const queryCallback=['code','error','error_description','error_code'].some(key=>cleanURL.searchParams.has(key));
  if(queryCallback) for(const key of ['code','error','error_description','error_code'])cleanURL.searchParams.delete(key);
  if(params.has('invite')||params.has('access_token')||params.has('error'))cleanURL.hash='';
  if(queryCallback||cleanURL.hash!==location.hash)history.replaceState(null,'',cleanURL.pathname+cleanURL.search+cleanURL.hash);
  try {
    if (cloud.enabled) {
      const oauthComplete=await cloud.finishOAuth(callbackSearch,new URL('./',location.href).href);
      returnedFromEmail=await cloud.acceptCallback(hash);
      if(!oauthComplete)await cloud.restore();
      if (cloud.user&&!cloud.recovering) await connectAccount();
    }
    if (configError) storageWarning=configError;
  } catch(error) {
    if (cloud.user) {accountUser=cloud.user;state={version:1,groups:[],activeGroup:null};syncMessage=tr('Sin conexión · Reintentar');}
    storageWarning=error.message;
  } finally {
    authLoading=false;render();
    if(returnedFromEmail&&!accountUser){authMode='login';authStage='login';accountModal();toast(tr('Has vuelto del enlace de correo. Entra para comprobar tu cuenta.'));}
    else if(storageWarning)toast(storageWarning);
  }
}
setInterval(()=>refreshShared(),8000);
window.addEventListener('popstate',()=>{
  if(!accountUser&&!demoMode){authStage=location.hash==='#registro'?'signup':location.hash==='#acceso'?'login':'welcome';authMode=authStage==='signup'?'signup':'login';closeModal();render();}
});
window.addEventListener('hashchange',()=>{
  const params=new URLSearchParams(location.hash.replace(/^#/,''));
  if (params.has('invite')) {
    const token=params.get('invite');
    if (/^[a-f0-9]{64}$/.test(token)) {
      pendingInvite=token;inviteError='';
      try {sessionStorage.setItem('nexo-pending-invite',token);} catch {}
    } else inviteError=tr('El enlace de invitación no está completo. Pide a tu amigo que lo copie de nuevo.');
    history.replaceState(null,'',location.pathname+location.search);render();
  } else if (params.has('access_token')||params.has('error')) {
    authLoading=true;render();startAccount();
  }
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshShared();});
window.addEventListener('storage',event=>{
  if (event.key===cloud.storageKey && accountUser) {
    // Another tab may have refreshed its session or signed out. Do not restore
    // a stale refresh token or keep another account's groups on screen.
    authLoading=true;accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();closeModal();render();
    startAccount();
  }
});
