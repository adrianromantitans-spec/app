/* Push only: no caching of application pages, account data or API responses. */
const bindingCache='divzplit-push-binding-v1';
const bindingURL=new URL('./__push_account__',self.registration.scope).href;
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function readBinding(){const response=await(await caches.open(bindingCache)).match(bindingURL);return response?response.json():null;}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(!event.source?.url?.startsWith(self.registration.scope))return;
 event.waitUntil((async()=>{
  const cache=await caches.open(bindingCache),type=event.data?.type;
  if(type==='CLEAR_PUSH_ACCOUNT'){await cache.delete(bindingURL);const shown=await self.registration.getNotifications?.()||[];shown.forEach(notification=>notification.close());}
  if(type==='SET_PUSH_ACCOUNT'&&validId(event.data.userId))await cache.put(bindingURL,new Response(JSON.stringify({userId:event.data.userId}),{headers:{'Content-Type':'application/json'}}));
  event.ports?.[0]?.postMessage(await readBinding());
 })());
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data?.json();}catch{return;}
 if(!validId(data?.notificationId)||!validId(data?.userId))return;
 const binding=await readBinding();if(binding?.userId!==data.userId)return;
 await self.registration.showNotification('DivZplit',{body:typeof data.body==='string'?data.body.slice(0,300):'DivZplit',icon:new URL('./assets/app-icon-192.png',self.registration.scope).href,badge:new URL('./assets/app-icon-192.png',self.registration.scope).href,tag:'divzplit-'+data.notificationId,data:{notificationId:data.notificationId,userId:data.userId}});
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const data=event.notification.data,binding=await readBinding();if(!validId(data?.notificationId)||binding?.userId!==data?.userId)return;
  const url=new URL('./app/',self.registration.scope);url.searchParams.set('notification',data.notificationId);
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const appURL=new URL('./app/',self.registration.scope).href;
  const client=windows.find(window=>window.url.startsWith(appURL))||windows.find(window=>window.url.startsWith(self.registration.scope));
  if(client?.navigate){await client.navigate(url.href);await client.focus();}else await self.clients.openWindow(url.href);
 })());
});
