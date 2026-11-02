# Elegir la moneda de un pago

La ventana para saldar mantiene a la izquierda la moneda original del grupo. El selector de la derecha ofrece las otras 24 monedas admitidas. Elegir una muestra el equivalente y conserva el importe original debajo. Pulsar la moneda original vuelve a los importes de las cuentas.

Los grupos en EUR también pueden convertir a otra moneda. Se respeta el número de unidades decimales de cada moneda; ISK no admite céntimos. El selector y los títulos se traducen según el dispositivo, incluido «Últimos gastos» → «Ultimele cheltuieli».

## Cotizaciones y pagos

Se utiliza la función exchange-rates existente, que emite cotizaciones autenticadas contra EUR. Para convertir de RON a USD se consultan las cotizaciones RON/EUR y USD/EUR. Para pares que incluyen EUR solo se necesita la otra cotización. El cálculo usa fracciones enteras y redondea una vez en la unidad mínima de la moneda de destino.

Las fechas y fuentes se muestran en pantalla. Si los proveedores tienen fechas distintas, se conservan y muestran ambas. Es un cambio de referencia; los bancos pueden aplicar otro cambio o comisiones.

Al marcar un pago, el servidor comprueba pertenencia, destinatario, saldos, reservas pendientes, versión del grupo, titular y caducidad de ambas cotizaciones, moneda elegida e importe convertido. La solicitud conserva la moneda y el cambio. La recepción copia ese mismo registro al pago confirmado sin recalcularlo. Los gastos, deudas y saldos siguen en la moneda original del grupo.

Se conservan los pagos antiguos en euros y su RPC existente. Las nuevas conversiones a otras monedas usan un RPC adicional y no alteran registros anteriores. No se admiten cambios de la cotización desde el cliente ni importes convertidos por debajo de la unidad mínima.

## Activación

1. Ejecutar supabase/settlement-currencies.sql completo en Supabase → SQL Editor → Run, después de exchange-rates.sql.
2. Reabrir la app.

No requiere actualizar ni crear Edge Functions, cambiar claves o tocar Verify JWT. La vista de equivalencias usa el servicio existente. La activación SQL es necesaria para registrar pagos en las otras monedas; los pagos en euros siguen funcionando antes de esa activación.

## Verificación

npm run check y npm test cubren el cálculo exacto, redondeo y cotizaciones. tests/settlement_currencies_database.py prueba pagos auténticos de prueba, cotizaciones falsificadas/caducadas/de otra cuenta, monedas de cero decimales, reintentos, confirmación y conservación del saldo original. tests/settlement_currencies_browser.py comprueba la moneda izquierda fija, opciones, respuestas tardías, pagos en USD, grupos EUR y los textos en rumano e inglés. tests/fx_browser.py conserva las pruebas de pagos EUR.
