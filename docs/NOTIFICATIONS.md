# Avisos de DivZplit

La campanita contiene los avisos de cada cuenta, con contador, lectura, navegación
al grupo y preferencias. Nunca se avisa de las propias acciones. Gastos y nuevas
votaciones avisan a los demás miembros; tareas nuevas/reasignadas a su responsable;
los pagos a su destinatario o remitente según quién deba responder. Cada persona
puede silenciar grupos o categorías. Los avisos comienzan desde la activación.

## 1. Activar la campanita

En Supabase → SQL Editor → New query ejecutar **todo**
`supabase/notifications.sql`, después de `collaboration.sql`. La migración es
transaccional y repetible. No envía notificaciones a partir del historial anterior.
Una instalación nueva puede usar directamente `supabase/schema.sql`.

Con esto funciona la campanita dentro de la web. **Todavía no se envían avisos al
móvil cuando la web está cerrada**: hace falta completar el apartado siguiente.

## 2. Activar el envío al móvil

Requiere acceso administrativo a tu proyecto de Supabase y su CLI instalada.
El servidor de GitHub Pages no puede ejecutar esta función. No se incluyen claves
privadas ni claves `service_role` en la web o en este repositorio.

Desde la carpeta del proyecto:

1. Autenticarse en la CLI de Supabase y anotar la referencia del proyecto
   (las 20 letras de `https://REFERENCIA.supabase.co`).
2. Ejecutar `node scripts/prepare-push.mjs REFERENCIA`. Se crea `.push-setup/`
   con claves VAPID nuevas y un secreto de envío. La carpeta está excluida de Git.
   El script se niega a sobrescribir claves existentes; conservarlas entre despliegues.
3. Subir los secretos: `supabase secrets set --project-ref REFERENCIA --env-file .push-setup/push.env`.
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los proporciona Supabase a la función.
4. Desplegar: `supabase functions deploy push-dispatch --project-ref REFERENCIA --no-verify-jwt`.
   La función exige su propio encabezado secreto `x-dispatch-key`; una petición
   pública sin él no puede consumir la cola ni enviar avisos.
5. Solo después de desplegar, ejecutar **todo** `.push-setup/activate-push.sql`
   en el SQL Editor. Activa Cron y pg_net, guarda el secreto en Vault y programa
   el envío cada minuto. La clave pública de VAPID se publica mediante un RPC;
   la privada solo permanece en los secretos de la función.

**Los dos archivos de `.push-setup/` son privados**: no subirlos a GitHub ni
pegarlos en un chat. No cambiar la clave VAPID sin planificar renovar suscripciones.
Si el proyecto no tiene Cron/Vault disponibles, activarlos en el panel de Supabase
antes del paso 5. El despliegue requiere las capacidades y cuotas de tu plan.

Prueba real: con dos cuentas diferentes dentro de un grupo, activar los avisos en
la segunda, cerrar la web y añadir un gasto con la primera. Puede tardar alrededor
de un minuto, más el tiempo de entrega del proveedor. Revisar ejecución de Cron y
logs de `push-dispatch` si falla. Los estados de `divzplit_push_jobs` permiten ver
reintentos y destinos descartados sin registrar claves ni cuerpos de error privados.
No se ha validado entrega a dispositivos reales hasta completar este despliegue.

## 3. Activación por cada persona

Campanita → Preferencias → Activar notificaciones. El permiso del navegador solo
se solicita tras pulsar ese botón. Denegarlo conserva los avisos dentro de la web.

En **iPhone/iPad con iOS/iPadOS 16.4 o posterior**, abrir desde Safari → Compartir →
Añadir a pantalla de inicio y después abrir DivZplit desde ese icono. Una pestaña
normal de Safari en iPhone no recibe estos avisos. En Android usar un navegador
compatible, por ejemplo Chrome; también se puede instalar desde el menú del navegador.

Al cerrar sesión se borra el vínculo local y se anula la suscripción del dispositivo.
El worker ignora mensajes que no correspondan a la cuenta vinculada, incluso si
llega un aviso en tránsito después de salir. No se cachean páginas ni respuestas de
cuentas. La instalación no promete funcionamiento sin conexión.

## Cola y privacidad

- El servidor genera destinatarios a partir de membresía real y actor autenticado.
  Las tablas de suscripciones y cola no son legibles/escribibles por clientes.
- Los mensajes push se cifran con Web Push y muestran texto genérico en ES/EN/RO;
  los detalles se ven tras entrar en la web. El enlace se construye dentro de la app.
- Solo se aceptan destinos HTTPS de Apple, Google, Mozilla y Windows Push.
- La cola reclama trabajos con bloqueo, lease y `SKIP LOCKED`, reintenta errores
  temporales hasta cinco intentos, y desactiva destinos con respuesta 404/410.
- Se revalida cuenta del dispositivo, membresía, lectura y preferencias al reclamar.
  Los avisos leídos, silenciados o de más de un día no se envían desde la cola.
- La entrega es al menos una vez; el mismo identificador/tag evita acumular duplicados
  si el proveedor acepta un mensaje pero se pierde la confirmación del worker.
- Si el envío aún no está configurado, la interfaz no ofrece conceder un permiso inútil.

## Verificación

`npm test`, `npm run check`, `npm run test:database` y
`python3 tests/notifications_browser.py` (servidor en puerto 3004).
La prueba de navegador simula Push API y no contacta con proveedores ni pide permisos
reales. `deno check --node-modules-dir=none supabase/functions/push-dispatch/index.ts`
comprueba la función de Supabase. La entrega real requiere el paso 2 y dos dispositivos/cuentas.

## Invitación después del registro

Las cuentas nuevas reciben una invitación tras entrar con su identidad verificada,
incluida la confirmación por correo. Se puede omitir con Ahora no; el permiso del
navegador solo aparece al pulsar Activar. En Safari de iPhone se muestra la ayuda
para instalar; al abrir la app instalada por primera vez se puede activar directamente.
La invitación no interrumpe formularios, recuperación de cuenta ni invitaciones a grupos.
Se recuerda por cuenta/dispositivo y se registra como presentada en los metadatos
de la cuenta. No requiere ejecutar SQL adicional.

### Android React Native: invitación por cuenta

La versión **1.2.0-native.20 / código 26** corrige la marca de invitación nativa:
antes `native-push-offer-seen` era global y también se escribía al cerrar sesión o
borrar una cuenta. Al crear otra cuenta en la misma instalación, se omitía el aviso.
Ahora la marca es `native-push-offer-seen:<id de cuenta>` en el almacenamiento privado
del dispositivo. El cierre/borrado sigue limpiando la vinculación push, pero no
cuenta como haber visto o rechazado la invitación. Desactivarla explícitamente sí
conserva la decisión para esa cuenta. Las respuestas tardías no pueden marcar otra
cuenta ni abrir una invitación obsoleta.

La marca global anterior no se atribuye a una cuenta por suposición: una cuenta sin
marca propia puede recibir una invitación una vez tras actualizar. Se respetan el
permiso del sistema denegado, el servicio no disponible, un dispositivo ya activado,
la recuperación, el segundo plano, la animación inicial y otras ventanas abiertas.
No se obtiene token FCM ni se solicita permiso antes de pulsar Activar. Android 13+
muestra el diálogo del sistema si corresponde; versiones anteriores no tienen ese
permiso en tiempo de ejecución, pero sí la invitación y consentimiento de DivZplit.

Las pruebas incluyen confirmación por código con cero grupos, borrar/recrear con el
mismo correo, dos cuentas, persistencia, cierre de sesión antes del aviso y el hook
real de presentación. Pasan las 132 pruebas nativas y la suite compartida/web.
El cambio necesita instalar el AAB actualizado; no cambia SQL, Firebase, plantillas,
diseño, animaciones ni comportamiento web/iPhone. Para comprobar permiso y entrega
FCM reales hacen falta Android físico y el backend ya configurado.

### Presentación e idioma de los avisos Android

La versión **1.2.0-native.21 / código 27** deja que la cabecera normal de Android
muestre «DivZplit» y elimina el título adicional repetido del contenido. Conserva
el cuerpo y su versión expandida, el icono, el canal y el enlace al aviso. No usa
plantillas personalizadas ni oculta controles del sistema. Los avisos ya publicados
por versiones anteriores no se redibujan: comprobar con un aviso nuevo tras actualizar.

Cambiar el idioma de la app actualiza también la suscripción de este dispositivo,
sin esperar al siguiente refresco. Las altas/actualizaciones nativas comparten una
cola: una petición lenta de un idioma anterior no puede terminar sobrescribiendo
el último idioma seleccionado. Se comprueban cuenta, vinculación y consentimiento;
no se solicitan permisos, tokens nuevos ni altas de dispositivos desactivados por
cambiar idioma. La interfaz y la preferencia local siguen disponibles sin conexión;
el siguiente sync normal reintenta actualizar la suscripción.

El despachador ya obtiene `language` de la suscripción al reclamar cada aviso y
genera ES/EN/RO para gastos, compras, tareas, votaciones, pagos y recordatorios. No
requiere desplegar funciones ni SQL nuevos. «Automático» en el selector de Cuenta
usa ahora el catálogo: Automatic en inglés y Automat en rumano; las opciones de
idioma conservan sus nombres propios. Automático envía el idioma resuelto del
teléfono, no el valor `auto`, al servicio de notificaciones.

Las pruebas cubren el selector real renderizado, 21 textos/casos de envío nativo,
ES/EN/RO/automático, cambios rápidos, refrescos concurrentes, modo sin conexión,
cambio de cuenta y dispositivos desactivados. Instalar el nuevo AAB para comprobar
la presentación real de Android; el cambio no modifica la web/iPhone.

## Borrar todos los avisos

La campanita incluye **Borrar todo**, con confirmación. Borra todos los avisos de
la cuenta conectada, tanto leídos como pendientes, no solo la página cargada.
Conserva preferencias, grupos silenciados, suscripciones y avisos de otras cuentas.
Las entregas aún en cola se eliminan junto con sus avisos; un aviso ya enviado al
sistema del móvil puede permanecer allí. Para activar esta operación en proyectos
existentes, ejecutar `supabase/clear-lists.sql`. No contiene claves privadas.

## Abrir un aviso sin cambiar de pantalla

Pulsar un aviso muestra únicamente su detalle: tipo, asunto, grupo, autor y fecha cuando están disponibles. No cambia automáticamente a Gastos, Tareas, Votaciones o Pagos, ni abre un formulario de creación o una lista completa sobre esa sección. El usuario puede cerrar el aviso o entrar explícitamente en la sección mediante el botón de su categoría.

Se aplica también a recordatorios y enlaces del sistema del móvil. Si el aviso está en una página anterior del buzón se busca su información sin abrir el grupo. Las respuestas tardías se descartan cuando se cierra la ventana, se abre otro aviso o cambia la cuenta. Los textos se escapan y se mantiene el marcado como leído existente.

No requiere SQL ni funciones nuevas. Verificación: tests de apertura y sus carreras en tests/notification_open.test.mjs, y tests/notifications_browser.py con doce tipos de aviso, enlaces push, preferencias y cierre de sesión en ES/EN/RO.
