# Publicar DivZplit en Google Play

La web sigue siendo la aplicación. Play recibe un paquete Android (Trusted Web
Activity) que abre `https://divzplit.com/app/`. No hace falta un servidor nuevo.

## 1. Activar el borrado de cuenta

En el SQL Editor de Supabase, ejecuta una vez
[`supabase/account-deletion.sql`](../supabase/account-deletion.sql).

Después, en la app: **Cuenta → Eliminar cuenta**. La misma acción está en
`https://divzplit.com/eliminar-cuenta/` (inicia sesión y confirma el correo).

Qué hace:

- Cierra todas las sesiones y bloquea ese correo y Google/Apple asociados.
- Borra avisos, suscripciones push y el nombre del perfil.
- En grupos compartidos el nombre pasa a ser «Cuenta eliminada». Los gastos y
  saldos de las demás personas se conservan.
- Un grupo donde esa persona está sola se elimina, incluidas sus fotos.
- Si administraba un grupo con más gente, otro miembro pasa a administrarlo.

Play Console pide esa URL en **Política → Seguridad de los datos → Eliminación
de cuentas**: `https://divzplit.com/eliminar-cuenta/`.

## 2. assetlinks.json

`/.well-known/assetlinks.json` declara el paquete `com.divzplit.app` y la huella
SHA-256 del certificado con el que firmas el Android App Bundle.

Esa huella tiene que coincidir con el **certificado de firma de la app** de Play
(no solo con la clave de subida). Después de crear la ficha, copia el SHA-256 de
**Play Console → Integridad de la app → Firma de la app** y añádelo al array
`sha256_cert_fingerprints` si es distinto. Sin eso, Android abre la web en Chrome
en lugar de a pantalla completa.

## 3. Generar el paquete

Hace falta el almacén de claves de subida (no está en el repositorio) y
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```sh
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://divzplit.com/manifest.webmanifest
bubblewrap build
```

El `twa-manifest.json` de referencia está en `android/twa-manifest.json`.
El AAB resultante se sube en Play Console. Conserva el almacén de claves: sin él
no podrás publicar actualizaciones.
