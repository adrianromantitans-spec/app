import test from 'node:test';
import assert from 'node:assert/strict';
import {languagePreferences,detectLanguage,rememberLanguage} from '../language.js';
test('shared language selection respects browser preferences, explicit selection and storage restrictions',()=>{
 const names=['window','navigator','localStorage','location'],saved=new Map(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let stored=null;
 try{
  for(const [name,value] of Object.entries({window:{},navigator:{languages:['fr-FR','ro-RO']},localStorage:{getItem:()=>stored,setItem:(k,v)=>stored=v,removeItem:()=>stored=null},location:{href:'https://example.test/'}}))Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
  assert.equal(detectLanguage(languagePreferences()),'ro');assert.equal(rememberLanguage('en'),true);assert.equal(detectLanguage(languagePreferences()),'en');
  location.href='https://example.test/app/?lang=es';assert.equal(detectLanguage(languagePreferences()),'es');
  assert.equal(rememberLanguage('invalid'),false);assert.equal(stored,'en');
  location.href='https://example.test/';assert.equal(rememberLanguage('auto'),true);assert.equal(stored,null);assert.equal(detectLanguage(languagePreferences()),'ro');
  location.href='https://example.test/';localStorage.getItem=()=>{throw new Error('blocked');};assert.equal(detectLanguage(languagePreferences()),'ro');
 }finally{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});
