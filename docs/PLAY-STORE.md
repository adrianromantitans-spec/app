# Publicar DivZplit en Google Play

La web sigue siendo la aplicación. Play recibe un paquete Android (Trusted Web
Activity) que abre `https://divzplit.com/app/`. No hace falta un servidor nuevo.

## 1. Activar el borrado de cuenta

En el SQL Editor de Supabase, ejecuta una vez
[`supabase/account-deletion.sql`](../supabase/account-deletion.sql).

Después, en la app: **Cuenta → Eliminar cuenta**. La misma acción está en
`https://divzplit.com/delete-account/` (inicia sesión y confirma el correo).

Qué hace:

- Cierra todas las sesiones y bloquea ese correo y Google/Apple asociados.
- Borra avisos, suscripciones push y el nombre del perfil.
- En grupos compartidos el nombre pasa a ser «Cuenta eliminada». Los gastos y
  saldos de las demás personas se conservan.
- Un grupo donde esa persona está sola se elimina, incluidas sus fotos.
- Si administraba un grupo con más gente, otro miembro pasa a administrarlo.

Play Console pide esa URL en **Política → Seguridad de los datos → Eliminación
de cuentas**: `https://divzplit.com/delete-account/`.

## 2. assetlinks.json

`/.well-known/assetlinks.json` declara el paquete `com.divzplit.app` y la huella
SHA-256 del certificado con el que firmas el Android App Bundle.

Esa huella tiene que coincidir con el **certificado de firma de la app** de Play
(no solo con la clave de subida). Después de crear la ficha, copia el SHA-256 de
**Play Console → Integridad de la app → Firma de la app** y añádelo al array
`sha256_cert_fingerprints` si es distinto. Sin eso, Android abre la web en Chrome
en lugar de a pantalla completa.

## 3. Generar el paquete

Hace falta el almacén de claves de subida (no está en el repositorio) y
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```sh
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://divzplit.com/manifest.webmanifest
bubblewrap build
```

El `twa-manifest.json` de referencia está en `android/twa-manifest.json`.
El AAB resultante se sube en Play Console. Conserva el almacén de claves: sin él
no podrás publicar actualizaciones.

## Enlaces en inglés para Play Console

- Política de privacidad: `https://divzplit.com/privacy/`
- Condiciones: `https://divzplit.com/terms/`
- Eliminación de cuenta: `https://divzplit.com/delete-account/`

## Clasificación por contenido y edad de registro

Son tres decisiones distintas:

- **Clasificación del contenido (IARC/PEGI):** la asigna la entidad de clasificación
  a partir del cuestionario de Play Console. Una clasificación PEGI 3 puede ser
  compatible con una app de gastos cuyo registro sea para personas mayores.
  No garantiza una clasificación concreta ni autoriza cuentas desde los 3 años.
- **Público objetivo:** declara las franjas para las que realmente has diseñado
  la app. Con el registro actual de DivZplit, las franjas coherentes son **16–17**
  y **18 o más**. Esto no convierte a las personas de 16–17 en adultas.
- **Edad mínima de registro:** DivZplit exige actualmente **16 años**. Es una
  decisión del servicio, no un requisito impuesto por PEGI 3 ni por ser una app
  de gastos. No hay un circuito de autorización de tutores para menores de 16.

Responde al cuestionario según las funciones reales. Declara la interacción y
el contenido compartido entre usuarios (grupos, conceptos de gastos, fotos de
tickets, tareas y votaciones). No omitas estas funciones para obtener PEGI 3.
Las respuestas deben describir el contenido y los controles existentes;
la clasificación final puede variar por territorio. En anuncios marca **No**
mientras no se muestren anuncios, y actualiza la declaración si se incorporan.

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

Fuentes oficiales:

- [Condiciones de Splitwise](https://www.splitwise.com/terms)
- [Ficha de Splitwise en Google Play](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile)
- [Clasificación del contenido en Google Play](https://support.google.com/googleplay/android-developer/answer/9859655?hl=es)
- [Público objetivo en Google Play](https://support.google.com/googleplay/android-developer/answer/9867159?hl=es)
- [Protección de datos de menores: Comisión Europea](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en)
