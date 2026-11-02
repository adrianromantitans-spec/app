// DivZplit: dashboard bundle. Uses existing Supabase function secrets.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&value.length<=4096&&(/^(fcm\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.apple\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)+notify\.windows\.com)$/.test(u.hostname));}catch{return false;}}
const copy={es:{shopping:'Hay productos nuevos en la lista de la compra.',expenses:'Hay novedades en los gastos de tu grupo.',polls:'Tienes una nueva votación en tu grupo.',tasks:'Tienes una nueva tarea asignada.',payments:'Hay novedades sobre un pago de tu grupo.'},en:{shopping:'There are new products on the shopping list.',expenses:'There are expense updates in your group.',polls:'There is a new poll in your group.',tasks:'You have a new task assigned.',payments:'There is a payment update in your group.'},ro:{shopping:'Sunt produse noi în lista de cumpărături.',expenses:'Sunt noutăți despre cheltuielile grupului.',polls:'Ai un sondaj nou în grup.',tasks:'Ai o sarcină nouă atribuită.',payments:'Sunt noutăți despre o plată din grup.'}};
const shoppingReminderCopy={es:'Quedan productos por comprar en tu grupo.',en:'There are still products to buy in your group.',ro:'Mai sunt produse de cumpărat în grup.'};
const reminderCopy={es:'Tienes un recordatorio de tu grupo.',en:'You have a reminder from your group.',ro:'Ai un memento din grupul tău.'};
function pushPayload(job){if(!uuid.test(job.notification_id)||!uuid.test(job.user_id))throw new Error('Invalid job');const category=job.kind.startsWith('shopping.')?'shopping':job.kind.startsWith('expenses.')?'expenses':job.kind.startsWith('polls.')?'polls':job.kind.startsWith('tasks.')?'tasks':'payments';return JSON.stringify({title:'DivZplit',body:job.kind==='shopping.reminder'?(shoppingReminderCopy[job.language]||shoppingReminderCopy.en):job.kind.endsWith('.reminder')?(reminderCopy[job.language]||reminderCopy.en):(copy[job.language]||copy.en)[category],notificationId:job.notification_id,userId:job.user_id});}
function sameSecret(a,b){if(!a||!b||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
function createDispatcher({secret,rpc,send}){return async request=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!secret||secret.length<32||!sameSecret(request.headers.get('x-dispatch-key'),secret))return new Response('Unauthorized',{status:401});
 try{
  const jobs=await rpc('divzplit_claim_push',{p_limit:20});let sent=0,failed=0;
  for(let i=0;i<jobs.length;i+=5)await Promise.all(jobs.slice(i,i+5).map(async job=>{
   let status=500,retry=true,disable=false;
   try{
    if(!validEndpoint(job.endpoint))throw Object.assign(new Error('Invalid endpoint'),{statusCode:400});
    const result=await send({endpoint:job.endpoint,keys:job.keys},pushPayload(job),{TTL:3600,timeout:10000});status=result?.statusCode||201;retry=false;sent++;
   }catch(error){status=Number(error?.statusCode)||503;disable=status===404||status===410;retry=!disable&&status!==400;failed++;}
   await rpc('divzplit_finish_push',{p_id:job.id,p_lease:job.lease,p_status:status,p_retry:retry,p_disable:disable});
  }));
  return Response.json({sent,failed});
 }catch{return new Response('Dispatch temporarily unavailable',{status:503});}
};}

import webpush from 'npm:web-push@3.6.7';
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
 const dispatch=createDispatcher({secret:values.PUSH_DISPATCH_SECRET,rpc,send:webpush.sendNotification.bind(webpush)});
 handler=async request=>{
  if(request.method==='POST'&&values.PUSH_DISPATCH_SECRET!.length>=32&&sameSecret(request.headers.get('x-dispatch-key'),values.PUSH_DISPATCH_SECRET)){
   await rpc('divzplit_shopping_sender_ready',{}).catch(()=>{});
  }
  return dispatch(request);
 };
}catch{handler=async()=>new Response('Push is not configured',{status:503});}
Deno.serve(handler);
