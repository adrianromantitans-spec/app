import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the real frame callback with controlled timestamps, without relying
// on a headless browser's display refresh rate or changing the module's API.
const source=readFileSync(new URL('../dock-effects.js',import.meta.url),'utf8');
const tick=source.slice(source.indexOf('function tick(time){'),source.indexOf('\nfunction expand('));
function simulation(){
 const state={frame:0,previousTime:1000,amount:0,amountTarget:0,amountVelocity:0,
  lensAmount:1,lensTarget:1,lensVelocity:0,lensX:0,lensXTarget:100,
  view:{geometry:{left:0,top:0,width:360,height:72},lens:{style:{}},copy:{style:{}}},
  clamp:(x,min,max)=>Math.max(min,Math.min(max,x)),layout(){},schedule(){}};
 vm.createContext(state);vm.runInContext(tick,state);return state;
}
for(const hz of [60,90,120,144]){
 const state=simulation();
 for(let frame=1;frame<=hz/10;frame++){
  state.tick(1000+frame*1000/hz);
  const expected=100*(1-Math.pow(1-32/60,frame*60/hz));
  assert.ok(Math.abs(state.lensX-expected)<1e-8,`Position depends on frame rate: ${hz} Hz`);
 }
}
// Equal pointer speed must produce the same stretch, even when each high-Hz
// frame covers fewer pixels. Calibrate against the existing 60 Hz appearance.
const sizes=[];
for(const hz of [60,120]){
 const state=simulation(),dt=1/hz,delta=2*60/hz;
 state.lensXTarget=delta/(1-Math.pow(1-32/60,dt*60));
 state.tick(1000+1000/hz);sizes.push(state.view.lens.style);
}
for(const property of ['width','height'])assert.ok(Math.abs(parseFloat(sizes[0][property])-parseFloat(sizes[1][property]))<1e-8,`${property} depends on Hz`);
const state=simulation();state.tick(1000);
assert.ok(Number.isFinite(parseFloat(state.view.lens.style.width)),'Repeated timestamps must remain finite');
state.tick(61000);
assert.ok(Number.isFinite(state.lensX),'A suspended frame must remain finite');
assert.ok(state.lensX>=0&&state.lensX<=100,'Resuming must not overshoot the target');
console.log('PASS dock timing at 60/90/120/144 Hz, equal-speed stretch, repeated timestamps and suspension');
