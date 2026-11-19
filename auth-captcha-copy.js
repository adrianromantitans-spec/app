// Shared browser/native copy. No DOM, secrets or authentication credentials.
export const captchaCopy={
 checking:{es:'Verifica que eres una persona',en:'Verify you are human',ro:'Confirmă că ești o persoană'},
 cancel:{es:'Cancelar',en:'Cancel',ro:'Anulează'},
 cancelled:{es:'Has cancelado la verificación. Puedes volver a intentarlo.',en:'Verification was cancelled. You can try again.',ro:'Verificarea a fost anulată. Poți încerca din nou.'},
 unavailable:{es:'No se ha podido abrir la verificación de seguridad. Actualiza la aplicación y vuelve a intentarlo.',en:'Security verification could not open. Update the app and try again.',ro:'Verificarea de securitate nu a putut fi deschisă. Actualizează aplicația și încearcă din nou.'},
 rejected:{es:'No se ha podido verificar el acceso. Vuelve a intentarlo. Si continúa, escribe a support@divzplit.com para revisar la configuración de CAPTCHA.',en:'Access could not be verified. Try again. If this continues, contact support@divzplit.com to check the CAPTCHA configuration.',ro:'Accesul nu a putut fi verificat. Încearcă din nou. Dacă problema continuă, contactează support@divzplit.com pentru verificarea configurației CAPTCHA.'}
};
export const captchaText=(key,language)=>captchaCopy[key][language]||captchaCopy[key].en;
