// js/productos.js
// Lista de productos de la tienda. Los datos vienen de MongoDB (servidor en http://localhost:5000)

const contenedor = document.getElementById("grid-productos");

function renderizarProductos(productos) {
  let html = '';
  productos.forEach(function (producto) {
    const imagen = producto.imagen || 'img/sin-imagen.jpg';

    html += `
      <div class="tarjeta-producto">
        <img src="${imagen}" class="imagen-producto" alt="${escaparHtml(producto.nombre)}" onerror="this.style.display='none'">
        <h3>${escaparHtml(producto.nombre)}</h3>
        <p>${formatoPesos(producto.precioResidencial)}</p>
        <p><small>Stock: ${producto.stock}</small></p>
        <a class="btn-secundario" href="producto-detalle.html?codigo=${encodeURIComponent(producto.codigo)}">Ver detalle</a>
        <button type="button" class="btn-primario" onclick="agregarYAvisar('${producto.codigo}')">Añadir</button>
      </div>
    `;
  });
  contenedor.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function () {
  cargarCatalogo()
    .then(renderizarProductos)
    .catch(function (error) {
      console.error('Error al conectar con MongoDB:', error);
      contenedor.innerHTML = '<p class="text-danger">Error al conectar con la base de datos.</p>';
    });
});
