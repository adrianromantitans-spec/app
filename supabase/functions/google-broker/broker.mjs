import {randomToken,sha,s256} from './crypto.mjs';
const verifierPattern=/^[A-Za-z0-9_-]{43,128}$/;
async function bodyJSON(request){const reader=request.body?.getReader();if(!reader)throw Error();let size=0,parts=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error();}parts.push(value);}const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}
/** @param {{enabled?:boolean,clientId:string,clientSecret:string,callbackURL:string,origins?:string[],redirects?:string[],preflight:(r:Request)=>Promise<Response>,rpc:(name:string,args:Record<string,unknown>)=>Promise<any>,sealer:{seal:(v:unknown,id:string)=>Promise<string>,open:(v:string,id:string)=>Promise<any>},verifyGoogle:(token:string,context:any)=>Promise<any>,supabase:{create:(target:any,identity:any)=>Promise<void>,signIn:(tokens:any)=>Promise<any>},fetcher?:typeof fetch,log?:(event:Record<string,string>)=>void}} options */
export function createBroker({enabled=false,clientId,clientSecret,callbackURL,origins=['https://divzplit.com'],redirects=['https://divzplit.com/'],preflight,rpc,sealer,verifyGoogle,supabase,fetcher=fetch,log=(_event)=>{}}){
 return async request=>{
  const route=new URL(request.url).pathname.split('/').filter(Boolean).at(-1),origin=request.headers.get('origin');
  const cors=origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey','Vary':'Origin'}:{};
  const reply=(status,error,extra={})=>{try{log({event:'google_broker',outcome:error,request_id:crypto.randomUUID()});}catch{}return Response.json(status===200?extra:{error_code:error},{status,headers:{...cors,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});};
  if(!enabled||!clientId||!clientSecret)return reply(503,'broker_unavailable');
  if(route!=='callback'&&origin&&!origins.includes(origin))return reply(403,'broker_origin');
  if(route==='begin'&&!origins.includes(origin))return reply(403,'broker_origin');
  if(request.method==='POST'&&!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return reply(415,'broker_input');
  if(request.method==='OPTIONS'&&route!=='callback')return new Response(null,{status:204,headers:cors});
  if(route==='prepare'&&request.method==='POST'){
   try{
    if(await rpc('divzplit_google_broker_ready',{})!==true)return reply(503,'broker_unavailable');
    const body=await bodyJSON(request);if(Object.keys(body).some(k=>!['verifier','redirectTo'].includes(k))||!verifierPattern.test(body.verifier||'')||!redirects.includes(body.redirectTo))return reply(400,'broker_input');
    const id=crypto.randomUUID(),state=randomToken(),nonce=randomToken(),googleVerifier=randomToken(),ticket=randomToken();
    await rpc('divzplit_google_flow_prepare',{p_id:id,p_state:await sha(state),p_challenge:await s256(body.verifier),p_return:body.redirectTo,p_nonce:await sha(nonce),p_sealed:await sealer.seal({nonce,googleVerifier,state},id),p_ticket:await sha(ticket)});
    return reply(200,'prepared',{flowId:id,launchTicket:ticket});
   }catch{return reply(503,'broker_unavailable');}
  }
  if(route==='begin'&&request.method==='POST'){
   try{
    if(await rpc('divzplit_google_broker_ready',{})!==true)return reply(503,'broker_unavailable');
    const body=await bodyJSON(request);if(Object.keys(body).some(k=>!['token','codeChallenge','redirectTo','launchTicket'].includes(k))||!redirects.includes(body.redirectTo))return reply(400,'broker_input');
    const checked=await preflight(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({token:body.token,codeChallenge:body.codeChallenge,redirectTo:body.redirectTo})}));if(!checked.ok)return checked;
    let id,state,nonceDigest,googleVerifier;
    if(body.launchTicket!==undefined){
     if(!/^[A-Za-z0-9_-]{43}$/.test(body.launchTicket))return reply(400,'broker_input');
     const prepared=await rpc('divzplit_google_launch_claim',{p_ticket:await sha(body.launchTicket),p_challenge:body.codeChallenge,p_return:body.redirectTo});
     const context=await sealer.open(prepared.sealed,prepared.id);id=prepared.id;state=context.state;googleVerifier=context.googleVerifier;nonceDigest=prepared.nonceDigest;
    }else{
     id=crypto.randomUUID();state=randomToken();const nonce=randomToken();googleVerifier=randomToken();nonceDigest=await sha(nonce);
     const sealed=await sealer.seal({nonce,googleVerifier,state},id);
     await rpc('divzplit_google_flow_start',{p_id:id,p_state:await sha(state),p_challenge:body.codeChallenge,p_return:body.redirectTo,p_nonce:nonceDigest,p_sealed:sealed});
    }
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:clientId,redirect_uri:callbackURL,response_type:'code',scope:'openid email profile',state,nonce:nonceDigest,code_challenge:await s256(googleVerifier),code_challenge_method:'S256',access_type:'online',prompt:'select_account'}).toString();
    return reply(200,'started',{authorizeUrl:url.href,flowId:id});
   }catch{return reply(503,'broker_unavailable');}
  }
  if(route==='callback'&&request.method==='GET'){
   let flow,cancelled=false;
   try{
    const params=new URL(request.url).searchParams,state=params.get('state');if(!/^[A-Za-z0-9_-]{43}$/.test(state||''))return reply(400,'broker_state');
    flow=await rpc('divzplit_google_callback_claim',{p_state:await sha(state)});if(!redirects.includes(flow.returnTo))throw Error();
    if(params.has('error')){cancelled=params.get('error')==='access_denied';throw Error('Provider cancelled');}const code=params.get('code');if(!code||code.length>4096)throw Error();
    const context=await sealer.open(flow.sealed,flow.id);
    const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,code_verifier:context.googleVerifier,grant_type:'authorization_code',redirect_uri:callbackURL}),redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error();const tokens=await response.json();if(typeof tokens.access_token!=='string'||!tokens.access_token||tokens.access_token.length>8192)throw Error();
    const identity=await verifyGoogle(tokens.id_token,{nonceDigest:flow.nonceDigest,accessToken:tokens.access_token});
    const completion=randomToken(),sealed=await sealer.seal({idToken:tokens.id_token,accessToken:tokens.access_token,nonce:context.nonce},flow.id);
    await rpc('divzplit_google_callback_ready',{p_id:flow.id,p_subject:identity.subject,p_email:identity.email,p_sealed:sealed,p_completion:await sha(completion)});
    const target=new URL(flow.returnTo);target.searchParams.set('broker_code',completion);target.searchParams.set('broker_flow',flow.id);
    return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
   }catch{
    if(flow?.id){await rpc('divzplit_google_flow_finish',{p_id:flow.id}).catch(()=>{});if(redirects.includes(flow.returnTo)){const target=new URL(flow.returnTo);target.searchParams.set('broker_error',cancelled?'cancelled':'failed');target.searchParams.set('broker_flow',flow.id);return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}}
    return reply(400,'broker_state');
   }
  }
  if(route==='complete'&&request.method==='POST'){
   let flow;
   try{
    const body=await bodyJSON(request);if(Object.keys(body).some(k=>!['code','verifier','redirectTo','flowId'].includes(k))||!/^[A-Za-z0-9_-]{43}$/.test(body.code||'')||!verifierPattern.test(body.verifier||'')||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.flowId||'')||!redirects.includes(body.redirectTo))return reply(400,'broker_input');
    flow=await rpc('divzplit_google_completion_claim',{p_code:await sha(body.code),p_challenge:await s256(body.verifier),p_return:body.redirectTo,p_flow:body.flowId});
    const tokens=await sealer.open(flow.sealed,flow.id),identity=await verifyGoogle(tokens.idToken,{nonceDigest:flow.nonceDigest,accessToken:tokens.accessToken});
    if(identity.subject!==flow.subject||identity.email!==flow.email||await sha(tokens.nonce)!==flow.nonceDigest)throw Error();
    const target=await rpc('divzplit_google_authorize_provision',{p_id:flow.id});
    if(target.create)await supabase.create(target,identity);
    const session=await supabase.signIn(tokens);
    if(!session?.access_token||!session?.refresh_token||session.user?.id!==target.userId||!session.user?.identities?.some(i=>i.provider==='google'&&i.identity_data?.sub===identity.subject))throw Error();
    await rpc('divzplit_google_flow_finish',{p_id:flow.id,p_success:true});
    return reply(200,'completed',{access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,expires_at:session.expires_at,user:session.user});
   }catch{return reply(400,'broker_completion');}
   finally{if(flow?.id)await rpc('divzplit_google_flow_finish',{p_id:flow.id}).catch(()=>{});}
  }
  return reply(405,'broker_route');
 };
}
