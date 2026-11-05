# Activar las herramientas de privacidad

El borrado de cuenta lo hace la propia persona desde **Cuenta → Eliminar cuenta**
o desde [divzplit.com/delete-account](https://divzplit.com/delete-account/).
Para activarlo en un proyecto ya creado, ejecuta una vez
[`supabase/account-deletion.sql`](../supabase/account-deletion.sql).
Los grupos compartidos conservan gastos y saldos; el nombre pasa a ser
«Cuenta eliminada». Consulta [la guía de Play](PLAY-STORE.md).

Los cambios de la web no equivalen a una certificación legal. La política y las
condiciones están en inglés, español y rumano, con el responsable al final.

## Una acción en Supabase

1. Abrir el proyecto existente → **SQL Editor → New query**.
2. Copiar todo [`supabase/privacy-operations.sql`](../supabase/privacy-operations.sql)
   y pulsar **Run**. Es SQL, no una Edge Function. Requiere las migraciones actuales.
3. Comprobar la tarea diaria con:

```sql
select jobname, active from cron.job
where jobname = 'divzplit-privacy-retention';
```

Debe aparecer activa. Si pg_cron no está disponible, un administrador debe
programar la ejecución diaria de `public.divzplit_privacy_retention()` por otro
medio. No introducir claves privadas en el frontend ni en el chat.

La actualización añade la exportación de datos de la cuenta autenticada y la
limpieza de datos temporales. No elimina cuentas, gastos o pagos confirmados.
La web explica si la exportación aún no está disponible y permite pedir una copia
por correo. Los archivos de tickets y datos externos requieren revisión aparte.

## Funcionamiento de las solicitudes

**Cuenta** incluye el **Centro de ayuda**, **Contacto** y
**Descargar datos de mi cuenta**. Contacto abre el correo dirigido a soporte; el
usuario escribe su solicitud y debe enviarla. No se envía automáticamente. Revisar a
diario `support@divzplit.com` y seguir el [procedimiento operativo](privacy/OPERATIONS.md).
Un borrado requiere verificación y revisión de los datos compartidos; no se borran
las deudas de otros miembros por pulsar un botón.

## Pendientes que no se resuelven con código

- **Dirección y actividad en Rumanía:** el propietario ha confirmado que no tiene
  dirección profesional. Revisar la identificación exigible y la forma fiscal o
  empresarial para ingresos publicitarios con un profesional local.
- **Proveedores:** revisar y formalizar los acuerdos aplicables y las condiciones
  reales de conservación y transferencias; no se han aceptado contratos por ti.
  La base principal está en Irlanda, pero eso no cubre todos los servicios.
- **Edad mínima:** registro solo para personas de 16 años o más, sin vía de
  autorización de tutores para menores de 16. La declaración de edad no es una
  verificación de identidad ni un control contra eludir el formulario. Las
  personas de 16-17 pueden seguir siendo menores y tener protecciones específicas.
- **Publicidad:** todavía no hay anuncios ni rastreadores. Elegir proveedor y
  revisar consentimiento y protección de menores antes de activarlos. Nunca usar
  aceptación de condiciones como consentimiento publicitario general.

Las pruebas locales de base de datos, los flujos de registro y los documentos
traducidos han pasado. Las comprobaciones anónimas de siete tablas privadas de
producción no devolvieron registros. Esto no sustituye una auditoría completa de
la configuración de producción ni una revisión jurídica.
