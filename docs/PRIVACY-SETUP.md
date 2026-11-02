# Activar las herramientas de privacidad

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

Perfil → **Privacidad y mis datos** prepara un correo; el usuario debe enviarlo.
El mensaje indica claramente que no se ha enviado automáticamente. Revisar a
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
- **Menores:** el formulario remite a revisión con tutor y no ofrece registro
  directo para menores de 16. Esto no verifica edad ni autoridad parental y no
  sustituye un proceso completo con control del servidor. Definirlo y validarlo
  antes de abrir el registro de menores sin revisión manual.
- **Publicidad:** todavía no hay anuncios ni rastreadores. Elegir proveedor y
  revisar consentimiento y protección de menores antes de activarlos. Nunca usar
  aceptación de condiciones como consentimiento publicitario general.

Las pruebas locales de base de datos, los flujos de registro y los documentos
traducidos han pasado. Las comprobaciones anónimas de siete tablas privadas de
producción no devolvieron registros. Esto no sustituye una auditoría completa de
la configuración de producción ni una revisión jurídica.
