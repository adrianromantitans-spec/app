import {fromBase64} from './platform.mjs';

// RN XMLHttpRequest supports byte arrays; no DOM Blob/canvas or multipart conversion.
export function receiptFetcher(fetcher){return (url,options={})=>{
 const body=options.body;
 if(body?.nativeReceipt===true){
  if(body.type!=='image/jpeg'||!Number.isInteger(body.size)||body.size<1||body.size>1048576||typeof body.base64!=='string'||body.base64.length>1398104)throw new Error('Invalid receipt');
  const bytes=fromBase64(body.base64);if(bytes.length!==body.size)throw new Error('Invalid receipt size');
  return fetcher(url,{...options,body:bytes});
 }
 return fetcher(url,options);
};}
