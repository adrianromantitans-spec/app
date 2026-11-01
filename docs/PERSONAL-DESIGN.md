# Inicio personal y formulario compacto

La propuesta de vídeo aprobada se aplica a las cuentas reales: fondo lavanda, tipografía Manrope local, tarjetas compactas, navegación móvil fija y diálogos que se abren desde abajo.

El inicio muestra el saldo del usuario, sus pagos pendientes de confirmación, una próxima tarea o votación y el último gasto. La parte personal mensual se calcula con el calendario local en Casa; Viaje muestra el viaje completo. Los saldos siguen incluyendo todos los gastos y pagos confirmados.

Casa agrupa Convivencia, Pareja y Plan con amigos; Viaje selecciona grupos de tipo Viaje. Estos controles seleccionan grupos existentes y recuerdan la selección por cuenta durante la sesión. No cambian documentos, monedas ni saldos. Si no hay un grupo del tipo elegido, se ofrece crearlo explícitamente.

En viajes con moneda distinta del euro, «Ver cambio» abre la cotización fechada en euros. Se mantiene la opción de pagar en la moneda original y las reglas de confirmación y cotización congelada.

El gasto conserva importe, concepto, pagador y participantes en primer plano. «Más opciones» contiene categoría, fecha, repetición y ticket; adjuntar una foto expande esa sección. El pagador predeterminado sigue siendo el usuario actual y editar conserva el pagador existente. Se conservan los repartos personalizados, validación de céntimos y permisos.

No requiere migraciones SQL ni cambios en Supabase. Se publica como actualización de los archivos estáticos.

Validación: `npm run check`, `npm test`, y pruebas de navegador `personal_browser.py`, `fx_browser.py`, `collaboration_browser.py`, `planning_browser.py`, `notifications_browser.py`, `onboarding_payer_browser.py` y `receipt_autofill_browser.py`. Las pruebas del navegador usan datos locales de prueba, sin modificar cuentas reales.
