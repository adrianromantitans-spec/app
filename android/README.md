# DivZplit Android — revisión para Google Play

Proyecto Android **compilable**, basado en Trusted Web Activity (TWA). Abre la app existente en `https://divzplit.com/app/?source=installed` con un navegador compatible. No contiene una copia diferente de la web, no usa un WebView para Google Login y no cambia la interfaz ni la edad de registro.

| Dato | Valor |
|---|---|
| Paquete permanente | `com.divzplit.app` |
| Versión inicial | `1.0.0` |
| Código inicial | `1` |
| Android mínimo técnico | Android 7.0 / API 24 |
| Compile / target SDK | 36 / 36 |
| Java / Gradle / AGP | JDK 17 / 8.11.1 / 8.9.1 |
| Browser Helper | 2.7.4 |

`minSdk=24` permite instalar el paquete en Android 7; no garantiza soporte de todas las funciones en navegadores antiguos. Chrome actual requiere Android 10 o superior. La prueba real en dispositivos y la prueba a través de Play siguen pendientes.

## Compilar y firmar

1. Instala Android Studio estable, **JDK 17 completo** y Python 3. Android Studio también permite descargar el SDK sin usar la terminal.
2. En SDK Manager instala **Android SDK Platform 36**, **Android SDK Build-Tools 35.0.0** (versión predeterminada del AGP) y **Android SDK Platform-Tools**. Acepta las licencias. No hacen falta NDK ni CMake.
3. Configura `JAVA_HOME` al JDK 17 y `ANDROID_HOME` a tu SDK. También puedes abrir la carpeta `android/` en Android Studio y dejar que cree `local.properties`. Ese archivo es local y no se sube a GitHub.
4. Recupera el archivo **privado** `divzplit-upload.jks` y sus contraseñas de la entrega, guárdalos fuera del repositorio y ejecuta, desde la raíz:

```sh
python3 android/scripts/build-release.py --keystore "/ruta/privada/divzplit-upload.jks"
```

En Windows usa `py -3` en lugar de `python3` y una ruta como `C:\FirmaDivZplit\divzplit-upload.jks`. Las contraseñas se piden sin mostrarlas y no se guardan en el proyecto. Alias: `divzplit`.

El script comprueba el proyecto y que la clave coincide con `upload-certificate.pem`, ejecuta `lintRelease` y `bundleRelease`, realiza la firma final con `jarsigner` usando esa misma clave (compatible también con lectores JAR en streaming), verifica la firma y deja:

```
android/app/build/outputs/play/divzplit-1.0.0.aab
```

No subas un APK a Play. El AAB no se instala directamente tocándolo en el móvil: usa una pista de pruebas de Play o genera APKs con bundletool para pruebas locales.

### Compilación manual con Gradle

También puedes configurar estas variables **solo en tu terminal o gestor de secretos**, sin escribirlas en archivos del repositorio:

- `DIVZPLIT_UPLOAD_STORE_FILE`: ruta absoluta del `.jks`.
- `DIVZPLIT_UPLOAD_STORE_PASSWORD`: contraseña del almacén.
- `DIVZPLIT_UPLOAD_KEY_ALIAS`: `divzplit`.
- `DIVZPLIT_UPLOAD_KEY_PASSWORD`: contraseña de la clave.

Desde `android/`:

```sh
./gradlew --no-daemon :app:lintRelease :app:bundleRelease
```

En Windows: `gradlew.bat --no-daemon :app:lintRelease :app:bundleRelease`.

Salida original de Gradle: `android/app/build/outputs/bundle/release/app-release.aab`. Una compilación release sin variables de firma falla expresamente; no se entrega un bundle sin firma como si estuviera listo para Play. El script recomendado además compara el certificado esperado. No uses `--debug` de Gradle ni compartas volcados del entorno con contraseñas.

## Claves y certificados

- El `.jks` entregado es una **clave de subida nueva**, generada para esta primera publicación. No se ha reutilizado la contraseña del ejemplo del chat.
- `upload-certificate.pem` y `upload-certificate.sha256` son el **certificado público** y su huella. Es correcto guardarlos en GitHub; no permiten firmar una actualización.
- El `.jks` y su contraseña son privados. Guarda dos copias de seguridad separadas; conserva la contraseña en un gestor de contraseñas.
- Con **Play App Signing**, Google conserva la clave de **firma de distribución**. El certificado de la clave de subida normalmente será diferente. Si pierdes la clave de subida, puedes solicitar un restablecimiento en Play; no crees otra sin seguir ese procedimiento.

## Verificación del dominio

La entrega NO modifica `/.well-known/assetlinks.json` del sitio. `assetlinks.upload.json` es una propuesta para pruebas con la firma local y conserva las huellas anteriores; no está desplegada.

Para la instalación desde Play, toma **SHA-256 del certificado de firma de la aplicación** en Play Console → Integridad de la app / Firma de aplicaciones. Prepara una propuesta:

```sh
python3 android/scripts/prepare-assetlinks.py --fingerprint "AA:BB:...:32_BYTES" --output android/assetlinks.play.json
```

Sustituye el ejemplo por la huella completa real. Revisa el resultado y, en una modificación web aprobada aparte, copia ese JSON a `.well-known/assetlinks.json`. Debe servirse por HTTPS con HTTP 200 y `application/json`, sin redirigir. No borres otras apps, relaciones o huellas legítimas. Si Play permite rotación y muestra certificados diferentes por versión de Android, declara todas las huellas de firma de distribución aplicables.

Sin la huella adecuada puede aparecer la barra de Chrome; no se soluciona cambiando el CSS ni eliminando controles del navegador. Las instalaciones de Internal App Sharing pueden usar otro certificado: no confundas esa herramienta con la pista normal de pruebas internas de Play.

## Cambiar la versión

Edita **únicamente** `appVersionCode` y `appVersionName` en `android/twa-manifest.json` (por ejemplo, `2` y `1.0.1`). Gradle los lee directamente. El código debe superar cualquier código ya utilizado en Play, incluso una prueba descartada. No cambies `packageId`.

No necesitas instalar Bubblewrap para compilar. Evita ejecutar `bubblewrap update` sin revisar: puede sobrescribir la configuración de firma, lint y comprobaciones. Consulta [THIRD-PARTY.md](THIRD-PARTY.md) para la procedencia y los cambios del generador.

Guía de publicación: [docs/PLAY-STORE.md](../docs/PLAY-STORE.md). Informe de comprobaciones: [docs/ANDROID-RELEASE-REPORT.md](../docs/ANDROID-RELEASE-REPORT.md).
