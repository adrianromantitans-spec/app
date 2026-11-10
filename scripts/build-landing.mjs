import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {landingCopy} from '../landing-copy.js';
const c=landingCopy.en;
const esc=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const text=(key,tag='span',cls='')=>`<${tag}${cls?` class="${cls}"`:''} data-copy="${key}">${esc(c[key])}</${tag}>`;
const paths={arrow:'M5 12h14m-5-5 5 5-5 5',down:'m7 10 5 5 5-5',receipt:'M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2-3-2Zm4 6h6m-6 4h6',group:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',budget:'M3 3v18h18M7 14l4-4 4 3 6-8',poll:'M5 21V11m7 10V3m7 18v-7',task:'M9 11l3 3 7-7M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8',balance:'M4 7h16m-5-4 5 4-5 4M20 17H4m5-4-5 4 5 4',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',menu:'M4 6h16M4 12h16M4 18h16'};
const icon=name=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const brand=`<img class="brand-logo" src="./assets/divzplit-logo.svg" alt="" width="40" height="40"><span class="wordmark">Div<span>Z</span>plit<span>.</span></span>`;
const manifest=JSON.parse(await readFile(new URL('../assets/landing/manifest.json',import.meta.url),'utf8'));
function image(shot,alt,cls='',eager=false){const size=manifest.images['en-'+shot]||{width:393,height:852};return `<img${cls?` class="${cls}"`:''} data-app-shot="${shot}" data-alt="${alt}" src="./assets/landing/en-${shot}.webp?v=images-95" srcset="./assets/landing/en-${shot}.webp?v=images-95 ${size.width}w, ./assets/landing/en-${shot}-2x.webp?v=images-95 ${size.width*2}w" sizes="${['balance','recent'].includes(shot)?'250px':'(max-width: 600px) 270px, 310px'}" width="${size.width}" height="${size.height}" alt="${esc(c[alt])}" ${eager?'fetchpriority="high" loading="eager"':'loading="lazy"'} decoding="async">`;}
const cta=(key='start',cls='button-primary')=>`<a class="button ${cls}" data-app-link="signup" href="./app/#registro">${text(key)}${icon('arrow')}</a>`;
const featureCards=['receipt','group','budget','poll','task','balance'].map((name,i)=>`<article class="feature-card reveal"><div class="feature-icon">${icon(name)}</div>${text('f'+(i+1)+'Title','h3')}${text('f'+(i+1)+'Body','p')}</article>`).join('');
const steps=['group','expense','settlements'].map((shot,i)=>`<button class="step" data-step="${shot}" aria-pressed="${i===0}"><span class="step-number">0${i+1}</span><span class="step-copy">${text('step'+(i+1)+'Title','strong')}${text('step'+(i+1)+'Body')}</span></button>`).join('');
const featureStories=['expenses','shopping','polls','currency','groups','tasks','budget'].map((shot,i)=>{
 const key='show'+shot[0].toUpperCase()+shot.slice(1);
 return `<article class="feature-story reveal" data-feature="${shot}"><div class="feature-story-copy"><p class="eyebrow"><span class="feature-number" aria-hidden="true">0${i+1}</span>${text(key+'Label')}</p>${text(key+'Title','h3')}${text(key+'Body','p','section-description')}</div><figure class="feature-story-visual"><div class="feature-story-aura" aria-hidden="true"></div><div class="phone feature-story-phone">${image(shot,key+'Alt')}</div><figcaption data-copy="screenNote">${c.screenNote}</figcaption></figure></article>`;
}).join('');
const questions=[1,2,3,4,5].map(i=>`<details class="faq-item"><summary>${text('faq'+i)}<span class="faq-plus" aria-hidden="true">+</span></summary>${text('faq'+i+'Body','p')}</details>`).join('');
const ld=JSON.stringify({'@context':'https://schema.org','@type':'SoftwareApplication',name:'DivZplit',url:'https://divzplit.com/app/',applicationCategory:'FinanceApplication',operatingSystem:'Web',inLanguage:['es','en','ro'],offers:{'@type':'Offer',price:'0',priceCurrency:'EUR'},image:'https://divzplit.com/assets/landing/share.webp?v=images-95'});
const hash=createHash('sha256').update(ld).digest('base64');
const html=`<!doctype html>
<html lang="en">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <meta name="theme-color" content="#fcfaff">
 <meta name="referrer" content="no-referrer">
 <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-${hash}'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'">
 <script src="./landing-route.js?v=landing-51"></script>
 <title>${esc(c.title)}</title>
 <meta name="description" content="${esc(c.description)}">
 <link rel="canonical" href="https://divzplit.com/">
 <meta property="og:type" content="website"><meta property="og:site_name" content="DivZplit"><meta property="og:locale" content="en_GB">
 <meta property="og:title" content="${esc(c.title)}"><meta property="og:description" content="${esc(c.description)}"><meta property="og:url" content="https://divzplit.com/">
 <meta property="og:image" content="https://divzplit.com/assets/landing/share.webp?v=images-95"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="DivZplit: shared expenses and group plans">
 <meta name="twitter:card" content="summary_large_image">
 <link rel="icon" href="./assets/app-icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="./assets/app-icon-180.png?v=visual-53">
 <link rel="preload" href="./assets/Manrope.ttf" as="font" type="font/ttf" crossorigin>
 <link rel="stylesheet" href="./landing.css?v=visual-53">
 <script type="application/ld+json">${ld}</script>
 <script type="module" src="./landing.js?v=images-95"></script>
</head>
<body>
 <a class="skip-link" href="#main" data-copy="skip">${c.skip}</a>
 <header class="site-header" id="site-header"><div class="container nav-bar">
  <a class="brand" href="./" aria-label="DivZplit">${brand}</a>
  <nav class="nav-links" id="main-navigation" aria-label="${c.navLabel}" data-label="navLabel">
   <a href="#caracteristicas" data-copy="featuresNav">${c.featuresNav}</a><a href="#como-funciona" data-copy="howNav">${c.howNav}</a><a href="#planes" data-copy="plansNav">${c.plansNav}</a><a href="#preguntas" data-copy="faqNav">${c.faqNav}</a>
   <a class="mobile-login" href="./app/#acceso" data-app-link="login" data-copy="login">${c.login}</a>
  </nav>
  <div class="nav-actions"><label class="language-control"><span class="sr-only" data-copy="language">${c.language}</span><select id="landing-language" aria-label="${c.language}" data-label="language"><option value="es" lang="es">ES</option><option value="en" lang="en" selected>EN</option><option value="ro" lang="ro">RO</option></select></label><a class="nav-login" data-app-link="login" href="./app/#acceso" data-copy="login">${c.login}</a>${cta('start','button-small button-primary')}<button class="menu-toggle" id="menu-toggle" aria-controls="main-navigation" aria-expanded="false" aria-label="${c.menu}" data-label="menu">${icon('menu')}</button></div>
 </div></header>
 <main id="main">
  <section class="hero"><div class="container hero-grid">
   <div class="hero-copy"><p class="eyebrow hero-eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${text('eyebrow')}</p><h1>${text('hero1')}${text('hero2')}${text('hero3','span','hero-accent')}</h1>${text('heroText','p','hero-description')}<div class="hero-actions">${cta()}<a class="button button-secondary" href="#como-funciona">${text('discover')}${icon('down')}</a></div>${text('heroNote','p','hero-note')}</div>
   <div class="hero-art"><div class="hero-aura" aria-hidden="true"></div><div class="floating-label">${icon('spark')}${text('floatingLabel')}</div><div class="phone hero-phone">${image('home','heroAlt','',true)}</div><div class="floating-shot recent-shot">${image('recent','recentAlt','',true)}</div><div class="floating-shot balance-shot">${image('balance','balanceAlt','',true)}</div>${text('screenNote','p','screen-caption')}</div>
  </div></section>
  <section class="section feature-section" id="caracteristicas"><div class="container"><header class="section-heading reveal">${text('featureEyebrow','p','eyebrow')}${text('featureTitle','h2')}${text('featureText','p','section-description')}</header><div class="feature-grid">${featureCards}</div></div></section>
  <section class="section how-section" id="como-funciona"><div class="container how-shell"><div class="how-copy reveal">${text('howEyebrow','p','eyebrow')}${text('howTitle','h2')}${text('howText','p','section-description')}<div class="steps" role="group" aria-label="${c.stepsLabel}" data-label="stepsLabel">${steps}</div></div><figure class="how-visual reveal"><div class="how-aura" aria-hidden="true"></div><div class="phone step-phone">${image('group','groupAlt','step-image')}</div><figcaption data-copy="screenNote">${c.screenNote}</figcaption></figure></div></section>
  <section class="section scenarios-section" id="planes"><div class="container"><header class="section-heading reveal">${text('plansEyebrow','p','eyebrow')}${text('plansTitle','h2')}${text('plansText','p','section-description')}</header><div class="feature-stories">${featureStories}</div></div></section>
  <section class="section faq-section" id="preguntas"><div class="container faq-layout"><header class="faq-heading reveal">${text('faqEyebrow','p','eyebrow')}${text('faqTitle','h2')}</header><div class="faq-list reveal">${questions}</div></div></section>
  <section class="section final-section"><div class="container cta-box reveal"><p class="eyebrow" data-copy="ctaEyebrow">${c.ctaEyebrow}</p><h2>${text('cta1')}${text('cta2')}</h2>${text('ctaBody','p','cta-description')}${cta('ctaButton','button-white')}</div></section>
 </main>
 <footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-identity"><a class="brand" href="./" aria-label="DivZplit">${brand}</a>${text('footerText','p')}</div><nav aria-label="DivZplit"><h2 data-copy="product">${c.product}</h2><a href="#caracteristicas" data-copy="featuresNav">${c.featuresNav}</a><a href="#como-funciona" data-copy="howNav">${c.howNav}</a><a href="./app/" data-app-link="open" data-copy="openApp">${c.openApp}</a></nav><nav aria-label="Information" data-label="legal"><h2 data-copy="legal">${c.legal}</h2><a href="./privacy/" data-legal="privacy" data-copy="privacy">${c.privacy}</a><a href="./terms/" data-legal="terms" data-copy="terms">${c.terms}</a><a href="mailto:support@divzplit.com" data-copy="contact">${c.contact}</a></nav></div><div class="footer-bottom"><span>© 2026 DivZplit.</span>${text('footerNote')}</div></div></footer>
</body>
</html>
`;
await writeFile(new URL('../index.html',import.meta.url),html);
console.log('Built static, English-first landing with multilingual client copy. No deployment performed.');
