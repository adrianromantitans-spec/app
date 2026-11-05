/* Backwards compatibility only. No credentials are read or sent by the landing. */
(() => {
 const url=new URL(location.href),hash=url.hash.slice(1),params=new URLSearchParams(hash);
 const authCallback=['code','error','error_description','error_code'].some(key=>url.searchParams.has(key));
 const appHash=['registro','acceso'].includes(hash)||['invite','access_token','error'].some(key=>params.has(key));
 const installed=navigator.standalone===true||(typeof matchMedia==='function'&&matchMedia('(display-mode: standalone)').matches);
 if(!authCallback&&!appHash&&!url.searchParams.has('notification')&&url.searchParams.get('source')!=='installed'&&!installed)return;
 const target=new URL('./app/',url);target.search=url.search;target.hash=url.hash;
 if(authCallback)target.searchParams.set('legacy_auth_return','1');
 document.documentElement.hidden=true;
 location.replace(target.href);
})();
