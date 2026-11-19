import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnstileHandler} from '../supabase/functions/oauth-turnstile/verify.mjs';
import {protectedGoogleURL,turnstileToken,protectionCopy,loadTurnstile} from '../oauth-protection.js';
const origin='https://divzplit.com',challenge='A'.repeat(43),clock=Date.parse('2026-11-19T12:00:00Z');
const request=(body={},options={})=>new Request('https://fixture.supabase.co/functions/v1/oauth-turnstile',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...options.headers},body:JSON.stringify({token:'fictional-challenge-token',codeChallenge:challenge,redirectTo:origin+'/',...body}),...options});
function fixture(overrides={}){
 const seen=[],logs=[],tokens=new Set();let claims={success:true,hostname:'divzplit.com',action:'google_oauth',cdata:challenge,challenge_ts:new Date(clock-1000).toISOString()};
 const h=createTurnstileHandler({secret:'fixture-server-secret',supabaseURL:'https://fixture.supabase.co',now:()=>clock,
  reserve:async(token,flow)=>{seen.push({token,flow});if(tokens.has(token))return 'replay';tokens.add(token);return 'reserved';},
  fetcher:async(url,o)=>{seen.push({url,body:JSON.parse(o.body)});return Response.json(claims);},log:e=>logs.push(e),...overrides});
 return {h,seen,logs,setClaims:value=>claims=value};
}
test('Siteverify validates action, hostname, age and PKCE context and exposes no secret or hook grant',async()=>{
 const f=fixture(),r=await f.h(request()),body=await r.json();assert.equal(r.status,200);const url=new URL(body.authorizeUrl);
 assert.equal(url.origin,'https://fixture.supabase.co');assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('redirect_to'),origin+'/');assert.equal(url.searchParams.get('code_challenge'),challenge);assert.equal(url.searchParams.get('code_challenge_method'),'s256');
 assert.equal(f.seen[0].token.length,64);assert.equal(f.seen[0].flow.length,64);assert.equal(f.seen[1].url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(f.seen[1].body.secret,'fixture-server-secret');assert.ok(!('remoteip' in f.seen[1].body));
 assert.deepEqual(Object.keys(body),['authorizeUrl']);assert.ok(!JSON.stringify(f.logs).includes('fictional'));assert.ok(!JSON.stringify(f.logs).includes('fixture-server-secret'));assert.equal(r.headers.get('cache-control'),'no-store');
});
test('missing/invalid proof context and arbitrary redirect destinations are rejected before Siteverify',async()=>{
 for(const body of [{token:''},{token:'x'.repeat(2049)},{codeChallenge:'bad'},{redirectTo:'https://evil.example/'},{redirectTo:origin+'/?next=evil'},{email:'victim@example.test'},{captcha_verified:true}]){
  const f=fixture(),r=await f.h(request(body));assert.equal(r.status,400);assert.equal(f.seen.length,0);
 }
 const f=fixture(),r=await f.h(request({}, {headers:{Origin:'https://evil.example','Content-Type':'application/json'}}));assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(f.seen.length,0);
});
test('wrong/failed/expired Siteverify claims fail closed',async()=>{
 for(const fields of [{success:false},{hostname:'evil.example'},{hostname:'sub.divzplit.com'},{action:'other_action'},{cdata:'B'.repeat(43)},{challenge_ts:new Date(clock-301000).toISOString()},{challenge_ts:new Date(clock+31000).toISOString()},{challenge_ts:null}]){
  const f=fixture();f.setClaims({success:true,hostname:'divzplit.com',action:'google_oauth',cdata:challenge,challenge_ts:new Date(clock).toISOString(),...fields});assert.equal((await f.h(request())).status,400);
 }
});
test('durable reservations stop concurrent/replayed token verification, even if Siteverify would succeed twice',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:12},()=>f.h(request())));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,11);assert.equal(f.seen.filter(r=>r.url).length,1);
});
test('database limits/outages and Cloudflare outages never fail open',async()=>{
 for(const [override,status] of [[{reserve:async()=> 'rate_limited'},429],[{reserve:async()=>{throw Error('private db details');}},503],[{fetcher:async()=>{throw Error('private network details');}},503],[{fetcher:async()=>new Response('down',{status:500})},503],[{secret:''},503],[{fetcher:async()=>Response.json({success:false,'error-codes':['invalid-input-secret']})},503]]){
  const f=fixture(override),r=await f.h(request());assert.equal(r.status,status);assert.ok(!(await r.text()).includes('private'));if(status===429)assert.equal(r.headers.get('retry-after'),'60');
 }
});
test('preflight rejects oversized streamed payloads and allows only bounded JSON POST and CORS OPTIONS',async()=>{
 const f=fixture(),large=new Request('https://fixture.supabase.co/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'x'.repeat(8193)});assert.equal((await f.h(large)).status,413);
 for(const [method,status] of [['GET',405],['OPTIONS',204]])assert.equal((await f.h(new Request('https://fixture.supabase.co/',{method,headers:{Origin:origin}}))).status,status);
 assert.equal(f.seen.length,0);
});
const cloud={config:{url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'}},settings={enabled:true,siteKey:'0x4AAAAAAGIzOswUgGy61ea9'},authURL='https://fixture.supabase.co/auth/v1/authorize?'+new URLSearchParams({provider:'google',redirect_to:origin+'/',code_challenge:challenge,code_challenge_method:'s256'});
const host=()=>({ownerDocument:{createElement:()=>({setAttribute(){}})},replaceChildren(){}});
test('disabled preflight preserves legacy browser/TWA redirects without loading a challenge',async()=>{
 assert.equal(await protectedGoogleURL({authorizeURL:authURL,settings:{enabled:false},token:()=>{throw Error();}}),authURL);
});
test('enabled browser preflight sends only the token and PKCE context and accepts only its exact original URL',async()=>{
 let sent,widget;const url=await protectedGoogleURL({cloud,authorizeURL:authURL,settings,host:host(),token:async o=>{widget=o;return 'local-test-token';},fetcher:async(url,o)=>{sent={url,...o};return Response.json({authorizeUrl:authURL});}});
 assert.equal(url,authURL);assert.equal(widget.challenge,challenge);assert.deepEqual(JSON.parse(sent.body),{token:'local-test-token',codeChallenge:challenge,redirectTo:origin+'/'});assert.ok(!sent.headers.Authorization);
 await assert.rejects(protectedGoogleURL({cloud,authorizeURL:authURL,settings,host:host(),token:async()=> 'local-test-token',fetcher:async()=>Response.json({authorizeUrl:'https://evil.example/'})}));
});
test('widget and server failures are localized in ES/EN/RO and cannot return an OAuth URL',async()=>{
 for(const language of ['es','en','ro'])for(const status of [400,429,503])await assert.rejects(protectedGoogleURL({cloud,authorizeURL:authURL,settings,host:host(),language,token:async()=> 'local-test-token',fetcher:async()=>new Response('{}',{status})}),e=>e.message===protectionCopy[status===429?'wait':'retry'][language]);
});
test('widget cleanup covers success, expired/error callbacks and cancellation while loading',async()=>{
 for(const outcome of ['callback','expired-callback','error-callback']){
  let options,removed=0;const p=turnstileToken({host:host(),siteKey:settings.siteKey,challenge,language:'ro',load:async()=>({render:(host,o)=>{options=o;return 'widget';},remove:()=>removed++})});
  await new Promise(r=>setImmediate(r));assert.equal(options.cData,challenge);assert.equal(options.action,'google_oauth');assert.equal(options.language,'ro');options[outcome]('local-test-token');if(outcome==='callback')assert.equal(await p,'local-test-token');else await assert.rejects(p);assert.equal(removed,1);
 }
 const controller=new AbortController();let render=0,complete;const pending=turnstileToken({host:host(),signal:controller.signal,load:()=>new Promise(resolve=>{complete=resolve;})});await new Promise(r=>setImmediate(r));controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');complete({render(){render++;},remove(){}});await new Promise(r=>setImmediate(r));assert.equal(render,0);
});

test('async explicit widget loading resolves on script load without calling incompatible ready()',async()=>{
 let script,calls=0;const window={},document={createElement:()=>({remove(){}}),head:{append(value){script=value;}}};
 const loaded=loadTurnstile({document,window});assert.equal(script.src,'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');assert.equal(script.referrerPolicy,'no-referrer');
 assert.equal(script.async,true);assert.equal(script.defer,true);
 window.turnstile={render(){},ready(){calls++;throw Error('[Cloudflare Turnstile] Remove async/defer from the Turnstile api.js script tag before using turnstile.ready()..');}};
 let done=false;loaded.then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);
 script.onload();assert.equal(await loaded,window.turnstile);assert.equal(calls,0);
 assert.equal(await loadTurnstile({document,window}),window.turnstile);assert.equal(calls,0);
});
