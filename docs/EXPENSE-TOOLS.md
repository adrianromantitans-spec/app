# Editar gastos, repartir a medida y eliminar grupos

## Activación en grupos compartidos

Ejecutar una vez el contenido completo de `supabase/expense-tools.sql` en el SQL
Editor del proyecto de Supabase. La migración se puede repetir y no cambia los
importes, monedas ni gastos existentes. Incluye los permisos para eliminar grupos
y validar los repartos en el servidor. No hace falta repetir la configuración
de tickets. En una instalación nueva se puede usar el `supabase/schema.sql` completo.

La edición de gastos con reparto igual ya funciona con el esquema anterior.
Los repartos personalizados y la eliminación compartida requieren esta actualización;
si no está aplicada, la aplicación lo explica y no borra solo una copia local.
Todos los miembros deben recargar la aplicación para usar los nuevos cálculos.

## Editar

Abrir el detalle de un gasto y pulsar **Editar gasto**. El autor y el propietario
del grupo pueden editarlo; el servidor verifica el permiso. Se conservan su ID,
autor y ticket, salvo que se seleccione una foto nueva o **Quitar la foto actual**.

Editar un gasto recalcula los saldos y conserva los pagos ya registrados.
Un conflicto deja el formulario abierto para revisar y volver a guardar. Si el
servidor confirma un cambio pero se pierde la respuesta, la aplicación compara
el contenido antes de considerarlo guardado; que exista el ID no es suficiente.

En la plantilla de un gasto recurrente, editar el importe o reparto afecta al
original y a las futuras cuotas. Las cuotas ya generadas conservan su propio
contenido. La fecha de una plantilla activa es de solo lectura; se debe detener
la repetición antes de cambiarla. Editar una cuota no modifica la plantilla.

## Repartos

- Partes iguales: conserva el comportamiento anterior.
- Importes individuales: los importes deben sumar exactamente el total.
- Porcentajes: hasta dos decimales; deben sumar exactamente 100 %.
- Por partes: números enteros positivos, por ejemplo 2, 1 y 1.

Los importes se guardan como céntimos/bani enteros y los porcentajes en centésimas
de punto porcentual. Los repartos ponderados asignan primero la parte entera y
reparten los céntimos restantes a los mayores restos; los empates respetan el orden
de participantes. Todos los miembros obtienen el mismo resultado, sin cambiar el
total. Las claves de miembro se traducen entre la identidad local y la de Supabase,
no entre idiomas. El servidor valida totales, participantes y límites numéricos.

## Eliminar un grupo

**Editar detalles del grupo → Eliminar grupo**. Solo el propietario puede hacerlo.
Se muestra un aviso si hay saldos pendientes y se exige escribir el nombre exacto.
Eliminar no realiza transferencias ni paga las deudas.

La operación comprueba la revisión del grupo: si cambió desde que se abrió la
confirmación, se debe cerrar y revisar antes de borrar. El borrado elimina los
datos del grupo, miembros e invitaciones en una transacción. No borra las cuentas
de las personas. Los demás miembros dejan de ver el grupo al sincronizar.
La demo también permite borrar su último grupo y conserva ese estado al recargar.

Las fotos privadas se eliminan mediante la API de Storage después de confirmar
el borrado del grupo. Una cola privada `nexo_deleted_groups` conserva solo ID,
propietario y fechas para permitir reintentos y evitar reutilizar IDs borrados.
Solo el propietario que borró el grupo puede terminar esa limpieza; los antiguos
miembros pierden el acceso a las fotos. Si se interrumpe, se reintenta al entrar
de nuevo o después de otra eliminación. No se borran objetos directamente con SQL.
Los enlaces ya firmados tienen la duración de 60 segundos configurada anteriormente.

## Pruebas

`npm run check` y `npm test`. En navegador local: `tests/expense_tools_browser.py`.
En PostgreSQL desechable, después de `tests/database_test.py`, ejecutar
`tests/expense_tools_database.py` y `tests/expense_tools_shared_browser.py` con
`NEXO_TEST_CONTAINER` apuntando al contenedor aislado. Estas pruebas usan Auth y
Storage HTTP simulados con RLS real; no eliminan grupos ni fotos de producción.
