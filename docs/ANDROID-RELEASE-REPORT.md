# Informe de preparación Android / Google Play

**Fecha:** 5 de noviembre de 2026. **Rama:** `review/google-play-preparation`. **Base:** `89c74f1ac6d364a263c31f2604c04bf32dcc0c1b`.

## Resultado y alcance

Se ha generado y firmado un AAB real de DivZplit. El proyecto original solo contenía la configuración de Bubblewrap, no las fuentes Gradle/Android generadas ni la clave privada. Esta entrega completa ese proyecto y sus instrucciones.

No se han cambiado archivos de interfaz, JavaScript de la web, traducciones, servicios de autenticación, esquema de datos, service worker ni páginas legales. No se ha publicado en Play, fusionado a main ni cambiado el despliegue del sitio. `.well-known/assetlinks.json` permanece sin modificaciones. La app sigue abriendo la web existente mediante TWA.

## Identidad del artefacto entregado

| Propiedad | Resultado |
|---|---|
| Archivo | `divzplit-1.0.0.aab` |
| Paquete | `com.divzplit.app` |
| Versión / código | `1.0.0` / `1` |
| Android mínimo / destino | API 24 (Android 7.0) / API 36 (Android 16) |
| Tamaño | 1.913.004 bytes |
| SHA-256 del AAB | `411ecfba85a66dcfa7e2e2e23a5a400dac5fb8bd53bd56623a398c983f721720` |
| Certificado de subida | `7A:B0:37:0C:C1:18:70:90:F6:4D:50:51:D8:89:2C:83:2C:9A:0E:17:2C:83:DD:1F:DF:A5:A3:0E:95:75:02:58` |
| Alias privado | `divzplit` |
| Clave | Nueva, RSA de 3072 bits; contraseña no reutilizada del ejemplo del chat |

La huella de arriba es de la **clave de subida**, no una huella ya obtenida de Play App Signing. El hash del AAB identifica esta entrega concreta; otra compilación legítima puede cambiarlo por metadatos y firma, manteniendo la misma identidad de aplicación.

## Comprobaciones realizadas

| Comprobación | Resultado / límite |
|---|---|
| Gradle release | Correcto, AGP 8.9.1 / Gradle 8.11.1 / JDK 17 |
| Script de compilación entregado | Ejecutado correctamente, no solo descrito |
| Lint release | **0 errores, 8 avisos**, detallados debajo; no se ha desactivado la comprobación de release |
| bundletool 1.18.3 `validate` | Correcto sobre el AAB final; JAR de herramienta verificado por SHA-256 de su publicación |
| Firma `jarsigner -verify` | Correcta; certificado contrastado con el `.jks` privado entregado |
| Manifiesto del AAB | Paquete/versión/SDK confirmados por `bundletool dump manifest`; no es un release debuggable |
| Firma final | Manifest JAR al inicio; ningún archivo del payload de la aplicación cambió respecto al bundle de Gradle |
| Librerías nativas `.so` | No hay; no se introduce una biblioteca nativa pendiente de adaptación a páginas de 16 KB |
| Permisos del paquete final | `POST_NOTIFICATIONS` y permiso interno de AndroidX `com.divzplit.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |
| Permisos no añadidos | No cámara, contactos, ubicación, micrófono, lectura general de medios ni Advertising ID. El navegador gestiona la selección de archivos/cámara y su conexión |
| Sin credenciales de firma | El release se rechaza; no se presenta un unsigned como archivo de Play |
| Clave equivocada | El script la rechaza antes de compilar, comparando el certificado esperado |
| Asset Links | Preparador rechaza huellas inválidas y no sobrescribe ni publica el archivo del sitio |
| Material privado | `.jks`, claves, contraseñas y builds excluidos del repositorio y del ZIP de fuentes |
| Gradle wrapper | JAR y distribución comprobados frente a hashes oficiales; distribución con checksum fijado |
| Comprobaciones web existentes | `npm run check` y `npm test`: correctas; solo pruebas locales de código, sin operaciones con usuarios reales |
| Enlaces públicos | `/app/`, `/privacy/`, `/terms/`, `/delete-account/` y alias españoles: HTTP 200 tras seguimiento de redirecciones |
| Asset Links público | HTTP 200, JSON; su existencia no acredita que incluya los nuevos certificados |

Los datos estructurados están en `android/release-verification.json`. No se ha usado un emulador ni un teléfono Android en esta sesión. No se han enviado correos reales ni hecho acciones sobre cuentas de producción.

## Avisos no bloqueantes observados

- **1 aviso de orientación:** se conserva la configuración vertical previa del TWA. Android recomienda adaptarse también a pantallas grandes y multiwindow; Android 16 puede ignorar restricciones en determinados dispositivos. Debe probarse en tablet/foldable. No se ha rediseñado la web ni ocultado el aviso.
- **7 avisos de recursos no utilizados:** recursos auxiliares de la plantilla (opción de ajustes del sitio, scope, manifest web incluido y fondos de shortcuts). Algunos se informan dos veces en el modelo de lint. Se conservan para no quitar capacidades de la plantilla por una optimización cosmética. No impiden la compilación.
- **Firma:** `jarsigner` avisa de certificado autofirmado/no perteneciente a una CA, ausencia de sello de tiempo y atributos POSIX de ZIP. Es una clave de subida Android autofirmada, válida hasta 2054, no un certificado TLS público. La firma criptográfica y su identidad se han verificado; la aceptación por Play sigue pendiente. El AAB final ya no presenta el aviso de orden de manifest al leer mediante JarInputStream.
- **SDK:** las herramientas pueden avisar de versiones distintas del formato XML del SDK por la combinación del AGP y command-line tools actuales. Se descargó y utilizó la plataforma 36 y el build terminó. No se ha ignorado un error de compilación.

## Bloqueos y comprobaciones pendientes para publicar

1. **Certificado de Play desconocido:** aún no se ha subido ningún AAB, según lo confirmado por el propietario. Falta obtener la huella de firma de distribución de Play y aprobar/desplegar la relación de confianza en el dominio. La barra de Chrome puede aparecer hasta hacerlo. La huella ya publicada en el sitio no coincide con la nueva clave de subida y no se ha eliminado: no se conoce aquí su almacén original.
2. **Instalación y funcionamiento reales:** pendiente instalación desde la pista interna, informe de prelanzamiento y pruebas del checklist (sesiones, Google/email, recuperación por código, invitaciones, archivo/cámara/OCR, gastos, compras, tareas, votaciones, exportación, borrado y notificaciones). La validación de un ZIP firmado no sustituye esas pruebas.
3. **Android antiguo:** min SDK 24 es un mínimo de instalación técnico. Chrome actual necesita Android 10 o superior. Android 7/8/9 dependen de un navegador compatible disponible, que puede estar desactualizado; no se ha certificado el funcionamiento en esos sistemas. Si las pruebas muestran incompatibilidad, decidir expresamente si elevar el mínimo antes de publicar, con un cambio revisado.
4. **Internet y navegador:** la app depende de HTTPS, del alojamiento web, Supabase y un navegador TWA compatible. La alternativa es Custom Tabs; puede mostrar controles del navegador. El service worker actual es solo para push: no existe un modo offline completo. La continuidad de datos y sesiones pertenece en gran parte al navegador y al backend.
5. **Supabase:** no se ha accedido a su panel ni ejecutado migraciones. Verificar las configuraciones de OAuth y correos, plantilla de recuperación por código, almacenamiento privado de tickets, autorización entre grupos, exportación, borrado de cuenta, retención y push en tu proyecto real. Comprobar accesibilidad del enlace de borrado no demuestra que su operación de base de datos esté activada.
6. **Privacidad y UGC:** revisar y completar declaraciones reales de datos, edades, contenido generado/compartido por usuarios, mecanismos de soporte y controles de gestión/reportes/bloqueo aplicables a la política de UGC. No se ha añadido moderación nueva ni certificado que todos los requisitos de política estén cubiertos. Las operaciones de privacidad que ya documenta `docs/privacy/OPERATIONS.md` siguen siendo responsabilidad operativa del titular.
7. **Play Console:** cuenta e identidad, acceso de revisión, icono/capturas/imagen destacada, cuestionarios, declaraciones financieras/datos, países y prueba cerrada cuando corresponda. No se garantiza una clasificación 3+ ni aceptación por Google.
8. **Prueba cerrada:** para cuentas personales nuevas sujetas a ese requisito, 12 testers inscritos continuamente durante al menos 14 días y posterior solicitud de acceso a producción. No se ha iniciado ninguna pista ni dado de alta testers automáticamente.
9. **Custodia de firma:** descargar y respaldar la clave y contraseñas privadas; sin este paso no podrás reproducir cómodamente las siguientes subidas. Con Play App Signing es posible solicitar restablecimiento de la clave de subida, por lo que su pérdida no equivale automáticamente a perder para siempre la app.

## Cómo se han preservado las funciones

- TWA con Android Browser Helper y fallback **Custom Tabs**, sin trasladar Google Login a un WebView.
- Mismo dominio, ruta, iconos de marca, esquema de datos y funciones web; delegación de notificaciones habilitada.
- Icono de notificaciones y monochrome nativo derivados del monograma DZ existente, no un cambio del diseño de la web.
- Las claves privadas no se han insertado en el AAB como recursos ni en Gradle. Los certificados públicos sí permiten comprobar la identidad de la firma.
- No hay workflow de publicación automática, cambios de hosting ni merge a producción. Las futuras actualizaciones web requieren tu revisión y despliegue habitual; las del contenedor requieren otro AAB con código de versión mayor.
