import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {referenceIntro,fontFor} from '../src/design.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('native opening keeps the original web assembly, Z keyframes and handoff durations',()=>{
 const glass=read('../../glass.css'),css=read('../../styles.css'),handoff=read('../../intro-transition.js');
 assert.equal(referenceIntro.assembly,Number(glass.match(/animation:word-left-in ([\d.]+)s/)[1])*1000);
 assert.equal(referenceIntro.z,Number(glass.match(/animation:z-rise ([\d.]+)s/)[1])*1000);
 const rise=css.match(/@keyframes z-rise\{(.+)\}/)[1];
 const stops=[...rise.matchAll(/(\d+)%/g)].map(m=>Number(m[1])).filter(n=>n>0);
 assert.deepEqual(referenceIntro.zStops,stops.map(percent=>percent/100*referenceIntro.z));
 assert.equal(referenceIntro.hold,Number(handoff.match(/setTimeout\(releaseHold,skipped\?0:(\d+)/)[1]));
 assert.equal(referenceIntro.flight,Number(handoff.match(/brand\.animate\(keyframes\(\),\{duration:(\d+)/)[1]));
 assert.equal(referenceIntro.opacityEnd,Number(glass.match(/@keyframes intro-left-contained\{.*?\}(\d+)%\{opacity:1/)[1])/100*referenceIntro.assembly);
});
test('Manrope weights resolve to bundled static faces rather than synthetic Android bold',()=>{
 for(const weight of [400,500,600,700,800,850]){
  const name=fontFor(weight),font=readFileSync(new URL(`../android/app/src/main/assets/fonts/${name}.ttf`,import.meta.url));
  assert.equal(font.readUInt32BE(0),0x00010000);
  const count=font.readUInt16BE(4),tables=Array.from({length:count},(_,i)=>font.toString('ascii',12+i*16,16+i*16));
  assert.ok(tables.includes('glyf'));assert.ok(!tables.includes('fvar'),'Static face required for predictable Android weight mapping');
 }
 assert.equal(fontFor(850),fontFor(800));
});
