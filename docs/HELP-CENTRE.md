# Centro de ayuda

Cuenta → Ayuda y asistencia → Centro de ayuda abre una página dentro de la app,
también si la cuenta todavía no tiene grupos. Incluye 14 respuestas sobre grupos,
acceso, gastos, presupuestos, tickets, pagos, simplificación, monedas, notificaciones,
compra, tareas, datos y edad mínima. El contenido completo está en español, inglés
y rumano y sigue el idioma de la aplicación.

Las preguntas son desplegables nativos (`details`/`summary`). La búsqueda combina
los términos, ignora mayúsculas y tildes, filtra categorías vacías y permite limpiar
el resultado. La consulta se conserva en memoria al volver desde Cuenta y no se
envía a un servicio externo ni se guarda en almacenamiento persistente. El pie
incluye Contactar con soporte mediante el correo habitual.

Contenido y búsqueda: `help.js`. Diseño: `help.css`. La entrada de Cuenta reutiliza
las filas de configuración. Actualizar las tres versiones de cada respuesta si
cambia una función; no documentar funciones que aún no estén disponibles.

Validación: `node tests/help.test.mjs` y, con servidor local activo,
`NEXO_URL=http://127.0.0.1:3023/ python3 tests/help_browser.py`. Se han comprobado
los tres idiomas, acceso sin grupos, desplegables, búsquedas con y sin resultados,
texto de búsqueda escapado, navegación, contacto y anchos desde 320 px.
No requiere SQL ni cambios en Supabase.
