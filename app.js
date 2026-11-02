import {groupMode,homeSummary,dayOffset,groupForMode} from './home.js?v=shopping-34';
import {euroAmount,validQuote} from './fx.js?v=shopping-34';
import {optionalBudget,localDateTime,planClosed,planningFields} from './planning.js?v=shopping-34';
import {receiptTools,clearReceiptAutofill,cancelReceiptReader,resetReceiptReader,handleReceiptAction} from './receipt-ui.js?v=shopping-34';
import {tr,ui,locale,languageName,initializeLanguage} from './i18n.js?v=shopping-34';
import {nextOccurrence,materializeRecurring,prepareReceipt} from './extras.js?v=ocr-18';
import {money as formatMoney,currencies,currencyDigits,currencyScale,currencyStep, currencyOf,currencyUnit,canChangeCurrency,checkCurrencyChange, uid, totalSpent, balances, settlements, addExpense, updateExpense, validateExpense, expenseShares, decimalUnits, vote, seed} from './model.js?v=shopping-34';
import {Cloud} from './cloud.js?v=shopping-34';
import {historyView,paymentRequestsView} from './activity-ui.js?v=shopping-34';
import {NotificationCentre} from './notifications.js?v=shopping-34';
import {cloudConfig} from './config.js';
import {welcomePage,socialButtons} from './auth-ui.js?v=welcome-20';

initializeLanguage();

let cloud;
let configError='';
try {cloud=new Cloud(cloudConfig);} catch (error) {configError=error.message;cloud=new Cloud({});}
const notifications=new NotificationCentre({cloud,openModal,toast,groups:()=>state.groups,closeModal,canOfferOnboarding:()=>!!accountUser&&!authLoading&&!remoteBusy&&!brandIntroActive&&!pendingInvite&&!modalRoot.firstElementChild,openGroup:async(id,kind)=>{
  if(!state.groups.some(g=>g.id===id))await loadSharedGroups();
  if(!state.groups.some(g=>g.id===id))throw new Error(tr('No tienes acceso a este grupo.'));
  closeModal();state.activeGroup=id;rememberActiveGroup();
  page=kind.startsWith('payment')?'activity':'home';tab=kind.startsWith('polls.')?'plans':kind.startsWith('tasks.')?'tasks':'expenses';
  if(page==='activity')await loadActivity();render();window.scrollTo({top:0});
  if(kind.startsWith('tasks.'))await showPlanningList('tasks');else if(kind.startsWith('polls.'))await showPlanningList('polls');
}});
let accountUser=null;
let remoteBusy=false;
let authLoading=cloud.enabled;
let syncMessage='';
let authMode=location.hash==='#registro'?'signup':'login';
let authStage=location.hash==='#registro'?'signup':location.hash==='#acceso'?'login':'welcome';
let brandIntroShown=false;
let brandIntroActive=false;
let brandIntroPendingRender=false;
let finishBrandIntro=()=>{};
let demoMode=false;
let providers=null;
let providerError=false;
let pendingInvite='';
let inviteError='';
const remoteBaseline=new Map();
const activityCache=new Map();
const activityRequests=new Map();
let fxSession={groupId:null,mode:false,quote:null,error:'',loading:false,request:0};
let homeClock=0;
let shoppingState={groupId:null,viewer:null,items:[],error:'',loading:false};
let shoppingRequest=0;
let planningLimit=30;
let recordedPaymentLimit=50;
let showArchivedRepayments=false;
const paymentArchives=new Map();
const archiveRequests=new Map();

const icons = {
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5"/>',
  refresh:'<path d="M20 7V3m0 4h-4M4 17v4m0-4h4M20 7a9 9 0 0 0-15-2M4 17a9 9 0 0 0 15 2"/>',
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
// Keep the number and currency as unbroken units within narrow summary cards.
const statMoney=cents=>{
  const parts=new Intl.NumberFormat(locale,{style:'currency',currency:currencyOf(group()),minimumFractionDigits:currencyDigits(currencyOf(group())),maximumFractionDigits:currencyDigits(currencyOf(group()))}).formatToParts(cents/currencyScale(currencyOf(group())));
  const currencyIndex=parts.findIndex(part=>part.type==='currency');
  const number=parts.filter(part=>part.type!=='currency').map(part=>part.value).join('').trim();
  const numberHTML=`<span class="stat-number">${esc(number)}</span>`;
  const currencyHTML=`<span class="stat-currency">${esc(parts[currencyIndex].value)}</span>`;
  return currencyIndex===0?currencyHTML+' '+numberHTML:numberHTML+' '+currencyHTML;
};
const memberName=m=>m.id==='you'?tr('Tú'):m.name;
const member = id => {const m=group().members.find(m => m.id === id) || {name:tr('Miembro'),initials:'?',color:'purple'};return {...m,name:memberName(m)};};
const avatar = (m, small=false) => `<span class="avatar ${esc(m.color)} ${small?'small':''}" title="${esc(memberName(m))}">${esc(m.initials)}</span>`;
const avatars = members => `<div class="avatars">${members.slice(0,4).map(m=>avatar(m,true)).join('')}</div>`;
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel = date => date ? new Intl.DateTimeFormat(locale,{day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`)) : tr('Sin fecha');
const categoryIcon = category => ({Alojamiento:'bed',Transporte:'plane',Comida:'coffee',Actividades:'spark',Otros:'receipt'}[category] || 'receipt');
let toastTimer;
function toast(message,tone='neutral') { const el=document.querySelector('#toast'); el.textContent=message;el.classList.toggle('success',tone==='success'); el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4500); }
async function save(checkout=null) {
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
      const saved=g.remote ? await cloud.saveGroup(g,checkout?.groupId===g.id?checkout:null) : await cloud.createGroup(g);
      state.groups[i]=saved;
      remoteBaseline.delete(g.id);remoteBaseline.set(saved.id,JSON.stringify(saved));
      if (state.activeGroup===g.id) state.activeGroup=saved.id;
    }
    rememberActiveGroup();setSync(tr('Actualizado'));
  } catch (error) {
    if (!cloud.session) {notifications.disconnect().catch(()=>{});accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();closeModal();}
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
  if(brandIntroActive){brandIntroPendingRender=true;return;}
  if(cloud.recovering){root.classList.remove('personal-shell');document.body.classList.remove('personal-app');renderRecovery(true);return;}
  if (!accountUser&&!demoMode) {root.classList.remove('personal-shell');document.body.classList.remove('personal-app');if(authStage==='recover'){renderRecovery(false);return;}renderWelcome();return;}
  root.classList.add('personal-shell');document.body.classList.add('personal-app');
  const g = group();
  const navigation = [['home','home',tr('Inicio')],['groups','users',tr('Grupos')],['activity','chart',tr('Actividad')],['budget','wallet',tr('Presupuestos')],['profile','person',tr('Perfil')]];
  const mobileNavigation=navigation.filter(([id])=>id!=='budget');
  const mobileActive=page==='budget'?'home':page;
  const navIndex={home:0,groups:1,activity:3,profile:4}[mobileActive]??0;
  const previousIndicatorBox=root.querySelector('.mobile-nav-indicator')?.getBoundingClientRect();
  root.innerHTML = ui`<aside class="sidebar" aria-label="Navegación principal">
    <a class="brand" href="#" data-page="home"><span class="brand-wordmark">Div<span class="brand-z">Z</span>plit<span class="brand-dot">.</span></span></a>
    <button class="button primary sidebar-create" data-action="quick-add">${icon('plus')} ${tr('Crear')}</button><div class="workspace-label">TU PEQUEÑO UNIVERSO</div>
    <nav>${navigation.map(([id,ic,label])=>`<button class="nav-item ${page===id?'active':''}" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span>${id==='groups'?`<span class="nav-count">${state.groups.length}</span>`:''}</button>`).join('')}</nav>
    <div class="sidebar-group-label">TUS GRUPOS <button class="icon-button" data-action="new-group" aria-label="Crear un grupo">${icon('plus')}</button></div>
    <div class="sidebar-groups">${state.groups.map(item=>`<button class="group-nav ${item.id===g?.id?'selected':''}" data-group="${esc(item.id)}"><span class="group-emoji">${esc(item.emoji)}</span><span>${esc(item.name)}</span>${item.id===g?.id?'<span class="selected-dot"></span>':''}</button>`).join('')}</div>
    <div class="sidebar-bottom"><div class="together-card"><span class="little-spark">✳</span><h3>Menos líos.<br>Más buenos momentos.</h3><p>Lo mejor de hacer planes<br>es hacerlos juntos.</p><button data-action="new-group">Empieza algo bonito ${icon('arrow')}</button></div>
    <button class="profile" data-action="settings">${avatar(currentProfile())}<span><strong>${esc(currentProfile().name)}</strong><small>${accountUser?tr('Tu cuenta compartida'):tr('Tu espacio de demo')}</small></span>${icon('settings')}</button></div>
  </aside>
  <div class="main-shell" data-current-page="${esc(page)}"><header class="topbar"><div class="breadcrumb"><span class="mobile-logo brand-wordmark">Div<span class="brand-z">Z</span>plit<span class="brand-dot">.</span></span><span class="desktop-crumb">Tu espacio</span>${icon('chevron')}<strong>${navigation.find(n=>n[0]===page)?.[2]}</strong></div><div class="topbar-right">${!accountUser?tr('<button class="button secondary account-button" data-action="account">Entrar</button>'):''}${accountUser?notifications.bell():''}<button class="top-avatar" data-action="settings" aria-label="Tu perfil y datos">${avatar(currentProfile(),true)}</button></div></header>
  <main id="main" tabindex="-1">${accountBanner()}${page==='profile'?profileView():!state.groups.length?emptyAccount():page==='home'?homeView():page==='groups'?groupsView():page==='activity'?activityView():budgetView()}</main>
  <footer class="page-footer"><span>Hecho para compartir algo más que gastos.</span><span>DivZplit ${icon('heart')}</span></footer>
  <nav class="mobile-nav" style="--nav-index:${navIndex}" aria-label="Navegación móvil"><span class="mobile-nav-indicator" aria-hidden="true"></span>${mobileNavigation.map(([id,ic,label],index)=>`${index===2?ui`<div class="nav-add-slot"><button class="nav-add" data-action="quick-add" aria-label="Añadir" aria-haspopup="dialog" aria-expanded="false">${icon('plus')}</button></div>`:''}<button class="mobile-nav-item ${mobileActive===id?'active':''}" data-page="${id}" ${mobileActive===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav></div>`;
  root.inert=authLoading || !!modalRoot.firstElementChild;
  const indicator=root.querySelector('.mobile-nav-indicator'),nextIndicatorBox=indicator?.getBoundingClientRect();
  if(previousIndicatorBox?.width&&nextIndicatorBox?.width&&Math.abs(previousIndicatorBox.width-nextIndicatorBox.width)<1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const offset=previousIndicatorBox.left-nextIndicatorBox.left;
    if(Math.abs(offset)>.5)indicator.animate([{transform:`translateX(${offset}px)`},{transform:'translateX(0)'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
  }
}

function homeGroupHeader(g) {
  const travel=groupMode(g)==='travel';
  const context=travel&&g.date?`${g.members.length} · ${dateLabel(g.date)}${g.endDate?' – '+dateLabel(g.endDate):''}`:ui`${g.members.length} personas · ${tr(g.type==='Convivencia'?'Gastos de casa':g.type)}`;
  return `<div class="home-group-header"><button class="home-group-picker" data-action="choose-group" aria-label="${tr('Seleccionar grupo')}"><span class="home-group-symbol">${icon(travel?'plane':'home')}</span><span class="home-group-copy"><strong>${esc(g.name)} <span aria-hidden="true">⌄</span></strong><small>${esc(context)}</small></span></button><div class="home-modes" role="group" aria-label="${tr('Vistas de grupo')}"><button data-group-mode="home" aria-pressed="${!travel}">${tr('Casa')}</button><button data-group-mode="travel" aria-pressed="${travel}">${tr('Viaje')}</button></div></div>`;
}
function homeView() {
  const g=group();homeClock=Math.floor(Date.now()/60000);
  if(tab!=='summary')return `${homeGroupHeader(g)}<div class="home-detail-heading"><button class="text-button" data-tab="summary">${icon('arrow','back-arrow')} ${tr('Inicio')}</button><span>${esc(g.name)}</span></div><div class="home-detail-tabs tabs" role="tablist" aria-label="${tr('Secciones del grupo')}">${[['summary',tr('Resumen')],['expenses',tr('Gastos')],['plans',tr('Planes y votaciones')],['tasks',tr('Tareas')]].map(([id,label])=>`<button role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div><div class="tab-content" role="tabpanel">${tab==='expenses'?expensesView():tab==='plans'?plansView():tasksView()}</div>`;
  const info=homeSummary(g),data=activityData(),toConfirm=data.requests.filter(r=>r.to_id===accountUser?.id),outgoing=data.requests.filter(r=>r.from_id===accountUser?.id),pending=toConfirm.length||outgoing.length;
  const balanceLabel=info.ownBalance>0?'Te deben en este grupo':info.ownBalance<0?'Tienes pendiente':'Todo en equilibrio';
  const detail=info.travel&&currencyOf(g)!=='EUR'?tr('Consulta el cambio para pagar en euros'):info.travel?ui`Tu parte del viaje: ${money(info.ownShare)}`:ui`Este mes · Tu parte: ${money(info.ownShare)}`;
  const attention=data.ready===true&&pending?`<button class="home-attention" data-action="show-pending-payments"><span class="home-attention-count">${pending}</span><strong>${toConfirm.length?toConfirm.length===1?tr('Un pago espera tu confirmación'):ui`${toConfirm.length} pagos esperan tu confirmación`:outgoing.length===1?tr('Un pago espera confirmación'):ui`${outgoing.length} pagos esperan confirmación`}</strong>${icon('chevron')}</button>`:'';
  return `<section class="personal-home" data-home-mode="${info.travel?'travel':'home'}">${homeGroupHeader(g)}<div class="home-greeting"><p>${info.travel?tr('Todo listo para el próximo plan'):ui`Hola, ${esc(currentProfile().name.split(/\s+/)[0])}`}</p><h1>${tr(info.travel?'Viajad. Lo demás, aquí.':'Tus cuentas, al día.')}</h1></div><div class="home-overview"><article class="home-balance balance-stat ${info.ownBalance<0?'is-owed':info.ownBalance>0?'is-credit':'is-settled'}"><div class="home-balance-top"><div class="stat-copy"><span class="stat-label">${tr(balanceLabel)}</span><strong class="stat-amount" aria-label="${esc(money(Math.abs(info.ownBalance)))}">${statMoney(Math.abs(info.ownBalance))}</strong></div><span class="home-wallet">${icon('wallet')}</span></div><div class="home-balance-bottom"><small>${detail}</small><button class="text-button" data-action="settlements" ${info.travel&&currencyOf(g)!=='EUR'?'data-prefer-euros="true"':''}>${tr(info.travel&&currencyOf(g)!=='EUR'?'Ver cambio':'Saldar')}${icon('arrow')}</button></div></article>${attention}${info.travel?homeBudgetLine(g):''}<button class="button primary home-add" data-action="new-expense">${icon('plus')}${tr('Añadir gasto')}</button></div><div class="home-summary-grid">${summaryView(info)}<section class="home-recent"><div class="home-section-heading"><h2>${tr('Último gasto')}</h2><button class="text-button" data-tab="expenses">${tr('Ver todos')}${icon('arrow')}</button></div><div class="home-compact-card">${g.expenses.length?expenseList(g.expenses.slice(0,1)):`<button class="home-empty-action" data-action="new-expense">${icon('receipt')}<span>${tr('Añade el primer gasto del grupo.')}</span>${icon('plus')}</button>`}</div></section></div><div class="home-shortcuts" aria-label="${tr('Secciones del grupo')}"><button data-tab="expenses">${icon('receipt')}${tr('Gastos')}</button><button data-tab="tasks">${icon('task')}${tr('Tareas')}</button><button data-tab="plans">${icon('vote')}${tr('Votaciones')}</button></div>${!info.travel?`<button class="home-shopping-entry" data-shopping-action="open"><span class="home-shopping-icon">${icon('receipt')}</span><span><strong>${tr('Lista de la compra')}</strong><small>${tr('Lo que falta, en un mismo lugar.')}</small></span>${icon('chevron')}</button>`:''}<div class="home-context"><span>${tr('Total compartido')}: <strong>${money(totalSpent(g))}</strong></span><button class="text-button" data-page="budget">${tr('Presupuestos')}${icon('arrow')}</button></div></section>`;
}
function homeBudgetLine(g) {
 return `<div class="home-budget-line"><span>${g.budget?ui`Presupuesto: ${money(totalSpent(g))} de ${money(g.budget)}`:tr('Presupuesto de viaje · Opcional')}</span><button class="text-button" ${canManage()?'data-action="edit-budget"':'data-page="budget"'}>${tr(g.budget?canManage()?'Ajustar':'Ver':canManage()?'Añadir':'Ver')}${icon(g.budget?'arrow':'plus')}</button></div>`;
}
function homeDeadline(item) {
 if(!item.dueAt)return '';
 const date=new Date(item.dueAt),day=dayOffset(item.dueAt),time=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit'}).format(date);
 return day===0?ui`Hoy, ${time}`:day===1?ui`Mañana, ${time}`:day!==null&&day<0?tr('Fecha vencida'):new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
}
function summaryView(info=homeSummary(group())) {
 const entry=info.highlight,g=group(),isPoll=entry?.kind==='polls',item=entry?.item,deadline=item?homeDeadline(item):'',assigned=item&&!isPoll?memberName(member(item.assignee)):'';
 const heading=info.travel?'Lo próximo':item?.dueAt&&dayOffset(item.dueAt)===0?'Para hoy':'Próximas tareas';
 return `<section class="home-upcoming"><div class="home-section-heading"><h2>${tr(heading)}</h2><button class="text-button" data-tab="${info.travel?'plans':'tasks'}">${tr(info.travel?'Ver planes':'Ver tareas')}${icon('arrow')}</button></div><div class="home-compact-card">${item?`<div class="home-highlight">${isPoll?`<span class="home-poll-symbol">${icon('vote')}</span>`:`<label class="home-task-check"><input type="checkbox" data-task="${esc(item.id)}" aria-label="${esc(item.title)}"><span>${icon('check')}</span></label>`}<button class="home-highlight-copy" data-plan-detail="${esc(item.id)}" data-kind="${entry.kind}"><strong>${esc(item.title)}</strong><small>${esc(isPoll?tr('Votación'):assigned)}${deadline?' · '+esc(deadline):''}</small></button>${item.important?`<span class="home-important">${tr('Importante')}</span>`:isPoll?`<button class="home-row-action" data-plan-detail="${esc(item.id)}" data-kind="polls">${tr(item.votes.you?'Ver':'Votar')}</button>`:''}</div>`:`<button class="home-empty-action" data-action="${info.travel?'new-poll':'new-task'}">${icon(info.travel?'vote':'check')}<span>${tr(info.travel?'El próximo plan lo decidís juntos.':'Sin tareas pendientes. Todo al día.')}</span>${icon('plus')}</button>`}</div></section>`;
}
function rememberHomeMode(g) {
 try{const key='divzplit-home-groups:'+ (accountUser?.id||'demo'),saved=JSON.parse(sessionStorage.getItem(key)||'{}');sessionStorage.setItem(key,JSON.stringify({...saved,[groupMode(g)]:g.id}));}catch{/* Navigation also works without browser storage. */}
}
async function activateHomeGroup(id) {
 const selected=state.groups.find(g=>g.id===id);if(!selected)throw new Error(tr('No tienes acceso a este grupo.'));
 closeModal();state.activeGroup=id;page='home';tab='summary';expenseFilter='all';rememberActiveGroup();rememberHomeMode(selected);if(!accountUser)await save();render();window.scrollTo({top:0});
 await loadActivity();if(group()?.id===id&&page==='home')render();
}
function chooseGroup(mode=null) {
 const groups=mode?state.groups.filter(g=>groupMode(g)===mode):state.groups;
 openModal(tr('Seleccionar grupo'),`<div class="home-group-options">${groups.map(g=>`<button class="home-group-option" data-group="${esc(g.id)}"><span class="home-group-symbol">${icon(groupMode(g)==='travel'?'plane':'home')}</span><span><strong>${esc(g.name)}</strong><small>${esc(tr(g.type))} · ${g.members.length} ${tr('personas')}</small></span>${icon(g.id===group()?.id?'check':'chevron')}</button>`).join('')}${!groups.length?`<p class="dialog-copy">${tr(mode==='travel'?'Aún no tienes grupos de viaje.':'Aún no tienes grupos para el día a día.')}</p>`:''}<button class="button primary full-width" data-action="new-group" data-group-type="${mode==='home'?'Convivencia':'Viaje'}">${icon('plus')}${tr(mode==='home'?'Crear grupo de casa':mode==='travel'?'Crear grupo de viaje':'Crear grupo')}</button><div class="home-group-management">${canManage()?`<button class="text-button" data-action="edit-group">${tr('Detalles del grupo')}</button>`:''}${accountUser&&canManage()?`<button class="text-button" data-action="invite">${tr('Invitar')}</button>`:''}</div></div>`,group()?esc(group().name):'');
}
async function selectHomeMode(mode) {
 if(!['home','travel'].includes(mode))return;
 if(group())rememberHomeMode(group());
 let remembered;try{remembered=JSON.parse(sessionStorage.getItem('divzplit-home-groups:'+(accountUser?.id||'demo'))||'{}')[mode];}catch{}
 const selected=groupForMode(state.groups,mode,remembered);if(selected)await activateHomeGroup(selected.id);else chooseGroup(mode);
}
function shoppingViewer(){return accountUser?.id||'demo';}
function shoppingCurrent(){return shoppingState.groupId===group()?.id&&shoppingState.viewer===shoppingViewer();}
function demoShoppingKey(){return 'divzplit-demo-shopping:'+group().id;}
async function loadShopping(){
 const g=group(),viewer=shoppingViewer(),request=++shoppingRequest;if(!g)return;
 try {
  let items=[];
  if(accountUser)items=await cloud.shoppingList(g.id);
  else {try{items=JSON.parse(localStorage.getItem(demoShoppingKey())||'[]');}catch{}if(!Array.isArray(items))items=[];}
  if(request!==shoppingRequest||g.id!==group()?.id||viewer!==shoppingViewer())return;
  shoppingState={groupId:g.id,viewer,items,error:'',loading:false};renderShoppingList();
 }catch(error){if(request===shoppingRequest&&g.id===group()?.id&&viewer===shoppingViewer()){shoppingState={groupId:g.id,viewer,items:[],error:error.message,loading:false};renderShoppingList();}}
}
async function showShopping(){
 const g=group();if(!g)return;
 shoppingState={groupId:g.id,viewer:shoppingViewer(),items:[],error:'',loading:true};
 openModal(tr('Lista de la compra'),`<div class="shopping-list" data-shopping-group="${esc(g.id)}"><div class="shopping-toolbar"><button class="button primary" data-shopping-action="add">${icon('plus')}${tr('Añadir producto')}</button><button class="text-button" data-shopping-action="refresh" aria-label="${tr('Actualizar lista')}">${icon('refresh')}</button></div><p class="shopping-note">${tr('Marcar productos no cambia los saldos.')}</p><div class="shopping-items" aria-live="polite"></div><div class="shopping-footer"></div><p class="form-error" role="alert"></p></div>`,esc(g.name),'shopping-modal');
 renderShoppingList();await loadShopping();
}
function renderShoppingList(){
 const root=modalRoot.querySelector('.shopping-list');if(!root||!shoppingCurrent()||root.dataset.shoppingGroup!==group()?.id)return;
 const focusedProduct=document.activeElement?.dataset.shoppingCheck;
 const items=shoppingState.items,pending=items.filter(i=>!i.bought),bought=items.filter(i=>i.bought),unlinked=bought.filter(i=>!i.expense_id);
 const row=i=>{const manage=canManage()||i.created_by===shoppingViewer();return `<article class="shopping-row ${i.bought?'is-bought':''}"><label class="shopping-check"><input type="checkbox" data-shopping-check="${esc(i.id)}" ${i.bought?'checked':''} ${i.expense_id?'disabled':''} aria-label="${esc(i.title)}"><span>${icon('check')}</span></label><div class="shopping-product"><strong>${esc(i.title)}</strong>${i.quantity?`<small>${esc(i.quantity)}</small>`:''}${i.expense_id?`<button class="text-button" data-shopping-action="expense" data-shopping-id="${esc(i.id)}">${tr('Gasto registrado')}${icon('chevron')}</button>`:''}</div>${manage?`<div class="shopping-row-actions">${!i.expense_id?`<button class="icon-button" data-shopping-action="edit" data-shopping-id="${esc(i.id)}" aria-label="${esc(ui`Editar ${i.title}`)}">${icon('edit')}</button>`:''}<button class="icon-button" data-shopping-action="delete" data-shopping-id="${esc(i.id)}" aria-label="${esc(ui`Borrar ${i.title}`)}">${icon('close')}</button></div>`:''}</article>`;};
 root.querySelector('.shopping-items').innerHTML=shoppingState.loading?`<p role="status">${tr('Cargando lista…')}</p>`:shoppingState.error?`<p role="alert" class="form-error">${esc(shoppingState.error)}</p>`:`<section><h3>${tr('Por comprar')}<span>${pending.length}</span></h3>${pending.length?pending.map(row).join(''):`<div class="shopping-empty">${icon('check')}<p>${tr(items.length?'Todo comprado.':'Añade lo que hace falta para la próxima compra.')}</p></div>`}</section>${bought.length?`<section class="shopping-bought"><h3>${tr('Comprados')}<span>${bought.length}</span></h3>${bought.map(row).join('')}</section>`:''}`;
 root.querySelector('.shopping-footer').innerHTML=!shoppingState.error&&!shoppingState.loading?`<button class="button primary full-width" data-shopping-action="checkout" ${unlinked.length?'':'disabled'}>${icon('receipt')}${tr('Crear gasto de la compra')}${unlinked.length?`<span>${unlinked.length}</span>`:''}</button><p class="shopping-note">${tr('Revisa el importe, el pagador y el reparto antes de guardar.')}</p>${canManage()&&bought.length?`<button class="text-button danger-text full-width" data-shopping-action="clear">${tr('Limpiar comprados')}</button>`:''}`:'';
 root.querySelector('[data-shopping-action="add"]').disabled=shoppingState.loading||!!shoppingState.error;
 if(focusedProduct)root.querySelector('[data-shopping-check="'+CSS.escape(focusedProduct)+'"]')?.focus({preventScroll:true});
}
function shoppingItemForm(item=null){
 if(!shoppingCurrent()||shoppingState.error)return;
 openModal(tr(item?'Editar producto':'Añadir producto'),ui`<form id="shopping-item-form" data-shopping-group="${esc(group().id)}" data-entity-id="${esc(item?.id||uid())}" data-version="${item?.version||0}" data-edit="${!!item}"><label class="field">Producto<input name="title" required maxlength="120" placeholder="Ej. Leche" value="${esc(item?.title||'')}"></label><label class="field">Cantidad (opcional)<input name="quantity" maxlength="40" placeholder="Ej. 2 litros" value="${esc(item?.quantity||'')}"></label><p class="form-note">Se comparte con las personas de este grupo.</p><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-shopping-action="open">Volver a la lista</button><button type="submit" class="button primary">${tr(item?'Guardar cambios':'Añadir producto')}</button></div></form>`,esc(group().name));
}
async function shoppingMutation(action,item={}){
 if(!shoppingCurrent())throw new Error(tr('El grupo ha cambiado. Vuelve a abrir el formulario.'));
 const gid=group().id,viewer=shoppingViewer();++shoppingRequest;remoteBusy=true;
 try {
  let items;
  if(accountUser)items=await cloud.shoppingAction(gid,action,item);
  else {
   items=structuredClone(shoppingState.items);const previous=items.find(i=>i.id===item.id);
   if(action==='add'){if(!previous){if(items.length>=200)throw new Error(tr('La lista admite hasta 200 productos. Limpia los comprados para añadir más.'));items.push({...item,title:item.title.trim(),quantity:item.quantity.trim(),created_by:'demo',bought:false,version:1});}}
   else if(action==='clear')items=items.filter(i=>!i.bought);
   else if(action==='delete')items=items.filter(i=>i.id!==item.id);
   else {if(!previous||previous.version!==item.version||previous.expense_id)throw new Error(tr('La compra ha cambiado. Actualiza la lista y revisa tu selección.'));Object.assign(previous,item,{version:previous.version+1});}
   localStorage.setItem(demoShoppingKey(),JSON.stringify(items));
  }
  if(gid===group()?.id&&viewer===shoppingViewer()){shoppingState.items=items;renderShoppingList();}
 }finally{remoteBusy=false;}
}
async function shoppingAction(el){
 const action=el.dataset.shoppingAction;
 if(action==='open'){await showShopping();return;}
 if(action==='refresh'){await loadShopping();return;}
 if(!shoppingCurrent())return;
 const item=shoppingState.items.find(i=>i.id===el.dataset.shoppingId);
 if(action==='add'){shoppingItemForm();return;}
 if(action==='edit'&&item){shoppingItemForm(item);return;}
 if(action==='expense'&&item){if(group().expenses.some(e=>e.id===item.expense_id))expenseDetails(item.expense_id);else toast(tr('El gasto ya no está en este grupo.'));return;}
 if(action==='checkout'){
  const items=shoppingState.items.filter(i=>i.bought&&!i.expense_id);if(!items.length)return;
  expenseModal();const form=modalRoot.querySelector('#expense-form');form.shoppingCheckout={groupId:group().id,items:items.map(i=>i.id),expenseId:form.dataset.entityId};
  form.elements.title.value=(items.length===1?items[0].title:tr('Compra de casa')+': '+items.map(i=>i.title).join(', ')).slice(0,100);
  const note=document.createElement('p');note.className='form-note shopping-checkout-note';note.textContent=ui`${items.length} productos comprados se vincularán a este gasto al guardarlo.`;form.prepend(note);return;
 }
 if(action==='delete'&&item||action==='clear'){
  openModal(tr(action==='clear'?'¿Limpiar los productos comprados?':'¿Borrar este producto?'),ui`<p class="dialog-copy">${tr('Los gastos y los saldos se conservarán.')}</p><div class="modal-actions"><button class="button secondary" data-shopping-action="open">Cancelar</button><button class="button danger" data-shopping-action="confirm" data-shopping-operation="${action}" data-shopping-id="${esc(item?.id||'')}">${tr(action==='clear'?'Limpiar comprados':'Borrar')}</button></div>`);return;
 }
 if(action==='confirm'){await shoppingMutation(el.dataset.shoppingOperation,item||{});await showShopping();toast(tr('Lista de la compra actualizada.'),'success');}
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
  if(!g.budget)return ui`<section class="panel budget-card">${sectionTitle(tr('Gastos sin presupuesto'),tr('Lleva las cuentas sin fijar un límite.'))}<div class="budget-numbers"><strong>${money(spent)}</strong><span>Total compartido</span></div><p class="form-note">Sin presupuesto establecido.</p>${canManage()?ui`<button class="text-button" data-action="edit-budget">Añadir presupuesto ${icon('arrow')}</button>`:''}</section>`;
  return ui`<section class="panel budget-card">${sectionTitle(tr('Un plan, un presupuesto'),tr('Sin sorpresas al volver.'),`<span class="mini-icon">${icon('wallet')}</span>`)}<div class="budget-numbers"><strong>${money(spent)}</strong><span>de ${money(g.budget)}</span></div><div class="progress-track ${spent>g.budget?'over-budget':''}" role="progressbar" aria-label="Presupuesto utilizado" aria-valuenow="${Math.min(percentage,100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(percentage,100)}%"></span></div><div class="progress-labels"><span>${percentage}% del presupuesto</span><span>${spent>g.budget?tr('Por encima del plan'):tr('Vamos bien ✨')}</span></div><div class="budget-remaining">${icon('spark')}<span>${spent>g.budget?tr('Habéis superado el presupuesto en'):tr('Todavía quedan')} <strong>${money(Math.abs(g.budget-spent))}</strong>${spent>g.budget?'': tr(' para disfrutar.')}</span></div>${canManage()?ui`<button class="text-button" data-action="edit-budget">Ajustar presupuesto ${icon('arrow')}</button>`:''}</section>`;
}

function pollCard(poll) {
  const entries=Object.values(poll.votes); const own=poll.votes.you;const closed=planClosed(poll);
  return ui`<article class="poll-card" data-plan-card="${esc(poll.id)}">${planningMeta(poll,'polls')}<div class="poll-title"><span class="poll-symbol">💭</span><div><h3>${esc(poll.title)}</h3><p>${esc(poll.description || tr('Tu opinión también cuenta.'))}</p></div></div><div class="poll-options">${poll.options.map(option=>{const count=entries.filter(v=>v===option.id).length;return `<button class="poll-option ${own===option.id?'chosen':''}" data-poll="${esc(poll.id)}" ${closed?'disabled':''} data-option="${esc(option.id)}" aria-pressed="${own===option.id}"><span class="poll-fill" style="width:${entries.length?count/entries.length*100:0}%"></span><span class="option-text"><span>${esc(option.emoji || '✦')}</span>${esc(option.label)}</span><span class="option-count">${count}${own===option.id?icon('check'):'<span class="radio-dot"></span>'}</span></button>`;}).join('')}</div><div class="poll-footer">${avatars(group().members.filter(m=>poll.votes[m.id]))}<span>${entries.length} de ${group().members.length} han votado</span><span class="vote-status">${closed?tr('Votación cerrada'):own?tr('Tu voto está guardado'): tr('¡Solo faltas tú!')}</span></div>${planningControls(poll,'polls')}</article>`;
}
function plansView() {return `<section class="panel">${sectionTitle(tr('Los planes se hacen juntos'),tr('Propón, vota y encontrad vuestro próximo sí.'),ui`<button class="button primary small-button" data-action="new-poll">${icon('plus')} Nueva votación</button>`)}${ui`<button class="button secondary" data-show-planning="polls">Ver votaciones ${icon('arrow')}<span class="payment-list-count">${group().polls.length}</span></button>`}</section>`;}
function taskList(items) {
  if(!items.length)return empty(tr('Por ahora, todo hecho'),tr('Añade una tarea para repartir la organización.'),'new-task',tr('Añadir tarea'));
  return `<div class="task-list">${items.map(t=>`<div class="task-row planning-task ${t.done?'done':''}"><label><input type="checkbox" data-task="${esc(t.id)}" ${t.done?'checked':''} aria-label="${esc(t.title)}"><span class="custom-check">${icon('check')}</span></label><div class="planning-task-body"><button class="text-button task-detail-button" data-plan-detail="${esc(t.id)}" data-kind="tasks">${esc(t.title)}</button>${planningMeta(t,'tasks')}</div>${avatar(member(t.assignee),true)}</div>`).join('')}</div>`;
}
function tasksView() {const done=group().tasks.filter(t=>t.done).length;return `<section class="panel">${sectionTitle(tr('Un equipo para todo'),ui`${done} de ${group().tasks.length} tareas completadas.`,ui`<button class="button primary small-button" data-action="new-task">${icon('plus')} Añadir tarea</button>`)}${ui`<button class="button secondary" data-show-planning="tasks">Ver tareas ${icon('arrow')}<span class="payment-list-count">${group().tasks.length}</span></button>`}</section>`;}
function canEditPlan(item) {return !!item&&(!accountUser||canManage()||item.createdBy===accountUser.id);}
function planningMeta(item,kind) {
 const date=item.dueAt?new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.dueAt)):'';
 return `<div class="planning-meta">${item.important?`<span class="important-pill">${tr('Importante')}</span>`:''}${date?`<span class="${planClosed(item)&&!item.done?'deadline-overdue':''}">${tr(planClosed(item)?kind==='polls'?'Votación cerrada':'Fecha vencida':'Fecha límite')}: ${esc(date)}</span>`:''}${item.remindAt&&!item.done&&!planClosed(item)?`<span>${tr('Recordatorio')}: ${esc(new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.remindAt)))}</span>`:''}</div>`;
}
function planningControls(item,kind) {
 if(!canEditPlan(item))return '';
 return ui`<div class="planning-controls"><button class="text-button" data-plan-edit="${esc(item.id)}" data-kind="${kind}">Editar</button>${!item.done&&!(kind==='polls'&&planClosed(item))?ui`<button class="text-button" data-plan-remind="${esc(item.id)}" data-kind="${kind}">Enviar recordatorio</button>`:''}<button class="text-button danger-text" data-plan-delete="${esc(item.id)}" data-kind="${kind}">Borrar</button></div>`;
}
function renderPlanningList() {
 const container=modalRoot.querySelector('.planning-list-dialog'),g=group();if(!container||container.dataset.group!==g?.id)return;
 const kind=container.dataset.kind,items=g[kind];
 container.innerHTML=`${canManage()&&items.length?ui`<div class="history-modal-controls"><button class="button secondary danger-text" data-plan-clear="${kind}">Borrar todo</button></div>`:''}<div class="planning-list-scroll">${kind==='tasks'?taskList(items.slice(0,planningLimit)):items.length?items.slice(0,planningLimit).map(pollCard).join(''):empty(tr('Hay un plan por descubrir'),tr('Crea una votación con al menos dos opciones.'),'new-poll',tr('Crear votación'))}${items.length>planningLimit?ui`<button class="button secondary" data-action="more-planning">Ver más</button>`:''}</div>`;
}
async function showPlanningList(kind) {
 if(!['tasks','polls'].includes(kind)||!group())return;
 planningLimit=30;openModal(tr(kind==='tasks'?'Tareas':'Votaciones'),`<div class="planning-list-dialog" data-kind="${kind}" data-group="${esc(group().id)}"><p role="status">${tr('Cargando…')}</p></div>`,esc(group().name));
 if(accountUser)await loadSharedGroups();renderPlanningList();
}
function planDetails(id,kind) {
 const item=group()?.[kind]?.find(x=>x.id===id);if(!item)return;
 openModal(esc(item.title),`${planningMeta(item,kind)}${kind==='tasks'?ui`<p class="dialog-copy">${esc(member(item.assignee).name)} · ${tr(item.done?'Completada':'Pendiente')}</p>`:pollCard(item)}${kind==='tasks'?planningControls(item,kind):''}<div class="modal-actions"><button class="button secondary" data-show-planning="${kind}">${tr('Volver a la lista')}</button></div>`);
}
function planningInputs(item={}) {
 return ui`<div class="form-columns"><label class="field">Fecha límite (opcional)<input type="datetime-local" name="dueAt" value="${esc(localDateTime(item.dueAt))}"></label><label class="field">Recordatorio programado (opcional)<input type="datetime-local" name="remindAt" value="${esc(localDateTime(item.remindAt))}"></label></div><p class="form-note">Las horas corresponden a este dispositivo. El recordatorio debe ser anterior a la fecha límite.</p><label class="planning-important"><input type="checkbox" name="important" ${item.important?'checked':''}>Marcar como importante</label><p class="form-note">Los recordatorios avisarán al resto del grupo, respetando sus preferencias de notificaciones.</p>`;
}
function planningModal(kind,id=null) {
 const item=id?group()[kind].find(x=>x.id===id):null;if(id&&!canEditPlan(item))throw new Error(tr('No puedes editar esta entrada.'));
 const task=kind==='tasks';
 openModal(tr(item?task?'Editar tarea':'Editar votación':task?'Una pequeña cosa por hacer':'¿Cuál es el plan?'),ui`<form id="${task?'task':'poll'}-form" data-entity-id="${item?.id||uid()}" data-edit="${!!item}" data-group="${esc(group().id)}"><label class="field">${tr(task?'¿Qué queda pendiente?':'La gran pregunta')}<input name="title" maxlength="120" value="${esc(item?.title||'')}" required></label>${task?ui`<label class="field">¿Quién se encarga?<select name="assignee">${memberOptions({selfFirst:true,selected:item?.assignee||'you'})}</select></label>`:ui`<label class="field">Un poco de contexto <span class="muted">(opcional)</span><input name="description" maxlength="160" value="${esc(item?.description||'')}"></label>${item?`<p class="form-note">${tr('Las opciones se conservan para mantener los votos existentes.')}</p>`:[1,2,3].map(n=>ui`<label class="field">${tr('Opción')} ${n}<input name="option" maxlength="100" ${n<3?'required':''}></label>`).join('')}`}${planningInputs(item||{})}${actions(tr(item?'Guardar cambios':task?'Añadir tarea':'Crear votación'))}</form>`);
}
async function applyPlanningAction(kind,action,item={}) {
 const g=group();if(!['tasks','polls'].includes(kind))return;
 if(accountUser){
  remoteBusy=true;
  try{const saved=await cloud.planningAction(g,kind,action,item);if(group()?.id===saved.id){state.groups[state.groups.findIndex(x=>x.id===saved.id)]=saved;remoteBaseline.set(saved.id,JSON.stringify(saved));}}
  catch(error){await loadSharedGroups().catch(()=>{});render();throw error;}finally{remoteBusy=false;}
 }else{
  if(action==='clear')g[kind]=[];
  else if(action==='delete')g[kind]=g[kind].filter(x=>x.id!==item.id);
  else{const old=g[kind].find(x=>x.id===item.id);if(old)Object.assign(old,item);else g[kind].unshift({...item,createdBy:'you'});}
  await save();
 }
}
function groupsView() {return ui`<div class="welcome-row"><div><div class="eyebrow">CADA GRUPO, SU HISTORIA</div><h1>La gente con la que compartes<span class="purple-text">.</span></h1><p>De la escapada del finde a las cuentas de casa.</p></div><button class="button primary" data-action="new-group">${icon('plus')} Crear grupo</button></div><div class="group-cards">${state.groups.map((g,i)=>ui`<button class="group-card" data-group="${esc(g.id)}"><div class="group-card-cover cover-${i%3}"><span>${esc(g.emoji)}</span><span class="tiny-pill">${esc(tr(g.type))}</span></div><div class="group-card-body"><h2>${esc(g.name)} ${icon('arrow')}</h2><p>${icon('pin')}${esc(g.place || tr('El próximo gran plan'))}</p><div class="group-card-footer">${avatars(g.members)}<span>${g.members.length} personas</span></div><div class="group-card-total"><span>Compartido hasta ahora</span><strong>${money(totalSpent(g),currencyOf(g))}</strong></div></div></button>`).join('')}<button class="new-group-card" data-action="new-group"><span>${icon('plus')}</span><h3>El siguiente buen plan</h3><p>Empieza con un grupo.</p></button></div>`;}
function activityData() {return activityCache.get(group()?.id)||{ready:null,events:[],requests:[],next:null};}
const activityMemberName=id=>id===accountUser?.id?tr('Tú'):group()?.members.find(m=>m.id===id)?.name||tr('Miembro');
function activityNotice(data) {
  if(!accountUser)return `<p class="muted">${tr('Entra con tu cuenta para confirmar pagos compartidos.')}</p>`;
  if(data.error)return `<p class="activity-error" role="alert">${esc(data.error)}<button class="text-button" data-action="reload-activity">${tr('Volver a intentar')}</button></p>`;
  if(data.ready===false)return `<p class="muted">${tr('Los pagos con confirmación y el historial todavía no están activados.')}</p>`;
  if(data.ready===null)return `<p class="muted" role="status">${tr('Cargando actividad…')}</p>`;
  return '';
}
async function loadActivity(more=false,preservePages=false) {
  const g=group(),viewer=accountUser?.id;if(!viewer||!g)return;
  const previous=activityCache.get(g.id),request=(activityRequests.get(g.id)||0)+1;activityRequests.set(g.id,request);
  try{
    const ready=await cloud.collaborationAvailable();
    if(activityRequests.get(g.id)!==request||accountUser?.id!==viewer)return;
    if(!ready){activityCache.set(g.id,{ready:false,events:[],requests:[],next:null});return;}
    const result=await cloud.readActivity(g.id,more?previous?.next:null);
    await loadPaymentArchives(g);
    if(accountUser?.id!==viewer||activityRequests.get(g.id)!==request)return;
    const keepPages=preservePages&&previous?.events?.length>50&&JSON.stringify(previous.events.slice(0,50))===JSON.stringify(result.events);
    activityCache.set(g.id,{ready:true,...result,events:more?[...new Map([...(previous?.events||[]),...result.events].map(event=>[event.id,event])).values()]:keepPages?previous.events:result.events,next:keepPages?previous.next:result.next});
  }catch(error){if(accountUser?.id===viewer&&activityRequests.get(g.id)===request)activityCache.set(g.id,{...(previous||{events:[],requests:[],next:null}),ready:null,error:error.message});}
}
function pendingPaymentsPanel(data) {
  return `<section class="panel activity-panel">${sectionTitle(tr('Pagos pendientes de confirmar'),tr('El saldo cambia cuando quien recibe confirma el pago.'))}${activityNotice(data)||ui`<button class="button secondary" data-action="show-pending-payments">Ver pagos pendientes ${icon('arrow')}<span class="payment-list-count">${data.requests.length}</span></button>`}</section>`;
}
function activityView() {
  const g=group(),data=activityData();
  return ui`<div class="welcome-row"><div><div class="eyebrow">LO QUE VA PASANDO</div><h1>Actividad del grupo<span class="purple-text">.</span></h1><p>Pagos y cambios, con las cuentas claras.</p></div><select class="group-select" aria-label="Seleccionar grupo" data-group-select>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div>${pendingPaymentsPanel(data)}<section class="panel activity-panel">${sectionTitle(tr('Historial de cambios'),tr('Quién cambió qué y cuándo.'))}<p class="history-policy">${tr('Todos los miembros pueden consultarlo. Solo el administrador puede borrar entradas.')}</p>${activityNotice(data)||ui`<button class="button secondary" data-action="show-history">Ver historial ${icon('arrow')}</button>`}</section><section class="panel activity-panel">${sectionTitle(tr('Devoluciones registradas'),tr('Pagos confirmados por quien recibe el dinero.'))}${ui`<button class="button secondary" data-action="show-recorded-payments">Ver devoluciones ${icon('arrow')}<span class="payment-list-count">${visibleRepayments(g).length}</span></button>`}</section>`;
}

async function loadPaymentArchives(g=group()) {
  const viewer=accountUser?.id;if(!viewer||!g)return;
  const request=(archiveRequests.get(g.id)||0)+1;archiveRequests.set(g.id,request);
  try{
    const ids=await cloud.paymentArchives(g.id);
    if(accountUser?.id===viewer&&archiveRequests.get(g.id)===request)paymentArchives.set(g.id,{ids:ids||[],ready:ids!==null});
  }catch(error){if(accountUser?.id===viewer&&archiveRequests.get(g.id)===request)paymentArchives.set(g.id,{...paymentArchives.get(g.id),error:error.message});}
}
function visibleRepayments(g=group(),archived=false) {
  const ids=new Set(paymentArchives.get(g?.id)?.ids||[]);
  return g.payments.filter(p=>ids.has(p.id)===archived);
}

function renderPaymentList() {
  const container=modalRoot.querySelector('.payment-list-dialog'),g=group();
  if(!container||container.dataset.paymentGroup!==g?.id)return;
  const pending=container.dataset.kind==='pending',data=activityData(),archive=paymentArchives.get(g.id);
  const items=pending?data.requests:visibleRepayments(g,showArchivedRepayments);
  const notice=pending?activityNotice(data):archive?.error?`<p class="activity-error" role="alert">${esc(archive.error)}</p><button class="button secondary" data-action="show-recorded-payments">${tr('Volver a intentar')}</button>`:'';
  const controls=`<div class="history-modal-controls payment-list-controls">${!notice&&canManage()&&items.length&&(!showArchivedRepayments||pending)?ui`<button class="button secondary danger-text" data-clear-payment-list="${pending?'pending':'recorded'}">Borrar todo</button>`:''}${!pending&&archive?.ids?.length?ui`<button class="text-button" data-action="toggle-recorded-archive">${tr(showArchivedRepayments?'Volver a recientes':'Ver anteriores')}</button>`:''}</div>`;
  const recorded=items.length?items.slice(0,recordedPaymentLimit).map(p=>ui`<div class="payment-row"><span>${esc(member(p.from).name)} → ${esc(member(p.to).name)}</span><strong>${p.fx?money(p.fx.amount,'EUR'):money(p.amount)}</strong><small>${p.fx?money(p.amount)+' · ':''}${dateLabel(p.date)}</small>${p.fx?fxDetails(p.fx,currencyOf(g)):''}</div>`).join(''):tr('<p class="muted">Todavía no se han registrado devoluciones.</p>');
  container.innerHTML=`${controls}${!pending&&showArchivedRepayments?`<p class="history-policy">${tr('Devoluciones anteriores. Los pagos y los saldos se conservan.')}</p>`:''}<div class="payment-list-scroll">${notice||(pending?paymentRequestsView(items,accountUser?.id,activityMemberName,currencyOf(g)):recorded)}${!pending&&!notice&&items.length>recordedPaymentLimit?ui`<button class="button secondary" data-action="more-recorded-payments">Ver más devoluciones</button>`:''}</div>`;
}

async function showPaymentList(kind) {
  const g=group();if(!g||!['pending','recorded'].includes(kind))return;
  recordedPaymentLimit=50;showArchivedRepayments=false;
  openModal(tr(kind==='pending'?'Pagos pendientes de confirmar':'Devoluciones registradas'),`<div class="payment-list-dialog" data-kind="${kind}" data-payment-group="${esc(g.id)}"><p role="status">${tr('Cargando actividad…')}</p></div>`,esc(g.name));
  if(kind==='pending')await loadActivity();else if(accountUser){await loadSharedGroups();await loadPaymentArchives(g);}
  renderPaymentList();
}

function renderHistoryModal() {
  const container=modalRoot.querySelector('.history-dialog');
  if(!container||container.dataset.historyGroup!==group()?.id)return;
  const data=activityData();
  container.innerHTML=`${data.ready===true&&canManage()&&data.events.length?`<div class="history-modal-controls"><button class="button secondary danger-text" data-action="clear-history">${tr('Borrar todo')}</button></div>`:''}<div class="history-scroll">${activityNotice(data)||historyView(data.events,canManage(),activityMemberName,!!data.next)}</div>`;
}
async function showHistory() {
  const g=group();if(!g)return;
  openModal(tr('Historial de cambios'),`<div class="history-dialog" data-history-group="${esc(g.id)}"><p role="status">${tr('Cargando actividad…')}</p></div>`,esc(g.name));
  await loadActivity();renderHistoryModal();
}

function budgetView() {const g=group(); const spent=totalSpent(g); const categories=['Alojamiento','Transporte','Comida','Actividades','Otros'];return ui`<div class="welcome-row"><div><div class="eyebrow">DISFRUTAR, CON LAS CUENTAS CLARAS</div><h1>Un poquito de previsión<span class="purple-text">.</span></h1><p>El presupuesto de ${esc(g.name)}, de un vistazo.</p></div><select class="group-select" aria-label="Seleccionar grupo" data-group-select>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g?.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><div class="budget-layout">${budgetCard()}<section class="panel">${sectionTitle(tr('¿En qué se va el plan?'),tr('Tus gastos agrupados por categoría.'))}${categories.map(cat=>{const sum=g.expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);return `<div class="category-row"><span class="expense-icon lavender">${icon(categoryIcon(cat))}</span><div><span>${tr(cat)}</span><div class="progress-track"><span style="width:${spent?sum/spent*100:0}%"></span></div></div><strong>${money(sum)}</strong></div>`;}).join('')}</section></div>`;}

function openModal(title, content, subtitle='',kind='') {
  if (!modalRoot.contains(document.activeElement)) modalOpener = document.activeElement;
  root.querySelector('.nav-add')?.setAttribute('aria-expanded','false');
  modalRoot.innerHTML=ui`<div class="modal-overlay"><section class="modal ${esc(kind)}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><div><div class="eyebrow">TODO CONECTADO</div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div>${content}</section></div>`;
  document.body.classList.add('modal-open');
  root.inert = true;
  setTimeout(()=>modalRoot.querySelector('input, select, textarea, button')?.focus(),30);
}
function closeModal() {root.querySelector('.nav-add')?.setAttribute('aria-expanded','false');const previewForm=modalRoot.querySelector('#expense-form');cancelReceiptReader(previewForm);if(previewForm?.receiptPreviewURL)URL.revokeObjectURL(previewForm.receiptPreviewURL);modalRoot.innerHTML='';document.body.classList.remove('modal-open');root.inert=false;modalOpener?.focus();}
const actions = label => ui`<p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button secondary" data-action="close-modal">Cancelar</button><button class="button primary" type="submit">${label}${icon('arrow')}</button></div>`;
const memberOptions = ({selfFirst=false,selected=null,ownName=false}={}) => {
  const members=selfFirst?[...group().members.filter(m=>m.id==='you'),...group().members.filter(m=>m.id!=='you')]:group().members;
  return members.map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''}>${esc(ownName&&m.id==='you'&&accountUser?currentProfile().name+' ('+tr('Tú')+')':memberName(m))}</option>`).join('');
};
function canEditExpense(e) {return !!e&&(!accountUser||canManage()||e.createdBy===accountUser.id);}
function expenseModal(id=null) {
  const existing=id?group().expenses.find(e=>e.id===id):null;
  if(id&&!canEditExpense(existing)){toast(tr('No puedes editar este gasto.'));return;}
  const editing=!!existing;
  const participantMembers=existing?[...existing.participants.map(id=>group().members.find(m=>m.id===id)).filter(Boolean),...group().members.filter(m=>!existing.participants.includes(m.id))]:group().members;
  const g=group(),payer=member(existing?.payer||'you');
  openModal(tr(editing?'Editar gasto':'Añadir gasto'),ui`<form id="expense-form" class="compact-expense-form" data-entity-id="${existing?.id||uid()}" data-edit="${editing}" data-expense-group="${esc(g.id)}"><label class="expense-amount-field"><span>Importe</span><div><input name="amount" type="number" min="${currencyStep(currencyOf(g))}" max="1000000" step="${currencyStep(currencyOf(g))}" placeholder="0,00" required inputmode="decimal" aria-label="${esc(ui`Importe (${currencyUnit(g)})`)}"><strong aria-hidden="true">${esc(currencyUnit(g))}</strong></div></label><label class="field expense-concept">Concepto<input name="title" placeholder="Ej. Cena del grupo" aria-label="${tr('¿Qué habéis pagado?')}" required maxlength="100"></label><label class="field expense-payer-field"><span>Pagado por</span><div class="expense-payer-select"><span class="expense-payer-avatar" aria-hidden="true">${avatar(payer,true)}</span><select name="payer" aria-label="${tr('Pagado por')}">${memberOptions({selfFirst:true,selected:existing?.payer||'you',ownName:true})}</select></div></label><div class="expense-participants-heading"><span>${tr('Repartir entre')}</span><select name="splitMode" aria-label="${tr('Tipo de reparto')}"><option value="equal">Partes iguales</option><option value="amounts">Importes individuales</option><option value="percent">Porcentajes</option><option value="shares">Por partes</option></select></div><fieldset class="participants compact-participants"><legend class="sr-only">Participantes del gasto</legend>${participantMembers.map(m=>`<label class="participant person-chip"><input type="checkbox" name="participants" value="${esc(m.id)}" ${!existing||existing.participants.includes(m.id)?'checked':''}><span class="chip-check">${icon('check')}</span><span>${esc(memberName(m))}</span></label>`).join('')}</fieldset><div class="split-fields"></div><p class="split-total" aria-live="polite"></p><p class="form-note receipt-amount-status" role="status" aria-live="polite"></p><details class="expense-more-options" ${existing?.receipt||existing?.recurrence||existing?.seriesId?'open':''}><summary>${tr('Más opciones')}<span>${tr('Fecha, categoría y ticket')}</span></summary><div class="expense-more-content"><div class="form-columns"><label class="field">Categoría<select name="category">${['Comida','Transporte','Alojamiento','Actividades','Otros'].map(c=>`<option value="${esc(c)}">${tr(c)}</option>`).join('')}</select></label><label class="field">Fecha<input type="date" name="date" value="${today()}" required ${existing?.recurrence?.active?'readonly':''}></label></div><label class="field">Repetir<select name="frequency" ${editing?'disabled':''}><option value="">No repetir</option><option value="weekly">Cada semana</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select><span class="muted">${tr(existing?.recurrence?.active?'Los cambios se aplicarán al gasto original y a sus futuras repeticiones. Las cuotas ya creadas no cambian.':existing?.seriesId?'Solo se modificará esta cuota; la repetición original no cambia.':editing?(existing?.recurrence?'La repetición está detenida. Editar no la reactivará.':'Los cambios solo afectan a este gasto.'):'Se registrará al abrir la app cuando venza, con este importe y reparto. Podrás detenerlo desde el gasto original.')}</span></label><label class="field">Foto del ticket (opcional)<input type="file" name="receipt" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"><span class="muted">Elige una foto o usa la cámara. Hasta 20 MB; la optimizamos antes de subirla.</span></label>${existing?.receipt?ui`<label class="participant"><input type="checkbox" name="removeReceipt">Quitar la foto actual</label>`:''}<div class="receipt-preview" aria-live="polite"></div>${receiptTools()}</div></details><p class="form-error" role="alert"></p><div class="modal-actions expense-actions"><button class="button primary" type="submit">${icon('check')}${tr(editing?'Guardar cambios':'Guardar gasto')}</button></div></form>`,esc(g.name),'compact-expense-modal');
  const form=modalRoot.querySelector('#expense-form');
  form.splitDrafts={};
  if(existing){
    for(const key of ['title','payer','category','date'])form.elements[key].value=existing[key];
    form.elements.amount.value=(existing.amount/currencyScale(currencyOf(group()))).toFixed(currencyDigits(currencyOf(group())));
    form.elements.frequency.value=existing.recurrence?.frequency||'';
    form.elements.splitMode.value=existing.split?.mode||'equal';
    if(existing.split)form.splitDrafts[existing.split.mode]=Object.fromEntries(Object.entries(existing.split.values).map(([key,value])=>[key,existing.split.mode==='shares'?String(value):(value/(existing.split.mode==='percent'?100:currencyScale(currencyOf(group())))).toFixed(existing.split.mode==='percent'?2:currencyDigits(currencyOf(group())))]));
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
    return ui`<label class="field split-row"><span>${esc(memberName(member(id)))}</span><span>${tr(label)}<input type="number" data-split-member="${esc(id)}" name="split:${esc(id)}" value="${esc(values[id]??(mode==='shares'?'1':'0'))}" step="${mode==='shares'?'1':mode==='percent'?'0.01':currencyStep(currencyOf(group()))}" min="${mode==='shares'?'1':'0'}" max="${mode==='percent'?'100':mode==='shares'?'1000000':'1000000'}" inputmode="decimal" aria-label="${esc(memberName(member(id)))}" required></span></label>`;
  }).join('');
  updateSplitTotal(form);
}
function readSplit(form,participants) {
  const mode=form.elements.splitMode.value;if(mode==='equal')return {mode};
  const values=Object.fromEntries(participants.map(id=>{const value=form.elements['split:'+id]?.value??'';if(mode==='shares'&&!/^\d+$/.test(value))throw new Error(tr('Introduce un número entero de partes.'));return [id,mode==='shares'?Number(value):decimalUnits(value,mode==='percent'?'EUR':currencyOf(group()))];}));
  return {mode,values};
}
function updateSplitTotal(form) {
  const output=form.querySelector('.split-total');if(!output)return;
  const mode=form.elements.splitMode.value;
  if(mode==='equal'){output.textContent=tr('El gasto se divide a partes iguales entre los participantes seleccionados.');return;}
  try{
    const ids=[...form.querySelectorAll('input[name=participants]:checked')].map(input=>input.value);
    const split=readSplit(form,ids);const sum=Object.values(split.values).reduce((a,b)=>a+b,0);
    output.textContent=mode==='percent'?ui`Total: ${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(sum/100)} % de 100 %`:mode==='amounts'?ui`Total asignado: ${money(sum)} de ${money(decimalUnits(form.elements.amount.value||'0',currencyOf(group())))}`:ui`Total de partes: ${sum}`;
  }catch{output.textContent=tr('Completa el reparto para comprobar el total.');}
}
function groupModal(edit=false,defaultType='Viaje') {
  const g=group() || {};
  const selectedCurrency=currencyOf(edit?g:undefined);
  openModal(edit?tr('Los detalles del plan'):tr('Todo empieza con un grupo'),ui`<form id="group-form" data-entity-id="${uid()}" data-edit="${edit}"><div class="form-columns emoji-columns"><label class="field">Icono<select name="emoji">${['🚋','🌴','🪴','☀️','🏕️','🍕','🎉','🏠','✈️','⛷️'].map(e=>`<option ${edit&&g.emoji===e?'selected':''}>${e}</option>`).join('')}</select></label><label class="field">Nombre del grupo<input name="name" placeholder="Ej. Escapada al sur" value="${edit?esc(g.name):''}" maxlength="60" required></label></div><div class="form-columns"><label class="field">Tipo de grupo<select name="type">${['Viaje','Convivencia','Pareja','Plan con amigos'].map(t=>`<option value="${esc(t)}" ${(edit?g.type:defaultType)===t?'selected':''}>${tr(t)}</option>`).join('')}</select></label><label class="field">Lugar<input name="place" placeholder="Ej. Málaga, España" value="${edit?esc(g.place):''}" maxlength="80"></label></div><div class="form-columns"><label class="field">Desde<input type="date" name="date" value="${edit?esc(g.date):''}"></label><label class="field">Hasta<input type="date" name="endDate" value="${edit?esc(g.endDate):''}"></label></div>${edit||accountUser?'':ui`<label class="field">¿Quién se apunta? <span class="muted">Nombres separados por comas</span><input name="members" placeholder="Marta, Pablo, Lucía" maxlength="300"></label>`}<label class="field">Moneda del grupo<select name="currency" ${edit&&!canChangeCurrency(g)?'disabled':''}>${currencies.map(code=>`<option value="${code}" ${selectedCurrency===code?'selected':''}>${esc(new Intl.DisplayNames([locale],{type:'currency'}).of(code))} (${code})</option>`).join('')}</select><span class="muted">${tr(edit&&!canChangeCurrency(g)?'La moneda no se puede cambiar después de registrar gastos o pagos. Crea otro grupo para usar otra moneda.':'La moneda se comparte con todo el grupo. No se convierten importes automáticamente.')}</span></label><label class="field"><span class="budget-currency-label">${ui`Presupuesto total del grupo (${selectedCurrency==='EUR'?'€':selectedCurrency})`}</span><input name="budget" type="number" min="1" max="10000000" step="${currencyStep(selectedCurrency)}" value="${edit&&g.budget?g.budget/currencyScale(selectedCurrency):''}" placeholder="1200"><span class="muted">${tr('Opcional. Déjalo vacío si no necesitas presupuesto.')}</span></label><div class="form-note">${icon('users')} ${accountUser?tr('Comparte un enlace de invitación después de crear el grupo. Cada persona entrará con su cuenta.'):tr('Demo local: los participantes y los datos se guardan solo en este navegador.')}</div>${actions(edit?tr('Guardar cambios'):tr('Crear grupo'))}${edit&&canManage()?ui`<button type="button" class="text-button danger-text delete-group-link" data-action="delete-group">Eliminar grupo</button>`:''}</form>`);
}
function paymentSuggestions() {
  const pending=activityData().ready===true?activityData().requests:[];
  const id=value=>value===accountUser?.id?'you':value;
  return settlements({...group(),payments:[...group().payments,...pending.map(r=>({from:id(r.from_id),to:id(r.to_id),amount:r.amount}))]});
}
function fxDetails(snapshot,baseCurrency) {
 if(!snapshot)return '';
 const source=snapshot.source==='ECB'?'BCE / ECB':'ExchangeRate-API';
 return ui`<p class="fx-detail">${tr('Cambio aplicado')}: 1 EUR = ${esc(new Intl.NumberFormat(locale,{maximumFractionDigits:10}).format(Number(snapshot.rate)))} ${esc(baseCurrency)} · ${esc(snapshot.date)} · ${esc(source)}</p>`;
}
function fxPanel() {
 if(currencyOf(group())==='EUR')return '';
 const fx=fxSession,quote=fx.quote;
 return ui`<section class="fx-panel"><div class="fx-controls"><button class="button ${fx.mode?'secondary':'primary'} small-button" data-action="fx-original">${esc(currencyOf(group()))}</button><button class="button ${fx.mode?'primary':'secondary'} small-button" data-action="fx-euros">Ver en euros</button></div>${fx.loading?ui`<p role="status">Consultando el cambio más reciente…</p>`:fx.error?`<p class="activity-error" role="alert">${esc(fx.error)}</p><button class="text-button" data-action="fx-refresh">${tr('Volver a intentar')}</button>`:quote?ui`<p class="fx-detail">${tr('Última cotización disponible')}: ${esc(quote.rate_date)}<br>1 EUR = ${esc(new Intl.NumberFormat(locale,{maximumFractionDigits:10}).format(Number(quote.rate)))} ${esc(quote.currency)} · ${quote.source==='ECB'?'<a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer">BCE / ECB</a>':'<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates by ExchangeRate-API</a>'}</p><button class="text-button" data-action="fx-refresh">Actualizar cambio</button>`:''}<p class="form-note">Cambio de referencia: el banco puede aplicar otro cambio o comisiones. Los gastos y saldos se mantienen en la moneda original.</p></section>`;
}
function renderSettlements() {
 const box=modalRoot.querySelector('.settlements-dialog');if(!box||box.dataset.settlementGroup!==group()?.id)return;
 const g=group(),items=paymentSuggestions(),data=activityData(),converted=fxSession.mode&&validQuote(fxSession.quote,currencyOf(g));
 box.innerHTML=ui`<p class="settlement-note">Marca tu pago cuando lo hayas enviado. La otra persona debe confirmar que lo ha recibido.</p>${fxPanel()}${activityNotice(data)}${data.ready===true?paymentRequestsView(data.requests,accountUser?.id,activityMemberName,currencyOf(g)):''}<div class="settlement-list">${items.length?items.map((p,i)=>{const eur=converted?euroAmount(p.amount,currencyOf(g),fxSession.quote.rate):null;return `<div class="settlement-row"><div>${avatar(member(p.from),true)}<strong>${esc(member(p.from).name)}</strong>${icon('arrow')}<strong>${esc(member(p.to).name)}</strong></div><div class="settlement-amount"><strong>${money(eur??p.amount,converted?'EUR':currencyOf(g))}</strong>${converted?`<small>${money(p.amount)}</small>`:''}${accountUser&&data.ready===true&&p.from==='you'?ui`<button class="button secondary small-button" data-settle="${i}" ${fxSession.mode&&(!converted||!eur)?'disabled':''}>Marcar como pagado</button>`:''}${converted&&!eur?ui`<small>Importe inferior a un céntimo. Usa la moneda original.</small>`:''}</div></div>`;}).join(''):data.requests.length?ui`<p class="pending-summary">Quedan pagos pendientes de confirmar. Los saldos todavía no han cambiado.</p>`:empty(tr('¡Todo saldado!'),tr('El grupo está en equilibrio. A por el siguiente plan.'))}<p class="form-note">${icon('wallet')} DivZplit registra devoluciones; no envía dinero ni realiza transferencias.</p></div>`;
}
async function loadFxQuote() {
 const g=group(),viewer=accountUser?.id;if(!g||currencyOf(g)==='EUR')return;
 const request=++fxSession.request;fxSession.loading=true;fxSession.error='';fxSession.quote=null;renderSettlements();
 try{
  if(!viewer)throw new Error(tr('Entra con tu cuenta para consultar el cambio actualizado.'));
  const quote=await cloud.exchangeQuote(currencyOf(g));
  if(fxSession.request!==request||group()?.id!==g.id||accountUser?.id!==viewer)return;
  if(!validQuote(quote,currencyOf(g)))throw new Error(tr('No se ha podido obtener un cambio vigente.'));
  fxSession.quote=quote;
 }catch(error){if(fxSession.request===request&&group()?.id===g.id&&accountUser?.id===viewer)fxSession.error=error.message;}
 finally{if(fxSession.request===request&&group()?.id===g.id&&accountUser?.id===viewer){fxSession.loading=false;renderSettlements();}}
}
async function settlementsModal() {
 const id=group()?.id;if(!id)return;
 fxSession={groupId:id,mode:false,quote:null,error:'',loading:false,request:fxSession.request+1};
 openModal(tr('Las cuentas claras'),`<div class="settlements-dialog" data-settlement-group="${esc(id)}"><p role="status">${tr('Cargando actividad…')}</p></div>`,tr('Menos transferencias para equilibrar los saldos.'));
 await loadActivity();renderSettlements();
}
async function respondToPayment(requestId,action,returnToPending=false) {
  const request=activityData().requests.find(r=>r.id===requestId);
  if(!request||!['confirm','reject','cancel'].includes(action))return;
  if((action==='cancel'?request.from_id:request.to_id)!==accountUser?.id)throw new Error(tr('No puedes responder a este pago.'));
  remoteBusy=true;
  try{
    const saved=await cloud.respondPayment(group(),requestId,action);
    const index=state.groups.findIndex(g=>g.id===saved.id);state.groups[index]=saved;remoteBaseline.set(saved.id,JSON.stringify(saved));
    await loadActivity();closeModal();render();if(returnToPending)await showPaymentList('pending');
    toast(tr(action==='confirm'?'Pago confirmado. Los saldos están actualizados.':action==='reject'?'Pago marcado como no recibido. Los saldos no han cambiado.':'Solicitud cancelada. Los saldos no han cambiado.'),action==='confirm'?'success':'neutral');
  }catch(error){await loadActivity();throw error;}finally{remoteBusy=false;}
}

function expenseDetails(id) {
  const e=group().expenses.find(e=>e.id===id); if(!e)return;
  const shares=expenseShares(e);
  openModal(esc(e.title),ui`<div class="expense-detail-total">${money(e.amount)}<span>${esc(tr(e.category))} · ${dateLabel(e.date)}</span></div><p class="detail-payer">Pagado por <strong>${esc(member(e.payer).name)}</strong></p>${e.receipt?ui`<button class="button secondary full-width" data-view-receipt="${esc(e.id)}">${icon('receipt')} Ver foto del ticket</button>`:''}${e.recurrence?`<div class="recurrence-info"><strong>${({weekly:tr('Cada semana'),monthly:tr('Cada mes'),yearly:tr('Cada año')})[e.recurrence.frequency]||tr('Recurrente')}</strong><p>${e.recurrence.active?tr('Próximo gasto: ')+dateLabel(e.recurrence.nextDate):tr('Repetición detenida')}</p>${e.recurrence.active&&(!accountUser||canManage()||e.createdBy===accountUser.id)?ui`<button class="text-button" data-stop-recurrence="${esc(e.id)}">Detener repetición</button>`:''}</div>`:e.seriesId?tr('<p class="form-note">Generado a partir de un gasto recurrente.</p>'):''}<h3 class="detail-subtitle">Así se reparte</h3>${e.participants.map((id,i)=>`<div class="share-row">${avatar(member(id),true)}<span>${esc(member(id).name)}</span><strong>${money(shares[id])}</strong></div>`).join('')}<div class="modal-actions">${canEditExpense(e)?ui`<button class="button secondary" data-edit-expense="${esc(e.id)}">Editar gasto</button><button class="button danger" data-delete-expense="${esc(e.id)}">Eliminar gasto</button>`:''}<button class="button primary" data-action="close-modal">Entendido</button></div>`);
}
function profileContent() {
  const profile=currentProfile();
  return ui`<div class="profile-detail">${avatar(profile)}<div><h3>${esc(profile.name)}${accountUser?'':tr(' · Tu perfil de demo')}</h3><p>${accountUser?esc(accountUser.email):tr('Moneda:')+' '+esc(new Intl.DisplayNames([locale],{type:'currency'}).of(currencyOf(group())))+' · '+tr('Idioma:')+' '+languageName}</p></div></div><div class="privacy-note"><h3>${accountUser?tr('Vuestros planes, en el mismo sitio'):tr('Explora DivZplit a tu ritmo')}</h3><p>${accountUser?tr('Tus grupos se guardan en tu cuenta. Los cambios se comprueban cada ocho segundos mientras usas DivZplit. Solo sus miembros pueden acceder. Los grupos de ejemplo de la demo no se suben a tu cuenta.'):tr('Esta demo guarda los cambios en este navegador. Entra o crea una cuenta para organizar grupos compartidos con otras personas.')}</p></div>${accountUser?ui`<button class="button secondary full-width" data-action="signout">Cerrar sesión</button>`:ui`<button class="button primary full-width" data-action="account">Entrar o crear una cuenta</button>`}<button class="button secondary full-width export-account" data-action="export">${icon('logout')} Exportar mis datos (JSON)</button>${!accountUser?ui`<button class="text-button danger-text reset-button" data-action="reset">Restablecer los datos de ejemplo</button>`:''}`;
}
function settingsModal() {openModal(tr('Tu espacio, a tu manera'),profileContent());}
function profileView() {
  return ui`<div class="welcome-row"><div><div class="eyebrow">TU ESPACIO</div><h1>Tu perfil, a tu manera.</h1><p>Tu cuenta y tus datos, siempre a mano.</p></div></div><section class="panel profile-panel">${profileContent()}</section>`;
}
function quickAddModal() {
  const g=group();
  openModal(tr('¿Qué quieres añadir?'),ui`<div class="quick-add-content">${g?ui`<p class="quick-add-context">En el grupo: <strong>${esc(g.name)}</strong></p>${state.groups.length>1?ui`<label class="field">Seleccionar grupo<select data-quick-group>${state.groups.map(item=>`<option value="${esc(item.id)}" ${item.id===g.id?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>`:''}<div class="quick-actions">${[['new-expense','receipt',tr('Añadir gasto'),tr('Reparte una cuenta con tu grupo.')],['new-task','task',tr('Añadir tarea'),tr('Que no se os quede nada pendiente.')],['new-poll','vote',tr('Crear votación'),tr('Decidid juntos el próximo plan.')]].map(([action,ic,title,description])=>`<button class="quick-action" data-action="${action}"><span class="quick-action-icon">${icon(ic)}</span><span><strong>${title}</strong><small>${description}</small></span>${icon('chevron')}</button>`).join('')}</div>`:ui`<p class="form-note">Crea un grupo para empezar a compartir gastos y planes.</p>`}${g?`<button class="quick-action quick-shopping" data-shopping-action="open"><span class="quick-action-icon">${icon('receipt')}</span><span><strong>${tr('Lista de la compra')}</strong><small>${tr('Lo que falta, en un mismo lugar.')}</small></span>${icon('chevron')}</button>`:''}<button class="quick-action quick-new-group" data-action="new-group"><span class="quick-action-icon">${icon('users')}</span><span><strong>${tr('Crear grupo')}</strong><small>${tr('Todo empieza con tu gente.')}</small></span>${icon('plus')}</button></div>`,'','quick-add-modal');
  root.querySelector('.nav-add')?.setAttribute('aria-expanded','true');
}

document.addEventListener('click', event => {onAppClick(event).catch(handleActionError);});
async function onAppClick(event) {
  const el=event.target.closest('button, a');
  if(!el)return;
  if(brandIntroActive && el.matches('.auth-header .brand')){event.preventDefault();finishBrandIntro();return;}
  if(remoteBusy || authLoading){event.preventDefault();toast(tr('Espera un momento; estamos conectando con tus grupos.'));return;}
  if(el.matches('a[href="#"],a[data-action]'))event.preventDefault();
  if(el.dataset.shoppingAction){await shoppingAction(el);return;}
  if(el.dataset.notificationAction){await notifications.handle(el);return;}
  if(el.dataset.receiptAction){await handleReceiptAction(el,currencyOf(group()),updateSplitTotal);return;}
  if(el.dataset.page){page=el.dataset.page; render();if(page==='activity'||page==='home'){await loadActivity();render();}document.querySelector('#main')?.focus({preventScroll:true}); window.scrollTo({top:0});return;}
  if(el.dataset.group){await activateHomeGroup(el.dataset.group);return;}
  if(el.dataset.groupMode){await selectHomeMode(el.dataset.groupMode);return;}
  if(el.dataset.tab){tab=el.dataset.tab;render();return;}
  if(el.dataset.filter){expenseFilter=el.dataset.filter;render();return;}
  if(el.dataset.poll){const poll=group().polls.find(p=>p.id===el.dataset.poll);if(planClosed(poll))throw new Error(tr('Esta votación ya está cerrada.'));vote(poll,el.dataset.option,'you');await save();render();renderPlanningList();toast(poll.votes.you?tr('Tu voto está guardado. Puedes cambiarlo cuando quieras.'):tr('Has retirado tu voto.'));return;}
  if(el.dataset.editExpense){expenseModal(el.dataset.editExpense);return;}
  if(el.dataset.showPlanning){await showPlanningList(el.dataset.showPlanning);return;}
  if(el.dataset.planDetail){planDetails(el.dataset.planDetail,el.dataset.kind);return;}
  if(el.dataset.planEdit){planningModal(el.dataset.kind,el.dataset.planEdit);return;}
  if(el.dataset.planClear||el.dataset.planDelete){
    const kind=el.dataset.planClear||el.dataset.kind,all=!!el.dataset.planClear,item=group()?.[kind]?.find(x=>x.id===el.dataset.planDelete);
    if(all?!canManage():!canEditPlan(item))throw new Error(tr('No puedes borrar esta entrada.'));
    openModal(tr(all?'¿Borrar toda la lista?':'¿Borrar esta entrada?'),ui`<p class="dialog-copy">Se eliminarán ${all?tr('todas las entradas de esta lista'):tr('esta entrada')}. Los gastos, pagos y saldos se conservarán. También se cancelarán sus recordatorios programados. No se puede deshacer.</p><div class="modal-actions"><button class="button secondary" data-show-planning="${kind}">Cancelar</button><button class="button danger" data-confirm-plan-delete="${all?'clear':'delete'}" data-kind="${kind}" data-item="${esc(item?.id||'')}" data-planning-group="${esc(group().id)}">${tr(all?'Borrar todo':'Borrar')}</button></div>`);return;
  }
  if(el.dataset.confirmPlanDelete){
    if(el.dataset.planningGroup!==group()?.id)return;
    const kind=el.dataset.kind;await applyPlanningAction(kind,el.dataset.confirmPlanDelete,{id:el.dataset.item});closeModal();render();await showPlanningList(kind);toast(tr('Lista actualizada. Los saldos se conservan.'));return;
  }
  if(el.dataset.planRemind){
    if(!accountUser){toast(tr('Entra con tu cuenta para enviar recordatorios al grupo.'));return;}
    const kind=el.dataset.kind,item=group()?.[kind]?.find(x=>x.id===el.dataset.planRemind);if(!canEditPlan(item))return;
    openModal(tr('¿Enviar un recordatorio al grupo?'),ui`<p class="dialog-copy">Avisaremos al resto del grupo sobre <strong>${esc(item.title)}</strong>, respetando sus preferencias. Podrás enviar otro recordatorio dentro de 15 minutos.</p><div class="modal-actions"><button class="button secondary" data-show-planning="${kind}">Cancelar</button><button class="button primary" data-confirm-plan-remind="${esc(item.id)}" data-kind="${kind}" data-planning-group="${esc(group().id)}">Enviar recordatorio</button></div>`);return;
  }
  if(el.dataset.confirmPlanRemind){
    if(el.dataset.planningGroup!==group()?.id)return;remoteBusy=true;
    try{await cloud.remindPlan(group(),el.dataset.kind,el.dataset.confirmPlanRemind);closeModal();await showPlanningList(el.dataset.kind);toast(tr('Recordatorio enviado a las personas con estos avisos activados.'));}finally{remoteBusy=false;}return;
  }
  if(el.dataset.expense){expenseDetails(el.dataset.expense);return;}
  if(el.dataset.deleteExpense){const id=el.dataset.deleteExpense;openModal(tr('¿Eliminar este gasto?'),ui`<p class="dialog-copy">El reparto y los saldos del grupo se volverán a calcular. Esta acción no se puede deshacer.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button danger" data-confirm-delete="${esc(id)}">Sí, eliminar</button></div>`);return;}
  if(el.dataset.confirmDelete){const g=group();const receipt=g.expenses.find(e=>e.id===el.dataset.confirmDelete)?.receipt;g.expenses=g.expenses.filter(e=>e.id!==el.dataset.confirmDelete);await save();let removed=true;if(accountUser&&receipt?.path){try{await cloud.deleteReceipt(g.id,receipt.path);}catch{removed=false;}}closeModal();render();toast(removed?tr('Gasto eliminado. Los saldos están actualizados.'):tr('Gasto eliminado; no se pudo borrar su foto del almacenamiento.'));return;}
  if(el.dataset.settle!==undefined){
    let p=paymentSuggestions()[Number(el.dataset.settle)];if(!p||p.from!=='you')return;
    let fx=null;
    if(fxSession.mode){
      if(!validQuote(fxSession.quote,currencyOf(group())))throw new Error(tr('El cambio ha caducado. Actualízalo antes de continuar.'));
      const quote=fxSession.quote;const amount=euroAmount(p.amount,currencyOf(group()),quote.rate);if(amount<1)throw new Error(tr('Importe inferior a un céntimo. Usa la moneda original.'));
      p={...p,fxQuoteId:quote.id,eurAmount:amount};fx={currency:'EUR',amount,rate:quote.rate,date:quote.rate_date,source:quote.source};
    }
    openModal(tr('¿Has enviado el pago?'),ui`<p class="dialog-copy">Vas a marcar como enviado un pago de <strong>${fx?money(fx.amount,'EUR'):money(p.amount)}</strong> a <strong>${esc(member(p.to).name)}</strong>.</p>${fx?ui`<p class="form-note">Equivale a ${money(p.amount)} en las cuentas del grupo.</p>${fxDetails(fx,currencyOf(group()))}`:''}<p class="form-note">El saldo no cambiará hasta que la otra persona confirme la recepción.</p><div class="modal-actions"><button class="button secondary" data-action="settlements">Cancelar</button><button class="button primary" data-confirm-payment="${esc(JSON.stringify(p))}" data-payment-group="${esc(group().id)}" data-request-id="${uid()}">Ya lo he enviado</button></div>`);return;
  }
  if(el.dataset.confirmPayment){
    if(el.dataset.paymentGroup!==group()?.id)return;
    const p=JSON.parse(el.dataset.confirmPayment);remoteBusy=true;
    try{await cloud.requestPayment(group(),p,el.dataset.requestId);await loadActivity();closeModal();render();toast(tr('Pago enviado para confirmar. Los saldos todavía no han cambiado.'));}
    finally{remoteBusy=false;}return;
  }
  if(el.dataset.paymentResponse){
    const action=el.dataset.paymentResponse,id=el.dataset.requestId,returnToPending=!!modalRoot.querySelector('.payment-list-dialog[data-kind="pending"]');
    const request=activityData().requests.find(r=>r.id===id);
    const fxSummary=request?.fx?ui`<p class="dialog-copy">${money(request.fx.amount,'EUR')} · ${money(request.amount,request.currency)}</p>${fxDetails(request.fx,request.currency)}`:'';
    const label=action==='confirm'&&request?ui`¿Has recibido ${money(request.fx?.amount??request.amount,request.fx?'EUR':request.currency)}?`:action==='confirm'?tr('¿Confirmas que has recibido el dinero?'):action==='reject'?'¿Todavía no has recibido este pago?':'¿Cancelar esta solicitud de pago?';
    openModal(tr(label),ui`${action==='confirm'?`<div class="payment-confirm-icon">${icon('wallet')}</div>`:''}${fxSummary}<p class="dialog-copy">${tr(action==='confirm'?'Confirma únicamente si el dinero ya ha llegado a su destino.':'Los saldos no cambiarán.')}</p><div class="modal-actions"><button class="button secondary" data-action="${returnToPending?'show-pending-payments':'close-modal'}">Volver</button><button class="button primary" data-resolve-payment="${esc(action)}" data-request-id="${esc(id)}" data-return-pending="${returnToPending}">${tr(action==='confirm'?'Sí, confirmar':'Confirmar')}</button></div>`);return;
  }
  if(el.dataset.resolvePayment){await respondToPayment(el.dataset.requestId,el.dataset.resolvePayment,el.dataset.returnPending==='true');return;}
  if(el.dataset.deleteHistory){
    if(!canManage())throw new Error(tr('Solo el administrador puede borrar entradas del historial.'));
    openModal(tr('¿Borrar esta entrada del historial?'),ui`<p class="dialog-copy">Solo se eliminará esta entrada del historial. Los gastos, pagos y saldos no cambian. No se puede deshacer.</p><div class="modal-actions"><button class="button secondary" data-action="show-history">Cancelar</button><button class="button danger" data-confirm-history-delete="${esc(el.dataset.deleteHistory)}">Borrar entrada</button></div>`);return;
  }
  if(el.dataset.confirmHistoryDelete){remoteBusy=true;try{await cloud.deleteHistory(group(),el.dataset.confirmHistoryDelete);await loadActivity();closeModal();render();await showHistory();toast(tr('Entrada del historial borrada.'));}finally{remoteBusy=false;}return;}
  if(el.dataset.clearPaymentList){
    const kind=el.dataset.clearPaymentList;if(!canManage()||!['pending','recorded'].includes(kind))throw new Error(tr('Solo el administrador puede limpiar estas listas.'));
    openModal(tr(kind==='pending'?'¿Cancelar todos los pagos pendientes?':'¿Limpiar las devoluciones registradas?'),ui`<p class="dialog-copy">${tr(kind==='pending'?'Se cancelarán todas las solicitudes pendientes de este grupo. Los saldos no cambiarán y los pagos podrán volver a registrarse.':'Se quitarán de la lista las devoluciones actuales. Los pagos y los saldos se conservarán. Podrás consultarlas en «Ver anteriores».')}</p><div class="modal-actions"><button class="button secondary" data-action="${kind==='pending'?'show-pending-payments':'show-recorded-payments'}">Cancelar</button><button class="button danger" data-confirm-clear-payments="${kind}" data-payment-group="${esc(group().id)}">Borrar todo</button></div>`);return;
  }
  if(el.dataset.confirmClearPayments){
    const g=group(),kind=el.dataset.confirmClearPayments;if(g?.id!==el.dataset.paymentGroup||!canManage())throw new Error(tr('Solo el administrador puede limpiar estas listas.'));
    remoteBusy=true;
    try{activityRequests.set(g.id,(activityRequests.get(g.id)||0)+1);archiveRequests.set(g.id,(archiveRequests.get(g.id)||0)+1);await cloud.clearPaymentList(g,kind);await loadActivity();closeModal();render();await showPaymentList(kind);toast(tr(kind==='pending'?'Solicitudes canceladas. Los saldos no han cambiado.':'Lista limpiada. Los pagos y los saldos se conservan.'));}finally{remoteBusy=false;}return;
  }
  if(el.dataset.confirmClearHistory){
    const g=group();if(g?.id!==el.dataset.confirmClearHistory||!canManage())throw new Error(tr('Solo el administrador puede borrar entradas del historial.'));
    remoteBusy=true;
    try{activityRequests.set(g.id,(activityRequests.get(g.id)||0)+1);await cloud.clearHistory(g);await loadActivity();closeModal();render();await showHistory();toast(tr('Historial borrado. Los gastos y saldos se conservan.'));}finally{remoteBusy=false;}return;
  }

  if(el.dataset.viewReceipt){await viewReceipt(el.dataset.viewReceipt);return;}
  if(el.dataset.stopRecurrence){const e=group().expenses.find(e=>e.id===el.dataset.stopRecurrence);if(e?.recurrence&&(!accountUser||canManage()||e.createdBy===accountUser.id)){e.recurrence.active=false;await save();expenseDetails(e.id);toast(tr('Repetición detenida. Los gastos anteriores se conservan.'));}return;}
  switch(el.dataset.action){
    case 'close-modal':closeModal();break;
    case 'quick-add':quickAddModal();break;
    case 'delete-group':deleteGroupModal();break;
    case 'new-expense':expenseModal();break;
    case 'new-group':groupModal(false,el.dataset.groupType||'Viaje');break;
    case 'edit-group':groupModal(true);break;
    case 'fx-original':fxSession.mode=false;renderSettlements();break;
    case 'fx-euros':fxSession.mode=true;if(validQuote(fxSession.quote,currencyOf(group())))renderSettlements();else await loadFxQuote();break;
    case 'fx-refresh':await loadFxQuote();break;
    case 'choose-group':chooseGroup();break;
    case 'settlements':await settlementsModal();if(el.dataset.preferEuros==='true'){fxSession.mode=true;await loadFxQuote();}break;
    case 'reload-activity':await loadActivity();if(modalRoot.querySelector('.history-dialog'))renderHistoryModal();else if(modalRoot.querySelector('.payment-list-dialog'))renderPaymentList();else if(modalRoot.querySelector('.settlements-dialog'))renderSettlements();else if(modalRoot.firstElementChild)await settlementsModal();else render();break;
    case 'more-history':await loadActivity(true);renderHistoryModal();break;
    case 'show-pending-payments':await showPaymentList('pending');break;
    case 'show-recorded-payments':await showPaymentList('recorded');break;
    case 'toggle-recorded-archive':showArchivedRepayments=!showArchivedRepayments;recordedPaymentLimit=50;renderPaymentList();break;
    case 'more-recorded-payments':recordedPaymentLimit+=50;renderPaymentList();break;
    case 'more-planning':planningLimit+=30;renderPlanningList();break;
    case 'show-history':await showHistory();break;
    case 'clear-history':if(!canManage())throw new Error(tr('Solo el administrador puede borrar entradas del historial.'));openModal(tr('¿Borrar todo el historial?'),ui`<p class="dialog-copy">Se borrarán todas las entradas del historial de este grupo. Los gastos, pagos y saldos se conservarán. No se puede deshacer.</p><div class="modal-actions"><button class="button secondary" data-action="show-history">Cancelar</button><button class="button danger" data-confirm-clear-history="${esc(group().id)}">Borrar todo</button></div>`);break;
    case 'edit-budget':openModal(tr('Disfrutar, sin sorpresas'),ui`<form id="budget-form"><label class="field">Presupuesto total del grupo (${currencyUnit(group())})<input type="number" name="budget" min="1" max="10000000" step="${currencyStep(currencyOf(group()))}" value="${group().budget?group().budget/currencyScale(currencyOf(group())):''}"></label><p class="form-note">Opcional. Déjalo vacío si no necesitas presupuesto.</p>${actions(tr('Actualizar presupuesto'))}</form>`,esc(group().name));break;
    case 'new-task':planningModal('tasks');break;
    case 'new-poll':planningModal('polls');break;
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
  if(remoteBusy || authLoading){if(el.dataset.shoppingCheck){el.checked=!!shoppingState.items.find(i=>i.id===el.dataset.shoppingCheck)?.bought;return;}render();return;}
  if(el.matches('[data-quick-group]')){state.activeGroup=el.value;await save();render();modalOpener=[...root.querySelectorAll('[data-action=quick-add]')].find(button=>button.getClientRects().length);quickAddModal();return;}
  if(el.form?.id==='expense-form'&&(el.name==='splitMode'||el.name==='participants')){renderSplitFields(el.form);return;}
  if(el.name==='removeReceipt'&&el.checked){const file=el.form.elements.receipt;file.value='';await receiptChanged(file);return;}
  if(el.matches('select[name=currency]')){const label=el.form.querySelector('.budget-currency-label');if(label)label.textContent=ui`Presupuesto total del grupo (${el.value==='EUR'?'€':el.value})`;if(el.form.elements.budget)el.form.elements.budget.step=currencyStep(el.value);return;}
  if(el.matches('input[name=receipt]')){const details=el.form?.querySelector('.expense-more-options');if(details)details.open=true;await receiptChanged(el);return;}
  if(el.form?.id==='expense-form'&&el.name==='payer'){const target=el.form.querySelector('.expense-payer-avatar');if(target)target.innerHTML=avatar(member(el.value),true);return;}
  if(el.dataset.shoppingCheck){const item=shoppingState.items.find(i=>i.id===el.dataset.shoppingCheck);if(item){try{await shoppingMutation('check',{id:item.id,version:item.version,bought:el.checked});}catch(error){await loadShopping();throw error;}}return;}
  if(el.dataset.task){const t=group().tasks.find(t=>t.id===el.dataset.task);t.done=el.checked;await save();render();renderPlanningList();toast(t.done?tr('¡Una cosa menos por hacer!'):tr('Tarea marcada como pendiente.'));}
  if(el.matches('[data-group-select]')){state.activeGroup=el.value;await save();render();if(page==='activity'||page==='home'){await loadActivity();render();}}
}
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.closest('#modal-root')&&!['account-form','recovery-form','password-form'].includes(form.id))return;event.preventDefault();if(remoteBusy||authLoading)return;const data=new FormData(form);
  if(await handleDeleteGroupForm(form,data))return;
  if(await handleRecoveryForm(form,data))return;
  if(await handleAccountForm(form,data))return;
  try {
    if(form.id==='shopping-item-form'){
      if(form.dataset.shoppingGroup!==group()?.id)throw new Error(tr('El grupo ha cambiado. Vuelve a abrir el formulario.'));
      const title=String(data.get('title')||'').trim(),quantity=String(data.get('quantity')||'').trim();
      if(!title||title.length>120||quantity.length>40)throw new Error(tr('Revisa el producto y su cantidad.'));
      await shoppingMutation(form.dataset.edit==='true'?'edit':'add',{id:form.dataset.entityId,version:Number(form.dataset.version),title,quantity});
      await showShopping();toast(tr('Lista de la compra actualizada.'),'success');return;
    }
    if(form.id==='expense-form'){
      if(form.dataset.expenseGroup!==group()?.id)throw new Error(tr('El grupo ha cambiado. Vuelve a abrir el formulario.'));
      if(form.receiptPending)throw new Error(tr('Espera a que termine de prepararse la foto.'));
      remoteBusy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;
      try {
        const fields={title:data.get('title'),amount:decimalUnits(data.get('amount'),currencyOf(group())),payer:data.get('payer'),participants:data.getAll('participants'),category:data.get('category'),date:data.get('date')};
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
    if(['task-form','poll-form'].includes(form.id)) {
      const kind=form.id==='task-form'?'tasks':'polls';
      if(form.dataset.group!==group()?.id)throw new Error(tr('El grupo ha cambiado. Vuelve a abrir el formulario.'));
      const previous=group()[kind].find(x=>x.id===form.dataset.entityId),title=data.get('title').trim();
      if(!title)throw new Error(tr('Escribe un título.'));
      const item={id:form.dataset.entityId,title,...planningFields({dueAt:data.get('dueAt'),remindAt:data.get('remindAt'),important:data.has('important')},previous)};
      if(kind==='tasks')Object.assign(item,{assignee:data.get('assignee'),done:previous?.done||false});
      else {
        const options=data.getAll('option').map(x=>x.trim()).filter(Boolean);
        if(!previous&&(options.length<2||new Set(options.map(x=>x.toLowerCase())).size!==options.length))throw new Error(tr('Escribe una pregunta y al menos dos opciones diferentes.'));
        Object.assign(item,{description:data.get('description').trim(),options:previous?.options||options.map(label=>({id:uid(),label,emoji:'✦'})),votes:previous?.votes||{}});
      }
      if(accountUser)await cloud.requirePlanning(!!item.remindAt);
      form.intendedPlan={...previous,...item};await applyPlanningAction(kind,'save',item);tab=kind==='tasks'?'tasks':'plans';closeModal();render();await showPlanningList(kind);toast(tr('Listo. Todo está actualizado.'),'success');return;
    }
    if(form.id==='budget-form'){const budget=optionalBudget(data.get('budget'),currencyOf(group()));if(accountUser&&!budget)await cloud.requirePlanning();group().budget=budget;}
    if(form.id==='group-form'){
      const name=data.get('name').trim();if(!name)throw new Error(tr('Ponle un nombre al grupo.'));
      if(data.get('endDate')&&!data.get('date'))throw new Error(tr('Indica también la fecha de inicio.'));
      if(data.get('date')&&data.get('endDate')&&data.get('endDate')<data.get('date'))throw new Error(tr('La fecha final debe ser posterior a la inicial.'));
      const currency=data.get('currency')||(form.dataset.edit==='true'?currencyOf(group()):'EUR');
      checkCurrencyChange(form.dataset.edit==='true'?group():null,currency);
      const fields={currency,name,emoji:data.get('emoji'),type:data.get('type'),place:data.get('place').trim(),date:data.get('date'),endDate:data.get('endDate'),budget:optionalBudget(data.get('budget'),currency)};
      if(accountUser&&!fields.budget)await cloud.requirePlanning();
      if(form.dataset.edit==='true')Object.assign(group(),fields);
      else {
        const names=String(data.get('members') || '').split(',').map(n=>n.trim()).filter(Boolean);if(names.length>19)throw new Error(tr('Puedes añadir hasta 19 personas más.'));
        const colors=['pink','blue','orange','purple'];const g={...fields,id:accountUser?form.dataset.entityId:uid(),members:[{id:'you',name:'Tú',initials:'AL',color:'purple'},...names.map((name,i)=>({id:uid(),name,initials:name.split(/\s+/).map(n=>n[0]).join('').slice(0,2).toUpperCase(),color:colors[i%4]}))],expenses:[],payments:[],tasks:[],polls:[]};state.groups.push(g);state.activeGroup=g.id;page='home';tab='summary';
      }
    }
    await save(form.shoppingCheckout);if(form.shoppingCheckout&&!accountUser){const key=demoShoppingKey();const items=JSON.parse(localStorage.getItem(key)||'[]');for(const i of items)if(form.shoppingCheckout.items.includes(i.id)){i.expense_id=form.shoppingCheckout.expenseId;i.version++;}localStorage.setItem(key,JSON.stringify(items));}if(form.oldReceipt&&accountUser)cloud.deleteReceipt(form.oldReceipt.groupId,form.oldReceipt.path).catch(()=>{});closeModal();render();toast(form.id==='group-form'?tr('El plan ya tiene su espacio.'):tr('Listo. Todo está actualizado.'),'success');
  }catch(error){
    // A response can be lost after the server commits. Stable form IDs let a
    // reload confirm the saved record instead of creating another one on retry.
    const id=form.dataset.entityId;
    const collection={'expense-form':'expenses','task-form':'tasks','poll-form':'polls'}[form.id];
    const confirmed=accountUser&&id&&((form.id==='group-form'&&form.dataset.edit!=='true'&&state.groups.some(g=>g.id===id))||(collection&&group()?.[collection]?.some(item=>item.id===id&&(form.dataset.edit!=='true'||sameJSON(item,form.intendedExpense||form.intendedPlan)))));
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
    notifications.disconnect().catch(()=>{});accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();closeModal();render();
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
document.addEventListener('input',event=>{if(event.target.form?.id==='expense-form'&&['title','amount','date'].includes(event.target.name)){const form=event.target.form;if(!form.receiptApplyingAuto){(form.receiptEditedFields??=new Set()).add(event.target.name);const revisions=form.receiptFieldRevisions??={};revisions[event.target.name]=(revisions[event.target.name]||0)+1;if(form.receiptAutofilled)delete form.receiptAutofilled[event.target.name];}}if(event.target.form?.id==='expense-form'&&(event.target.name==='amount'||event.target.dataset.splitMember))updateSplitTotal(event.target.form);});
async function processRecurrences() {
  let changed=false;
  for(const g of state.groups){
    const before=JSON.stringify(g);materializeRecurring(g,today(),e=>!accountUser||g.remote?.ownerId===accountUser.id||e.createdBy===accountUser.id,accountUser?.id);if(before!==JSON.stringify(g))changed=true;
  }
  if(changed)await save();
}
async function receiptChanged(input) {
  const form=input.form;const attempt={};form.receiptAttempt=attempt;
  clearReceiptAutofill(form);form.querySelector('.receipt-amount-status').textContent='';
  form.receiptBlob=null;form.receiptOCRSource=null;form.uploadedReceipt=null;form.receiptUploadId=uid();
  resetReceiptReader(form);
  if(input.files[0]?.size&&form.elements.removeReceipt)form.elements.removeReceipt.checked=false;
  const preview=form.querySelector('.receipt-preview');preview.replaceChildren();
  if(form.receiptPreviewURL)URL.revokeObjectURL(form.receiptPreviewURL);
  try {
    form.receiptPending=prepareReceipt(input.files[0]);const blob=await form.receiptPending;
    if(form.receiptAttempt!==attempt||!form.isConnected)return;
    if(blob){form.receiptBlob=blob;form.receiptOCRSource=input.files[0];form.receiptPreviewURL=URL.createObjectURL(blob);const img=document.createElement('img');img.src=form.receiptPreviewURL;img.alt=tr('Vista previa del ticket');preview.append(img);resetReceiptReader(form);}
  }catch(error){if(form.receiptAttempt===attempt){input.value='';toast(error.message);}}
  finally{if(form.receiptAttempt===attempt)form.receiptPending=null;}
  if(form.isConnected&&form.receiptAttempt===attempt&&form.receiptBlob&&form.dataset.edit!=='true'&&form.elements.amount.value===''){
    await handleReceiptAction(form.querySelector('[data-receipt-action=read]'),currencyOf(group()),updateSplitTotal);
  }
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
  root.innerHTML=welcomePage({stage:authStage,loading:authLoading,signup:authMode==='signup',form:accountForm(),social:socialButtons({providers,error:providerError,enabled:cloud.enabled,compact:authStage==='welcome'}),notice});
  root.inert=!!modalRoot.firstElementChild;
  if(!brandIntroShown){brandIntroShown=true;startBrandIntro();}
}
// Move the one header logo from the centre to its final layout position.
function startBrandIntro() {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const brand=root.querySelector('.auth-header .brand');
  if(reduced.matches || !brand?.animate){root.classList.add('welcome-ready');return;}
  const bounds=brand.getBoundingClientRect();
  if(!bounds.width)return;
  root.classList.add('brand-intro-active');
  const header=brand.closest('.auth-header');
  const headerBounds=header.getBoundingClientRect();
  const fontSize=parseFloat(getComputedStyle(brand).fontSize);
  const spacing=parseFloat(getComputedStyle(brand).letterSpacing)||0;
  const viewport=window.visualViewport;
  const visibleCentre=()=>({x:(viewport?.offsetLeft||0)+(viewport?.width||innerWidth)/2,y:(viewport?.offsetTop||0)+(viewport?.height||innerHeight)/2});
  const ratio=Math.min((viewport?.width||innerWidth)-64,360)/bounds.width;
  // Anchor the centre of the text throughout the size change. A fixed left
  // edge lets the changing text width push the logo sideways mid-flight.
  header.style.height=`${headerBounds.height}px`;
  const finalX=bounds.left+bounds.width/2-headerBounds.left;
  const finalY=bounds.top+bounds.height/2-headerBounds.top;
  const centre=visibleCentre();
  const startX=centre.x-headerBounds.left;
  const startY=centre.y-headerBounds.top;
  Object.assign(brand.style,{
    position:'absolute',left:`${finalX}px`,top:`${finalY}px`,
    transform:'translate(-50%,-50%)'
  });
  const curtain=document.createElement('div');
  curtain.className='brand-intro-curtain';
  curtain.setAttribute('aria-hidden','true');
  (root.querySelector('.welcome-stage')||brand.closest('.auth-shell')).prepend(curtain);
  brandIntroActive=true;
  const content=[...root.querySelectorAll(root.querySelector('.welcome-entry')?'.entry-controls,.welcome-phone':'.auth-main,.auth-footer')];
  content.forEach(el=>el.inert=true);
  let large={left:`${startX}px`,top:`${startY}px`,fontSize:`${fontSize*ratio}px`,letterSpacing:`${spacing*ratio}px`};
  const movement=brand.animate([
    {...large,offset:0},
    {...large,offset:.57,easing:'cubic-bezier(.22,1,.36,1)'},
    {left:`${finalX}px`,top:`${finalY}px`,fontSize:`${fontSize}px`,letterSpacing:`${spacing}px`,offset:1}
  ],{duration:2700,fill:'both'});
  const fade=curtain.animate([{opacity:1,offset:0},{opacity:1,offset:.57},{opacity:0,offset:1}],{duration:2700,fill:'both'});
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();finishBrandIntro();}};
  const initialWidth=innerWidth;
  // Safari can emit resize while its browser bars settle on first paint.
  // Only a real width change (rotation/window resize) should skip the intro.
  const onResize=()=>{if(Math.abs(innerWidth-initialWidth)>40)finishBrandIntro();};
  const onViewportChange=()=>{
    if(!brandIntroActive)return;
    const currentHeader=header.getBoundingClientRect();
    const currentCentre=visibleCentre();
    large={...large,left:`${currentCentre.x-currentHeader.left}px`,top:`${currentCentre.y-currentHeader.top}px`};
    movement.effect.setKeyframes([
      {...large,offset:0},
      {...large,offset:.57,easing:'cubic-bezier(.22,1,.36,1)'},
      {left:`${finalX}px`,top:`${finalY}px`,fontSize:`${fontSize}px`,letterSpacing:`${spacing}px`,offset:1}
    ]);
  };
  const onMotionChange=()=>{if(reduced.matches)finishBrandIntro();};
  let timeout;
  finishBrandIntro=()=>{
    if(!brandIntroActive)return;
    brandIntroActive=false;
    clearTimeout(timeout);
    movement.cancel();fade.cancel();curtain.remove();
    for(const property of ['position','left','top','font-size','letter-spacing','transform'])brand.style.removeProperty(property);
    header.style.removeProperty('height');
    root.classList.remove('brand-intro-active');
    root.classList.add('welcome-ready');
    content.forEach(el=>el.inert=false);
    document.removeEventListener('keydown',onKey);
    window.removeEventListener('resize',onResize);
    viewport?.removeEventListener('resize',onViewportChange);
    viewport?.removeEventListener('scroll',onViewportChange);
    reduced.removeEventListener('change',onMotionChange);
    if(brandIntroPendingRender){
      brandIntroPendingRender=false;render();
      root.querySelector('.auth-header .brand')?.replaceWith(brand);
    }
  };
  document.addEventListener('keydown',onKey);
  window.addEventListener('resize',onResize);
  viewport?.addEventListener('resize',onViewportChange);
  viewport?.addEventListener('scroll',onViewportChange);
  reduced.addEventListener('change',onMotionChange);
  timeout=setTimeout(()=>finishBrandIntro(),3300);
  movement.finished.then(()=>finishBrandIntro(),()=>{});
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
  document.querySelectorAll('.social-providers').forEach(el=>el.innerHTML=socialButtons({providers,error:providerError,enabled:cloud.enabled,compact:!!el.closest('.welcome-entry')}));
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
  if(notifications.account&&notifications.account!==cloud.user?.id)await notifications.disconnect();
  accountUser=cloud.user;demoMode=false;activityCache.clear();paymentArchives.clear();
  state={version:1,activeGroup:null,groups:[]};remoteBaseline.clear();page='home';tab='summary';
  try {state.activeGroup=sessionStorage.getItem('nexo-active-'+accountUser.id);} catch {}
  await loadSharedGroups();await processRecurrences();await loadActivity();if(group())rememberHomeMode(group());setSync(tr('Actualizado'));
  cloud.cleanupDeletedGroups().catch(()=>{});
  const metadata=accountUser.user_metadata||{};
  const firstSocialLogin=metadata.notification_intro_pending!==false&&accountUser.created_at&&accountUser.last_sign_in_at&&Math.abs(Date.parse(accountUser.last_sign_in_at)-Date.parse(accountUser.created_at))<10000;
  notifications.connect(accountUser.id,{onboard:metadata.notification_intro_pending===true||!!firstSocialLogin}).catch(()=>{});
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
  const before=JSON.stringify(state.groups),beforeActivity=JSON.stringify(activityData());
  try {
    await loadSharedGroups();await processRecurrences();await notifications.poll();if(page==='activity'||page==='home')await loadActivity(false,true);setSync(tr('Actualizado'));
    if (before!==JSON.stringify(state.groups)||beforeActivity!==JSON.stringify(activityData())||(page==='home'&&homeClock!==Math.floor(Date.now()/60000))) render();
  } catch(error) {
    setSync(tr('Sin conexión · Reintentar'));
    if (!cloud.session) {notifications.disconnect().catch(()=>{});accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();render();toast(tr('Tu sesión ha caducado. Vuelve a entrar.'));}
  } finally {remoteBusy=false;}
}
async function signOutAccount() {
  remoteBusy=true;
  try {await notifications.disconnect();await cloud.signOut();}
  catch {toast(tr('Has salido de este navegador. No se pudo cerrar la sesión en el servidor.'));}
  finally {
    activityCache.clear();paymentArchives.clear();accountUser=null;demoMode=false;authStage='welcome';authMode='login';history.replaceState(null,'',location.pathname+location.search);remoteBaseline.clear();state=structuredClone(demoState);page='home';tab='summary';
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
    const cleanup=event.newValue===null?notifications.disconnect():Promise.resolve();
    authLoading=true;accountUser=null;state=structuredClone(demoState);remoteBaseline.clear();closeModal();render();
    cleanup.finally(()=>startAccount());
  }
});

setInterval(()=>{if(modalRoot.querySelector('.shopping-list')&&shoppingCurrent()&&!remoteBusy&&!document.hidden)loadShopping();},10000);
