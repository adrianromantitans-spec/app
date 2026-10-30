# DivZplit

Una web para organizar viajes y planes en grupo: gastos compartidos, presupuestos,
votaciones y tareas, con un diseño adaptable a móvil.

Al abrir sin sesión aparece **Bienvenido a Nexo**, con registro e inicio de sesión.
La demo se abre únicamente con **Explorar una demo**. Una sesión válida conserva
el acceso a los grupos al recargar. Las opciones de Google y Apple se habilitan
según su configuración real en Supabase; consulta
[la guía de acceso social](docs/SOCIAL-LOGIN.md) para activarlas.

## Ejecutar

Requiere **Node.js 22 o posterior**. La demo local no tiene dependencias externas
ni necesita claves o base de datos. No requiere instalar paquetes.

```sh
cd /workspace/app
npm start
```

El servidor escucha en el puerto **3000** (configurable con `PORT`).
`npm run dev` reinicia el servidor al cambiar sus archivos; actualiza el navegador
para ver cambios en la interfaz.

## Qué puedes hacer

- Crear grupos con participantes, fechas y presupuesto; editar sus detalles.
- Añadir gastos, seleccionar quién paga y entre quiénes se reparten; consultar y eliminar gastos.
- Calcular saldos y proponer devoluciones para equilibrarlos, respetando cada céntimo.
- Registrar pagos **ya realizados**: Nexo no mueve dinero.
- Crear votaciones y cambiar o retirar tu propio voto.
- Asignar tareas y marcarlas como completadas.
- Ver gastos por categoría, modificar presupuestos y consultar actividad.
- Exportar los datos en JSON o restablecer la demo desde el perfil.

## Alcance de esta versión

Sin configurar un backend, Nexo funciona como **demo local**, con datos de ejemplo
y cambios en `localStorage`. En ese modo los participantes son nombres locales y
solo se vota desde el perfil de Alex («Tú»). La exportación JSON sirve como copia
consultable, pero todavía no hay importación.

La integración opcional con **Supabase** añade cuentas, grupos compartidos,
invitaciones por enlace y sincronización cada ocho segundos. Los datos de ejemplo
no se suben a la cuenta. Solo los miembros pueden consultar el grupo; el creador
gestiona sus detalles e invitaciones y cada persona vota con su identidad.

**La integración no está activa por defecto.** Hace falta crear tu proyecto,
ejecutar el esquema SQL y configurar sus dos valores públicos.
Sigue [la guía de activación](docs/SHARED-GROUPS.md) para configurar y verificar
Auth, correos, permisos y el despliegue en GitHub Pages.

## Validar

```sh
npm run check
npm test
```

Las pruebas de lógica verifican repartos exactos, validaciones, saldos, pagos,
participantes, votos, autenticación del cliente y conflictos. Para la comprobación opcional de navegador, con el servidor
arrancado y Python Playwright y Chromium disponibles:

```sh
python3 tests/browser_smoke.py
```

Se puede configurar `CHROMIUM_PATH` y `NEXO_URL` para otro navegador instalado o
puerto. La prueba crea un contexto aislado y no cambia los datos de tu navegador.

## Estructura

- `index.html`, `styles.css`: interfaz adaptable y recursos gráficos locales.
- `app.js`: interacción, formularios y persistencia.
- `auth-ui.js`: bienvenida, entrada y disponibilidad de proveedores de acceso.
- `model.js`: cálculos financieros en céntimos y datos de ejemplo.
- `cloud.js`, `config.js`: acceso a Supabase y su configuración pública opcional.
- `supabase/schema.sql`: tablas, permisos RLS y operaciones de grupos compartidos.
- `server.mjs`: servidor HTTP sin dependencias; sirve únicamente los recursos de la app.
- `tests/`: pruebas de lógica y flujo de navegador.

Consulta la guía de activación para ejecutar las pruebas de base de datos y de dos
navegadores. Esas comprobaciones locales no verifican el proyecto alojado ni su
envío de correos; la prueba final con dos cuentas reales sigue siendo necesaria.

## Publicar en GitHub Pages

La aplicación es estática y admite la ruta `/app/`, sin un proceso de compilación.
En el repositorio de GitHub, abre **Settings → Pages** y selecciona
**Deploy from a branch**, la rama **main** y la carpeta **/ (root)**. Pulsa **Save**.
GitHub mostrará el enlace cuando termine el despliegue; para este repositorio será
`https://adrianromantitans-spec.github.io/app/`.

Subir el código no activa GitHub Pages por sí solo. El sitio seguirá guardando los
datos únicamente en el navegador de cada persona.

## Nuevas funciones

Recuperación de contraseña, invitaciones por WhatsApp, fotos de tickets y gastos
recurrentes: consulta [la guía de activación y uso](docs/NEW-FEATURES.md).
Las fotos de grupos compartidos requieren ejecutar `supabase/receipts.sql` una vez.

## Idioma automático

La interfaz usa el primer idioma compatible de `navigator.languages`: español,
inglés o rumano (incluidas variantes como `es-MX` o `ro-RO`). Si ninguno coincide,
usa inglés. Cambiar la preferencia del navegador y recargar actualiza la interfaz.
Las fechas y los importes usan la variante regional seleccionada; la moneda
es la del grupo (EUR o RON). No se traducen los nombres, conceptos ni otros datos escritos
por los miembros. Las categorías y tipos mantienen sus valores internos para
que todos los idiomas puedan trabajar sobre el mismo grupo. No requiere SQL.

Los textos están en `translations.js`; `tr()` traduce mensajes y `ui` traduce
solo las partes estáticas de las plantillas, antes de interpolar datos. Al añadir
una pantalla, usa estos helpers y conserva los valores de formularios, claves
y datos de usuario sin traducir. `tests/i18n_browser.py` comprueba los tres idiomas,
el fallback y que cambiar de idioma conserve los datos existentes.

## Monedas por grupo

Se puede elegir euro (EUR) o leu rumano (RON) al crear un grupo. La moneda es
compartida por todos sus miembros y no depende del idioma. Los importes se guardan
en unidades menores enteras (céntimos/bani), sin conversiones automáticas.

Para grupos compartidos existentes, ejecutar una sola vez el contenido completo
de `supabase/currencies.sql` en el SQL Editor de Supabase. Se puede repetir y no
reescribe los grupos ni convierte sus importes. Los grupos sin moneda conservan
EUR. Una base nueva puede ejecutar directamente `supabase/schema.sql`.

Hasta aplicar la actualización, EUR sigue funcionando. Crear o guardar un grupo
RON muestra un mensaje explicativo y no lo convierte silenciosamente a euros.
Solo el propietario puede cambiar la moneda de un grupo vacío. Cuando ya existen
gastos o pagos, la moneda se bloquea tanto en la interfaz como en el servidor.
Para otra moneda, crear otro grupo. La actualización no cambia Storage ni tickets.

Pruebas adicionales: `tests/currency_browser.py` y, después de las pruebas de base
de datos en un contenedor desechable, `tests/currency_database.py`.

## Edición, repartos y borrado de grupos

Consulta [la guía de estas funciones](docs/EXPENSE-TOOLS.md). Para activarlas en
grupos compartidos existentes, ejecutar una vez `supabase/expense-tools.sql`.
Los importes, participantes y monedas existentes se conservan.

## Interfaz de cristal suave

`glass.css` aplica superficies claras y sombras suaves a las tarjetas, formularios,
perfil y navegación. La barra móvil tiene Inicio, Grupos, +, Actividad y Perfil.
El + abre acciones rápidas y permite elegir el grupo antes de añadir un gasto,
tarea o votación. El presupuesto sigue accesible desde el resumen del grupo y
la navegación de escritorio. El perfil también tiene una página propia.

La ilustración local `assets/lisbon.png` se usa solo en la tarjeta de Lisboa;
los demás grupos muestran su icono sobre un fondo suave. Los nombres y cantidades
siguen siendo datos reales, no textos incrustados en una imagen. Hay estilos sin
transparencia para navegadores sin backdrop-filter y preferencias de movimiento
reducido. `tests/glass_browser.py` verifica navegación, grupo de destino, perfil,
presupuesto y tamaños de pantalla en los tres idiomas. No requiere SQL adicional.


### Lectura de tickets

En un gasto nuevo con el importe vacío, adjuntar una foto inicia la lectura.
Si detecta un total fiable y la moneda es compatible, rellena el importe y los
campos vacíos de comercio/fecha. Puedes corregirlos antes de guardar. El gasto
solo se guarda al pulsar Guardar. **Leer ticket** permite repetir la lectura y
**Revisar datos detectados** permite usar otras sugerencias explícitamente.
No sobrescribe datos escritos a mano, tampoco durante la lectura; no convierte
monedas. Al sustituir la foto elimina solo los datos que había rellenado el OCR
y vuelve a leer. En gastos existentes no modifica campos automáticamente.

El reconocimiento se ejecuta en un Web Worker del dispositivo con Tesseract 6,
modelos en español, inglés y rumano, y archivos alojados en esta misma web.
Solo se cargan al iniciar una lectura; la primera vez requiere descargar los
modelos y puede tardar. La foto solo se comparte al guardar según el flujo de
tickets existente. El texto OCR completo no se almacena ni se comparte.
Si la lectura falla, siempre se puede introducir el gasto a mano. La calidad de
la foto afecta al reconocimiento: hay que revisar las sugerencias.

No requiere claves nuevas, migraciones ni servicios de pago. Versiones y
licencias: `vendor/ocr/`. La CSP permite WebAssembly (`wasm-unsafe-eval`) y
workers del propio origen, sin permitir evaluación arbitraria de JavaScript.

Pruebas con tickets generados y motor real (servidor en puerto 3001):

```sh
PORT=3001 npm start
python3 tests/receipt_ocr_browser.py
python3 tests/receipt_ocr_lifecycle_browser.py
```

El primer test cubre los tres idiomas, ambos motores SIMD/no SIMD, revisión,
moneda diferente y guardado. El segundo cubre cancelación, cierre, cambio de
foto, fallo del lector e inclusión segura del texto reconocido. Los casos del
analizador de importes y fechas se ejecutan también con `npm test`.


El lector usa ahora la foto original de la selección, separada de la versión
comprimida que se adjunta al gasto. Conserva más detalle, localiza el papel cuando
se distingue del fondo y reintenta con más contraste, otras distribuciones del
texto y orientación. Si el total no se reconoce, se pide recortar en lugar de
presentar símbolos como un comercio.

**Recortar para leer** permite marcar el ticket con el dedo o el ratón; las
flechas y +/− ajustan también el recorte con teclado. **Girar foto** cambia su
orientación para la lectura. **Leer esta zona** reconoce solo el recorte; estas
operaciones conservan la foto adjunta y no guardan un gasto automáticamente.

`tests/receipt_photo_browser.py` reproduce una foto grande con un ticket pequeño,
texto tenue y mucho fondo, el recorte táctil y por teclado, la orientación lateral
y el resultado con símbolos ilegibles. Usa `OCR_URL` para seleccionar el servidor.

`tests/receipt_autofill_browser.py` verifica que adjuntar una foto rellena el
importe sin pasos adicionales, admite correcciones antes del guardado y protege
datos manuales, moneda incompatible y sustitución de la foto.
