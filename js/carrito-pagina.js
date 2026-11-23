// Pinta la tabla del carrito: muestra los productos, calcula subtotales y el total,
// y maneja el caso de carrito vacío. Los precios y el stock vienen de MongoDB
// (PRODUCTOS se llena con cargarCatalogo() antes de dibujar).
function renderizarCarrito() {
  const carrito = obtenerCarrito();

  const tabla = document.getElementById("tablaCarrito");
  const cuerpo = document.getElementById("cuerpoCarrito");
  const mensajeVacio = document.getElementById("carritoVacio");
  const totalEl = document.getElementById("totalCarrito");
  if(!tabla ||!cuerpo) return;

  if (carrito.length === 0) {
    tabla.hidden = true;
    if(mensajeVacio) mensajeVacio.hidden = false;
    if(totalEl) totalEl.textContent = 0;
    actualizarContadorCarrito();
    return;
  }

  tabla.hidden = false;
  if(mensajeVacio) mensajeVacio.hidden = true;

  let filas = "";

  carrito.forEach(function (item) {
    const producto = PRODUCTOS.find(function (p) {
      return p.codigo === item.codigo;
    });

    if(!producto) return; // si el producto fue eliminado del catalogo, lo saltamos

    const subtotal = producto.precioResidencial * item.cantidad;

    filas += `
      <tr>
        <td>${obtenerImagenHtml(producto, "imagen-producto")}</td>
        <td>${escaparHtml(producto.nombre)}</td>
        <td>${formatoPesos(producto.precioResidencial)}</td>
        <td>
          <button type="button" class="btn-cantidad" onclick="actualizarCantidad('${item.codigo}', ${item.cantidad - 1}); renderizarCarrito();">-</button>
          ${item.cantidad}
          <button type="button" class="btn-cantidad" onclick="actualizarCantidad('${item.codigo}', ${item.cantidad + 1}); renderizarCarrito();">+</button>
        </td>
        <td>${formatoPesos(subtotal)}</td>
        <td>
          <button type="button" class="btn-secundario" onclick="quitarDelCarrito('${item.codigo}'); renderizarCarrito();">Quitar</button>
        </td>
      </tr>
    `;
  });

  cuerpo.innerHTML = filas;

  if(totalEl) totalEl.textContent = calcularTotal().toLocaleString("es-CL");

  actualizarContadorCarrito();
}

// Muestra un mensaje bajo el botón Pagar (tipo: "exito" o "error")
function mostrarMensajePago(texto, tipo) {
  const mensaje = document.getElementById("mensajePago");
  if (!mensaje) return;
  mensaje.className = "mensaje-alerta " + tipo;
  mensaje.textContent = texto;
}

// Botón Pagar: manda el carrito al servidor, que crea el pedido en MongoDB
// (descuenta el stock con control y guarda el historial).
function pagar() {
  const boton = document.getElementById("botonPagar");
  const carrito = obtenerCarrito();

  if (carrito.length === 0) {
    mostrarMensajePago("Tu carrito está vacío.", "error");
    return;
  }

  const sesion = obtenerSesion();
  if (!sesion) {
    mostrarMensajePago("Debes iniciar sesión como cliente para pagar. Te llevamos al login...", "error");
    setTimeout(function () { window.location.href = "login.html"; }, 1500);
    return;
  }
  if (sesion.rol !== "Cliente") {
    mostrarMensajePago("Las cuentas del personal no pueden comprar. Inicia sesión con una cuenta de cliente.", "error");
    return;
  }

  // Dirección y teléfono se sacan de la lista de usuarios registrados en este navegador
  let usuarios = [];
  try {
    usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  } catch (e) {
    usuarios = [];
  }
  const datosUsuario = usuarios.find(function (u) {
    return u.correo && u.correo.toLowerCase() === String(sesion.correo).toLowerCase();
  }) || {};

  boton.disabled = true;
  mostrarMensajePago("Procesando tu pedido...", "exito");

  llamarApi("/pedidos", {
    method: "POST",
    body: {
      cliente: {
        correo: sesion.correo,
        nombre: sesion.nombre,
        run: sesion.run,
        direccion: datosUsuario.direccion,
        telefono: datosUsuario.telefono
      },
      items: carrito.map(function (item) {
        return { codigo: item.codigo, cantidad: item.cantidad };
      })
    }
  })
    .then(function (pedido) {
      guardarCarrito([]);
      mostrarMensajePago(
        "✅ Pedido N° " + pedido.id_pedido + " creado por " + formatoPesos(pedido.total) + ". Estado: PENDIENTE.",
        "exito"
      );
      return cargarCatalogo(); // para refrescar el stock disponible
    })
    .catch(function (error) {
      mostrarMensajePago("❌ " + error.message, "error");
    })
    .finally(function () {
      boton.disabled = false;
      renderizarCarrito();
    });
}

document.addEventListener("DOMContentLoaded", function () {
  const boton = document.getElementById("botonPagar");
  if (boton) boton.addEventListener("click", pagar);

  cargarCatalogo()
    .then(renderizarCarrito)
    .catch(function () {
      mostrarMensajePago("No se pudo cargar el catálogo desde el servidor. ¿Está encendido \"node server.cjs\"?", "error");
    });
});
