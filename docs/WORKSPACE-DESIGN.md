# Inicio despejado y menú lateral

Aplica la propuesta de vídeo aprobada: el inicio contiene el saldo y dos gastos recientes; una acción fija permite añadir un gasto. Los pagos pendientes aparecen si necesitan la atención del usuario. Los accesos repetidos, las tarjetas de tareas vacías y la navegación inferior se sustituyen por un menú lateral móvil y una barra lateral persistente en escritorio.

El menú contiene Inicio, Gastos y pagos, Tareas, Votaciones, Lista de la compra y Presupuesto, además de Mis grupos y el perfil. El selector de grupo conserva Casa/Viaje dentro de la ventana de selección. Cambiar de vista o grupo no cambia documentos, monedas ni saldos.

El saldo conserva siempre el degradado morado y el importe blanco. Un saldo positivo muestra «+ Te deben» en una etiqueta verde suave; uno negativo, «− Debes» en ámbar; a cero aparece «✓ Todo saldado» en lavanda. El significado se indica con palabras y signos, además del color. Los importes mostrados son los saldos reales, con los pagos confirmados incluidos; no se cambian los cálculos ni las monedas.

La compra tiene una pantalla propia con productos, cantidades y estados. Añadir, editar y confirmar siguen abriendo ventanas centradas. La conversión de productos a gasto conserva el checkout atómico existente y actualiza la lista tras guardar, también si hay que recuperar una respuesta perdida. La flecha superior permite volver al inicio.

El menú es una ventana accesible: bloquea el fondo, mantiene el foco dentro, se cierra con Escape o tocando fuera y respeta reducir movimiento. Su contenido se desplaza si no cabe. Los formularios siguen centrados y se adaptan al área visible del teclado.

No requiere SQL nuevo, cambios en Supabase ni Edge Functions. Se conservan las funciones de gastos, reparto, tickets, pagos, historial, recordatorios y permisos.

Verificado con `npm run check`, `npm test`, `tests/workspace_browser.py`, `tests/personal_browser.py`, `tests/shopping_browser.py`, `tests/fx_browser.py`, `tests/notifications_browser.py` y `tests/onboarding_payer_browser.py`, usando `NEXO_URL` para apuntar al servidor local. Las pruebas incluyen estados positivos/negativos/cero, confirmación de pagos, navegación y foco, idiomas ES/EN/RO, pantallas de 320 a 1280 px, compras con PostgreSQL local, datos escapados, céntimos exactos y conservación de opciones avanzadas.
