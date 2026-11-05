# Ajustes visuales de DivZplit

## Aplicación

- `app.js`: elimina la animación adicional del logo, su bloqueo de interacción y su temporizador. Abre directamente el acceso o la sesión recuperada. Mientras se comprueba la sesión se muestra un estado neutro, sin logo ni formulario incorrecto. Elimina el icono DZ de las cabeceras y la franja Casa/Viaje del selector, manteniendo las tarjetas de todos los grupos y sus acciones.
- `home.js`: obtiene hasta cuatro gastos del grupo seleccionado, ordenados por fecha descendente; conserva el orden de llegada para empates y no modifica el documento del grupo. No mezcla grupos ni completa filas con datos inventados.
- `auth-ui.js`: mantiene el nombre DivZplit sin el icono cuadrado, el acceso por correo y Google/Apple, el registro y los enlaces de recuperación.
- `glass.css`: alinea la marca de texto, mantiene la Z y el punto morados y da estilo al estado de comprobación de sesión.
- `app/index.html`: renueva las versiones de recursos para evitar que una caché antigua oculte los cambios.

No se modifican Supabase, SQL, almacenamiento, el manifiesto, el favicon ni los iconos de instalación. No se intenta eliminar ninguna pantalla nativa exigida por iOS o Android.

## Landing

- `landing-copy.js`: explicaciones y textos alternativos para siete funciones en ES/EN/RO.
- `scripts/build-landing.mjs` e `index.html`: sustituyen las capturas repetidas de escenarios por siete secciones: gastos, compras, votaciones, monedas, grupos, tareas y presupuestos.
- `landing.css`: alterna las imágenes a izquierda y derecha en escritorio y apila texto e imagen en móvil, conservando los colores, tarjetas y animaciones existentes.
- `landing.js`: carga las imágenes y textos del idioma seleccionado con versiones nuevas de caché.
- `scripts/capture-landing.py`: captura cada pantalla desde los controles reales de la aplicación con respuestas locales y datos ficticios. Incluye productos, votos, tareas y una cotización de demostración; no contacta con usuarios ni crea registros reales.
- `assets/landing/` y `assets/welcome-*.png`: capturas actualizadas y tarjeta para compartir. Las imágenes siguen siendo WebP a dos resoluciones y se cargan de forma diferida salvo las de portada.

La conversión se presenta como la consulta disponible al saldar: el cambio es orientativo y no altera los gastos en su moneda original. La aplicación no envía dinero.

## Validación

- `npm run check` y `npm test`, incluida una prueba de fechas desordenadas, límite de cuatro filas y conservación del grupo original.
- `tests/intro_browser.py`: acceso directo y restauración lenta de una sesión sin mostrar un formulario incorrecto.
- `tests/visual_refinements_browser.py`: Chromium, con opción `DIVZPLIT_TEST_WEBKIT=1` para WebKit en un entorno compatible; cuatro gastos ordenados, aislamiento entre grupos, selector sin franja en anchos 320–1440, cabecera de texto, cambio de voto, compra compartida, tareas y «Ver todos». Usa fixtures locales; necesita los motores y sus dependencias.
- `tests/landing_browser.py`: siete imágenes distintas en los tres idiomas, adaptabilidad, navegación, movimiento reducido y uso sin JavaScript.
- `tests/auth_browser.py`, `tests/privacy_browser.py`, `tests/landing_migration_browser.py`, `tests/personal_browser.py`, `tests/help_browser.py` y `tests/notifications_browser.py`: acceso por correo, Google/Apple con PKCE, recuperación, invitaciones, exportación, cambios de grupo, creación/edición de gastos y funciones de Cuenta.

Las pruebas de navegador se ejecutan con el servidor local activo y `NEXO_URL=http://127.0.0.1:3031/app/` o `LANDING_URL=http://127.0.0.1:3031/`. Se intentó comprobar WebKit con bibliotecas locales, pero el renderizador WPE de este entorno no completó las interacciones. La revisión automatizada completada usa Chromium y tamaños de pantalla de iPhone/Android; la comprobación en Safari y teléfonos físicos queda pendiente.
