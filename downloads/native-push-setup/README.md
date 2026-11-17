# DivZplit — configuración de envío nativo

Archivos públicos generados desde la PR #10 integrada en main (fe7cf5ae268d0b82461668cff7aa689e0f72c660). No contienen credenciales privadas.

- index.ts: archivo único para el editor de Edge Functions; nombre native-push-dispatch. Desactivar Verify JWT sólo para esta función: exige x-dispatch-key antes de acceder a la cola.
- 01-instalar-servidor.sql: instalación en una transacción de tablas/RPC nativas e integración de borrado/export/retención. Requiere las migraciones actuales de DivZplit. No activa el envío.
- 02-activar-envio.sql: configurar cron y activar sólo después de desplegar y guardar las credenciales. Reutiliza el secreto Vault existente divzplit_push_dispatch; no lo rota.

Las claves privadas se guardan directamente en Supabase Secrets. Revisar docs/ANDROID-FIREBASE-PUSH.md del repositorio. No ejecutar la activación antes de completar configuración y revisar la instalación. La recepción real requiere Android.
