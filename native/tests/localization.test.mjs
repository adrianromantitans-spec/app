import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {nativeCatalog,nativeText,nativeTemplate} from '../src/localization.mjs';
import {NativeController} from '../src/session.mjs';
const require=createRequire(import.meta.url),babel=require('@babel/core');
test('all native static UI calls and conditional labels have complete English and Romanian copy',()=>{
 const keys=new Set();
 const collect=n=>{if(!n)return;if(n.type==='StringLiteral')keys.add(n.value);else if(n.type==='ConditionalExpression'){collect(n.consequent);collect(n.alternate);}else if(n.type==='MemberExpression'&&n.object.type==='ObjectExpression')n.object.properties.forEach(p=>collect(p.value));};
 const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&(n.callee?.name==='t'||n.callee?.property?.name==='t'))collect(n.arguments[0]);for(const value of Object.values(n))Array.isArray(value)?value.forEach(visit):visit(value);};
 for(const file of readdirSync(new URL('../src/',import.meta.url)).filter(f=>/\.(js|mjs)$/.test(f)))visit(babel.parseSync(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{filename:file,babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}}));
 const missing=[...keys].filter(k=>!nativeCatalog[k]?.en||!nativeCatalog[k]?.ro);assert.deepEqual(missing,[]);
});
test('email example, self name and errors adapt to the active language, including already-translated errors',()=>{
 assert.equal(nativeText('tu@correo.com','es'),'tu@correo.com');assert.equal(nativeText('tu@correo.com','en'),'you@example.com');assert.equal(nativeText('tu@correo.com','ro'),'tu@exemplu.ro');
 const key='No se ha podido completar la operación. Comprueba la conexión e inténtalo de nuevo.';
 for(const language of ['es','en','ro'])for(const source of [key,nativeCatalog[key].en,nativeCatalog[key].ro])assert.equal(nativeText(source,language),language==='es'?key:nativeCatalog[key][language]);
 assert.equal(nativeText('Could not register this device','es'),'No se ha podido registrar este dispositivo.');assert.equal(nativeText('Could not register this device','ro'),'Dispozitivul nu a putut fi înregistrat');
});
test('native template values stay opaque and member labels localize only the viewer',()=>{
 assert.equal(nativeTemplate('en',['Te deben ',' personas'],3),'3 people owe you');assert.equal(nativeTemplate('ro',['',' de ',' tareas completadas.'],1,3),'1 din 3 sarcini finalizate.');
 const c=new NativeController({cloud:{user:{id:'owner'}},i18n:{language:'en'},platform:{}});c.update({groups:[{id:'g',members:[{id:'you',name:'Tú'},{id:'other',name:'Guardar'}]}],groupId:'g'});
 assert.equal(c.memberName('you'),'You');assert.equal(c.memberName('owner'),'You');assert.equal(c.memberName('other'),'Guardar');c.i18n.language='ro';assert.equal(c.memberName('you'),'Tu');assert.equal(c.memberName('other'),'Guardar');
});

test('Android locale is used on first launch and an explicit app language survives persistence/restart',async()=>{
 const {installPlatform}=await import('../src/platform.mjs'),names=['window','navigator','localStorage','sessionStorage','location','crypto'],saved=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let stored='{}';
 const native={persist:async json=>{stored=json;}};
 try{
  Object.defineProperty(globalThis,'window',{configurable:true,value:globalThis});
  let platform=installPlatform(native,{locale:'ro-RO',storage:stored});
  const first=await import('../../i18n.js?native-locale-first');assert.equal(first.language,'ro');assert.equal(first.locale,'ro-RO');assert.equal(nativeText('tu@correo.com',first.language),'tu@exemplu.ro');
  first.setLanguage('en');await platform.flush();assert.equal(JSON.parse(stored)['divzplit-language'],'en');
  platform=installPlatform(native,{locale:'ro-RO',storage:stored});const restored=await import('../../i18n.js?native-locale-restored');assert.equal(restored.language,'en');assert.equal(nativeText('tu@correo.com',restored.language),'you@example.com');
  restored.setLanguage('auto');await platform.flush();assert.ok(!Object.hasOwn(JSON.parse(stored),'divzplit-language'));assert.equal(restored.language,'ro');
 }finally{for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
});
