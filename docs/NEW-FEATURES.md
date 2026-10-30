# Recuperación, invitaciones, tickets y recurrencias

## Qué cambia

- En **Iniciar sesión → ¿Has olvidado tu contraseña?**, pedir un enlace por correo.
  Abrirlo en el mismo navegador, dentro de 15 minutos. Puede abrirse en otra pestaña.
  El enlace utiliza PKCE: un enlace no solicitado o abierto en otro navegador no
  permite cambiar una contraseña. Tras guardarla se pide entrar de nuevo.
- En **Invitar → Generar enlace**, WhatsApp abre un mensaje preparado. La persona
  elige el destinatario y confirma el envío; DivZplit no lo envía automáticamente.
- En **Añadir gasto**, foto opcional y repetición semanal, mensual o anual.
  El importe y los participantes se repiten; el ticket nunca se copia a otra cuota.
- La fecha mensual conserva el día original: 31 de enero → 28/29 de febrero → 31
  de marzo. Las cuotas vencidas se registran al abrir la app o sincronizar, por
  el autor de la serie o el propietario. No existe un proceso en segundo plano
  cuando todas las personas tienen la app cerrada. Cada sincronización recupera
  hasta 60 cuotas por serie, con el límite existente de 1.000 gastos por grupo.
  Los identificadores por serie y fecha y la revisión del grupo evitan duplicados.
- Para detener la serie, abrir el gasto original y pulsar **Detener repetición**.
  Los gastos ya registrados permanecen. Eliminar el original también detiene
  las futuras cuotas. La propiedad de la serie se mantiene en su gasto original.

## Activar las fotos privadas (una sola vez)

No hace falta modificar el esquema de grupos para las recurrencias.
Las fotos compartidas necesitan un bucket privado y sus permisos:

1. Abrir el SQL Editor de **tu proyecto Supabase**.
2. Copiar y ejecutar el contenido completo de `supabase/receipts.sql`.
3. Comprobar que Storage muestra `divzplit-receipts` como **privado**.
4. Con dos cuentas reales del mismo grupo, guardar un gasto con foto y abrirla
   desde la segunda cuenta. Comprobar con una tercera cuenta ajena que no accede.

La migración es transaccional y se puede repetir. No modifica los datos de grupos.
No se necesitan claves secretas en el navegador ni buckets públicos.

Si el bucket no está activado, intentar guardar un gasto con foto muestra una
explicación y conserva el formulario. Se puede quitar la foto y guardar el gasto.
La demo conserva las fotos únicamente en su navegador; no las sube a Supabase.

## Almacenamiento

Se aceptan fotos compatibles con el navegador de hasta 20 MB. Se convierten a
JPEG (máximo 1 MB, lado mayor de 1.800 píxeles), eliminando los metadatos de la
foto original. Los archivos compartidos se guardan como
`grupo/autor/gasto.jpg`, con acceso solo a miembros del grupo. Los enlaces para
verlos caducan en 60 segundos y no se guardan en el documento del gasto.

Al borrar un gasto confirmado se intenta borrar su foto. Un fallo entre la
subida y la confirmación del gasto puede dejar un archivo sin referencia;
conviene revisar los objetos sin referencia al gestionar las cuotas de Storage.
No borrar automáticamente archivos recientes: una subida puede estar en curso.

La recuperación depende del servicio de correo configurado en Supabase (SMTP,
URL de vuelta y límites de envío); las pruebas automáticas no mandan correos.

## Verificación

- `npm run check` y `npm test`.
- `python3 tests/extras_browser.py`: foto local, persistencia, recurrencia,
  recuperación en otra pestaña y nueva contraseña; usa un transporte Auth ficticio.
- `python3 tests/auth_browser.py`, `python3 tests/browser_smoke.py`.
- Con un contenedor PostgreSQL desechable configurado como en la guía existente:
  `NEXO_TEST_CONTAINER=... python3 tests/database_test.py`, después
  `NEXO_TEST_CONTAINER=... python3 tests/receipts_database.py` (solo en una base
  de pruebas vacía; crea un esquema Storage mínimo con RLS) y
  `NEXO_TEST_CONTAINER=... python3 tests/shared_browser.py`.

Las pruebas locales verifican SQL y permisos; no aplican la migración al Supabase
publicado ni verifican la entrega de correo o el servicio Storage de producción.
