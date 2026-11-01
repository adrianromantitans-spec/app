# Pagos confirmados e historial

Para un proyecto existente que ya tiene `expense-tools.sql`, ejecutar una vez
[`supabase/collaboration.sql`](../supabase/collaboration.sql) en el SQL Editor de
Supabase. Se puede volver a ejecutar; conserva todos los grupos y pagos existentes.
Para una instalación nueva basta con `supabase/schema.sql`.

La interfaz comprueba la disponibilidad del servidor. Hasta aplicar el SQL,
continúan funcionando los gastos y los pagos históricos, pero no permite registrar
pagos nuevos mediante el antiguo flujo sin confirmación.

El administrador del grupo es la cuenta que lo creó (`owner_id`). No hace falta
cambiar las membresías existentes ni proporcionar ninguna clave privada a la web.

## Pagos

- El deudor pulsa **Marcar como pagado** y **Ya lo he enviado** después de transferir
  el dinero por su cuenta. DivZplit no realiza transferencias.
- El pago aparece en **Actividad** como pendiente. Los saldos siguen intactos.
- Solo el destinatario puede confirmar la recepción o indicar que no lo ha recibido.
  El remitente puede cancelar la solicitud mientras esté pendiente.
- Confirmar actualiza el documento del grupo y la solicitud dentro de una misma
  transacción. Las repeticiones y las confirmaciones simultáneas no duplican pagos.
- El servidor valida membresía, moneda, céntimos enteros y saldo disponible. Reserva
  los importes pendientes para evitar duplicarlos. Si un gasto cambia y deja el pago
  por encima de la deuda actual, hay que rechazarlo/cancelarlo y crear uno nuevo.
- Los pagos anteriores a esta actualización se conservan; no se exige reconfirmarlos.
  Un cliente antiguo ya no puede añadir ni modificar pagos con `nexo_save_group`.

## Historial

Un trigger del servidor registra altas, cambios y bajas de gastos, tareas,
votaciones y miembros, además de los detalles del grupo y pagos. Conserva actor,
fecha, moneda y valores anteriores/nuevos. La web muestra 50 entradas y permite
seguir cargando mediante un cursor; todos los miembros del grupo pueden leerlas.
Solo el creador puede borrar una entrada, mediante un RPC que verifica `auth.uid()`.
Borrar una entrada no modifica gastos, pagos, saldos ni la versión del grupo.
Las escrituras directas en las tablas de historial y solicitudes están prohibidas
para clientes, incluido el administrador del grupo.

Se registran cambios **desde la activación**. No se inventa quién modificó gastos
antiguos ni se reconstruye un historial anterior inexistente. Los nuevos registros
se guardan independientemente del gasto: si se borra un gasto, su historial permanece.
Eliminar el grupo completo sí elimina sus registros y solicitudes asociados.

## Pruebas

- `npm test`: modelo, clientes REST, paginación, cambio de cuenta y bloqueo sin SQL.
- `npm run check`: sintaxis.
- `npm run test:database`: PostgreSQL real en un contenedor desechable, incluidas
  identidades, RLS, rechazos, cancelaciones, confirmaciones simultáneas, borrado
  exclusivo del administrador y equivalencia de céntimos entre JavaScript/SQL.
- `python3 tests/collaboration_browser.py`: servidor local en puerto 3003; transporte
  simulado, dos cuentas, recorrido completo, tamaños móviles y ES/EN/RO. No usa
  cuentas, correos ni datos de producción.

## Historial compacto y borrado completo

Actividad muestra un acceso **Ver historial**. El listado completo se abre en una
ventana con altura limitada y paginación. El administrador puede borrar una entrada
o **Borrar todo**, siempre con confirmación. Los demás miembros solo consultan.

Para activar los borrados completos en un proyecto existente, ejecutar
`supabase/clear-lists.sql` después de `collaboration.sql` y `notifications.sql`.
El archivo define operaciones; ejecutarlo no borra datos existentes.
El historial se vacía solo en el grupo elegido y no altera documentos ni versiones.
Las nuevas modificaciones vuelven a registrarse normalmente después del borrado.


### Listas compactas de pagos

En Actividad, los pagos pendientes y las devoluciones registradas se abren en listas con desplazamiento. Las devoluciones se muestran en bloques de 50. Ejecutar `supabase/payment-lists.sql` en SQL Editor para activar las dos operaciones de «Borrar todo»; no requiere cambiar secretos, cron ni Edge Functions.

Solo el administrador puede limpiar listas. Los pendientes se cancelan en una operación bajo bloqueo del grupo, liberando las reservas sin modificar los saldos. Cada cancelación se registra en el historial y avisa a las partes, respetando sus preferencias. Las devoluciones confirmadas se archivan por identificador: el documento financiero y su versión se conservan íntegros. «Ver anteriores» permite consultar lo archivado y las nuevas confirmaciones siguen apareciendo en recientes. La migración es idempotente y por sí sola no cancela ni archiva entradas.

### Presupuesto opcional, tareas y votaciones

Ejecutar `supabase/planning.sql` después de las migraciones anteriores. Un presupuesto
vacío se guarda como `0` (sin límite): no muestra porcentajes ni exceso, y el
administrador puede establecerlo o quitarlo después. No modifica gastos ni pagos.

Tareas y Votaciones tienen accesos compactos y listas de 30 entradas por página,
con desplazamiento. El autor o el administrador puede editar y borrar una entrada;
solo el administrador puede borrar la lista entera, siempre con confirmación.
Las entradas antiguas sin autor las gestiona el administrador. Borrar conserva
el historial y los saldos y evita que se generen recordatorios de lo eliminado.
Las opciones de una votación existente se conservan junto con sus votos.

Las fechas son opcionales y se convierten desde la zona horaria del dispositivo
a UTC. La votación se cierra al vencer su fecha, también en el servidor; una tarea
vencida se puede completar. El recordatorio programado requiere una fecha límite
posterior. El indicador Importante destaca la entrada y el asunto de su aviso.

El autor o administrador puede enviar un recordatorio manual al resto del grupo,
con confirmación y una espera compartida de 15 minutos por entrada. Los avisos
respetan categorías y grupos silenciados y excluyen al remitente. Cron ejecuta
`divzplit_run_plan_reminders` cada minuto: reclama grupos con bloqueo, consume cada
ocurrencia una sola vez y omite tareas completadas y votaciones cerradas. No
depende de tener abierta la app. La migración instala/programa pg_cron cuando está
disponible en Supabase; la capacidad de programación se comprueba antes de guardar.

El envío al móvil usa la cola y las suscripciones ya activadas. Volver a desplegar
`push-dispatch` para actualizar el texto de los nuevos recordatorios; conservar
los secretos existentes y Verify JWT desactivado. Para el editor del panel se
puede generar un único archivo con `node scripts/bundle-push.mjs RUTA_SALIDA`.
No volver a ejecutar `prepare-push.mjs` ni cambiar las claves VAPID.

Pruebas: `npm test`, `npm run test:database`,
`python3 tests/planning_browser.py` con servidor local en puerto 3003. Cubren
presupuesto vacío, permisos, cierre de votaciones, votos conservados, avisos,
preferencias, duplicados y tamaños móviles en ES/EN/RO. No usan cuentas reales.
