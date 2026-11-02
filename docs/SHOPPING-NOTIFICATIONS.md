# Avisos de la lista de la compra

Añadir un producto genera un aviso para los demás miembros que hayan activado las notificaciones de compras y no tengan el grupo silenciado. Cada destinatario recibe como máximo un aviso de productos nuevos por grupo cada cinco minutos. Marcar, desmarcar, editar, borrar o limpiar productos no envía avisos. Convertirlos en un gasto conserva el aviso de gasto existente.

«Recordar al grupo» es opcional. Solo aparece cuando hay productos pendientes y exige confirmación antes de enviar. Los miembros pueden usarlo; el remitente queda excluido. Hay una espera compartida de quince minutos por grupo, y un identificador estable evita duplicados al reintentar una respuesta perdida. Cancelar no hace ninguna petición de envío. No hay recordatorios automáticos ni programados para compras.

La categoría «Lista de la compra» se activa o desactiva en las preferencias de la campana. Guardarla es atómico con las demás categorías y grupos silenciados. Al desactivarla se cancelan los trabajos de push pendientes de esa categoría y el trabajador vuelve a comprobar las preferencias al reclamar trabajos.

Los avisos abren su propio detalle. Entrar en la lista es una acción explícita mediante «Ver lista de la compra»; no se abren formularios de creación.

## Activación en Supabase

1. Ejecutar supabase/shopping-notifications.sql completo en SQL Editor. Requiere shopping.sql y las migraciones anteriores de notificaciones. Puede repetirse sin borrar datos ni reenviar avisos antiguos.
2. Abrir Edge Functions → push-dispatch → Code. Sustituir el archivo principal por el contenido completo de supabase/functions/push-dispatch/dashboard-shopping.ts y desplegar la actualización.
3. Reabrir la app. El recordatorio se puede probar desde Lista de la compra → Recordar al grupo, confirmando el envío.

El archivo de función es un paquete público de código generado con scripts/bundle-push.mjs. No contiene claves ni secretos. Usa las variables que ya existen en la función; no hay que generar nuevas claves, volver a registrar dispositivos ni cambiar Verify JWT.

Los avisos internos funcionan tras ejecutar el SQL. El envío al móvil para compras se habilita cuando la versión actualizada de push-dispatch recibe su siguiente llamada autenticada del programador existente. Así, la versión anterior nunca envía un aviso de compras con texto de pagos. Los avisos creados antes de esa actualización quedan disponibles en la campana; no se envía una ráfaga de avisos antiguos.

## Verificación

- npm run check y npm test, incluidos textos push de compras en ES/EN/RO.
- npm run test:database: preferencias, pertenencia al grupo, silencio, exclusión del remitente, límite persistente de cinco minutos, quince minutos entre recordatorios, respuesta perdida, cola de push y ausencia de cambios financieros.
- tests/shopping_browser.py: añadir/marcar/cancelar no envía recordatorios; confirmar envía una petición explícita; el resto de la compra sigue funcionando.
- tests/notifications_browser.py: preferencia opcional, detalle individual de avisos y navegación al grupo.
