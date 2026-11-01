import webpush from 'npm:web-push@3.6.7';
import {createDispatcher} from './dispatch.mjs';
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','PUSH_DISPATCH_SECRET'];
const values=Object.fromEntries(required.map(key=>[key,Deno.env.get(key)]));
let handler: (request:Request)=>Promise<Response>;
try{
 if(required.some(key=>!values[key]))throw new Error('Missing configuration');
 webpush.setVapidDetails(values.VAPID_SUBJECT!,values.VAPID_PUBLIC_KEY!,values.VAPID_PRIVATE_KEY!);
 const rpc=async(name:string,body:unknown)=>{
  const result=await fetch(values.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:values.SUPABASE_SERVICE_ROLE_KEY!,Authorization:'Bearer '+values.SUPABASE_SERVICE_ROLE_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw new Error('Worker RPC failed');return result.json();
 };
 handler=createDispatcher({secret:values.PUSH_DISPATCH_SECRET,rpc,send:webpush.sendNotification.bind(webpush)});
}catch{handler=async()=>new Response('Push is not configured',{status:503});}
Deno.serve(handler);
