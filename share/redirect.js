// Never send the invitation token to a server or accept an external redirect.
const token=new URLSearchParams(location.hash.slice(1)).get('invite');
if(/^[a-f0-9]{64}$/.test(token||''))location.replace('/app/#invite='+token);
