import {base64url,shaBytes} from './crypto.mjs';
// Signature/issuer/audience/expiry verification is supplied by pinned jose.
export function createGoogleVerifier({jwtVerify,keySet,clientId,now=()=>Date.now()}){
 return async(token,{nonceDigest,accessToken})=>{
  if(typeof token!=='string'||token.length>16384)throw Error('Invalid identity');
  const {payload:p}=await jwtVerify(token,keySet,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,requiredClaims:['sub','iss','aud','exp','iat','nonce','email','email_verified'],clockTolerance:30,currentDate:new Date(now())});
  if(typeof p.sub!=='string'||!p.sub||p.sub.length>255||p.email_verified!==true||typeof p.email!=='string'||p.email.length>254||!p.email.includes('@')||p.nonce!==nonceDigest||p.iat>now()/1000+30||p.exp<=now()/1000||p.azp!==undefined&&p.azp!==clientId||Array.isArray(p.aud)&&p.aud.length>1&&p.azp!==clientId)throw Error('Invalid identity claims');
  if(p.at_hash!==undefined){if(typeof accessToken!=='string'||p.at_hash!==base64url((await shaBytes(accessToken)).slice(0,16)))throw Error('Invalid access token binding');}
  return {subject:p.sub,email:p.email,name:typeof p.name==='string'?p.name.trim().slice(0,40):''};
 };
}
