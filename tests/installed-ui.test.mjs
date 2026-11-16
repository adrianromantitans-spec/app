import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../installed-ui.js',import.meta.url),'utf8');
function launch({href='https://divzplit.com/app/',mode='browser',ios=false}={}){
 const attributes={},meta=[];
 vm.runInNewContext(source,{URL,location:{href},navigator:{standalone:ios},
  matchMedia:query=>({matches:query===`(display-mode: ${mode})`}),
  document:{documentElement:{setAttribute:(key,value)=>attributes[key]=value},
   createElement:()=>({}),head:{append:element=>meta.push(element)}}});
 return {attributes,meta};
}
test('installed launches opt out of browser translation without changing language selection',()=>{
 for(const settings of [{href:'https://divzplit.com/app/?source=installed&lang=ro'},{mode:'standalone'},{mode:'fullscreen'},{ios:true}]){
  const result=launch(settings);
  assert.deepEqual(result.attributes,{translate:'no'});
  assert.equal(result.meta.length,1);assert.equal(result.meta[0].name,'google');assert.equal(result.meta[0].content,'notranslate');
  assert.equal(result.attributes.lang,undefined);
 }
});
test('ordinary browser visits retain translation, including every app language',()=>{
 for(const lang of ['es','en','ro'])assert.deepEqual(launch({href:`https://divzplit.com/app/?lang=${lang}`}),{attributes:{},meta:[]});
});
test('the installed-only hint loads before the application entry, with a static route',()=>{
 const html=readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
 assert.ok(html.indexOf('src="../installed-ui.js?')<html.indexOf('src="../app.js?'));
 assert.match(readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),/'installed-ui.js'/);
 assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/installed-ui\.js/);
});
