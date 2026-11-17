import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptFetcher} from '../src/receipt-transport.mjs';
import {Cloud} from '../../cloud.js';

test('private receipt upload preserves exact JPEG bytes, session headers and cancellation',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 let request;const cloud=new Cloud({url:'https://native-fixture.supabase.co',publishableKey:'sb_publishable_test_fixture'}, {storage,fetcher:receiptFetcher(async(url,options)=>{request={url,options};return new Response('{}');})});
 cloud.user={id:'11111111-1111-4111-8111-111111111111'};cloud.persistSession({access_token:'fixture-session',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600});
 const result=await cloud.uploadReceipt('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',{nativeReceipt:true,type:'image/jpeg',size:4,base64:'/9j/2Q=='});
 assert.deepEqual([...request.options.body],[255,216,255,217]);assert.equal(request.options.headers['Content-Type'],'image/jpeg');assert.equal(request.options.headers.Authorization,'Bearer fixture-session');
 assert.ok(request.options.signal instanceof AbortSignal);assert.equal(request.options.headers['x-upsert'],'false');assert.ok(request.url.endsWith(result.path));
});
test('malformed or oversized image envelopes never reach the network',()=>{
 let calls=0;const fetcher=receiptFetcher(()=>{calls++;});const valid={nativeReceipt:true,type:'image/jpeg',size:3,base64:'AQID'};
 for(const fields of [{size:1048577},{size:0},{size:2},{type:'image/svg+xml'},{base64:'@invalid'}])assert.throws(()=>fetcher('https://example.invalid',{body:{...valid,...fields}}));
 assert.equal(calls,0);
});
test('ordinary JSON requests are forwarded unchanged',async()=>{
 const options={method:'POST',body:'{"title":"Dinner"}'};let received;
 await receiptFetcher(async(url,input)=>{received=input;})('https://example.invalid',options);assert.equal(received,options);
});
