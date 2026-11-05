# Landing con capturas reales

Publicación autorizada por el propietario tras revisar las capturas. La migración conserva la configuración de Supabase sin modificarla.

## Rutas

- `/`: presentación pública, ES/EN/RO, sin inicializar Auth ni consultar datos de cuentas.
- `/app/`: aplicación existente, registro, acceso, grupos y Cuenta. Comparte los módulos y recursos originales; no hay una segunda aplicación ni base de datos.
- `/privacidad/`, `/condiciones/` y sus variantes de idioma: páginas legales existentes.
- Los enlaces antiguos de invitación, registro, acceso, notificación y retorno de Auth en la raíz se trasladan a `/app/` conservando sus parámetros. Los retornos PKCE siguen exigiendo el verificador original y sus comprobaciones de caducidad, identidad y reutilización.
- Una visita normal a la raíz permanece en la landing, incluso si existe una sesión. «Abrir la app» restaura la sesión desde el mismo almacenamiento del origen.

## Revisar localmente

```sh
npm start
# http://localhost:3000/       landing
# http://localhost:3000/app/  aplicación
npm run check
npm test
```

Las capturas provienen de la interfaz real ejecutada en Chromium, con respuestas locales de prueba y datos de ejemplo. No contienen información de usuarios ni se han creado grupos reales para obtenerlas. Hay versiones de las pantallas en los tres idiomas y dos resoluciones WebP; no se usan imágenes de aplicaciones ajenas, pantallas inventadas ni servicios de seguimiento externos.

```sh
# Con el servidor en puerto 3030, Python Playwright, Chromium y Pillow:
npm run capture:landing
npm run build:landing
python3 scripts/capture-landing-preview.py
```

`LANDING_URL` permite cambiar el servidor de las capturas. `build:landing` regenera el HTML estático desde los textos y las dimensiones de las imágenes. La página sigue siendo útil sin JavaScript; el selector conserva la elección de idioma al entrar en la aplicación. Las imágenes de secciones inferiores se cargan de forma diferida y las animaciones respetan movimiento reducido.

## Configuración de autenticación conservada

La publicación utiliza el retorno raíz ya configurado en Supabase:

- **Site URL:** `https://divzplit.com/`.
- **Redirect URLs:** conservar `https://divzplit.com/`.
- Registro, recuperación y Google/Apple solicitan ese retorno raíz; el puente de la landing abre `/app/` y el cliente conserva las comprobaciones PKCE.
- Para desarrollo permitir la raíz local exacta, por ejemplo `http://localhost:3000/`.

No hace falta cambiar la configuración de Supabase para publicar esta versión. No cambian el origen JavaScript de Google (`https://divzplit.com`) ni el callback de Google/Apple en Supabase (`https://xvtqmmpufvmyuokpmjvf.supabase.co/auth/v1/callback`). No se necesitan secretos nuevos, SQL ni migraciones de datos. Las pruebas locales simulan Auth y no validan credenciales de producción.

El service worker mantiene su registro en la raíz, el almacenamiento de vinculación y las suscripciones existentes; los clics de nuevas notificaciones abren `/app/`. El manifiesto conserva `id: ./` y pasa a iniciar y delimitar la aplicación en `/app/`. Las instalaciones anteriores que abran la raíz en modo independiente se trasladan a la app.

La futura TWA de Android deberá iniciar `/app/`. Este trabajo no publica nada en Google Play ni configura firma, Android o Digital Asset Links.

## Comprobaciones

- Sintaxis y suite completa de lógica: `npm run check` y `npm test`.
- `tests/landing_browser.py`: tres idiomas, anchos 320–1440, imágenes reales, pasos interactivos, menú, preguntas, movimiento reducido, uso sin JavaScript y ausencia de tráfico Auth en la landing.
- `tests/landing_migration_browser.py`: PKCE y recuperación iniciados en la antigua raíz, invitaciones, confirmaciones, notificaciones, instalaciones y restauración de una sesión existente.
- `tests/auth_browser.py`, `tests/notifications_browser.py`, `tests/privacy_browser.py`, `tests/help_browser.py`: regresiones de acceso, notificaciones y Cuenta en `/app/`.

Para estas pruebas usar `NEXO_URL=http://127.0.0.1:3030/app/` con el servidor activo. No crean usuarios ni envían correos o mensajes reales.

## Publicación y reversión

La implementación se revisó en `landing/real-app-preview` antes de su publicación autorizada en `main`. La comprobación de acceso con credenciales del propietario, invitación e instalación existentes sigue siendo una verificación manual adicional a las pruebas con fixtures.

Para revertir una futura migración, recuperar del commit anterior a la landing el HTML raíz, el manifiesto y los cambios de rutas/worker de esta rama, manteniendo los datos y las URL de retorno permitidas durante la transición. No borrar almacenamiento local, suscripciones ni tablas para revertir una página de presentación.
