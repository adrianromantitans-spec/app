# Nexo

Una web para organizar viajes y planes en grupo: gastos compartidos, presupuestos,
votaciones y tareas, con un diseño adaptable a móvil.

## Ejecutar

Requiere **Node.js 22 o posterior**. No tiene dependencias externas ni necesita claves,
base de datos o instalación de paquetes.

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

Es una **demo local**, con datos de ejemplo para explorarla. Guarda los cambios en
`localStorage` de este navegador; no hay backend, registro, autenticación,
sincronización ni invitaciones reales. Los participantes son nombres locales y
solo se vota desde el perfil de Alex («Tú»). Si se borran los datos del navegador
se pierden los cambios; la exportación JSON sirve como copia consultable, pero
todavía no hay importación. Si el almacenamiento está bloqueado, la interfaz avisa
de que los cambios solo durarán la sesión.

## Validar

```sh
npm run check
npm test
```

Las 8 pruebas de lógica verifican repartos exactos, validaciones, saldos, pagos,
participantes y votos. Para la comprobación opcional de navegador, con el servidor
arrancado y Python Playwright y Chromium disponibles:

```sh
python3 tests/browser_smoke.py
```

Se puede configurar `CHROMIUM_PATH` y `NEXO_URL` para otro navegador instalado o
puerto. La prueba crea un contexto aislado y no cambia los datos de tu navegador.

## Estructura

- `index.html`, `styles.css`: interfaz adaptable y recursos gráficos locales.
- `app.js`: interacción, formularios y persistencia.
- `model.js`: cálculos financieros en céntimos y datos de ejemplo.
- `server.mjs`: servidor HTTP sin dependencias; sirve únicamente los recursos de la app.
- `tests/`: pruebas de lógica y flujo de navegador.

La siguiente etapa para compartir grupos entre personas es incorporar backend,
autenticación y permisos de acceso a cada grupo.

## Publicar en GitHub Pages

La aplicación es estática y admite la ruta `/app/`, sin un proceso de compilación.
En el repositorio de GitHub, abre **Settings → Pages** y selecciona
**Deploy from a branch**, la rama **main** y la carpeta **/ (root)**. Pulsa **Save**.
GitHub mostrará el enlace cuando termine el despliegue; para este repositorio será
`https://adrianromantitans-spec.github.io/app/`.

Subir el código no activa GitHub Pages por sí solo. El sitio seguirá guardando los
datos únicamente en el navegador de cada persona.
