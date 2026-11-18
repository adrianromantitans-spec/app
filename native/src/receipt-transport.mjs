import {fromBase64} from './platform.mjs';

// RN XMLHttpRequest supports byte arrays; no DOM Blob/canvas or multipart conversion.
export function receiptFetcher(fetcher){return (url,options={})=>{
 // React Native's whatwg-fetch turns cache:no-store/no-cache into an `_=`
 // query parameter. PostgREST treats it as a filter and rejects the request.
 // Preserve cache prevention with HTTP headers, leaving the API URL untouched.
 if(options.cache==='no-store'||options.cache==='no-cache'){
  const {cache,...rest}=options;options={...rest,headers:{...options.headers,'Cache-Control':'no-store','Pragma':'no-cache'}};
 }
 const body=options.body;
 if(body?.nativeReceipt===true){
  if(body.type!=='image/jpeg'||!Number.isInteger(body.size)||body.size<1||body.size>1048576||typeof body.base64!=='string'||body.base64.length>1398104)throw new Error('Invalid receipt');
  const bytes=fromBase64(body.base64);if(bytes.length!==body.size)throw new Error('Invalid receipt size');
  return fetcher(url,{...options,body:bytes});
 }
 return fetcher(url,options);
};}
