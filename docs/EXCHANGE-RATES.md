# Monedas y devoluciones en euros

DivZplit admite EUR, RON, USD, GBP, CHF, PLN, CZK, HUF, SEK, DKK, NOK, ISK,
ALL, BAM, MKD, RSD, MDL, UAH, RUB, BYN, TRY, GEL, AMD, AZN y GIP. Los países
que utilizan el euro comparten EUR; las libras locales sin código ISO se pueden
llevar en GBP. Bulgaria utiliza EUR desde 2026; BGN no se ofrece para grupos nuevos.

Cada grupo conserva su moneda de contabilidad. No se cambia después de registrar
gastos o pagos. «Saldar cuentas → Ver en euros» obtiene una cotización del servidor,
muestra la equivalencia y permite registrar la devolución en EUR. Se muestran
ambos importes, el cambio aplicado, la fecha y la fuente en la solicitud pendiente,
en la confirmación del destinatario, en el historial y en las devoluciones registradas.

Se usa el BCE cuando publica esa moneda y ExchangeRate-API como fuente alternativa.
Los proveedores actualizan sus referencias diariamente; el BCE publica en días
hábiles. Siempre se muestra la fecha de la última cotización disponible, sin
presentar un dato de viernes como una cotización de domingo. No se usa una referencia
de más de siete días. El código cachea las fuentes hasta una hora por instancia y
comparte solicitudes simultáneas. Se incluye la atribución y el enlace de cada fuente.
Los importes son orientativos: un banco puede usar otro cambio o cobrar comisiones.

El servidor emite cotizaciones privadas por cuenta que caducan a los 15 minutos.
Al registrar el pago valida que la cotización pertenece al remitente, la moneda,
la versión, el saldo disponible y el importe EUR exacto. El tipo y los importes
quedan guardados de forma inmutable en la solicitud. Confirmar después de que la
cotización caduque sigue siendo válido: confirma el importe que se había enviado.
El destinatario confirma la recepción; el ledger salda la cantidad original y no
recalcula gastos ni pagos anteriores. Los reintentos no duplican pagos. El redondeo
es al céntimo más cercano, con mitades hacia arriba. ISK utiliza unidades enteras;
los repartos, presupuestos, formularios, edición y conversiones respetan esa precisión.
Una conversión menor de un céntimo se paga en la moneda original.

## Activar en un proyecto existente

1. Ejecutar todo `supabase/exchange-rates.sql` después de las migraciones anteriores.
   No contiene secretos ni cambia gastos, saldos o monedas existentes. Una instalación
   nueva puede ejecutar directamente `supabase/schema.sql`.
2. Crear una función Edge nueva llamada exactamente `exchange-rates`.
   Para el editor del panel, generar un único archivo con
   `node scripts/bundle-rates.mjs RUTA_SALIDA.ts`, pegarlo en `index.ts` y desplegar.
   Con CLI: `supabase functions deploy exchange-rates --project-ref REFERENCIA --no-verify-jwt`.
3. Dejar Verify JWT desactivado en esa función: el código valida cada cuenta contra
   `/auth/v1/user`, compatible con los tokens actuales de Supabase. Usa las variables
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` que Supabase proporciona al servidor.
   No añadir claves a la web ni cambiar VAPID, `push-dispatch`, Vault o Cron.

Si falla la consulta o falta la activación, la app permite reintentar o seguir en
la moneda original. Nunca inventa una cotización ni convierte un pago a cero.
Esta versión no mezcla distintas monedas dentro de los gastos de un mismo grupo.

## Verificación

- `npm test` y `npm run check`: modelos, fuentes, redondeo, caducidad, autenticación,
  caché, transporte y fallos de proveedor.
- `NEXO_TEST_CONTAINER=... npm run test:database`: PostgreSQL desechable; cotizaciones
  no falsificables, permisos, reservas, idempotencia, confirmación, snapshot y saldos.
- `python3 tests/fx_browser.py`: servidor local en puerto 3003, transporte simulado,
  dos cuentas, móvil/tablet, ES/EN/RO, conversión, fallos y gastos enteros en ISK.

La entrega de una transferencia bancaria no se ejecuta ni verifica desde DivZplit.
