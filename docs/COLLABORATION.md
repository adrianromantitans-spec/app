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
