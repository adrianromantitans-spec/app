# Publicación de DivZplit en Google Play

Entrega preparada el **5 de noviembre de 2026** en la rama `review/google-play-preparation`, desde `89c74f1ac6d364a263c31f2604c04bf32dcc0c1b`. No se ha fusionado a `main`, publicado una versión en Play, cambiado Supabase ni desplegado la web. La rama contiene un proyecto Android TWA, no una reescritura ni una web rediseñada.


**Actualización del 16 de noviembre:** la rama incorpora el arranque Android **1.0.1, código 2**, de la PR #4. Para actualizar la prueba existente, usa ese AAB y consulta [ANDROID-STARTUP-FIX.md](ANDROID-STARTUP-FIX.md). Las referencias a 1.0.0 de esta guía documentan la primera entrega. La huella de Play App Signing de la PR #3 ya está incorporada en `main`; comprueba su despliegue y la instalación real antes de dar la verificación por completada.

## 1. Archivos de la entrega

- **`divzplit-1.0.0.aab`**: bundle release firmado con la clave de subida nueva. Paquete `com.divzplit.app`, versión `1.0.0`, código `1`, min SDK `24`, target `36`.
- **`divzplit-google-play-review.zip`**: proyecto completo y documentación para revisión; excluye compilaciones intermedias, `.git`, claves y contraseñas. Incluye una relación exacta de archivos y un parche binario aplicable al commit base.
- **`divzplit-firma-privada.zip`**: almacén privado `divzplit-upload.jks`, alias y contraseñas. No se publica en GitHub. Extrae y guarda el almacén y la contraseña por separado.
- **`ENTREGA-GOOGLE-PLAY.md`** y el informe de comprobaciones: acceso rápido a las instrucciones y limitaciones.
- **`android/upload-certificate.pem`**: certificado público para comprobar la identidad del firmante; no es la clave privada de firma.

El AAB ha de pasar todavía las pruebas en Play y la revisión de Google. Que compile y tenga firma válida no garantiza aceptación ni equivale a una instalación real probada.

## 2. Preparar tu cuenta y la ficha

1. Crea/verifica tu cuenta de desarrollador de Google Play y completa la identidad, datos de contacto, pagos de registro y verificaciones que Play pida. El tipo de cuenta debe reflejar tu situación real.
2. En Play Console, pulsa **Crear aplicación**: nombre **DivZplit**, tipo **Aplicación**, gratuita si ese es tu modelo actual, y el idioma principal que prefieras para la ficha. El paquete permanente quedará asociado al primer AAB.
3. Completa las declaraciones de políticas, contacto de soporte y acceso a la app. Facilita a los revisores una **cuenta de pruebas dedicada** que funcione y permita revisar las funciones compartidas, con instrucciones y otro miembro de prueba si es necesario. No entregues tu cuenta personal ni credenciales de producción administrativas.
4. Sube el icono de ficha `android/store_icon.png` (512×512) y prepara la imagen destacada (1024×500) y capturas reales de móvil según las exigencias actuales de la ficha. Muestra funciones que existan. No se han inventado capturas de una instalación nativa.
5. Usa [PLAY-STORE-LISTING.md](PLAY-STORE-LISTING.md) como borrador de las descripciones española, inglesa y rumana; revísalas antes de publicarlas.

## 3. Contenido, edades, anuncios y datos

| Campo | Qué preparar / declarar |
|---|---|
| Privacidad | `https://divzplit.com/privacy/` |
| Condiciones | `https://divzplit.com/terms/` |
| Eliminación de cuenta | `https://divzplit.com/delete-account/` |
| Alias españoles existentes | `/privacidad/`, `/condiciones/`, `/eliminar-cuenta/`; se han comprobado accesibles |
| Edad mínima del servicio | **16 años**; esta entrega no la cambia |
| Público objetivo | Franjas coherentes con el servicio actual: **16–17** y **18 o más**, si reflejan el público real |
| Clasificación por contenido | Responder el cuestionario IARC con las funciones reales; **no se puede garantizar PEGI 3 / Everyone** |
| Anuncios | **No**, mientras no muestres anuncios; no hay SDK de anuncios añadido en este Android |
| Acceso | Registro, Google/email y funcionalidades de grupos: dar al revisor instrucciones y acceso válido |

La clasificación por contenido y la edad de registro son conceptos diferentes. No marques que la app está diseñada para niños por querer una clasificación baja. Debes declarar la interacción y contenido compartido: nombres de grupos, conceptos de gastos, fotos de tickets, tareas y votaciones. No copies respuestas de Splitwise ni ocultes funciones para obtener una clasificación concreta.

### Seguridad de los datos y funciones financieras

Completa el formulario a partir del funcionamiento y configuración reales, no copiando una plantilla de otra app. Revisa al menos:

- Nombre, correo e identificadores de cuenta; autenticación con proveedores y almacenamiento en Supabase.
- Importes, gastos, saldos y otra información financiera introducida por usuarios.
- Fotos de tickets opcionales, y contenido compartido de grupos, compras, tareas y votaciones.
- Suscripciones/endpoints de notificaciones cuando el usuario las activa.
- Contactos con soporte, registros técnicos y servicios efectivamente usados, incluidos los que configures fuera del repositorio.

Distingue recopilación, finalidad y compartición según las definiciones de Play. Los gastos y fotos se comparten con miembros del grupo; los proveedores que procesan datos por tu cuenta tienen reglas específicas en la declaración. No declares todo como «no recopilado» solo porque la interfaz sea web. La lectura OCR se hace localmente, pero una foto adjunta puede subirse al almacenamiento privado del grupo.

Si Play muestra la declaración de funciones financieras, describe el **registro/reparto de gastos y gestión de saldos**. DivZplit no envía dinero ni ejecuta transferencias. Revisa las opciones actuales del formulario antes de elegir una categoría.

Comprueba que la política identifique al responsable, contactos, destinatarios, conservación, solicitudes y países aplicables. La existencia de una página HTTP 200 no acredita esa revisión ni que el borrado funcione realmente.

### Eliminación de cuenta: comprobación operativa

En el SQL Editor de Supabase, ejecuta una vez
[`supabase/account-deletion.sql`](../supabase/account-deletion.sql).

Después, en la app: **Cuenta → Eliminar cuenta**. La misma acción está en
`https://divzplit.com/delete-account/` (inicia sesión y confirma el correo).

Qué hace:

- Deshabilita la cuenta anterior, revoca sesiones y retira las identidades
  asociadas. Esto no garantiza una prohibición de volver a registrarse.
- Borra avisos, suscripciones push y el nombre del perfil.
- En grupos compartidos el nombre pasa a ser «Cuenta eliminada». Los gastos y
  saldos de las demás personas se conservan.
- Un grupo donde esa persona está sola se retira de la app. La eliminación de
  fotos requiere completar y verificar el borrado mediante la API de Storage;
  borrar filas de `storage.objects` no elimina los archivos físicos.
- Si administraba un grupo con más gente, otro miembro pasa a administrarlo.

Play Console pide esa URL en **Política → Seguridad de los datos → Eliminación
de cuentas**: `https://divzplit.com/delete-account/`.

### Comparación con Splitwise

Consulta de fuentes oficiales: 5 de noviembre de 2026. Sus condiciones prohíben
el uso a menores de **13 años** y su ficha de Play consultada muestra **Everyone**
en la región servida. Las etiquetas regionales, como PEGI 3, no equivalen a su
edad mínima contractual. El cuestionario de DivZplit se debe completar por sus
propias funciones; no se puede copiar la clasificación ni el público objetivo
privado de otra app.

Para bajar el registro a 13, hay que adaptar el producto y las políticas a los
países de uso y a las bases del tratamiento. Cuando el tratamiento se basa en el
consentimiento, el umbral de consentimiento parental en la UE varía entre 13 y
16 años. Cambiar solo los textos o aceptar una casilla del menor no implementa
la autorización de un tutor. Revisa también la capacidad contractual y los
permisos opcionales; 16 no es una obligación universal para toda app.

## 4. Subir el AAB a pruebas internas

1. Abre **Pruebas y versiones → Pruebas internas** (los nombres pueden variar en la consola) y crea una versión.
2. Activa **Play App Signing** y usa la opción de que Google genere y gestione la clave de firma de distribución para esta primera app. Conserva tu propia clave de subida entregada.
3. Sube **`divzplit-1.0.0.aab`**. No subas el `.jks`, contraseñas, ZIP de código ni un APK.
4. Confirma paquete `com.divzplit.app`, código `1`, versión `1.0.0` y que no aparecen errores de firma, API objetivo o declaraciones. El archivo entregado se ha firmado y validado localmente; Play puede hacer comprobaciones adicionales.
5. Añade notas de versión claras, por ejemplo «Primera versión de DivZplit para compartir gastos y organizar grupos».
6. Configura tus testers, guarda/revisa la versión y distribúyela en pruebas internas cuando hayas completado los requisitos de esa pista.
7. Copia el enlace de participación y haz una **instalación real desde Play** con la cuenta de tester. El informe de prelanzamiento de Play es una comprobación adicional; no reemplaza las pruebas manuales.

### Huella de Play App Signing: paso necesario después de la primera subida

En **Integridad de la app → Firma de aplicaciones**, copia el **SHA-256 del certificado de firma de la aplicación**, no solo el de subida. Ejecuta el preparador explicado en [android/README.md](../android/README.md), revisa el JSON y solicita/aprueba el cambio independiente de `.well-known/assetlinks.json` en la web. Esta entrega NO lo despliega.

La huella que debe validar una instalación descargada de Play puede ser diferente de la del AAB subido. Una barra de direcciones visible puede indicar que la relación de confianza no coincide o que ese navegador no admite TWA. No desactives verificaciones ni sustituyas OAuth por un WebView para ocultarla.

## 5. Pruebas reales antes de solicitar producción

Usa la versión descargada desde la pista de Play y cuentas de prueba. Repite en español, inglés y rumano donde corresponda:

- Instalar, abrir, cerrar, volver, iniciar sesión, cerrar sesión y reabrir con/sin sesión.
- Google Login; registro/email; recuperación **por código**; código caducado; cancelación; enlaces de invitación y apertura desde fuera de la app.
- Crear/unirse a grupos; monedas y fechas; gastos; «super» → carrito; selección manual de categoría y sus repartos.
- Foto del ticket: selector, cámara si el navegador la ofrece, cancelación, archivo inválido, vista previa, OCR, permisos y tamaños máximos.
- Compras, tareas, votaciones, actividad, saldos y confirmaciones de pagos, exportación de datos y eliminación de cuenta de prueba.
- Notificaciones: conceder/denegar permiso en Android y en el sitio, recepción, tocar notificación y cierre de sesión sin recibir datos de otra cuenta. Requiere el backend push ya configurado.
- Atrás, teclado, enlaces externos, pantalla pequeña, pantalla grande/tablet, cambio de orientación y Android 15/16; revisar contraste e interacción táctil.
- Sin red y reconexión: la app actual no ofrece una aplicación offline completa; no debe indicarse en la ficha que funciona íntegramente sin conexión.
- Navegador compatible y actualizado; no dar por probadas las versiones antiguas de Android solo por `minSdk=24`.

No hagas pruebas de borrado ni modificaciones sobre cuentas reales de otras personas. Revisa el informe de limitaciones antes de abrir la pista a usuarios externos.

## 6. Prueba cerrada y producción

Para cuentas **personales creadas después del 13 de noviembre de 2023**, la documentación oficial consultada exige una **prueba cerrada con al menos 12 testers inscritos continuamente durante 14 días** antes de poder solicitar acceso a producción. Una prueba interna no sustituye esa prueba cerrada. Play evalúa también las respuestas sobre uso, feedback y preparación; cumplir la cifra y plazo no garantiza autorización automática.

Cuando corresponda: configura la prueba cerrada, incorpora testers reales, recoge incidencias, corrige y responde honestamente a la solicitud de acceso a producción. Después prepara la versión de producción, países y distribución y envíala a revisión manualmente. No publiques una versión con incidencias bloqueantes sin resolver.

## 7. Cómo seguir actualizando desde GitHub

### Cambios de la web

DivZplit Android abre la misma web que ya tienes. Cambios de interfaz, traducciones o lógica web continúan haciéndose en ramas y PRs del repositorio. **Después de tu revisión**, fusiona la rama web que proceda y despliega el sitio en GitHub Pages como ahora. No suele hacer falta otro AAB si el contenedor y su configuración Android no cambian.

La web se descarga desde el dominio al abrir/recargar la TWA; puede intervenir la caché HTTP/CDN. Mantén los identificadores de versión de los recursos que ya usa el proyecto. El service worker actual es para push y **no cachea páginas ni respuestas de cuenta**. No implementes una actualización forzada que pierda un gasto a medio escribir. No cambies el dominio, rutas, autenticación, permisos o esquema de almacenamiento sin probar también la app instalada. Actualiza las declaraciones de Play si cambian las prácticas de datos o funciones.

### Cambios que requieren un AAB nuevo

Para iconos Android, permisos, Browser Helper, SDK objetivo, configuración de arranque o código del contenedor:

1. Crea una rama desde el proyecto Android aprobado.
2. Realiza/revisa el cambio; sube `appVersionCode` y `appVersionName` en `android/twa-manifest.json`.
3. Compila con **la misma clave de subida**, ejecuta lint y valida el AAB.
4. Sube a pruebas; prueba una **actualización sobre la versión anterior instalada desde Play**, conservando acceso y datos.
5. Envía una versión nueva por Play Console. No cambies el paquete y no generes otra clave por rutina.

Esta entrega no añade workflows de publicación, secretos de GitHub ni permisos para publicar automáticamente en Play. La rama preparada es solo para revisión.

## 8. Lo que tienes que hacer personalmente

- Descargar/respaldar el AAB, el proyecto y la clave privada; guardar las contraseñas fuera de GitHub.
- Revisar la rama/PR y aprobar lo que quieras incorporar; no hay un merge automático.
- Crear/verificar la cuenta de Play y completar la ficha, recursos gráficos, contactos y declaraciones reales.
- Verificar en tu Supabase que recuperación por código, migraciones, almacenamiento, push, exportación y borrado están activos; no se han cambiado aquí.
- Subir el primer AAB a pruebas y obtener la huella de Play App Signing.
- Aprobar y desplegar por separado `assetlinks.json` con esa huella; comprobar la TWA instalada desde Play.
- Completar las pruebas de dispositivo y revisión de privacidad/UGC; preparar acceso para los revisores.
- Hacer la prueba cerrada si tu cuenta lo exige y solicitar acceso a producción.
- Enviar la versión a revisión y elegir cuándo distribuirla.

## Fuentes oficiales

Consultadas el 5 de noviembre de 2026:

- [API objetivo de Google Play — API 36 desde el 31 de agosto de 2026](https://developer.android.com/google/play/requirements/target-sdk)
- [Pruebas para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=es)
- [Play App Signing y clave de subida](https://support.google.com/googleplay/android-developer/answer/9842756?hl=es)
- [Clasificación del contenido](https://support.google.com/googleplay/android-developer/answer/9859655?hl=es)
- [Público objetivo](https://support.google.com/googleplay/android-developer/answer/9867159?hl=es)
- [Seguridad de los datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es)
- [Eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es)
- [Chrome y requisitos Android actuales](https://support.google.com/chrome/answer/95414?hl=es&co=GENIE.Platform%3DAndroid)
- [TWA y verificación de origen](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)

- [Condiciones de Splitwise](https://www.splitwise.com/terms)
- [Ficha de Splitwise en Google Play](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile)
- [Protección de datos de menores: Comisión Europea](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en)

## Revisión local de 16 de noviembre de 2026 — antes de publicar

No se ha enviado ninguna ficha a una tienda ni desplegado este borrador.
El operador confirma que actúa como persona física, sin empresa, y que no hay
anuncios ni funciones de pago. Google Play será la primera tienda; App Store
se revisará después. Una posible compra única para quitar anuncios no es una
suscripción recurrente. No declarar compras o anuncios futuros como activos.

Confirmar una dirección pública de contacto adecuada y la identificación exigible.
Verificar en producción la eliminación de cuenta y archivos, las migraciones,
los registros retenidos y la conservación de proveedores antes de declarar
resultados de borrado. Véase [OPERATIONS](privacy/OPERATIONS.md).

## Alcance inicial confirmado por el propietario

Primer lanzamiento en países europeos. La lista exacta se elegirá en Google Play
Console antes de publicar. Esto no confirma por sí solo un lanzamiento limitado
a la UE/EEE ni la inclusión de Reino Unido o Suiza. Revisar la lista definitiva
para ajustar los requisitos aplicables. El borrador sigue sin publicar.
