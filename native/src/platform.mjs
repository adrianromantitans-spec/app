const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes){let result='';for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b||0)<<8)|(c||0);result+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(b===undefined?'=':alphabet[(n>>>6)&63])+(c===undefined?'=':alphabet[n&63]);}return result;}
export function fromBase64(value){const bytes=[];let buffer=0,bits=0;for(const c of value.replace(/=+$/,'')){const n=alphabet.indexOf(c);if(n<0)throw new Error('Invalid base64');buffer=(buffer<<6)|n;bits+=6;if(bits>=8){bits-=8;bytes.push((buffer>>>bits)&255);}}return Uint8Array.from(bytes);}
export function installPlatform(native,initial){
 const values=new Map(Object.entries(JSON.parse(initial.storage||'{}')));let pending=Promise.resolve(),failure=null;
 const persist=()=>{const json=JSON.stringify(Object.fromEntries(values));pending=pending.then(()=>native.persist(json)).catch(error=>{failure=error;});};
 const store=prefix=>({getItem:key=>values.get(prefix+key)??null,setItem:(key,value)=>{values.set(prefix+key,String(value));persist();},removeItem:key=>{values.delete(prefix+key);persist();}});
 globalThis.localStorage=store('');globalThis.sessionStorage=store('temporary:');
 const nav=globalThis.navigator||{};
 Object.defineProperty(nav,'languages',{configurable:true,value:[initial.locale||'en-US']});
 Object.defineProperty(nav,'language',{configurable:true,value:initial.locale||'en-US'});
 if(!globalThis.navigator)globalThis.navigator=nav;
 globalThis.location={href:'https://divzplit.com/app/?source=installed'};
 globalThis.structuredClone??=value=>JSON.parse(JSON.stringify(value));
 globalThis.btoa??=value=>toBase64(Uint8Array.from(value,c=>c.charCodeAt(0)));
 globalThis.atob??=value=>String.fromCharCode(...fromBase64(value));
 globalThis.TextEncoder??=class {encode(value){const out=[];for(const c of String(value)){const cp=c.codePointAt(0);if(cp<128)out.push(cp);else if(cp<2048)out.push(192|(cp>>6),128|(cp&63));else if(cp<65536)out.push(224|(cp>>12),128|((cp>>6)&63),128|(cp&63));else out.push(240|(cp>>18),128|((cp>>12)&63),128|((cp>>6)&63),128|(cp&63));}return Uint8Array.from(out);}};
 const randomValues=array=>{if(!ArrayBuffer.isView(array)||array.byteLength>65536)throw new Error('Invalid secure random request');new Uint8Array(array.buffer,array.byteOffset,array.byteLength).set(fromBase64(native.randomBase64(array.byteLength)));return array;};
 const randomUUID=()=>{const b=randomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
 const crypto={getRandomValues:randomValues,randomUUID,subtle:{async digest(name,bytes){if(name!=='SHA-256')throw new Error('Unsupported digest');return fromBase64(await native.sha256(toBase64(new Uint8Array(bytes.buffer||bytes,bytes.byteOffset||0,bytes.byteLength)))).buffer;}}};
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:crypto});
 return {storage:globalThis.localStorage,temporaryStorage:globalThis.sessionStorage,async flush(){await pending;if(failure){const error=failure;failure=null;throw error;}}};
}
