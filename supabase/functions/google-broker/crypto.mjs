export const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const randomToken=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
export const shaBytes=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export const sha=async value=>Array.from(await shaBytes(value),b=>b.toString(16).padStart(2,'0')).join('');
export const s256=async value=>base64url(await shaBytes(value));
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function createSealer(encodedKey){
 if(typeof encodedKey!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(encodedKey))throw Error('Encryption key unavailable');
 const bytes=decode(encodedKey);if(bytes.length!==32)throw Error('Encryption key unavailable');
 const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
 return {
  async seal(value,flowId){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(flowId)},key,new TextEncoder().encode(JSON.stringify(value)));return base64url(iv)+'.'+base64url(new Uint8Array(data));},
  async open(value,flowId){if(typeof value!=='string'||value.length>32768)throw Error('Invalid context');const [iv,data,...extra]=value.split('.');if(extra.length||!iv||!data)throw Error('Invalid context');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(flowId)},key,decode(data));return JSON.parse(new TextDecoder().decode(plain));}
 };
}
