# Lista de la compra compartida

La lista se abre desde una tarjeta compacta del inicio de Casa, sin mostrar todos los productos en el inicio. También está en el menú «+» de cualquier grupo. Usa el diseño morado, hojas inferiores y navegación Liquid Glass existentes.

Permite añadir productos y cantidades opcionales, marcar o desmarcar comprados y crear un gasto a partir de los productos comprados que aún no tienen gasto. El formulario exige revisar importe, pagador y reparto; cancelarlo no crea gastos. Los productos se vinculan al gasto únicamente cuando se guarda. La lista se actualiza al abrir, al pulsar actualizar y cada diez segundos mientras está abierta.

Todos los miembros pueden añadir productos y marcarlos. Su autor y el administrador pueden editarlos y borrarlos. El administrador puede limpiar los comprados. Los productos vinculados a un gasto conservan su marca y permiten abrir ese gasto; borrar el producto o limpiar la lista nunca elimina el gasto ni modifica saldos. El límite es de 200 productos por grupo, incluidos los comprados.

## Activación

1. Publicar los archivos estáticos de esta versión.
2. Copiar `supabase/shopping.sql` completo en el SQL Editor del proyecto Supabase y ejecutarlo. Requiere las actualizaciones anteriores de DivZplit; no lleva claves ni secretos. Se puede ejecutar otra vez sin borrar datos.
3. Reabrir la aplicación y entrar en Casa → Lista de la compra.

Mientras no se ejecute el SQL, esta sección muestra que aún no está activada. Los gastos, pagos y demás funciones siguen disponibles. No requiere ninguna Edge Function nueva ni tocar Verify JWT.

## Integridad y acceso

Los productos viven en una tabla independiente con RLS y sin acceso directo para clientes. Los RPC verifican la pertenencia al grupo, los permisos del autor/administrador y la versión del producto. El checkout bloquea el grupo, comprueba que todos los productos están comprados y sin vincular, y utiliza el guardado de gastos existente. Añadir el gasto y vincular sus productos forman una única transacción. Una respuesta perdida se puede reintentar con los mismos identificadores sin duplicados. Dos personas no pueden convertir los mismos productos en dos gastos.

La demo guarda su lista local en una clave separada de los documentos financieros. Las cuentas compartidas no almacenan listas en localStorage. Las respuestas tardías se descartan si cambia el usuario o el grupo.

## Retirar la función

Se puede retirar la tarjeta y el acceso del menú o revertir este cambio de interfaz. No hace falta borrar la tabla ni los gastos creados. Retirar la lista conserva el historial financiero. No ejecutar DROP ni borrar registros financieros para ocultar esta función.

## Verificación

`npm run check`, `npm test`, `npm run test:database`, `NEXO_URL=http://127.0.0.1:3007/ python3 tests/shopping_browser.py` y `tests/personal_browser.py`.

Las pruebas de compras usan dos cuentas de prueba, PostgreSQL desechable local y transportes Auth/REST locales. Cubren permisos, aislamiento, versiones, límites, cancelación, conservación de saldos, checkout atómico, respuesta perdida, compras concurrentes, limpieza, títulos escapados y móvil/tablet en español, inglés y rumano.
