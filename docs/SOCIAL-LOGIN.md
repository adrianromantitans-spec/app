# Bienvenida e inicio de sesión con Google y Apple

Sin una sesión válida, Nexo abre **Bienvenido a Nexo**, con registro e inicio de
sesión por correo. La demo requiere pulsar **Explorar una demo**; refrescarla vuelve
a la bienvenida y conserva sus datos locales. Una sesión válida abre directamente
los grupos del usuario, también al recargar. Cerrar sesión vuelve a la bienvenida.

## Estado de Google y Apple

El frontend consulta `/auth/v1/settings` de tu proyecto y solo permite pulsar los
proveedores que Supabase informa como habilitados. No se muestran accesos ficticios
ni se cambian las opciones del servicio desde el navegador. Si no están habilitados,
las opciones indican **No disponible** y el correo sigue disponible.

En la comprobación del proyecto antes de este cambio, **Google y Apple estaban
deshabilitados**. El código está preparado, pero el propietario debe configurarlos
en Supabase y en sus respectivas consolas antes de probar un acceso real.

## Activar Google

1. Abre tu proyecto en Google Cloud Console. Configura la pantalla de consentimiento
   de OAuth y crea un **OAuth client ID** de tipo **Web application**.
2. En **Authorized JavaScript origins**, añade:
   `https://adrianromantitans-spec.github.io`
3. En **Authorized redirect URIs**, añade exactamente:
   `https://xvtqmmpufvmyuokpmjvf.supabase.co/auth/v1/callback`
4. En Supabase → Authentication → Sign In / Providers → Google, habilita el
   proveedor e introduce el **Client ID** y el **Client Secret** de Google.
   Guarda la configuración. El secreto se introduce solo en Supabase, nunca en
   el código, en GitHub ni en el chat.
5. Si la pantalla de consentimiento está en modo de pruebas, añade las cuentas
   que usarás como **Test users**. El resto de usuarios necesita que el estado y
   los requisitos de publicación de Google permitan el acceso.

Consulta la [guía oficial de Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
para los nombres de paneles y requisitos actuales.

## Activar Apple

Necesitas acceso a una cuenta de **Apple Developer** con Sign in with Apple
configurado para web. Sigue la
[guía oficial de Apple en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-apple)
para crear el App ID / Services ID asociado y su credencial.

- Dominio del retorno de autenticación: `xvtqmmpufvmyuokpmjvf.supabase.co`
- Return URL: `https://xvtqmmpufvmyuokpmjvf.supabase.co/auth/v1/callback`
- En Supabase → Authentication → Sign In / Providers → Apple, configura el
  identificador y la credencial privada y activa el proveedor.

La clave privada y el secreto de Apple se guardan exclusivamente en sus paneles
seguros. Los secretos de cliente para el flujo web de Apple requieren renovación
periódica; consulta su fecha de caducidad y las instrucciones del proveedor.
Esta implementación usa el flujo web de Apple, no el SDK nativo de iOS.

## URL de vuelta a Nexo

En Supabase → Authentication → URL Configuration, conserva:

- **Site URL:** `https://adrianromantitans-spec.github.io/app/`
- **Redirect URLs:** esa misma URL exacta.

Para desarrollo, añade también la URL local que estés usando, por ejemplo
`http://localhost:3000/`. No confundas el callback de Supabase registrado en Google
o Apple con el regreso final a la web de Nexo: son dos pasos diferentes.

## Prueba real tras activar un proveedor

1. Abre Nexo sin sesión y pulsa **Continuar con Google** o **Continuar con Apple**.
2. Confirma el consentimiento en la página del proveedor. Nexo vuelve a abrirse
   en la misma pestaña, verifica la sesión y muestra los grupos de esa cuenta.
3. Recarga: debe mantenerse la sesión. Cierra sesión: debe volver la bienvenida.
4. Repite desde una invitación y comprueba que, tras entrar, sigue disponible
   **Aceptar invitación**. Iniciar sesión no acepta grupos automáticamente.

No es necesario modificar el frontend al activar un proveedor: su estado se vuelve
a consultar al cargar la página. La publicación del código por sí sola no habilita
Google ni Apple y las pruebas con fixtures no prueban las credenciales reales.

## Flujo y comprobaciones locales

El acceso usa **PKCE S256**: se genera un verificador aleatorio en la pestaña y solo
su hash se incluye en la URL de autorización. El código de vuelta se intercambia
con ese verificador antes de comprobar la identidad. Se retiran los parámetros de
acceso de la barra de direcciones. Un código no iniciado en esa pestaña o caducado
se rechaza. Los tokens incluidos en enlaces de confirmación de correo no se adoptan
como sesión; el correo sigue requiriendo entrada explícita con contraseña.

Si Google o Apple entregan un nombre y falta `display_name`, se normaliza mediante
el endpoint autorizado del propio usuario para que aparezca en los grupos. No se
utilizan claves privilegiadas ni un endpoint de administración.

```sh
npm run check
npm test
# Con npm start activo, Python Playwright y Chromium:
python3 tests/auth_browser.py
python3 tests/browser_smoke.py
```

Las pruebas de OAuth interceptan el transporte de Auth y simulan el proveedor.
Verifican bienvenida, registro, errores, disponibilidad, PKCE, retorno, sesión,
invitaciones y diseño adaptable sin crear cuentas ni enviar correos reales.
