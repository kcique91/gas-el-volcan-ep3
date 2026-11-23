// js/index.js
// Productos destacados del inicio. Los datos vienen de MongoDB (servidor en http://localhost:5000)

const contenedorHome = document.getElementById("grid-productos");

function renderizarDestacados(productos) {
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
  contenedorHome.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function () {
  // Nosotros y Blogs también cargan este archivo pero no tienen la grilla de productos
  if (!contenedorHome) return;

  cargarCatalogo()
    .then(function (productos) {
      // Mostramos solo los primeros 4 productos como "destacados"
      renderizarDestacados(productos.slice(0, 4));
    })
    .catch(function (error) {
      console.error('Error al conectar con MongoDB:', error);
      contenedorHome.innerHTML = '<p class="text-danger">Error al conectar con la base de datos.</p>';
    });
});
