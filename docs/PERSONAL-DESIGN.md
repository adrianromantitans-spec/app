# Diseño actual

La versión vigente usa el inicio despejado y el menú lateral descritos en [WORKSPACE-DESIGN.md](WORKSPACE-DESIGN.md). El resto de este documento conserva las decisiones de las propuestas anteriores.

# Inicio personal y formulario compacto

La propuesta de vídeo aprobada se aplica a las cuentas reales: fondo lavanda, tipografía Manrope local, tarjetas compactas, navegación móvil fija y ventanas emergentes centradas.

El inicio muestra el saldo del usuario, sus pagos pendientes de confirmación, una próxima tarea o votación y el último gasto. La parte personal mensual se calcula con el calendario local en Casa; Viaje muestra el viaje completo. Los saldos siguen incluyendo todos los gastos y pagos confirmados.

Casa agrupa Convivencia, Pareja y Plan con amigos; Viaje selecciona grupos de tipo Viaje. Estos controles seleccionan grupos existentes y recuerdan la selección por cuenta durante la sesión. No cambian documentos, monedas ni saldos. Si no hay un grupo del tipo elegido, se ofrece crearlo explícitamente.

En viajes con moneda distinta del euro, «Ver cambio» abre la cotización fechada en euros. Se mantiene la opción de pagar en la moneda original y las reglas de confirmación y cotización congelada.

El gasto conserva importe, concepto, pagador y participantes en primer plano. «Más opciones» contiene categoría, fecha, repetición y ticket; adjuntar una foto expande esa sección. El pagador predeterminado sigue siendo el usuario actual y editar conserva el pagador existente. Se conservan los repartos personalizados, validación de céntimos y permisos.

No requiere migraciones SQL ni cambios en Supabase. Se publica como actualización de los archivos estáticos.

Validación: `npm run check`, `npm test`, y pruebas de navegador `personal_browser.py`, `fx_browser.py`, `collaboration_browser.py`, `planning_browser.py`, `notifications_browser.py`, `onboarding_payer_browser.py` y `receipt_autofill_browser.py`. Las pruebas del navegador usan datos locales de prueba, sin modificar cuentas reales.

## Barra Liquid Glass

La propuesta posterior añade una cápsula móvil flotante con márgenes de 16 px, altura de 66 px y separación inferior de al menos 22 px, respetando el área segura del dispositivo. El fondo aplica desenfoque y transparencia cuando el navegador los admite, con una alternativa opaca y soporte para reducir transparencias. El indicador acompaña el cambio de sección y respeta reducir movimiento. El botón central abre el menú existente con «Añadir gasto» destacado en morado. El contenido y los avisos tienen espacio inferior para quedar por encima de la barra.

Verificación adicional en navegador: destinos, indicador durante las actualizaciones de pantalla, tamaños de 320 a 760 px, botones de al menos 44 px, menú y formulario, preferencias de movimiento, idiomas español/inglés/rumano y navegación de escritorio.

## Ventanas centradas

Las ventanas móviles se centran en el área visible con márgenes seguros y sin el tirador de hoja inferior. Los formularios largos se desplazan por dentro. El tamaño y la posición se actualizan con visualViewport para ajustarse al teclado y al desplazamiento de la vista del iPhone. Se conserva el cierre con Escape o tocando el fondo y la gestión del foco. Verificado en móvil, tablet y escritorio, alturas cortas y una simulación de teclado con desplazamiento, en español, inglés y rumano.
