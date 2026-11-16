# DivZplit: piloto Android WebView (pendiente de pruebas, no publicar en producción)

La compilación habitual sigue siendo la TWA actual. La opción `--wrapper webview` selecciona un manifiesto, código Java, recursos de tema y un pequeño script **incluidos únicamente en ese AAB**. No se sirve JavaScript nuevo a la web y no se modifica ninguna animación, duración, componente, autenticación web ni tabla de Supabase.

Se reutilizan el proyecto Android, SDK 36, la clave de subida, `com.divzplit.app`, iconos y splash vectorial existentes. No se añade Capacitor ni otra dependencia. El Android Browser Helper existente aporta Custom Tabs para las páginas externas; el contenido de DivZplit se renderiza en Android System WebView. No aparece la interfaz ni el traductor de Chrome dentro de DivZplit. El proveedor de identidad **sí** se abre en el navegador seguro del sistema, como exige Google para OAuth; no se oculta esa interfaz ni se falsifica el user-agent.

## Estado y límites que impiden una publicación general

- **Push en segundo plano pendiente.** WebView no soporta la suscripción Web Push de la TWA. La bandeja y su actualización con la app abierta siguen utilizando el código web existente; no equivalen a avisos con la app cerrada. Hace falta implementar un transporte push nativo (por ejemplo FCM), asociar dispositivos a la cuenta y adaptar el envío del backend. No se han creado proyectos Firebase ni cambiado servicios externos. No solicitar permisos de notificación sin una implementación real.
- **Pruebas en dispositivos pendientes.** Compilar y pasar lint no demuestra que Google vuelva correctamente a WebView, que un fabricante gestione igual el teclado o que la cámara/OCR funcione en su dispositivo.
- El almacenamiento de Chrome y WebView es independiente. Los usuarios deberán volver a entrar al cambiar desde la TWA; los datos remotos de su cuenta permanecen en Supabase. Datos exclusivamente locales de la demo y preferencias de Chrome no se migran. Al volver a TWA tampoco se comparten sesiones.
- El piloto selecciona fotos existentes mediante el selector de documentos de Android, sin permisos amplios de almacenamiento. **Captura directa de cámara pendiente**; no se anuncia como implementada. Comprobar HEIC y OCR reales.
- Cambiar de orientación o matar el proceso mientras hay un selector/descarga/OAuth abierto puede cancelar la operación. El usuario debe repetirla. No se persisten verificadores OAuth, exportaciones ni contraseñas en almacenamiento nativo. Rotación, muerte de proceso y cancelación necesitan prueba física.
- No se añade modo sin conexión. Un error de red/TLS muestra una pantalla nativa con reintento; no se aceptan certificados inválidos. WebView moderno sigue siendo necesario para las capacidades de la web.

## Compilar sin sustituir la TWA por defecto

Con el JDK/SDK y las variables de firma explicadas en `android/README.md`:

```sh
python3 android/scripts/test-webview.py
python3 tests/webview_bridge_browser.py
python3 android/scripts/build-release.py --wrapper webview --keystore /ruta/privada/divzplit-upload.jks
```

Salida: `android/app/build/outputs/play/divzplit-1.1.0-webview.1.aab`, código **4**, firmado con la misma clave de subida. La versión experimental está en `android/webview-pilot.json`; comprobar en Play que el código no se haya utilizado y aumentarlo si es necesario. No regenerar ninguna clave.

La compilación normal conserva TWA 1.0.2 (3):

```sh
python3 android/scripts/build-release.py --wrapper twa --keystore /ruta/privada/divzplit-upload.jks
```

El script valida identidad, certificado esperado y configuración, ejecuta lint y genera y verifica la firma. Compilar en el mismo directorio un wrapper y después el otro selecciona sus fuentes; no cambia la configuración de producción.

## Google, Apple y enlaces verificados

1. Conservar en la web pública `.well-known/assetlinks.json` el certificado de **firma de aplicaciones de Google Play** `65:59:83:FB:B9:3A:E3:CC:0F:46:86:D7:2D:C8:05:FA:40:79:45:68:29:1E:47:84:7E:B9:22:B4:5E:A9:BC:64` para `com.divzplit.app`. La firma de subida no lo sustituye.
2. El piloto declara App Links tanto para `/app/` como para `/` (el retorno HTTPS ya empleado por Supabase). Usa `singleTask` para devolver el callback a la **misma WebView**, donde está el verificador PKCE en sessionStorage. El callback de la raíz se normaliza a `/app/` con la marca de compatibilidad que ya valida la aplicación. No se transfieren tokens o contraseñas desde el navegador a una interfaz JavaScript nativa.
3. No se cambian clientes OAuth, Supabase Redirect URLs ni los controles PKCE. Confirmar que sigue autorizado el retorno actual `https://divzplit.com/`. Si el navegador no entrega el App Link a la app, detener la distribución y resolver la verificación; no usar Google Login incrustado ni desactivar su seguridad.
4. En un teléfono conectado por ADB se puede comprobar `adb shell pm get-app-links com.divzplit.app` y, en Android 12+, volver a verificar con `adb shell pm verify-app-links --re-verify com.divzplit.app`. Comprobar que el dominio está verificado y que está habilitado abrir sus enlaces con DivZplit. No pegar un código OAuth real en comandos o capturas.
5. Si Android elimina el proceso durante OAuth, el verificador temporal podría perderse y el acceso deberá reiniciarse. No se puede prometer recuperación de ese flujo sin una prueba de proceso real.

## Lo que hay implementado en el piloto

- WebView acelerado, HTTPS de DivZplit únicamente para páginas internas; contenido mixto, acceso a archivos/content URL, cookies de terceros y depuración de producción desactivados. Certificados inválidos se rechazan.
- Páginas externas, Google/Apple y WhatsApp se abren en Custom Tabs; correo y teléfono usan la aplicación correspondiente. Se bloquean esquemas `intent:`, `javascript:`, `file:`, `content:` y HTTP para navegación externa.
- Selección de imágenes, exportación JSON con el selector Guardar de Android y copia de enlaces. El canal usa puertos WebMessage dirigidos al origen exacto del documento principal, sin `addJavascriptInterface`. No da acceso al sistema de archivos ni permite leer el portapapeles. Exportaciones limitadas a JSON y 20 MB, mantenidas sólo en memoria hasta que el usuario elige dónde guardar.
- Atrás cierra primero el modal web; luego usa el historial de WebView o cierra la actividad. Revisar los recorridos SPA de las pestañas, que no necesariamente añaden historial de navegador.
- Insets del sistema/teclado, almacenamiento web persistente y gestión de reintento. El splash obligatorio de Android permanece y la animación web se carga sin alteraciones.

## Prueba antes de considerar publicar

La PR es un borrador de migración. Revisarla **no requiere desplegar cambios a la web**. Se puede generar un AAB desde su rama para un grupo pequeño. No promocionar esta versión a producción ni sustituir las pruebas de todos los usuarios hasta completar los bloqueos.

En Google Play Console → DivZplit → Prueba interna, crear una versión, subir el AAB de código 4 y comprobar paquete y versión. Leer los avisos y distribuir sólo al grupo informado del piloto. Un usuario inscrito en varias pistas suele recibir la versión compatible con código superior; no usar la pista interna para probar con personas que necesiten las notificaciones actuales. El AAB no se instala directamente como un APK. Una APK firmada con la clave de subida tampoco actualiza una instalación firmada por Google Play.

Probar en Android reciente y en el dispositivo de 60 Hz:

- Actualizar desde la TWA instalada por Play y volver a entrar con correo, Google y Apple si está habilitado. Verificar rechazo/cancelación y que conserva los grupos y saldos de la cuenta correcta.
- Enlaces de invitación, correo de confirmación, recuperación de contraseña y retorno del navegador; repetir con proceso cerrado y proceso eliminado por Android.
- Animación original, idioma es/en/ro, teclado y botones del sistema; rotación, segundo plano/reanudación y 60/120 Hz si hay dispositivos.
- Foto de ticket, OCR, carga a Supabase y vista de la imagen. Exportar ambos JSON, comprobar su contenido, copiar y compartir invitaciones.
- Gastos, reparto, pagos, listas, votaciones y tareas; revisar la bandeja de notificaciones. El push con la app cerrada **aún no está implementado**.
- Sin red, error TLS, cancelar selectores, Atrás y enlaces externos. Verificar que nunca aparece Google Login dentro de WebView.

Para volver a TWA después de distribuir código 4 hace falta otro AAB TWA con **código mayor que 4**; Play no permite actualizar hacia una versión de código inferior. No asumir que basta volver a subir el AAB de código 3.

## Comprobaciones automáticas

`check-project.py` sigue verificando la TWA predeterminada. `test-webview.py` compila y ejecuta la política Java real con URLs válidas y hostiles y revisa los límites del manifiesto. `webview_bridge_browser.py` verifica con datos ficticios el canal JS, portapapeles, exportaciones, inyección idempotente y aislamiento de origen/iframes en Chromium. El build release y lint verifican compilación/configuración Android. **Ninguna de estas pruebas ejecuta un Android real ni confirma un acceso Google completo o entrega de push.**
