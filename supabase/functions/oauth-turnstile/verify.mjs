// This verifies an app preflight, NOT authorization to create a Supabase user.
// Standard /auth/v1/authorize remains directly reachable. See docs/OAUTH-ANTIBOT.md.
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
/**
 * @param {{secret?:string,supabaseURL?:string,origins?:string[],hostnames?:string[],redirects?:string[],reserve?:(tokenDigest:string,flowDigest:string)=>Promise<string>,fetcher?:typeof fetch,now?:()=>number,log?:(event:Record<string,string|number>)=>void}} [options]
 */
export function createTurnstileHandler({secret,supabaseURL,origins=['https://divzplit.com'],hostnames=['divzplit.com'],redirects=['https://divzplit.com/'],reserve,fetcher=fetch,now=()=>Date.now(),log=(_event)=>{}}={}){
 let auth;
 try{auth=new URL(supabaseURL);if(auth.protocol!=='https:'||!/^[a-z0-9-]+\.supabase\.co$/.test(auth.hostname)||auth.href!==auth.origin+'/')throw Error();}catch{auth=null;}
 const configured=!!auth&&typeof secret==='string'&&!!secret&&typeof reserve==='function'&&origins.length>0&&hostnames.length>0&&redirects.length>0;
 return async request=>{
  const origin=request.headers.get('origin'),allowed=origins.includes(origin),start=now(),id=crypto.randomUUID();
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Max-Age':'600'}:{})};
  const reply=(status,code,extra={})=>{try{log({event:'oauth_preflight',outcome:code,request_id:id,duration_ms:Math.max(0,now()-start)});}catch{/* telemetry must not change the decision */}return new Response(JSON.stringify({...(status===200?extra:{error:code})}),{status,headers:{...headers,...(status===429?{'Retry-After':'60'}:{})}});};
  if(!allowed)return reply(403,'origin_denied'); // CORS defense only; not proof of a person.
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,'method_not_allowed');
  if(!configured)return reply(503,'not_configured');
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply(415,'invalid_content_type');
  let body;
  try{
   const reader=request.body?.getReader();if(!reader)return reply(400,'invalid_request');let size=0,parts=[];
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply(413,'request_too_large');}parts.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}body=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return reply(400,'invalid_request');}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['token','codeChallenge','redirectTo'].includes(k))||typeof body.token!=='string'||!body.token||body.token.length>2048||!/^[-_A-Za-z0-9]{43}$/.test(body.codeChallenge||'')||!redirects.includes(body.redirectTo))return reply(400,'invalid_request');
  // Reserve the token digest atomically BEFORE Siteverify. Its duplicate-token
  // detection is eventually consistent, so it is not our concurrency lock.
  try{const decision=await reserve(await digest(body.token),await digest(body.codeChallenge));if(decision==='rate_limited')return reply(429,'rate_limited');if(decision==='replay')return reply(409,'challenge_reused');if(decision!=='reserved')return reply(503,'verification_unavailable');}
  catch{return reply(503,'verification_unavailable');}
  let result;
  try{
   const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:body.token}),redirect:'error',signal:AbortSignal.timeout(10000)});
   if(!response.ok)return reply(503,'verification_unavailable');result=await response.json();
  }catch{return reply(503,'verification_unavailable');}
  if(Array.isArray(result?.['error-codes'])&&result['error-codes'].some(code=>['missing-input-secret','invalid-input-secret','internal-error'].includes(code)))return reply(503,'verification_unavailable');
  const stamp=Date.parse(result?.challenge_ts);
  if(result?.success!==true||!hostnames.includes(result.hostname)||result.action!=='google_oauth'||result.cdata!==body.codeChallenge||!Number.isFinite(stamp)||now()-stamp>300000||stamp>now()+30000)return reply(400,'challenge_invalid');
  const url=new URL('/auth/v1/authorize',auth);url.search=new URLSearchParams({provider:'google',redirect_to:body.redirectTo,code_challenge:body.codeChallenge,code_challenge_method:'s256'}).toString();
  // No reusable grant, user/email entitlement, metadata flag or hook bypass is issued.
  return reply(200,'verified',{authorizeUrl:url.href});
 };
}
