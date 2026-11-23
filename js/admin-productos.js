// Panel de administración - Productos.
// Los productos se leen de MongoDB (cargarCatalogo) y los cambios se guardan en MongoDB a través del servidor.
function mostrarProductosAdmin() {
  const cuerpo = document.getElementById("cuerpoProductosAdmin");
  if (!cuerpo) return;

  // Solo el Administrador puede crear y eliminar productos (el servidor también lo exige)
  const puedeEliminar = esAdministrador();

  let filas = "";

  PRODUCTOS.forEach(function (producto) {
    filas += `
      <tr>
        <td>${escaparHtml(producto.codigo)}</td>
        <td>${escaparHtml(producto.nombre)}</td>
        <td>${escaparHtml(producto.categoria)}</td>
        <td>${formatoPesos(producto.precioResidencial)}</td>
        <td>${producto.stock}</td>
        <td>
          <button type="button" class="btn-editar" onclick="editarProducto('${producto.codigo}')">Editar</button>
          ${puedeEliminar ? `<button type="button" class="btn-eliminar" onclick="eliminarProducto('${producto.codigo}')">Eliminar</button>` : ""}
        </td>
      </tr>
    `;
  });

  cuerpo.innerHTML = filas;
}

// Guarda el código del producto a editar y redirige al formulario de edición
function editarProducto(codigo) {
  localStorage.setItem("codigoProductoEditar", codigo);
  window.location.href = "producto-editar.html";
}

// Elimina un producto de MongoDB. Los pedidos antiguos no se afectan: cada pedido guarda su propia copia del nombre y el precio.
function eliminarProducto(codigo) {
  if (!confirm("¿Eliminar este producto?")) return;

  llamarApi("/productos/" + encodeURIComponent(codigo), { method: "DELETE" })
    .then(function () {
      return cargarCatalogo();
    })
    .then(mostrarProductosAdmin)
    .catch(function (error) {
      alert("❌ No se pudo eliminar: " + error.message);
    });
}

// El botón "Nuevo Producto" es solo para el Administrador
if (!esAdministrador()) {
  const enlaceNuevo = document.querySelector('a[href="producto-nuevo.html"]');
  if (enlaceNuevo) enlaceNuevo.style.display = "none";
}

cargarCatalogo()
  .then(mostrarProductosAdmin)
  .catch(function (error) {
    const cuerpo = document.getElementById("cuerpoProductosAdmin");
    if (cuerpo) cuerpo.innerHTML = '<tr><td colspan="6">No se pudo cargar desde el servidor: ' + escaparHtml(error.message) + '</td></tr>';
  });
