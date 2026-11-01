const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&value.length<=4096&&(/^(fcm\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.apple\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)+notify\.windows\.com)$/.test(u.hostname));}catch{return false;}}
const copy={es:{expenses:'Hay novedades en los gastos de tu grupo.',polls:'Tienes una nueva votación en tu grupo.',tasks:'Tienes una nueva tarea asignada.',payments:'Hay novedades sobre un pago de tu grupo.'},en:{expenses:'There are expense updates in your group.',polls:'There is a new poll in your group.',tasks:'You have a new task assigned.',payments:'There is a payment update in your group.'},ro:{expenses:'Sunt noutăți despre cheltuielile grupului.',polls:'Ai un sondaj nou în grup.',tasks:'Ai o sarcină nouă atribuită.',payments:'Sunt noutăți despre o plată din grup.'}};
const reminderCopy={es:'Tienes un recordatorio de tu grupo.',en:'You have a reminder from your group.',ro:'Ai un memento din grupul tău.'};
export function pushPayload(job){if(!uuid.test(job.notification_id)||!uuid.test(job.user_id))throw new Error('Invalid job');const category=job.kind.startsWith('expenses.')?'expenses':job.kind.startsWith('polls.')?'polls':job.kind.startsWith('tasks.')?'tasks':'payments';return JSON.stringify({title:'DivZplit',body:job.kind.endsWith('.reminder')?(reminderCopy[job.language]||reminderCopy.en):(copy[job.language]||copy.en)[category],notificationId:job.notification_id,userId:job.user_id});}
export function sameSecret(a,b){if(!a||!b||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
export function createDispatcher({secret,rpc,send}){return async request=>{
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
