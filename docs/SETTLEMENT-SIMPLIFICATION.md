# Simplificación de pagos

«Saldar cuentas» propone menos transferencias conservando exactamente el saldo
neto de cada miembro en la moneda original del grupo. No modifica los gastos ni
registra pagos al activar o desactivar «Simplificar pagos».

Los pagos pendientes de confirmar se reservan al calcular las sugerencias para
no pedirlos dos veces; solo la confirmación del destinatario cambia el libro de
pagos. Cada transferencia conecta directamente a una persona que debe dinero
con una que tiene dinero por recibir.

Con hasta 18 miembros con saldo distinto de cero se calcula el número mínimo de
transferencias mediante particiones de suma cero. Para grupos mayores se usa un
algoritmo acotado que nunca ofrece más transferencias que el plan habitual,
sin prometer un mínimo global. El resultado se conserva en memoria mientras
los saldos y los pagos pendientes no cambien.

No requiere migraciones SQL. Validación: comparación con búsqueda exhaustiva en
100 grupos aleatorios, grupos grandes y prueba de navegador con ocho miembros,
reducción de siete a cuatro transferencias, solicitud real de pago y confirmación
del destinatario en PostgreSQL local.
