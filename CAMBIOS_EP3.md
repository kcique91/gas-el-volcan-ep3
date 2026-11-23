# Correcciones a la app web de Gas El Volcán (EP3)

Estos archivos se copian ENCIMA del proyecto (reemplazando los que ya existen). No hace falta `npm install`.
Después: cerrar y volver a abrir `node server.cjs` y `npm run dev`.

Si usas git: `git apply cambios.patch` hace lo mismo.

## Antes de probar
En Compass, pegar de nuevo `01_crear_base_y_datos.js` (deja la base limpia).
**Ya no hace falta** el "paso crítico" de borrar el índice `codigo_1_fecha_cambio_-1`: el servidor ahora guarda el historial en el formato de nuestra base y ese índice no molesta.

## Cuentas de prueba
| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@duoc.cl | admin |
| Vendedor | vendedor@duoc.cl | vende |
| Cliente | cliente@gmail.com | 1234 |

## Qué se corrigió

1. **Editar sin iniciar sesión.** Ahora el servidor exige sesión (login del personal en `POST /api/login`, token en cada petición). El botón "Editar" del detalle solo aparece al personal. Las páginas Pedidos, Historial y el panel admin mandan al login si no hay sesión de personal. Roles: Administrador puede todo; Vendedor puede editar productos y ver pedidos/historial, pero no crear ni borrar productos.
2. **La app se saltaba las reglas de la base.** Se quitó `bypassDocumentValidation`. Si se intenta guardar stock o precio negativo, MongoDB lo rechaza (regla `minimum: 0` del script 01) y la página muestra el mensaje.
3. **Historial en otro formato.** El servidor ahora guarda `{ codigo, campo, valor_anterior, valor_nuevo, usuario, fecha_cambio }` (igual que nuestros scripts). Se registra un documento por cada cambio de STOCK, PRECIO_RESIDENCIAL o PRECIO_COMERCIAL. La página Historial lee ese formato y muestra el stock (antes no lo mostraba), el usuario y la fecha.
4. **Panel de administración desconectado de MongoDB.** El catálogo ya no está escrito en `productos-data.js` ni guardado en el navegador: se carga de MongoDB (`cargarCatalogo()`). Crear, editar y eliminar productos desde el panel ahora usa `POST/PUT/DELETE /api/productos`. La tienda, el carrito y el panel ven los mismos datos.
5. **Botón Pagar no hacía nada.** Ahora llama a `POST /api/pedidos`: busca (o crea) al cliente por su correo, descuenta el stock solo si alcanza (`stock >= cantidad`, igual que el script 06), guarda el pedido con sus líneas dentro, deja el historial de stock y vacía el carrito. Si un producto no alcanza, se devuelve el stock ya descontado y no se crea el pedido.
6. **Menú distinto en cada página.** Todas las páginas públicas tienen ahora el mismo encabezado (logo, menú completo, usuario y carrito). Los enlaces Pedidos e Historial se muestran solo al personal. Se arreglaron además las etiquetas rotas del menú en `blog-detalle-1/2` y `carrito.html`, y el menú ya no se corta en el borde cuando hay más botones.

## Cambios menores
- El aviso "Producto agregado al carrito" ya no aparece cuando no había stock.
- Las tarjetas de producto muestran el stock (así se ve bajar al comprar).
- `nosotros.html` y `blogs.html` ya no dan error de JavaScript (cargaban `index.js` sin tener la grilla de productos).
- Precios con separador de miles ($13.000).
- **Catálogo de 14 productos:** se quitaron de MongoDB el balón portátil 2 kg (CL005) y su recarga (CL006), que no están en la tienda original. La web los deja de mostrar sola, porque lee el catálogo de la base. En los pedidos 4, 5, 9 y 10 esa línea se reemplazó por otro producto del catálogo (los pedidos entregados siguen sumando $147.480). Hay que volver a pegar el script 01 actualizado en Compass.
- **Detalle de producto** (`producto-detalle.html` / `js/producto-detalle.js`): ahora muestra la ruta Home / Productos / categoría / producto, un campo **Cantidad** con el botón **Añadir al carrito** (valida entero ≥ 1 y no deja pasar el stock) y la sección **Productos relacionados** con los demás productos de la misma categoría. Si el stock es 0 avisa "Sin stock por el momento".

## Qué sigue pendiente (no se tocó)
- Los **usuarios** (panel Admin > Usuarios y el registro de clientes) siguen guardados en el navegador, no en MongoDB.
- El inicio de sesión de **clientes** no lo verifica el servidor (solo el del personal); las contraseñas del personal están escritas en `server.cjs` (en un sistema real irían cifradas en la base).
- MongoDB local sin réplica no permite transacciones: la "marcha atrás" del pedido la hace el programa.
- Si se reinicia `node server.cjs`, el personal debe volver a iniciar sesión (los tokens viven en memoria).
- Los pedidos no tienen aún botones para cambiar de estado desde la web (se hace con `updateOne`, como en el script 04).
