// Injected only into the trusted main frame of the experimental Android WebView.
// No changes to files served to browsers, iPhone or the TWA.
(() => {
 if (location.origin !== 'https://divzplit.com' || window !== window.top || window.__divzplitWebViewInstalled) return;
 Object.defineProperty(window,'__divzplitWebViewInstalled',{value:true});
 Object.defineProperty(window,'__divzplitBack',{value:()=>{
  const modal=document.querySelector('#modal-root');
  if(modal?.firstElementChild){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;}
  const shell=document.querySelector('.main-shell');
  const home=document.querySelector('.reference-dock [data-route="home"],.workspace-sidebar [data-route="home"]');
  if(shell?.dataset.currentPage&&shell.dataset.currentPage!=='home'&&home){home.click();return true;}
  return false;
 }});
 let port, serial=0;
 const pending=new Map();
 // Keep JSON blobs created by this page: CSP can forbid fetch(blob:) even for
 // same-origin exports. Read their bytes directly without relaxing website CSP.
 const exportBlobs=new Map(),createBlobURL=URL.createObjectURL.bind(URL),revokeBlobURL=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=blob=>{
  const url=createBlobURL(blob);
  if(blob.type==='application/json'&&blob.size<=20*1024*1024)exportBlobs.set(url,blob);
  return url;
 };
 URL.revokeObjectURL=url=>{exportBlobs.delete(String(url));revokeBlobURL(url);};
 window.addEventListener('message', event => {
  if((event.source!==null&&event.source!==window)||event.data !== 'divzplit-native-ready' || !event.ports[0])return;
  port?.close();port=event.ports[0];
  port.onmessage=event=>{try{const result=JSON.parse(event.data),job=pending.get(result.id);if(!job)return;clearTimeout(job.timer);pending.delete(result.id);result.ok?job.resolve():job.reject(new Error('Native action unavailable'));}catch{}};
 });
 function send(message){
  if(!port)return Promise.reject(new Error('Native channel unavailable'));
  return new Promise((resolve,reject)=>{
   const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Native action timed out'));},10000);
   pending.set(id,{resolve,reject,timer});port.postMessage(JSON.stringify({...message,id}));
  });
 }
 // Native clipboard writes only; no access to clipboard contents.
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>send({type:'clipboard',text:String(text)})}});
 Object.defineProperty(window,'__divzplitDownload',{configurable:true,value:async url=>{
  try{
   if(!url.startsWith('blob:https://divzplit.com/'))return;
   const blob=exportBlobs.get(url);
   if(!blob)throw new Error('Export unavailable');
   if(blob.type!=='application/json'||blob.size>20*1024*1024)throw new Error('Invalid export');
   const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
   await send({type:'export',base64});
  }catch{alert('Could not open the DivZplit export. Please try again.');}
 }});
 // Read blob exports before the website revokes their temporary URLs.
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[download]');
  if(!link?.href.startsWith('blob:https://divzplit.com/'))return;
  event.preventDefault();window.__divzplitDownload(link.href);
 },true);
})();
