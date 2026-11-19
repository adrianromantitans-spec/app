import {createTurnstileHandler} from './verify.mjs';
let handler: (request:Request)=>Promise<Response>;
try {
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const list=(name:string,fallback:string[])=>{const raw=Deno.env.get(name);const values=raw?JSON.parse(raw):fallback;if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='string'||!v))throw Error('Invalid allowlist');return values;};
 handler=createTurnstileHandler({secret:Deno.env.get('TURNSTILE_SECRET_KEY'),supabaseURL:url,
  origins:list('TURNSTILE_ALLOWED_ORIGINS',['https://divzplit.com']),
  hostnames:list('TURNSTILE_ALLOWED_HOSTNAMES',['divzplit.com']),
  redirects:list('TURNSTILE_REDIRECT_URLS',['https://divzplit.com/']),
  reserve:async(tokenDigest:string,flowDigest:string)=>{
   if(!url||!service)throw Error('Missing server configuration');
   const response=await fetch(url+'/rest/v1/rpc/divzplit_turnstile_reserve',{method:'POST',headers:{'Content-Type':'application/json',apikey:service,Authorization:'Bearer '+service},body:JSON.stringify({p_token_digest:tokenDigest,p_flow_digest:flowDigest}),redirect:'error',signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw Error('Preflight storage unavailable');return response.json();
  },log:(event:unknown)=>console.info(JSON.stringify(event))});
}catch{handler=async()=>new Response(JSON.stringify({error:'not_configured'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
Deno.serve(handler);
