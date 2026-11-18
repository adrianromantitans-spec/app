import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openingZFrames} from '../src/opening-motion.mjs';
import {gradientBounds,referenceSurface,introSize,referenceIntro,homeAmountSize} from '../src/design.mjs';
import {navigationDirection} from '../src/dock-motion.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('the native Z has the original CSS keyframes on one continuous eased timeline',()=>{
 const frames=openingZFrames(),css=read('../../styles.css');
 for(const [time,y,rotate,scale,opacity] of [[0,45,85,.8,0],[.25,45,85,.8,0],[.38,34,75,.9,1],[.76,-5,-9,1,1],[.9,1,3,1,1],[1,0,0,1,1]]){
  const i=frames.inputRange.findIndex(t=>Math.abs(t-time)<1e-8);assert.ok(i>=0);assert.equal(frames.y[i],y);assert.equal(frames.rotate[i],rotate+'deg');assert.equal(frames.scale[i],scale);assert.equal(frames.opacity[i],opacity);
 }
 assert.match(css,/transform-origin:50% 85%/);assert.ok(frames.inputRange.every((v,i)=>i===0||v>frames.inputRange[i-1]));
 const mid=frames.inputRange.findIndex(v=>Math.abs(v-(.38+.76)/2)<1e-8);assert.ok(frames.y[mid]<14.5,'Per-keyframe website easing must not become linear');
 assert.equal(referenceIntro.z,1550);assert.equal(referenceIntro.flight,1161);
});
test('native surfaces retain the measured web palette, dock geometry and navigation spring',()=>{
 const css=read('../../refined.css').toLowerCase(),dock=read('../../dock-effects.js');
 for(const color of [...referenceSurface.credit,...referenceSurface.debt,referenceSurface.paid])assert.ok(css.includes(color.toLowerCase()),color);
 assert.ok(dock.includes('(68-width)*amount'));assert.ok(dock.includes('(72-12*amount)'));assert.ok(dock.includes('6*amount'));assert.ok(dock.includes('280'));assert.ok(dock.includes('Math.sqrt(420-damping*damping)'));
 assert.equal(referenceSurface.dock.compactWidth,68);assert.equal(referenceSurface.dock.compactHeight,60);assert.equal(referenceSurface.dock.stiffness,420);assert.equal(referenceSurface.dock.damping,36);
});
test('numeric SVG gradient bounds preserve CSS angle on a wide card rather than stretching a square gradient',()=>{
 for(const [w,h,angle] of [[353,142,125],[357,72,135],[52,52,145]]){
  const g=gradientBounds(w,h,angle);assert.ok(Math.abs(g.x1+g.x2-w)<1e-8);assert.ok(Math.abs(g.y1+g.y2-h)<1e-8);
  const measured=Math.atan2(g.x2-g.x1,-(g.y2-g.y1))*180/Math.PI;assert.ok(Math.abs(measured-angle)<1e-8);
 }
 assert.equal(introSize(320),37);assert.ok(Math.abs(introSize(393)-39.3)<1e-8);assert.equal(introSize(600),48);assert.equal(introSize(800),52);
});
test('primary page entry follows the website route direction and secondary routes keep their existing entry',()=>{
 assert.equal(navigationDirection('home','profile'),1);assert.equal(navigationDirection('profile','groups'),-1);assert.equal(navigationDirection('activity','activity'),0);assert.equal(navigationDirection('shopping','home'),0);
});

test('balance digits follow the nested mobile web font rule rather than the larger wrapper',()=>{assert.equal(homeAmountSize(320),34);assert.equal(homeAmountSize(393),37);assert.equal(homeAmountSize(430),37);assert.equal(homeAmountSize(800),40);});
