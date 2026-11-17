import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {installPlatform,toBase64,fromBase64} from '../src/platform.mjs';

test('binary certificate/PKCE buffers round trip without Unicode corruption',()=>{
 for(const length of [0,1,2,3,32,255,1024]){const bytes=randomBytes(length);assert.equal(toBase64(bytes),bytes.toString('base64'));assert.deepEqual(Buffer.from(fromBase64(toBase64(bytes))),bytes);}
});
test('native platform preserves sessions, serializes persistence, and computes real SHA-256',async()=>{
 const names=['crypto','localStorage','sessionStorage','location','navigator'];const saved=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const writes=[];const native={persist:async value=>writes.push(JSON.parse(value)),randomBase64:n=>randomBytes(n).toString('base64'),sha256:async value=>createHash('sha256').update(Buffer.from(value,'base64')).digest('base64')};
 try{
  const p=installPlatform(native,{storage:'{"session":"existing","temporary:pkce":"verifier"}',locale:'ro-RO'});
  assert.equal(p.storage.getItem('session'),'existing');assert.equal(p.temporaryStorage.getItem('pkce'),'verifier');
  p.storage.setItem('session','new');p.temporaryStorage.removeItem('pkce');await p.flush();
  assert.equal(writes.length,2);assert.equal(writes.at(-1).session,'new');assert.equal(writes.at(-1)['temporary:pkce'],undefined);
  assert.match(crypto.randomUUID(),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('abc'))).toString('hex'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  native.persist=async()=>{throw new Error('Storage unavailable');};p.storage.setItem('session','failed');await assert.rejects(p.flush(),/Storage unavailable/);
 }finally{for(const name of names){if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}}
});
