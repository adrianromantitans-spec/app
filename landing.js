import {landingCopy} from './landing-copy.js?v=visual-53';
import {detectLanguage,languagePreferences,rememberLanguage} from './language.js?v=landing-51';
let currentLanguage=detectLanguage(languagePreferences());
const languageSelect=document.querySelector('#landing-language');
const header=document.querySelector('#site-header');
const menu=document.querySelector('#main-navigation');
const toggle=document.querySelector('#menu-toggle');
let activeStep='group';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function setShot(image,language){
 const name=image.dataset.appShot,base=new URL('./assets/landing/'+language+'-'+name,import.meta.url).href;
 const width=Number(image.getAttribute('width'))||393;
 image.src=base+'.webp?v=visual-53';image.srcset=base+'.webp?v=visual-53 '+width+'w, '+base+'-2x.webp?v=visual-53 '+width*2+'w';
 if(image.dataset.alt)image.alt=landingCopy[language][image.dataset.alt];
}
export function applyLanguage(language){
 if(!Object.hasOwn(landingCopy,language))return;
 currentLanguage=language;const copy=landingCopy[language];document.documentElement.lang=language;document.title=copy.title;
 for(const element of document.querySelectorAll('[data-copy]')){const value=copy[element.dataset.copy];if(value!==undefined)element.textContent=value;}
 for(const element of document.querySelectorAll('[data-label]'))element.setAttribute('aria-label',copy[element.dataset.label]);
 document.querySelector('meta[name=description]').content=copy.description;
 document.querySelector('meta[property="og:title"]').content=copy.title;
 document.querySelector('meta[property="og:description"]').content=copy.description;
 document.querySelector('meta[property="og:image:alt"]').content=copy.heroAlt;
 document.querySelector('meta[property="og:locale"]').content={es:'es_ES',en:'en_GB',ro:'ro_RO'}[language];
 for(const image of document.querySelectorAll('[data-app-shot]'))setShot(image,language);
 for(const link of document.querySelectorAll('[data-app-link]')){const url=new URL('./app/',location.href);url.searchParams.set('lang',language);url.hash={signup:'registro',login:'acceso',open:''}[link.dataset.appLink]||'';link.href=url.href;}
 for(const link of document.querySelectorAll('[data-legal]'))link.href=new URL('./'+(link.dataset.legal==='privacy'?'privacidad':'condiciones')+'/',location.href).href;
 languageSelect.value=language;
}
applyLanguage(currentLanguage);
languageSelect.addEventListener('change',()=>{const language=languageSelect.value;rememberLanguage(language);applyLanguage(language);const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url.pathname+url.search+url.hash);});
function closeMenu(){menu.removeAttribute('data-open');toggle.setAttribute('aria-expanded','false');}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));if(open)menu.dataset.open='true';else menu.removeAttribute('data-open');});
menu.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('click',event=>{if(!header.contains(event.target))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
const onScroll=()=>header.classList.toggle('is-scrolled',scrollY>12);window.addEventListener('scroll',onScroll,{passive:true});onScroll();
for(const button of document.querySelectorAll('[data-step]'))button.addEventListener('click',()=>{
 activeStep=button.dataset.step;
 for(const step of document.querySelectorAll('[data-step]'))step.setAttribute('aria-pressed',String(step===button));
 const image=document.querySelector('.step-image');image.dataset.appShot=activeStep;image.dataset.alt={group:'groupAlt',expense:'expenseAlt',settlements:'settlementsAlt'}[activeStep];setShot(image,currentLanguage);
 if(!reduced.matches&&image.animate)image.animate([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});
});
if('IntersectionObserver' in window&&!reduced.matches){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.remove('is-waiting');entry.target.classList.add('is-visible');observer.unobserve(entry.target);}},{threshold:.08});
 for(const element of document.querySelectorAll('.reveal')){if(element.getBoundingClientRect().top>innerHeight){element.classList.add('is-waiting');observer.observe(element);}}
}
