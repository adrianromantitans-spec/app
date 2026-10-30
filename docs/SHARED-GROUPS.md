# Activar las cuentas y los grupos compartidos

El frontend sigue funcionando en GitHub Pages. Las cuentas, los grupos y los
permisos se guardan en **tu proyecto de Supabase**. Hasta que se complete esta
configuración, Nexo conserva su demo local y explica que las cuentas no están
activadas. No existe un servidor compartido de prueba oculto.

## 1. Crear el proyecto

1. Entra en <https://supabase.com/dashboard> y crea un proyecto (el plan gratuito
   sirve para probarlo). Guarda la contraseña de PostgreSQL de forma privada.
2. Copia el **Project URL** y la **Publishable key** desde Connect o la sección
   de API del proyecto. Una clave `anon` antigua también es compatible.
3. Nunca pongas una contraseña, una clave `service_role`, una clave `sb_secret_`
   ni un token de usuario en el código o en el chat. El navegador solo necesita
   la URL y la clave pública. La protección de los datos se aplica en PostgreSQL.

## 2. Preparar la base de datos

En el SQL Editor de ese proyecto, abre una consulta nueva, pega el contenido
completo de [`supabase/schema.sql`](../supabase/schema.sql) y pulsa Run.
La migración es una transacción, permite volver a ejecutarla y no borra grupos.
No la ejecutes sobre un esquema de otra aplicación sin revisarla primero.

El esquema crea grupos, miembros, invitaciones y funciones con permisos
explícitos. Activa RLS en todas las tablas. Los usuarios no pueden escribir
directamente en las tablas: las funciones comprueban la identidad, la pertenencia
y la revisión del grupo antes de aceptar un cambio.

## 3. Configurar el acceso por correo

En Authentication → URL Configuration:

- **Site URL:** `https://adrianromantitans-spec.github.io/app/`
- **Redirect URLs:** añade exactamente esa URL y `http://localhost:3000/` para
  pruebas locales. Si utilizas Live Server en otro puerto, añade su URL exacta.

En Authentication → Providers, activa el acceso por email y contraseña y conserva
la confirmación por correo. Nexo permite registrarse, confirmar el correo, entrar
y cerrar sesión. El nombre visible se toma del registro, no de la dirección de
correo, que no se comparte en el documento del grupo.

Al volver del enlace de confirmación, Nexo pide entrar explícitamente con correo
y contraseña. No adopta tokens recibidos en una URL ni cambia una cuenta ya
abierta por el mero hecho de seguir un enlace.

**Correo a tus amigos:** el envío predeterminado de Supabase puede restringirse a
correos autorizados del equipo y tiene límites bajos. Configura un proveedor SMTP
en Authentication para permitir registros y confirmaciones de personas externas.
Introduce sus credenciales únicamente en el panel de Supabase. Verifica con una
segunda dirección que llega el correo antes de anunciar la función como activa.
No es necesario desactivar la confirmación para usar esta integración.

La recuperación de contraseñas y la eliminación de cuentas todavía no tienen
pantallas propias en Nexo; no se deben anunciar como funciones disponibles.

## 4. Conectar el frontend

Edita únicamente los dos valores públicos de [`config.js`](../config.js):

```js
export const cloudConfig = {
  url: 'https://TU-PROYECTO.supabase.co',
  publishableKey: 'TU_CLAVE_PUBLICA_PUBLISHABLE'
};
```

Guarda, prueba y publica ese cambio en `main`. GitHub Pages sirve el nuevo archivo
como JavaScript, sin compilación ni claves de servidor. Las claves privilegiadas
se rechazan por el cliente, pero esto no sustituye la revisión: nunca las publiques.

Si las comprobaciones desde el entorno cloud están restringidas por red, solicita
añadir el hostname exacto de tu proyecto (`TU-PROYECTO.supabase.co`) a la lista
permitida. No desactives el proxy ni TLS para saltarte esa restricción.

## 5. Comprobar con dos personas

1. Crea una cuenta y confirma su correo. Al entrar no deben aparecer los grupos
   de ejemplo: la demo local permanece separada y no se sube automáticamente.
2. Crea un grupo real, abre **Invitar** y genera un enlace.
3. Abre el enlace en un segundo móvil o en un contexto de navegador distinto.
   Registra una segunda cuenta, confirma su correo y acepta la invitación.
4. Añade un gasto desde el primer móvil. Debe aparecer en el segundo en unos
   ocho segundos, o al pulsar **Actualizar**.
5. Vota desde cada cuenta y completa una tarea. Comprueba que los votos son
   independientes y que el estado coincide.
6. Edita un formulario mientras la otra persona cambia el grupo. Al guardar una
   revisión antigua debe mostrarse un conflicto, recargar el estado confirmado
   y permitir revisar y reintentar el formulario sin sobrescribir al compañero.
7. Cierra sesión. Los grupos privados deben desaparecer y volver la demo local.

Estos pasos contra el proyecto real, su servicio de Auth, correo y GitHub Pages
son necesarios antes de afirmar que la función está activa en producción. Las
pruebas locales no sustituyen esa comprobación.

## Permisos y comportamiento

- Un usuario autenticado solo puede consultar los grupos a los que pertenece.
- El creador gestiona nombre, fechas, presupuesto e invitaciones.
- Los miembros añaden gastos y tareas y pueden completar tareas del grupo.
  Solo el autor de un gasto o el creador del grupo puede modificarlo o eliminarlo.
- Cada cuenta solo cambia su propio voto. Las preguntas y opciones de votaciones
  existentes no se modifican desde este flujo.
- Una devolución solo la puede registrar una de las dos partes implicadas.
  Los registros son inmutables; Nexo no procesa transferencias de dinero.
- Cada invitación permite hasta 20 incorporaciones, caduca a los 7 días y está
  limitada a un grupo de 50 miembros. Un nuevo enlace desactiva el anterior.
  El creador puede desactivar enlaces sin expulsar a miembros existentes.
- La base de datos guarda el hash del enlace. El token viaja en el fragmento de
  URL y se retira de la barra al abrirse; no forma parte de la petición HTTP.
  Quien posea un enlace vigente puede unirse: compártelo solo con tu grupo.
- Se permiten hasta 30 grupos propios, 1000 gastos, 1000 devoluciones, 500 tareas
  y 100 votaciones por grupo, con un documento de hasta 250 kB.
- Los nuevos miembros se incluyen en gastos futuros solo si se seleccionan;
  incorporarse no cambia el reparto de los gastos anteriores.
- La sincronización usa consultas cada 8 segundos mientras la página está visible
  y no hay un formulario abierto. No se guardan cambios compartidos sin conexión
  ni se promete colaboración instantánea. Los fallos se muestran y no se anuncian
  como guardados correctamente.
- El inicio de sesión se conserva en `localStorage` con tokens de acceso/renovación
  del servicio de Auth. No uses el mismo perfil del navegador en un dispositivo
  compartido sin cerrar sesión. Si el navegador bloquea su almacenamiento,
  tendrás que volver a entrar al recargar.

## Comprobaciones de desarrollo

```sh
npm run check
npm test
```

Las pruebas de navegador de la demo siguen disponibles con
`python3 tests/browser_smoke.py` y el servidor `npm start` activo.

Para las pruebas de PostgreSQL, usa un contenedor **desechable**, aislado de red:

```sh
# Usa una contraseña de prueba nueva; no reutilices credenciales reales.
docker run -d --name nexo-postgres-tests --network none \
  -e POSTGRES_PASSWORD=UNA_CONTRASENA_SOLO_DE_PRUEBA postgres:17-alpine
docker exec nexo-postgres-tests pg_isready -U postgres
npm run test:database
python3 tests/shared_browser.py
docker rm -f nexo-postgres-tests
```

La suite SQL crea una simulación local de `auth.users` y `auth.uid()` para ejecutar
las funciones reales con roles `anon` y `authenticated`. La prueba de dos
navegadores usa PostgreSQL real, pero intercepta el transporte HTTP y simula
Auth; **no envía correos ni verifica el servicio alojado de Supabase**. Requiere
Python Playwright, Chromium y el servidor de desarrollo. No ejecutes las
fixtures sobre una base de datos real o de producción.
