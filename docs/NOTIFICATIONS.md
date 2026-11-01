# Avisos de DivZplit

La campanita contiene los avisos de cada cuenta, con contador, lectura, navegación
al grupo y preferencias. Nunca se avisa de las propias acciones. Gastos y nuevas
votaciones avisan a los demás miembros; tareas nuevas/reasignadas a su responsable;
los pagos a su destinatario o remitente según quién deba responder. Cada persona
puede silenciar grupos o categorías. Los avisos comienzan desde la activación.

## 1. Activar la campanita

En Supabase → SQL Editor → New query ejecutar **todo**
`supabase/notifications.sql`, después de `collaboration.sql`. La migración es
transaccional y repetible. No envía notificaciones a partir del historial anterior.
Una instalación nueva puede usar directamente `supabase/schema.sql`.

Con esto funciona la campanita dentro de la web. **Todavía no se envían avisos al
móvil cuando la web está cerrada**: hace falta completar el apartado siguiente.

## 2. Activar el envío al móvil

Requiere acceso administrativo a tu proyecto de Supabase y su CLI instalada.
El servidor de GitHub Pages no puede ejecutar esta función. No se incluyen claves
privadas ni claves `service_role` en la web o en este repositorio.

Desde la carpeta del proyecto:

1. Autenticarse en la CLI de Supabase y anotar la referencia del proyecto
   (las 20 letras de `https://REFERENCIA.supabase.co`).
2. Ejecutar `node scripts/prepare-push.mjs REFERENCIA`. Se crea `.push-setup/`
   con claves VAPID nuevas y un secreto de envío. La carpeta está excluida de Git.
   El script se niega a sobrescribir claves existentes; conservarlas entre despliegues.
3. Subir los secretos: `supabase secrets set --project-ref REFERENCIA --env-file .push-setup/push.env`.
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los proporciona Supabase a la función.
4. Desplegar: `supabase functions deploy push-dispatch --project-ref REFERENCIA --no-verify-jwt`.
   La función exige su propio encabezado secreto `x-dispatch-key`; una petición
   pública sin él no puede consumir la cola ni enviar avisos.
5. Solo después de desplegar, ejecutar **todo** `.push-setup/activate-push.sql`
   en el SQL Editor. Activa Cron y pg_net, guarda el secreto en Vault y programa
   el envío cada minuto. La clave pública de VAPID se publica mediante un RPC;
   la privada solo permanece en los secretos de la función.

**Los dos archivos de `.push-setup/` son privados**: no subirlos a GitHub ni
pegarlos en un chat. No cambiar la clave VAPID sin planificar renovar suscripciones.
Si el proyecto no tiene Cron/Vault disponibles, activarlos en el panel de Supabase
antes del paso 5. El despliegue requiere las capacidades y cuotas de tu plan.

Prueba real: con dos cuentas diferentes dentro de un grupo, activar los avisos en
la segunda, cerrar la web y añadir un gasto con la primera. Puede tardar alrededor
de un minuto, más el tiempo de entrega del proveedor. Revisar ejecución de Cron y
logs de `push-dispatch` si falla. Los estados de `divzplit_push_jobs` permiten ver
reintentos y destinos descartados sin registrar claves ni cuerpos de error privados.
No se ha validado entrega a dispositivos reales hasta completar este despliegue.

## 3. Activación por cada persona

Campanita → Preferencias → Activar notificaciones. El permiso del navegador solo
se solicita tras pulsar ese botón. Denegarlo conserva los avisos dentro de la web.

En **iPhone/iPad con iOS/iPadOS 16.4 o posterior**, abrir desde Safari → Compartir →
Añadir a pantalla de inicio y después abrir DivZplit desde ese icono. Una pestaña
normal de Safari en iPhone no recibe estos avisos. En Android usar un navegador
compatible, por ejemplo Chrome; también se puede instalar desde el menú del navegador.

Al cerrar sesión se borra el vínculo local y se anula la suscripción del dispositivo.
El worker ignora mensajes que no correspondan a la cuenta vinculada, incluso si
llega un aviso en tránsito después de salir. No se cachean páginas ni respuestas de
cuentas. La instalación no promete funcionamiento sin conexión.

## Cola y privacidad

- El servidor genera destinatarios a partir de membresía real y actor autenticado.
  Las tablas de suscripciones y cola no son legibles/escribibles por clientes.
- Los mensajes push se cifran con Web Push y muestran texto genérico en ES/EN/RO;
  los detalles se ven tras entrar en la web. El enlace se construye dentro de la app.
- Solo se aceptan destinos HTTPS de Apple, Google, Mozilla y Windows Push.
- La cola reclama trabajos con bloqueo, lease y `SKIP LOCKED`, reintenta errores
  temporales hasta cinco intentos, y desactiva destinos con respuesta 404/410.
- Se revalida cuenta del dispositivo, membresía, lectura y preferencias al reclamar.
  Los avisos leídos, silenciados o de más de un día no se envían desde la cola.
- La entrega es al menos una vez; el mismo identificador/tag evita acumular duplicados
  si el proveedor acepta un mensaje pero se pierde la confirmación del worker.
- Si el envío aún no está configurado, la interfaz no ofrece conceder un permiso inútil.

## Verificación

`npm test`, `npm run check`, `npm run test:database` y
`python3 tests/notifications_browser.py` (servidor en puerto 3004).
La prueba de navegador simula Push API y no contacta con proveedores ni pide permisos
reales. `deno check --node-modules-dir=none supabase/functions/push-dispatch/index.ts`
comprueba la función de Supabase. La entrega real requiere el paso 2 y dos dispositivos/cuentas.

## Invitación después del registro

Las cuentas nuevas reciben una invitación tras entrar con su identidad verificada,
incluida la confirmación por correo. Se puede omitir con Ahora no; el permiso del
navegador solo aparece al pulsar Activar. En Safari de iPhone se muestra la ayuda
para instalar; al abrir la app instalada por primera vez se puede activar directamente.
La invitación no interrumpe formularios, recuperación de cuenta ni invitaciones a grupos.
Se recuerda por cuenta/dispositivo y se registra como presentada en los metadatos
de la cuenta. No requiere ejecutar SQL adicional.
