// All inputs here come from a claimed private flow plus verified Google claims.
// No existing account is updated, confirmed or resurrected by this adapter.
export function createAuthAdapter({url,key,fetcher=fetch}){
 const call=async(path,body,access)=>{
  const response=await fetcher(url+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+(access||key),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(12000)});
  let data;try{data=await response.json();}catch{data=null;}return {ok:response.ok,status:response.status,data};
 };
 return {
  async create(target,identity){
   const payload={id:target.userId,email:identity.email,email_confirm:false,user_metadata:{display_name:identity.name,notification_intro_pending:true},app_metadata:{provider:'google',divzplit_google_subject:identity.subject}};
   let created;try{created=await call('/auth/v1/admin/users',payload);}catch{/* Lost response: recover only the exact broker-owned intended ID. */}
   if(created?.ok){if(created.data?.id!==target.userId)throw Error('Unexpected account');return;}
   const existing=await call('/auth/v1/admin/users/'+encodeURIComponent(target.userId));const u=existing.data;
   if(!existing.ok||u?.id!==target.userId||u.email?.toLowerCase()!==identity.email.toLowerCase()||u.app_metadata?.divzplit_google_subject!==identity.subject)throw Error('Provisioning unavailable');
  },
  async signIn(tokens){
   const result=await call('/auth/v1/token?grant_type=id_token',{provider:'google',id_token:tokens.idToken,access_token:tokens.accessToken,nonce:tokens.nonce});
   if(!result.ok)throw Error('Provider login unavailable');return result.data;
  }
 };
}
