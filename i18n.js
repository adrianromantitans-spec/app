import {translations} from './translations.js?v=glass-8';

const supported=new Set(['es','en','ro']);
export function detectLanguage(preferences=[]) {
  for(const preference of preferences){if(typeof preference!=='string')continue;const base=preference.toLowerCase().split(/[-_]/)[0];if(supported.has(base))return base;}
  return 'en';
}
const preferences=typeof window==='undefined'?['es-ES']:(navigator.languages?.length?navigator.languages:[navigator.language]);
export const language=detectLanguage(preferences);
export const locale=(()=>{
  for(const preference of preferences){if(typeof preference!=='string'||preference.toLowerCase().split(/[-_]/)[0]!==language)continue;try{if(Intl.DateTimeFormat.supportedLocalesOf([preference]).length)return preference;}catch{/* use a valid locale below */}}
  return {es:'es-ES',en:'en-GB',ro:'ro-RO'}[language];
})();
export const languageName={es:'español',en:'English',ro:'română'}[language];
const slot=/__DZ_SLOT_\d+__/g;
function translateText(input) {
  if(language==='es')return input;
  const leading=input.match(/^\s*/)[0],trailing=input.match(/\s*$/)[0];const core=input.trim();if(!core)return input;
  const tokens=[];const key=core.replace(slot,value=>`{${tokens.push(value)-1}}`);
  const translated=translations[key]?.[language];
  if(translated!==undefined)return leading+translated.replace(/\{(\d+)\}/g,(_,i)=>tokens[i]??`{${i}}`)+trailing;
  // Icons and dynamic values remain opaque. Translate only the surrounding static copy.
  return input.split(/(__DZ_SLOT_\d+__)/).map(part=>{
    if(/^__DZ_SLOT_\d+__$/.test(part))return part;
    const text=part.trim();if(!text)return part;
    const value=translations[text]?.[language];return value===undefined?part:part.slice(0,part.indexOf(text))+value+part.slice(part.indexOf(text)+text.length);
  }).join('');
}
const escapeText=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function translateMarkup(source) {
  if(language==='es')return source;
  // Localize text and accessible labels, never value, data-*, URLs or form field names.
  return source.replace(/<[^>]*>|[^<]+/g,token=>token.startsWith('<')?
    token.replace(/(\b(?:aria-label|placeholder|alt|title)=)(["'])(.*?)\2/g,(_,prefix,quote,value)=>prefix+quote+escapeText(translateText(value)).replace(/"/g,'&quot;').replace(/'/g,'&#39;')+quote):
    escapeText(translateText(token)));
}
export function tr(source) {return typeof source==='string'?(source.includes('<')?translateMarkup(source):translateText(source)):source;}
// Translate static template segments BEFORE inserting values. A group's name or
// expense title is never looked up in a translation catalog, even if it matches UI copy.
export function ui(strings,...values) {
  const source=strings.map((s,i)=>s+(i<values.length?`__DZ_SLOT_${i}__`:'')).join('');
  const result=source.includes('<')?translateMarkup(source):translateText(source);
  return result.replace(slot,key=>String(values[Number(key.match(/\d+/)[0])]));
}
export function initializeLanguage() {
  document.documentElement.lang=language;
  document.title='DivZplit — '+tr('Lo mejor pasa juntos');
  const description=document.querySelector('meta[name=description]');if(description)description.content=tr('DivZplit: los planes, gastos, votaciones y tareas de tu grupo, en un mismo lugar.');
  const skip=document.querySelector('.skip-link');if(skip)skip.textContent=tr('Saltar al contenido');
}
