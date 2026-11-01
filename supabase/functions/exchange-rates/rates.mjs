import {currencies} from '../../../currencies.js';
export const ECB_URL='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const FALLBACK_URL='https://open.er-api.com/v6/latest/EUR';
export function freshDate(value,now=Date.now()) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const stamp=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value&&stamp<=now&&now-stamp<8*86400000;
}
export function parseEcb(text,currency,now=Date.now()) {
 const date=text.match(/\btime=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
 if(!freshDate(date,now))throw new Error('Stale rate');
 const cubes=[...text.matchAll(/<Cube\s+([^>]+)\/?\s*>/g)];
 for(const cube of cubes){const code=cube[1].match(/\bcurrency=['"]([A-Z]{3})['"]/)?.[1],rate=cube[1].match(/\brate=['"]([0-9]+(?:\.[0-9]+)?)['"]/)?.[1];if(code===currency&&validRate(rate))return {currency,rate,date,source:'ECB'};}
 throw new Error('Currency unavailable');
}
function validRate(rate){return /^\d+(?:\.\d{1,10})?$/.test(String(rate))&&Number(rate)>0&&Number(rate)<=100000000;}
export function parseFallback(data,currency,now=Date.now()) {
 const timestamp=Number(data?.time_last_update_unix)*1000;
 const date=Number.isFinite(timestamp)?new Date(timestamp).toISOString().slice(0,10):'';
 const rate=String(data?.rates?.[currency]);
 if(data?.result!=='success'||data.base_code!=='EUR'||!freshDate(date,now)||timestamp>now+60000||!validRate(rate))throw new Error('Invalid rate');
 return {currency,rate,date,source:'ExchangeRate-API'};
}
export function createRateHandler({fetcher=fetch,user,issue,now=Date.now}) {
 const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
 const cache=new Map(),pending=new Map();
 async function loadSource(url,json=false){
  const saved=cache.get(url);if(saved&&saved.expires>now())return saved.data;
  if(pending.has(url))return pending.get(url);
  const task=(async()=>{const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Rate unavailable');const data=json?await response.json():await response.text();if(json)parseFallback(data,'USD',now());else parseEcb(data,'USD',now());cache.set(url,{data,expires:now()+3600000});return data;})();pending.set(url,task);
  try{return await task;}finally{pending.delete(url);}
 }
 const result=(value,status=200)=>Response.json(value,{status,headers:cors});
 return async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return result({error:'Method not allowed'},405);
  let actor;
  try{actor=await user(request.headers.get('authorization')||'');if(!actor)return result({error:'Unauthorized'},401);}catch{return result({error:'Authentication temporarily unavailable'},503);}
  let currency;try{currency=(await request.json()).currency;}catch{return result({error:'Invalid currency'},400);}
  if(!currencies.includes(currency)||currency==='EUR')return result({error:'Invalid currency'},400);
  try{
   let quote;
   try{quote=parseEcb(await loadSource(ECB_URL),currency,now());}
   catch{quote=parseFallback(await loadSource(FALLBACK_URL,true),currency,now());}
   return result(await issue(actor,quote));
  }catch{return result({error:'Exchange rates temporarily unavailable'},503);}
 };
}
