const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const pemBytes=pem=>Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
export function createFcmSender({credentials,projectId,fetcher=fetch,cryptoProvider=crypto,clock=()=>Date.now()}){
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
