import {invitationURL} from '../../invitation-share.js';
export function invitationResult(result,groupId,now=Date.now()){
 if(!result||!/^[a-f0-9]{64}$/.test(result.token||'')||!Number.isFinite(Date.parse(result.expires_at))||Date.parse(result.expires_at)<=now)throw new Error('No se ha podido crear el enlace. Vuelve a intentarlo.');
 return {groupId,url:invitationURL(result.token),expiresAt:result.expires_at};
}
export function invitationMessage(c,name,url){return c.ui`Únete a ${name} en DivZplit para compartir los gastos: ${url}`;}
