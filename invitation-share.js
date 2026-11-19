// Public invitation presentation only: tokens stay in the URL fragment.
export const shareChannels=['whatsapp','telegram','instagram','snapchat'];
export const shareNames={whatsapp:'WhatsApp',telegram:'Telegram',instagram:'Instagram',snapchat:'Snapchat'};
export const shareColors={whatsapp:'#24794D',telegram:'#1686B0',instagram:'#BC397A',snapchat:'#50422B'};
export const sharePaths={
 whatsapp:'M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.7Z M8 7.5c-1 2.5 2.5 6.5 5.5 7.5l2-2-2-1.2-1 1c-1.5-.7-2.8-2-3.4-3.4l1-1L9 6.5Z',
 telegram:'m3 10 18-7-4 18-6-5-3 3v-6l10-7-7 10 M3 10l5 3',
 instagram:'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17.5 6.5h.01',
 snapchat:'M8 8a4 4 0 1 1 8 0v3l2-1 1 2-3 1c0 2 2 3 4 4l-3 1-1 2-4-1-4 1-1-2-3-1c2-1 4-2 4-4l-3-1 1-2 2 1Z'
};
export function invitationURL(token,origin='https://divzplit.com'){
 if(!/^[a-f0-9]{64}$/.test(token||''))throw new Error('Invalid invitation');
 const url=new URL('/share/',origin);url.hash='invite='+token;return url.href;
}
export function invitationCopy(language,name,url){
 const text={es:`Únete a ${name} en DivZplit para compartir los gastos: ${url}`,en:`Join ${name} on DivZplit to share expenses: ${url}`,ro:`Alătură-te grupului ${name} în DivZplit pentru a împărți cheltuielile: ${url}`};return text[language]||text.en;
}
export function shareHref(channel,message,url){
 if(channel==='whatsapp')return 'https://wa.me/?text='+encodeURIComponent(message);
 if(channel==='telegram')return 'https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(message.endsWith(url)?message.slice(0,-url.length).trim():message);
 return null;
}
