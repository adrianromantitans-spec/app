import test from 'node:test';
import assert from 'node:assert/strict';
import {euroAmount,validQuote} from '../fx.js';
import {currencies,currencyScale,currencyDigits,money,decimalUnits,balances,addExpense,seed} from '../model.js';
import {optionalBudget} from '../planning.js';
import {parseEcb,parseFallback,createRateHandler,ECB_URL,FALLBACK_URL} from '../supabase/functions/exchange-rates/rates.mjs';
const today='2026-11-01',now=Date.parse(today+'T12:00:00Z');
const xml="<Envelope><Cube><Cube time='2026-10-30'><Cube currency='RON' rate='5.3447'/><Cube currency='USD' rate='1.1172'/></Cube></Cube></Envelope>";
const fallback={result:'success',base_code:'EUR',time_last_update_unix:now/1000,rates:{UAH:50.797859,RON:5.342671,USD:1.116626}};
test('all requested currencies preserve minor units; ISK is integral while others retain cents',()=>{
 for(const code of ['EUR','RON','USD','GBP','CHF','PLN','CZK','HUF','SEK','DKK','NOK','ISK','ALL','BAM','MKD','RSD','MDL','UAH','RUB','BYN','TRY','GEL','AMD','AZN','GIP']){
  assert.ok(currencies.includes(code));assert.equal(decimalUnits('123',code),123*currencyScale(code));
  assert.equal(optionalBudget('123',code),123*currencyScale(code));
  assert.equal(money(123*currencyScale(code),code),new Intl.NumberFormat('es-ES',{style:'currency',currency:code,minimumFractionDigits:currencyDigits(code),maximumFractionDigits:currencyDigits(code)}).format(123));
 }
 assert.throws(()=>decimalUnits('1.5','ISK'));assert.throws(()=>optionalBudget('1.5','ISK'));
 const g=seed().groups[0];g.expenses=[];g.payments=[];g.currency='ISK';addExpense(g,{title:'Cena',amount:100,payer:'you',participants:['you','marta','pablo'],category:'Comida',date:today});assert.equal(Object.values(balances(g)).reduce((a,b)=>a+b,0),0);
});
test('EUR rounding is exact half-up, including integer currencies and subcent amounts',()=>{
 assert.equal(euroAmount(50000,'RON','5.0000000000'),10000);
 assert.equal(euroAmount(1,'RON','2'),1);assert.equal(euroAmount(1,'RON','3'),0);
 assert.equal(euroAmount(136,'ISK','136.0000'),100);
 for(const rate of ['0','-1','NaN','1e5'])assert.throws(()=>euroAmount(100,'RON',rate));
});
test('official business-day quotes and the daily fallback have explicit dates and sources',()=>{
 assert.deepEqual(parseEcb(xml,'RON',now),{currency:'RON',rate:'5.3447',date:'2026-10-30',source:'ECB'});
 assert.deepEqual(parseFallback(fallback,'UAH',now),{currency:'UAH',rate:'50.797859',date:today,source:'ExchangeRate-API'});
 assert.throws(()=>parseEcb(xml.replace('2026-10-30','2020-01-01'),'RON',now));
 assert.throws(()=>parseFallback({...fallback,time_last_update_unix:0},'UAH',now));
 assert.throws(()=>parseFallback({...fallback,base_code:'USD'},'UAH',now));
});
test('quotes are authenticated, providers are cached and clients cannot choose the rate or recipient',async()=>{
 const calls=[],issued=[];const handler=createRateHandler({now:()=>now,user:async token=>token==='Bearer valid'?'actor':null,fetcher:async url=>{calls.push(url);return url===ECB_URL?new Response(xml):Response.json(fallback);},issue:async(actor,quote)=>{issued.push({actor,quote});return {...quote,id:'quote'};}});
 const request=(currency,authorization='Bearer valid')=>new Request('https://function.test',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify({currency,rate:0.01,user:'forged'})});
 assert.equal((await handler(request('RON',''))).status,401);assert.equal(calls.length,0);
 const authDown=createRateHandler({user:async()=>{throw new Error('Auth offline');},issue:async()=>assert.fail()});assert.equal((await authDown(request('RON'))).status,503);
 assert.equal((await handler(request('ZZZ'))).status,400);
 assert.equal((await handler(request('RON'))).status,200);assert.equal((await handler(request('RON'))).status,200);
 assert.equal((await handler(request('UAH'))).status,200);assert.equal((await handler(request('UAH'))).status,200);
 assert.deepEqual(calls,[ECB_URL,FALLBACK_URL]);assert.equal(issued[0].actor,'actor');assert.equal(issued[0].quote.rate,'5.3447');
 const broken=createRateHandler({now:()=>now,user:async()=> 'actor',issue:async()=>assert.fail(),fetcher:async()=>{throw new Error('offline');}});assert.equal((await broken(request('RON'))).status,503);
});
test('expired or foreign-currency quotes cannot be used in a payment preview',()=>{
 const q={id:'11111111-1111-4111-8111-111111111111',currency:'RON',source:'ECB',rate:'5',rate_date:today,expires_at:'2026-11-01T12:15:00Z'};
 assert.equal(validQuote(q,'RON',now),true);assert.equal(validQuote(q,'USD',now),false);assert.equal(validQuote(q,'RON',now+16*60000),false);
});

test('cross-currency amounts round once in the selected minor unit',async()=>{
 const {convertedAmount,validConversion}=await import('../fx.js');
 assert.equal(convertedAmount(10000,'RON','USD','5','1.2'),2400);
 assert.equal(convertedAmount(10000,'EUR','USD','1','1.2'),12000);
 assert.equal(convertedAmount(1000,'ISK','RON','160','5'),3125);
 assert.equal(convertedAmount(100,'RON','ISK','5','160'),32);
 assert.equal(convertedAmount(1,'RON','ISK','5','160'),0);
 assert.equal(convertedAmount(1,'RON','USD','2','1'),1);
 assert.throws(()=>convertedAmount(100,'RON','USD','0','1'));
 assert.throws(()=>convertedAmount(100,'RON','RON','5','5'));
 const quote={id:'11111111-1111-4111-8111-111111111111',currency:'RON',rate:'5',rate_date:'2026-11-02',source:'ECB',expires_at:new Date(Date.now()+60000).toISOString()};
 assert.equal(validConversion(quote,null,'RON','EUR'),true);
 assert.equal(validConversion(null,{...quote,currency:'USD'},'EUR','USD'),true);
 assert.equal(validConversion(quote,{...quote,currency:'GBP'},'RON','USD'),false);
 assert.equal(validConversion({...quote,expires_at:'2000-01-01'},null,'RON','EUR'),false);
});
