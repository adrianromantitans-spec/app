import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Cloud} from '../cloud.js';
import {landingCopy} from '../landing-copy.js';
const script=await readFile(new URL('../landing-route.js',import.meta.url),'utf8');
function bridge(href,standalone=false){let target=null;const html={};vm.runInNewContext(script,{location:{href,replace:value=>target=value},navigator:{standalone},matchMedia:()=>({matches:standalone}),document:{documentElement:html},URL,URLSearchParams});return {target,hidden:!!html.hidden};}
test('public landing stays public; old app links, notifications and installed launch route to app',()=>{
 for(const url of ['https://example.test/','https://example.test/?lang=ro','https://example.test/#planes','https://example.test/?next=https://evil.test'])assert.deepEqual(bridge(url),{target:null,hidden:false});
 for(const tail of ['#registro','#acceso','#invite='+'a'.repeat(64),'?notification=abc','?source=installed','#access_token=fixture&refresh_token=ignored']){
  const result=bridge('https://example.test/'+tail);assert.equal(result.target,'https://example.test/app/'+tail);assert.equal(result.hidden,true);
 }
 assert.equal(bridge('https://example.test/',true).target,'https://example.test/app/');
 const callback=new URL(bridge('https://example.test/?code=fixture&lang=ro').target);assert.equal(callback.pathname,'/app/');assert.equal(callback.searchParams.get('code'),'fixture');assert.equal(callback.searchParams.get('lang'),'ro');assert.equal(callback.searchParams.get('legacy_auth_return'),'1');
 assert.equal(new URL(bridge('https://example.test/?code=x&next=https://evil.test/').target).origin,'https://example.test');
});
const config={url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
const user={id:'11111111-1111-4111-8111-111111111111',user_metadata:{display_name:'Alex'}};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const response=data=>new Response(JSON.stringify(data));
function client(){const seen=[];const c=new Cloud(config,{storage:storage(),temporaryStorage:storage(),fetcher:async(url,o)=>{seen.push(url);return response(url.includes('/token?')?{access_token:'test',refresh_token:'refresh',expires_in:3600}:url.includes('/recover?')?{}:user);}});return {c,seen};}
test('a legacy root OAuth callback migrates only with its stored PKCE verifier and explicit bridge marker',async()=>{
 for(const [target,allow] of [['https://example.test/app/',false],['https://evil.test/app/',true],['https://example.test/other/',true]]){
  const {c,seen}=client();await c.oauthURL('google','https://example.test/');await assert.rejects(()=>c.finishOAuth('?code=fixture',target,{allowLegacyRoot:allow}));assert.equal(seen.length,0);
 }
 const {c,seen}=client();await c.oauthURL('google','https://example.test/');assert.equal(await c.finishOAuth('?code=fixture','https://example.test/app/',{allowLegacyRoot:true}),true);assert.equal(c.user.id,user.id);assert.ok(seen[0].includes('grant_type=pkce'));
 await assert.rejects(()=>c.finishOAuth('?code=fixture','https://example.test/app/',{allowLegacyRoot:true}));
});
test('legacy password recovery can migrate while keeping recovery-only authorization',async()=>{
 const {c}=client();await c.recoverPassword('fixture@example.test','https://example.test/');assert.equal(await c.finishOAuth('?code=fixture','https://example.test/app/',{allowLegacyRoot:true}),true);assert.equal(c.recovering,true);
});
test('landing copy is complete in the three supported languages and app identity remains stable',async()=>{
 const keys=Object.keys(landingCopy.es).sort();for(const language of ['en','ro']){assert.deepEqual(Object.keys(landingCopy[language]).sort(),keys);for(const value of Object.values(landingCopy[language]))assert.ok(value.trim().length);}
 const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./app/');assert.equal(manifest.start_url,'./app/?source=installed');
});
