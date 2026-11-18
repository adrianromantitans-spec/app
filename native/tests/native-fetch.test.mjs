import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Cloud,CloudError,mapGroup} from '../../cloud.js';
import {receiptFetcher} from '../src/receipt-transport.mjs';
import * as model from '../../model.js';
const require=createRequire(import.meta.url),NativeRequest=require('whatwg-fetch').Request;
const actor='11111111-1111-4111-8111-111111111111';
const config={url:'https://native-fixture.supabase.co',publishableKey:'sb_publishable_fixture'};
function client(fetcher){const cloud=new Cloud(config,{storage:{getItem:()=>null,setItem(){},removeItem(){}},fetcher});cloud.user={id:actor};cloud.persistSession({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600});return cloud;}
test('the shipped React Native fetch implementation mutates no-store PostgREST GET queries',async()=>{
 const request=new NativeRequest(config.url+'/rest/v1/nexo_groups?select=id',{method:'GET',cache:'no-store'});assert.ok(new URL(request.url).searchParams.has('_'));
 const cloud=client(async(url,options)=>{const request=new NativeRequest(url,options);assert.ok(new URL(request.url).searchParams.has('_'));return new Response(JSON.stringify({code:'PGRST100',message:'failed to parse filter timestamp'}),{status:400});});
 await assert.rejects(cloud.listGroups(),error=>error instanceof CloudError&&error.status===400&&error.code==='PGRST100');
});
test('native adapter retrieves existing groups with the real RN Request and an unchanged REST query',async()=>{
 const group=model.seed().groups[0],document=mapGroup(group,actor,true);let request;
 const cloud=client(receiptFetcher(async(url,options)=>{request=new NativeRequest(url,options);assert.ok(!new URL(request.url).searchParams.has('_'));return new Response(JSON.stringify([{id:group.id,owner_id:actor,version:9,document}]));}));
 const groups=await cloud.listGroups();assert.equal(groups[0].id,group.id);assert.equal(groups[0].remote.version,9);assert.equal(request.headers.get('authorization'),'Bearer fixture-access');assert.equal(request.headers.get('apikey'),config.publishableKey);assert.equal(request.headers.get('cache-control'),'no-store');assert.equal(request.headers.get('pragma'),'no-cache');
 assert.equal(new URL(request.url).searchParams.get('select'),'id,owner_id,document,version');assert.equal(new URL(request.url).searchParams.get('order'),'created_at.asc');
});
test('native cache adaptation preserves abort signal, method, JSON body and receipt bytes',async()=>{
 const controller=new AbortController(),calls=[];const fetcher=receiptFetcher(async(url,options)=>{calls.push(options);return new Response('{}');});
 await fetcher(config.url+'/rest/v1/rpc/save',{method:'POST',cache:'no-store',signal:controller.signal,body:'{"name":"Plan"}',headers:{Authorization:'Bearer fixture'}});
 await fetcher(config.url+'/storage/v1/object/test',{method:'POST',cache:'no-store',signal:controller.signal,body:{nativeReceipt:true,type:'image/jpeg',size:4,base64:'/9j/2Q=='},headers:{'Content-Type':'image/jpeg'}});
 assert.equal(calls[0].body,'{"name":"Plan"}');assert.equal(calls[0].signal,controller.signal);assert.equal(calls[0].method,'POST');assert.ok(!Object.hasOwn(calls[0],'cache'));assert.deepEqual([...calls[1].body],[255,216,255,217]);assert.equal(calls[1].headers['Content-Type'],'image/jpeg');assert.equal(calls[1].signal,controller.signal);
});
