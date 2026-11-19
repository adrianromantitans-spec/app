import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
const imports=source=>[...source.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g)].map(match=>match[1]);
// A new app entry importing the old i18n URL can reuse a cached catalogue: the
// existing Verify button translates, while new signup copy falls back to Spanish.
test('web locale import graph and HTML preloads all use the refreshed shared i18n instance',()=>{
 const entry=read('app/index.html').match(/<script type="module" src="\.\.\/(app\.js\?[^" ]+)"/)[1],urls=new Set(),walk=url=>{if(urls.has(url))return;urls.add(url);for(const child of imports(read(url.split('?')[0])))walk(child.slice(2));};walk(entry);
 const localeURLs=[...urls].filter(url=>url.startsWith('i18n.js'));
 assert.deepEqual(localeURLs,['i18n.js?v=signup-locale-2']);
 for(const url of urls)assert.ok(!url.includes('i18n.js?v=language-90'));
 for(const [,url] of read('app/index.html').matchAll(/rel="modulepreload" href="\.\.\/([^" ]+)"/g))if([...urls].some(u=>u.split('?')[0]===url.split('?')[0]))assert.ok(urls.has(url),'stale preload: '+url);
});
for(const lang of ['es','en','ro'])test('signup instructions, labels, retry and errors all follow '+lang+' even after changing language',()=>{
 const script=`
 globalThis.window={};Object.defineProperty(globalThis,'navigator',{value:{languages:['es-ES']}});globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
 const i18n=await import('./i18n.js?v=signup-locale-2');i18n.setLanguage('${lang}');
 const {translations}=await import('./translations.js');
 const copy=['Confirma tu correo','Introduce el código del correo para confirmar tu cuenta y entrar.','Si el correo puede registrarse, recibirás un código. Revisa también spam.','Código del correo','Verificar código','Reenviar código','Cambiar correo','Espera un minuto antes de reenviar el código.','El código no es válido o ha caducado. Solicita uno nuevo.','No se ha podido verificar el código. Solicita uno nuevo.','Si el correo puede registrarse, hemos enviado otro código. Revisa también spam.'];
 for(const text of copy){const actual=i18n.tr(text),expected='${lang}'==='es'?text:translations[text]['${lang}'];if(actual!==expected)throw Error('Untranslated signup copy: '+text);}
 const {Cloud}=await import('./cloud.js');const cloud=new Cloud({url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'});cloud.pendingSignup={email:'alex@example.test',sentAt:Date.now()};
 try{await cloud.resendSignupCode();throw Error('Expected cooldown');}catch(error){const key='Espera un minuto antes de reenviar el código.';if(error.message!==i18n.tr(key))throw error;}
 `;
 execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8'});
});
