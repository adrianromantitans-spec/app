import {SignJWT,generateKeyPair,exportJWK,createLocalJWKSet,jwtVerify} from 'npm:jose@6.2.17';
import {createGoogleVerifier} from '../supabase/functions/google-broker/google.mjs';
import {sha,base64url,shaBytes} from '../supabase/functions/google-broker/crypto.mjs';
const clientId='fixture.apps.googleusercontent.com',time=Date.parse('2026-11-19T12:00:00Z'),nonceDigest=await sha('fixture-raw-nonce'),accessToken='fixture-google-access';
const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true}),other=await generateKeyPair('RS256');
const jwk=await exportJWK(publicKey);jwk.kid='fixture';jwk.alg='RS256';
const verifier=createGoogleVerifier({jwtVerify,keySet:createLocalJWKSet({keys:[jwk]}),clientId,now:()=>time});
const payload={sub:'google-fixture-sub',email:'alex@example.test',email_verified:true,nonce:nonceDigest,name:'Alex',iat:time/1000-10,exp:time/1000+3600,iss:'https://accounts.google.com',aud:clientId,at_hash:base64url((await shaBytes(accessToken)).slice(0,16))};
async function token(overrides:Record<string,unknown>={},key=privateKey){return new SignJWT({...payload,...overrides}).setProtectedHeader({alg:'RS256',kid:'fixture'}).sign(key);}
Deno.test('real Google-shaped RS256 proof accepts only the pinned verifier policy',async()=>{
 const result=await verifier(await token(),{nonceDigest,accessToken});if(result.subject!==payload.sub||result.email!==payload.email)throw Error('Invalid identity');
});
for(const [name,overrides] of Object.entries({issuer:{iss:'https://evil.example'},audience:{aud:'other.apps.googleusercontent.com'},nonce:{nonce:'wrong'},expired:{exp:time/1000-1},future:{iat:time/1000+31},unverified_email:{email_verified:false},authorized_party:{azp:'other.apps.googleusercontent.com'},multiple_audience:{aud:[clientId,'other']},access_hash:{at_hash:'wrong'}})){
 Deno.test('rejects signed but invalid '+name,async()=>{let rejected=false;try{await verifier(await token(overrides),{nonceDigest,accessToken});}catch{rejected=true;}if(!rejected)throw Error('Accepted '+name);});
}
Deno.test('rejects forged signatures even with a matching key identifier',async()=>{let rejected=false;try{await verifier(await token({},other.privateKey),{nonceDigest,accessToken});}catch{rejected=true;}if(!rejected)throw Error('Accepted foreign key');});
Deno.test('rejects algorithm substitution',async()=>{const encoded=await new SignJWT(payload).setProtectedHeader({alg:'HS256',kid:'fixture'}).sign(new TextEncoder().encode('fixture-secret-not-a-google-key-123456789'));let rejected=false;try{await verifier(encoded,{nonceDigest,accessToken});}catch{rejected=true;}if(!rejected)throw Error('Accepted HS256');});
