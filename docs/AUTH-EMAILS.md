# Correos automáticos de registro

DivZplit utiliza Supabase Auth directamente desde JavaScript; no usa React.
Al registrarse envía `data.language` con el mismo idioma que la app: `es`, `ro`
o `en`. Las preferencias regionales se normalizan y el idioma alternativo es inglés.
También conserva el nombre y la preferencia de bienvenida de notificaciones.

Supabase envía automáticamente la confirmación a través del SMTP configurado.
Según la configuración confirmada por el propietario: proveedor Resend, dominio
`divzplit.com`, remitente `noreply@divzplit.com`. Las credenciales permanecen en
Supabase, nunca en el código de GitHub Pages.

La plantilla de Authentication → Email Templates → Confirm signup debe utilizar
`.Data.language` y conservar el enlace `.ConfirmationURL`, por ejemplo:

```html
{{ if eq .Data.language "ro" }}Confirmă contul
{{ else if eq .Data.language "es" }}Confirma tu cuenta
{{ else }}Confirm your account{{ end }}
```

Esto se integra en la plantilla existente; no sustituye su diseño. La app no
modifica las plantillas ni el SMTP del panel de Supabase. El asunto del correo
se configura por separado en el panel.

El idioma se guarda al crear la cuenta. Las cuentas anteriores sin este dato
usan la rama de inglés de la plantilla; este cambio no modifica sus perfiles.
Para una comprobación completa, crear una cuenta de prueba desde un navegador
en español y otra desde un navegador en rumano y comprobar el mensaje recibido
y su enlace. Las pruebas automáticas simulan el envío a Supabase y no envían
correos reales ni verifican la entrega del proveedor.

## Instalar el diseño del correo

La plantilla lista para copiar está en
[`supabase/templates/confirm-signup.html`](../supabase/templates/confirm-signup.html).
Conserva el diseño enviado por el propietario y añade los tres idiomas.

En el proyecto de Supabase, abrir Authentication → Email → Templates
(o Email Templates, según el panel) → Confirm signup. Sustituir el campo
**Body / Source** completo por ese archivo y guardar. No se pega en React,
en una Edge Function ni en el campo de dirección del remitente.

El SMTP mantiene `noreply@divzplit.com`. Publicar el archivo en GitHub no instala
la plantilla en Supabase: requiere guardarla en el panel. Antes de reemplazarla,
guardar una copia del HTML actual para poder recuperarlo. Usar Preview y luego
un registro de prueba para verificar la entrega. El asunto es un campo separado;
puede mantenerse como `DivZplit · Email confirmation` si el panel no permite
traducirlo dinámicamente.

## Revisión de correo transaccional — 16 de noviembre de 2026

Las verificaciones y la recuperación solicitadas son mensajes necesarios para
prestar y proteger la cuenta. Mantenerlos sin promociones ni campañas de
reactivación: no requieren una casilla de marketing ni una baja publicitaria.
Que un proveedor llame «transaccional» a su API no convierte un mensaje promocional
en uno administrativo. Revisar por separado consentimiento y baja antes de
cualquier marketing, según los territorios y la normativa aplicable.

Resend actúa como encargado para el contenido enviado por DivZplit; recibe correo,
contenido del mensaje (incluidos enlaces o códigos), datos técnicos de entrega y
nombre si se incluye. Las plantillas versionadas actuales no interpolan el nombre.
Resend declara almacenamiento y operaciones principales en EE. UU.; la región de
salida del correo no cambia la residencia de esos datos. Su DPA incluye cláusulas
contractuales tipo de la UE y se aplica según sus condiciones. Descargar la copia
correspondiente a la cuenta y registrar subencargados y salvaguardas; no confundir
la documentación pública con una inspección de la cuenta real. Comprobar y
desactivar el seguimiento de aperturas y clics para estos mensajes.

### DNS público observado, sin modificar Cloudflare

Consulta del 16 de noviembre de 2026 mediante el resolvedor público de Google:

| Nombre | Registro observado | Alcance de la comprobación |
| --- | --- | --- |
| `divzplit.com` | TXT `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF publicado para Cloudflare; no prueba por sí solo la autorización del envío por Resend. |
| `send.divzplit.com` | TXT SPF con IPs autorizadas; MX `feedback.forge.rmta.net` | Registros publicados para este posible Return-Path; contrastar con la configuración real del proveedor. |
| `resend._domainkey.divzplit.com` | Clave pública DKIM presente | No prueba que un mensaje real esté firmado con ese selector ni valide la firma. |
| `_dmarc.divzplit.com` | TXT `v=DMARC1; p=none` | Política de no imposición; no indica rechazo ni cuarentena. No contiene `rua` para informes agregados. |

No sustituir el SPF raíz por otro ni añadir un segundo SPF: podría romper el
reenvío de soporte. Comparar los nombres/valores con Resend → Domains y el
Return-Path real. Comprobar en un mensaje de prueba los encabezados
Authentication-Results: SPF, DKIM y DMARC, más alineación con From. `p=none`
permite observar; plantear cuarentena/rechazo solo tras validar todos los emisores,
incluido el reenvío de soporte. No se ha cambiado ningún registro DNS.

### Seguridad y entrega: confirmación del propietario y mantenimiento

El cliente ya muestra una respuesta neutral a recuperación («Si existe una
cuenta…») y no cambia la contraseña antes de verificar el código. La plantilla
actual usa `{{ .Token }}`; los enlaces PKCE anteriores siguen admitidos. El cliente
limita su estado de enlaces PKCE a 15 minutos; ese límite no demuestra el plazo
configurado en Supabase para los códigos/verificaciones del servidor.

El propietario confirma que Confirm email está activado y que el OTP expira a los
3.600 segundos (una hora); indica que el resto de las comprobaciones de correo y
autenticación ya está resuelto. Son datos confirmados por el propietario, no una
prueba administrativa independiente realizada en esta sesión. Conservar evidencia
de entrega, alineación, uso único y controles de abuso en el entorno del propietario.
Para futuros cambios, volver a probar códigos válidos, caducados y reutilizados
con cuentas de prueba autorizadas. Mantener respuestas neutrales para correos
registrados y no registrados, también al reenviar. No registrar ni compartir
códigos, tokens, contraseñas o URLs de verificación completas en soporte.

En futuras comprobaciones, revisar entrega y spam en Gmail/Outlook y recopilar
solo encabezados saneados.
Las pruebas locales usan fixtures y no envían correos. La publicación de GitHub no
instala las plantillas ni cambia expiración, SMTP o seguimiento en Supabase/Resend.
La inspección administrativa sigue bloqueada por el endpoint de Supabase.

Fuentes:

- https://resend.com/security/gdpr
- https://resend.com/legal/dpa
- https://resend.com/docs/dashboard/domains/introduction
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/key-concepts-for-direct-marketing-using-electronic-mail/

La guía de ICO distingue servicio y marketing en el Reino Unido; no sustituye
la revisión de las reglas rumanas ni de los demás territorios de lanzamiento.

Romanian commercial-email reference: [Law 506/2004, Article 12](https://legislatie.just.ro/Public/DetaliiDocument/56973). Commercial campaigns need a separate assessment of consent or any applicable exception and opt-out requirements.
