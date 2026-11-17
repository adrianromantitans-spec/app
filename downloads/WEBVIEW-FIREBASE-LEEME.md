# DivZplit WebView + Firebase — prueba interna

AAB firmado 1.1.0-webview.3, código 6, paquete com.divzplit.app. Fuente: PR #10 (c1e5339de560eb9bee0cd89289decc55de8594a4), integrada en main. Mantiene la clave de subida original. No contiene credenciales privadas del servidor.

Subir a Google Play Console → DivZplit → Prueba interna → Crear nueva versión. Confirmar código 6 y publicar únicamente para testers. Actualizar desde la cuenta de Google Play inscrita. No se instala directamente como APK.

El servidor debe estar configurado/desplegado según docs/ANDROID-FIREBASE-PUSH.md. POST 200 en la cola vacía no acredita recepción por FCM. Probar permiso Android, otra cuenta del mismo grupo como emisor, recepción en segundo plano y apertura; repetir cierre de sesión/cambio de cuenta y permiso denegado. El cambio TWA→WebView puede requerir volver a iniciar sesión; el backend de la cuenta es el mismo.

Pruebas automáticas y builds validados; sigue pendiente la prueba real de FCM/Google/cámara en Android. No promocionar a producción antes de completarla. Para volver a TWA después de código 6 se requiere un AAB TWA de código superior a 6.
