import {tr,ui,language} from './i18n.js?v=help-50';
export const TERMS_VERSION='2026-11-02.2';
export const PRIVACY_VERSION='2026-11-02.3';
export const SUPPORT_EMAIL='support@divzplit.com';
export function legalURL(kind){if(!['privacy','terms'].includes(kind))throw new Error('Invalid legal document');return './'+(kind==='privacy'?'privacidad':'condiciones')+'/'+(language==='en'?'':language+'/');}
export function legalMetadata(accepted,ageBand,source){
 if(accepted!==true)throw new Error(tr('Debes aceptar las condiciones para crear una cuenta.'));
 if(ageBand!=='16_or_over')throw new Error(tr(ageBand==='under_16'?'Debes tener al menos 16 años para registrarte.':'Selecciona tu franja de edad.'));
 if(!['email','google','apple'].includes(source))throw new Error('Invalid registration source');
 return {terms_version:TERMS_VERSION,privacy_notice_version:PRIVACY_VERSION,terms_accepted_at:new Date().toISOString(),legal_language:language,declared_age_band:ageBand,legal_source:source};
}
export function legalFields(){
 return ui`<div class="registration-legal"><label class="field">Franja de edad<select name="ageBand" required><option value="">Seleccionar</option><option value="16_or_over">Tengo 16 años o más</option><option value="under_16">Tengo menos de 16 años</option></select></label><p class="form-note">El registro está disponible solo para personas de 16 años o más.</p><label class="legal-checkbox"><input type="checkbox" name="acceptTerms" required><span>${tr('Acepto las')} <a href="${legalURL('terms')}" target="_blank" rel="noopener">${tr('Condiciones de uso')}</a>.</span></label><p class="form-note">${tr('Consulta cómo usamos tus datos en la')} <a href="${legalURL('privacy')}" target="_blank" rel="noopener">${tr('Política de privacidad')}</a>. ${tr('Las notificaciones son opcionales y se configuran por separado.')}</p></div>`;
}
export function legalLinks(){return ui`<nav class="auth-legal" aria-label="Información legal"><a href="${legalURL('privacy')}">Privacidad</a><a href="${legalURL('terms')}">Condiciones</a><a href="mailto:${SUPPORT_EMAIL}">Contacto</a></nav>`;}
