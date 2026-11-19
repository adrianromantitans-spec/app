import test from 'node:test';
import assert from 'node:assert/strict';
import {Cloud} from '../../cloud.js';
import {NativeController} from '../src/session.mjs';
import {receiptFetcher} from '../src/receipt-transport.mjs';
const config={url:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
test('native registration obtains CAPTCHA without exposing email/password to the challenge view',async()=>{
 const calls=[],bridge=[];
 const cloud=new Cloud(config,{storage:{getItem:()=>null,setItem(){},removeItem(){}},fetcher:receiptFetcher(async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  return Response.json(body.gotrue_meta_security?{user:{id:'pending'}}:{error_code:'captcha_failed'},{status:body.gotrue_meta_security?200:400});
 })});
 const c=new NativeController({cloud,i18n:{language:'ro'},platform:{async flush(){}},native:{async authCaptcha(...args){bridge.push(args);return 'fixture-native-token';}}});
 assert.equal(await c.register({email:'test@example.test',password:'fictional-password',name:'Alex',accepted:true,ageBand:'16_or_over'}),false);
 assert.deepEqual(bridge,[['ro']]);assert.equal(calls.length,2);assert.equal(calls[1].body.gotrue_meta_security.captcha_token,'fixture-native-token');
 assert.equal(cloud.pendingSignup.email,'test@example.test');assert.equal(c.state.busy,false);assert.equal(c.state.error,'');assert.equal(cloud.session,null);
});
