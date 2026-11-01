import {createRateHandler} from './rates.mjs';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
Deno.serve(createRateHandler({
 user:async(authorization:string)=>{
  if(!url||!key||!/^Bearer \S+$/i.test(authorization))return null;
  const response=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(response.status===401||response.status===403)return null;
  if(!response.ok)throw new Error('Authentication unavailable');
  const user=await response.json();return typeof user.id==='string'?user.id:null;
 },
 issue:async(actor:string,quote:{currency:string,rate:string,date:string,source:string})=>{
  const response=await fetch(url+'/rest/v1/rpc/divzplit_issue_fx_quote',{method:'POST',headers:{'Content-Type':'application/json',apikey:key!,Authorization:'Bearer '+key},body:JSON.stringify({p_user:actor,p_currency:quote.currency,p_rate:quote.rate,p_date:quote.date,p_source:quote.source}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Quote unavailable');return response.json();
 }
}));
