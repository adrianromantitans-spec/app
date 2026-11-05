export const supportedLanguages=['es','en','ro'];
export function detectLanguage(preferences=[]){
 for(const preference of preferences){if(typeof preference!=='string')continue;const base=preference.toLowerCase().split(/[-_]/)[0];if(supportedLanguages.includes(base))return base;}
 return 'en';
}
export function languagePreferences(){
 if(typeof window==='undefined')return ['es-ES'];
 const preferences=navigator.languages?.length?[...navigator.languages]:[navigator.language];
 try{const stored=localStorage.getItem('divzplit-language');if(supportedLanguages.includes(stored))preferences.unshift(stored);}catch{/* language selection still works in memory */}
 let requested=null;try{requested=new URL(globalThis.location?.href||'https://divzplit.invalid/').searchParams.get('lang');}catch{/* ignore malformed embedding URLs */}if(supportedLanguages.includes(requested))preferences.unshift(requested);
 return preferences;
}
export function languageSelection(){
 try{const stored=localStorage.getItem('divzplit-language');return supportedLanguages.includes(stored)?stored:'auto';}catch{return 'auto';}
}
export function rememberLanguage(language){
 if(language!=='auto'&&!supportedLanguages.includes(language))return false;
 try{if(language==='auto')localStorage.removeItem('divzplit-language');else localStorage.setItem('divzplit-language',language);return true;}catch{return false;}
}
