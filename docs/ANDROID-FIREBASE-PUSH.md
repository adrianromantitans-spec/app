# Firebase Messaging para el piloto WebView

El archivo Android recibido corresponde a `com.divzplit.app`, proyecto `divzplit-1ce52`, número `641796053452`. Se incluye como `android/app/google-services.json`. Es configuración pública del cliente, **no** una cuenta de servicio ni una credencial de administrador. El SDK Firebase Messaging y el plugin Google Services se aplican únicamente al build WebView; la compilación TWA y el Web Push existente se conservan.

## Implementación preparada

- SDK Firebase Messaging 24.1.2. No se incorpora Firebase Auth, Firestore ni Analytics. Auto-init de Messaging desactivado hasta consentimiento mediante el botón existente de notificaciones; permiso de Android 13+ solicitado al activarlo.
- El código de la web utiliza su canal Web Push original cuando no existe el adaptador Android. En WebView usa el canal nativo de origen exacto. El teléfono guarda el identificador de la cuenta habilitada, no sus credenciales de Supabase ni las del servidor.
- Registro del token mediante RPC autenticado, idioma es/en/ro y renovación al reanudar. Cerrar sesión borra el vínculo local inmediatamente, cancela avisos visibles, elimina el token de Firebase y desactiva el registro del servidor. Si cambia una cuenta durante el registro no se debe habilitar para la cuenta anterior.
- El servicio recibe mensajes **data-only**. Comprueba permiso, consentimiento y `userId` antes de mostrar el aviso. El toque abre la notificación por ID; Supabase vuelve a comprobar a qué cuenta pertenece. No usar mensajes `notification` del compositor de Firebase para el envío de la app: Android puede mostrarlos automáticamente, saltándose estas comprobaciones locales.
- SQL separado para dispositivos, cola, leases y reintentos nativos. Respeta membresía actual, preferencias, grupos silenciados, notificaciones leídas/caducadas y cuentas bloqueadas. El borrado de cuenta elimina registros nativos y el export/retención contempla estos registros sin exponer tokens.
- Edge Function `native-push-dispatch` usa Firebase HTTP v1 y credenciales privadas exclusivamente del servidor. No necesita claves VAPID para FCM nativo. La función Web Push no se sustituye ni se cambia su programación.

## Configuración externa todavía necesaria (no se ha desplegado)

No basta con `google-services.json`: el envío requiere una cuenta de servicio privada y activar el backend. Esas claves **no deben subirse al repositorio, adjuntarse al chat ni incluirse en el AAB**.

1. Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. Guardar el JSON **en tu ordenador**. Confirmar `project_id=divzplit-1ce52`.
2. Supabase de DivZplit → Edge Functions → Secrets. Guardar:
   - `FCM_PROJECT_ID`: `divzplit-1ce52`.
   - `FCM_SERVICE_ACCOUNT_JSON`: contenido completo de **ese JSON privado**, pegado directamente en Supabase.
   - `PUSH_DISPATCH_SECRET`: reutilizar el valor ya usado para el emisor Web Push. No rotarlo ni crear otro si ya existe. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los facilita el entorno de Edge Functions.
3. Si no existe `PUSH_DISPATCH_SECRET`, hay que configurar un secreto aleatorio de al menos 32 caracteres tanto en Edge Secrets como en Vault con nombre `divzplit_push_dispatch`. Deben coincidir. **No ejecutar el cron hasta resolver esto**. El script de cron falla expresamente si no existe el secreto de Vault y nunca lo imprime.
4. Ejecutar en el SQL Editor, en este orden: `supabase/native-push.sql`, `supabase/account-deletion.sql`, `supabase/privacy-operations.sql`. Se revisan antes de ejecutar y usan las tablas actuales de la app; no cambian gastos ni saldos. `native-push.sql` deja el envío desactivado inicialmente.
5. Desplegar la nueva función como `native-push-dispatch`, con la verificación JWT de la plataforma desactivada. La función exige su propio `x-dispatch-key` antes de leer trabajos; las RPC del trabajador están limitadas a `service_role`. No desactivar la verificación de las RPC de usuario.

Con CLI, desde la raíz:

```sh
supabase functions deploy native-push-dispatch --project-ref xvtqmmpufvmyuokpmjvf --no-verify-jwt
```

Para el editor de Supabase se genera un **único archivo público** sin leer secretos:

```sh
node scripts/bundle-native-push.mjs /ruta/de/salida/index.ts
```

6. Confirmar que la API Firebase Cloud Messaging HTTP v1 está habilitada y que la cuenta de servicio tiene permiso para enviar mensajes en el proyecto correcto. Si la organización bloquea crear claves, detener este paso y usar el método de identidad autorizado por ella.
7. Ejecutar `supabase/native-push-cron.sql`, después de revisar el proyecto y configurar los secretos. Reutiliza el secreto de Vault existente, crea únicamente el cron nativo y activa la configuración nativa. El resto de crons y el Web Push se mantienen.
8. Desplegar la actualización web revisada: sólo el adaptador opcional de notificaciones, su mensaje de ajustes Android y versiones de recursos. Diseño, animación y acceso con Google no se modifican.
9. Compilar con `python3 android/scripts/build-release.py --wrapper webview`: `1.1.0-webview.3`, código **6**. Revisar que el código no esté usado en Play y distribuir primero por prueba interna. Mantiene paquete y firma de subida. El AAB anterior no contiene Firebase.

## Prueba de entrega real pendiente

Instalar desde Play en un Android con Google Play Services y WebView actual. Entrar en una cuenta de prueba, abrir la campanita → Preferencias → Activar notificaciones y aceptar el permiso de Android. La opción no se muestra como operativa hasta que la RPC de disponibilidad indique que el backend está activado.

Desde **otra cuenta de prueba de un grupo compartido** generar una novedad; dejar la app en segundo plano y comprobar recepción y apertura. Repetir con es/en/ro, permiso denegado, desactivar avisos, cerrar sesión, cambiar de cuenta, grupos silenciados y preferencias desactivadas. No deben aparecer avisos de la cuenta anterior. Forzar cierre desde Ajustes puede suspender entregas FCM hasta abrir otra vez; no confundirlo con dejar la app en segundo plano. Si la app sigue sin permitir habilitar, comprobar despliegue SQL/Edge antes de generar otro AAB.

Comprobar en Supabase que el cron sólo reclama su cola y que no aparecen errores de OAuth/FCM. Los detalles del servidor, tokens y claves no se copian al chat. La actualización no está lista para producción hasta verificar entrega real, retorno Google/Apple, cámara y ciclo de vida en Android. No se ha ejecutado un AAB en dispositivo desde este entorno.

## Validación reproducible

- `npm run check` y `npm test`: regresiones generales y pruebas de consentimiento, aislamiento de cuentas, token inválido, expiración, reintento, JWT firmado y endpoints fijos.
- `npm run test:database` y `NEXO_TEST_CONTAINER=CONTENEDOR_LOCAL python3 tests/native_push_database.py` **sólo** sobre un PostgreSQL desechable. Nunca apuntar estos tests a producción. Prueban la migración real, RLS, reasignación, leases, membresía/preferencias, bloqueo y borrado de cuenta.
- `tests/webview_bridge_browser.py`, `tests/webview_flows_browser.py`: protocolo nativo modelado en Chromium y regresiones de UI/OCR, sin cuentas reales.
- Lint, build firmado, bundletool y comparación del asset incluido. Nada de ello acredita entrega por FCM ni Google real; ambos requieren configuración externa y Android físico.
