# Nitidez del icono inicial de Android

Revisión del 16 de noviembre de 2026, sobre `ca610cf` (el proyecto Android ya integrado en `main`).

## Hallazgo

En Android 12+, el tema de arranque de 1.0.1 apunta a `@mipmap/ic_launcher`. Ese recurso adaptativo coloca `ic_maskable.png` en su capa de fondo. Los mapas de bits son de 82, 123, 164, 246 y 328 píxeles según la densidad; Android puede ampliar el drawable para el splash. Es una posible fuente de suavizado visible, aunque no demuestra que sea la causa exclusiva en un teléfono concreto: la transición del sistema y el fabricante también pueden intervenir.

## Cambio limitado a la primera pantalla

- Se añade un icono adaptativo **exclusivo del splash**, `drawable-v31/ic_splash.xml`, con el mismo encuadre y márgenes de 8,5 dp del icono anterior.
- Su imagen de fondo usa un **VectorDrawable** de la marca existente, sin depender del PNG pequeño: `drawable/ic_splash_maskable.xml`.
- La conversión reutiliza el trazado DZ de `assets/divzplit-logo.svg`, sus cuatro colores de degradado, fondo morado y composición centrada del maskable (aproximadamente 80 %, 410/512). Se conserva el escalado del gradiente radial de SVG.
- `values-v31/styles.xml` referencia ese drawable en `windowSplashScreenAnimatedIcon`. El icono del escritorio y las notificaciones siguen usando sus recursos anteriores.
- No cambia la duración ni la presencia del splash obligatorio de Android, ni se añade otro splash o una espera.
- La web, sus PNG/SVG originales, estilos y animaciones permanecen sin cambios. No hace falta modificar el logo de Google Cloud por esta mejora nativa.

El proyecto se prepara como **1.0.2, código 3**, porque probar un nuevo recurso Android requiere una actualización del AAB. El paquete, certificado de subida, Play App Signing, permisos, dominio y funciones no cambian.

## Archivos

1. `android/app/src/main/res/drawable/ic_splash_maskable.xml`: dibujo vectorial del logo existente para el splash.
2. `android/app/src/main/res/drawable-v31/ic_splash.xml`: encuadre adaptativo nativo, sin bitmap pequeño.
3. `android/app/src/main/res/values-v31/styles.xml`: selecciona el nuevo recurso solo en Android 12+.
4. `android/twa-manifest.json`: versión 1.0.2 y código 3.
5. `android/scripts/check-project.py`: comprueba la referencia vectorial y que el trazado DZ coincida con el SVG original.
6. `android/splash-icon-verification.json`: resultados del artefacto compilado.
7. Este documento.

## Compilar y probar

```sh
python3 android/scripts/check-project.py
python3 android/scripts/build-release.py --keystore "/ruta/privada/divzplit-upload.jks"
```

Salida: `android/app/build/outputs/play/divzplit-1.0.2.aab`. Usa la misma clave de subida; no generes otra. Si ya utilizaste un código superior en Play, incrementa el código antes de recompilar.

La mejora queda en una rama/PR para revisión. No se fusiona a `main`, despliega la web ni publica en Play automáticamente. Para probarla, sube el AAB nuevo al mismo canal de pruebas que utilizas y actualiza desde Google Play. No basta con fusionar la PR o recargar la web para cambiar un recurso nativo instalado.

## Verificación y límite

Se valida el proyecto, la compilación release, lint, la estructura del AAB con bundletool y su firma con el mismo certificado. El paquete contiene los nuevos recursos; los 373 archivos existentes fuera de Android se han comparado sin diferencias. No se altera la animación de apertura ni sus tiempos.

Falta la comparación visual real en el móvil: arranque frío en Android 12 o superior, misma pantalla y escala, antes/después. No se dispone aquí de ese dispositivo y no se puede prometer eliminar el suavizado que aplique Android durante su transición. En Android anterior a 12 la selección del splash no cambia. Si el nuevo icono sigue muy borroso una vez estabilizado, revisar una captura o grabación y el modelo/versión Android.
