// DivZplit native FCM dispatcher. Set secrets only in Supabase.
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

const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const pemBytes=pem=>Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
function createFcmSender({credentials,projectId,fetcher=fetch,cryptoProvider=crypto,clock=()=>Date.now()}){
 if(!/^[a-z][a-z0-9-]{4,62}$/.test(projectId)||credentials.project_id!==projectId||!String(credentials.client_email).endsWith('@'+projectId+'.iam.gserviceaccount.com')||!String(credentials.private_key).startsWith('-----BEGIN PRIVATE KEY-----'))throw new Error('Invalid Firebase sender configuration');
 let cached=null,pending=null;
 async function accessToken(){
  if(cached&&cached.until>clock())return cached.token;
  if(pending)return pending;
  pending=(async()=>{
   const now=Math.floor(clock()/1000),unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
   const key=await cryptoProvider.subtle.importKey('pkcs8',pemBytes(credentials.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
   const bytes=new Uint8Array(await cryptoProvider.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
   const signature=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Object.assign(new Error('Firebase sender authentication unavailable'),{statusCode:503});
   const result=await response.json();if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(result.expires_in)||result.expires_in<120)throw new Error('Invalid sender response');
   cached={token:result.access_token,until:clock()+(Math.min(result.expires_in,3600)-60)*1000};return cached.token;
  })();
  try{return await pending;}finally{pending=null;}
 }
 return async(token,payload)=>{
  const auth=await accessToken();
  const response=await fetcher('https://fcm.googleapis.com/v1/projects/'+projectId+'/messages:send',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({message:{token,data:payload,android:{priority:'HIGH',ttl:'3600s'}}}),signal:AbortSignal.timeout(15000)});
  if(response.ok)return {statusCode:200};
  const error=await response.json().catch(()=>({}));
  const codes=(error?.error?.details||[]).map(x=>x.errorCode);
  if(response.status===401)cached=null;
  throw Object.assign(new Error('Firebase delivery failed'),{statusCode:codes.includes('UNREGISTERED')||codes.includes('SENDER_ID_MISMATCH')?410:response.status});
 };
}

const validToken=token=>typeof token==='string'&&/^[A-Za-z0-9_:.-]{20,4096}$/.test(token);
function createNativeDispatcher({secret,rpc,send}){return async request=>{
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
