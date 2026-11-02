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
