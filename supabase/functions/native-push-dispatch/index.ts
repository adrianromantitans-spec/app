import {createNativeDispatcher} from './dispatch.mjs';
import {createFcmSender} from './fcm.mjs';
let handler: (request:Request)=>Promise<Response>;
try{
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const secret=Deno.env.get('PUSH_DISPATCH_SECRET'),project=Deno.env.get('FCM_PROJECT_ID');
 const raw=Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
 if(!url||!service||!secret||!project||!raw)throw new Error('Missing sender settings');
 const send=createFcmSender({credentials:JSON.parse(raw),projectId:project});
 const rpc=async(name:string,body:unknown)=>{
  const result=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:service,Authorization:'Bearer '+service},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw new Error('Native worker RPC failed');return result.json();
 };
 handler=createNativeDispatcher({secret,rpc,send});
}catch{handler=async()=>new Response('Native push is not configured',{status:503});}
Deno.serve(handler);
