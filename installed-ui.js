// DivZplit supplies its own languages. Leave normal browser translation available.
(() => {
 const installed=new URL(location.href).searchParams.get('source')==='installed'||
  navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||
  matchMedia('(display-mode: fullscreen)').matches;
 if(!installed)return;
 document.documentElement.setAttribute('translate','no');
 const hint=document.createElement('meta');
 hint.name='google';hint.content='notranslate';document.head.append(hint);
})();
