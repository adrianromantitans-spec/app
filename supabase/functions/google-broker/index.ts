import {jwtVerify,createRemoteJWKSet} from 'npm:jose@6.2.17';
import {createBroker} from './broker.mjs';
import {createSealer} from './crypto.mjs';
import {createGoogleVerifier} from './google.mjs';
import {createAuthAdapter} from './auth.mjs';
import {createTurnstileHandler} from '../oauth-turnstile/verify.mjs';
let handler:(r:Request)=>Promise<Response>;
try{
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),clientId=Deno.env.get('GOOGLE_BROKER_CLIENT_ID'),secret=Deno.env.get('GOOGLE_BROKER_CLIENT_SECRET');
 if(!url||!key||!clientId||!secret||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Missing configuration');
 const list=(name:string,fallback:string[])=>{const value=Deno.env.get(name);const data=value?JSON.parse(value):fallback;if(!Array.isArray(data)||!data.length||data.some(v=>typeof v!=='string'))throw Error('Invalid allowlist');return data;};
 const origins=list('TURNSTILE_ALLOWED_ORIGINS',['https://divzplit.com']),redirects=list('TURNSTILE_REDIRECT_URLS',['https://divzplit.com/']);
 const rpc=async(name:string,body:Record<string,unknown>)=>{
  const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Broker storage unavailable');const text=await response.text();return text?JSON.parse(text):null;
 };
 const sealer=await createSealer(Deno.env.get('GOOGLE_BROKER_ENCRYPTION_KEY'));
 const preflight=createTurnstileHandler({secret:Deno.env.get('TURNSTILE_SECRET_KEY'),supabaseURL:url,origins,redirects,hostnames:list('TURNSTILE_ALLOWED_HOSTNAMES',['divzplit.com']),reserve:(token:string,flow:string)=>rpc('divzplit_turnstile_reserve',{p_token_digest:token,p_flow_digest:flow})});
 const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:300000});
 const verifyGoogle=createGoogleVerifier({jwtVerify,keySet:keys,clientId});
 handler=createBroker({enabled:Deno.env.get('GOOGLE_BROKER_ENABLED')==='true',clientId,clientSecret:secret,callbackURL:url+'/functions/v1/google-broker/callback',origins,redirects,preflight,rpc,sealer,verifyGoogle,supabase:createAuthAdapter({url,key}),log:(event:unknown)=>console.info(JSON.stringify(event))});
}catch{handler=async()=>Response.json({error_code:'broker_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
Deno.serve(handler);
