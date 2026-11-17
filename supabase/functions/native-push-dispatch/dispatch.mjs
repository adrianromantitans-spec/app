import {sameSecret,pushPayload} from '../push-dispatch/dispatch.mjs';
export const validToken=token=>typeof token==='string'&&/^[A-Za-z0-9_:.-]{20,4096}$/.test(token);
export function createNativeDispatcher({secret,rpc,send}){return async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!secret||secret.length<32||!sameSecret(request.headers.get('x-dispatch-key'),secret))return new Response('Unauthorized',{status:401});
 try{
  const jobs=await rpc('divzplit_claim_native_push',{p_limit:20});let sent=0,failed=0;
  for(let i=0;i<jobs.length;i+=5)await Promise.all(jobs.slice(i,i+5).map(async job=>{
   let status=500,retry=true,disable=false;
   try{
    if(!validToken(job.token))throw Object.assign(new Error('Invalid token'),{statusCode:400});
    const payload=JSON.parse(pushPayload(job));
    await send(job.token,payload);status=200;retry=false;sent++;
   }catch(error){status=Number(error?.statusCode)||503;disable=status===410;retry=!disable&&(status===401||status===403||status===429||status>=500);failed++;}
   await rpc('divzplit_finish_native_push',{p_id:job.id,p_lease:job.lease,p_status:status,p_retry:retry,p_disable:disable});
  }));
  return Response.json({sent,failed});
 }catch{return new Response('Native delivery temporarily unavailable',{status:503});}
};}
