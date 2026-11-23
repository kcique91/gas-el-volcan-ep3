// js/producto-detalle.js
// Detalle de un producto: datos desde MongoDB, cantidad + "Añadir al carrito",
// productos relacionados (misma categoría) y, solo para el personal, edición.

function obtenerCodigoURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('codigo');
}

function cargarDetalle() {
  const codigo = obtenerCodigoURL();
  const detalle = document.getElementById('detalleProducto');
  if (!codigo) {
    detalle.innerHTML = '<p>No se indicó ningún producto. <a href="productos.html">Volver a productos</a></p>';
    return;
  }

  // El catálogo trae todos los productos de MongoDB: de ahí salen el producto y sus relacionados
  cargarCatalogo()
    .then(function () {
      const producto = PRODUCTOS.find(function (p) { return p.codigo === codigo; });
      if (!producto) {
        detalle.innerHTML = '<p>No existe un producto con el código "' + escaparHtml(codigo) + '". <a href="productos.html">Volver a productos</a></p>';
        return;
      }
      renderizarDetalle(producto);
      renderizarRelacionados(producto);
    })
    .catch(function (err) {
      console.error(err);
      detalle.innerHTML = '<p>No se pudo cargar el producto. ¿Está encendido "node server.cjs"?</p>';
    });
}

function renderizarDetalle(p) {
  const imagen = p.imagen || 'img/sin-imagen.jpg';

  // Ruta de navegación: Home / Productos / categoría / producto
  document.getElementById('breadcrumb').innerHTML =
    '<a href="index.html">Home</a> / <a href="productos.html">Productos</a> / ' +
    escaparHtml(p.categoria) + ' / <strong>' + escaparHtml(p.nombre) + '</strong>';

  // Cantidad y botón "Añadir al carrito" (si no hay stock, se avisa en vez de mostrar el formulario)
  const compra = p.stock > 0 ? `
        <div style="display:flex; align-items:center; gap:10px; margin:15px 0;">
          <label for="inputCantidad">Cantidad:</label>
          <input type="number" id="inputCantidad" value="1" min="1" max="${p.stock}" step="1" style="width:90px; padding:8px;">
          <button type="button" class="btn-primario" onclick="anadirDesdeDetalle('${p.codigo}')">Añadir al carrito</button>
        </div>` : '<p><strong>Sin stock por el momento.</strong></p>';

  // El botón y el formulario de edición solo existen si el personal inició sesión.
  // (El servidor además rechaza cualquier cambio que no traiga una sesión válida.)
  const edicion = esStaff() ? `
        <div id="formEdicion" style="display:none; border:1px solid #ccc; padding:15px; margin-top:10px;">
          <h3>Editar producto</h3>
          <input type="text" id="editNombre" value="${escaparHtml(p.nombre)}"><br>
          <input type="number" id="editPrecio" min="0" value="${p.precioResidencial}"><br>
          <input type="number" id="editStock" min="0" value="${p.stock}"><br>
          <button onclick="guardarCambios('${p.codigo}')">Guardar</button>
          <button onclick="toggleEdicion()">Cancelar</button>
        </div>
        <button class="btn-secundario" onclick="toggleEdicion()">✏️ Editar</button>` : '';

  document.getElementById('detalleProducto').innerHTML = `
    <div class="detalle-producto-container">
      <img src="${imagen}" class="imagen-producto-grande" alt="${escaparHtml(p.nombre)}">
      <div class="detalle-info">
        <h2>${escaparHtml(p.nombre)}</h2>
        <p><strong>Código:</strong> ${escaparHtml(p.codigo)}</p>
        <p><strong>Precio:</strong> ${formatoPesos(p.precioResidencial)}</p>
        <p><strong>Stock:</strong> ${p.stock}</p>
        <p><strong>Descripción:</strong> ${escaparHtml(p.descripcion || 'Sin descripción')}</p>
        ${compra}
        ${edicion}
      </div>
    </div>
  `;
}

// Productos de la misma categoría (menos el que se está viendo)
function renderizarRelacionados(producto) {
  const relacionados = PRODUCTOS.filter(function (p) {
    return p.categoria === producto.categoria && p.codigo !== producto.codigo;
  });

  const titulo = document.getElementById('tituloRelacionados');
  const grilla = document.getElementById('grid-relacionados');
  if (relacionados.length === 0) {
    if (titulo) titulo.hidden = true;
    return;
  }
  if (titulo) titulo.hidden = false;

  grilla.innerHTML = relacionados.map(function (p) {
    return `
      <div class="tarjeta-producto">
        <img src="${p.imagen || 'img/sin-imagen.jpg'}" class="imagen-producto" alt="${escaparHtml(p.nombre)}" onerror="this.style.display='none'">
        <h3>${escaparHtml(p.nombre)}</h3>
        <p>${formatoPesos(p.precioResidencial)}</p>
        <a class="btn-secundario" href="producto-detalle.html?codigo=${encodeURIComponent(p.codigo)}">Ver detalle</a>
      </div>`;
  }).join('');
}

// Botón "Añadir al carrito" del detalle: usa la cantidad escrita en el campo
function anadirDesdeDetalle(codigo) {
  const cantidad = Number(document.getElementById('inputCantidad').value);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    alert('Ingresa una cantidad entera de 1 o más.');
    return;
  }
  // agregarAlCarrito avisa por sí sola si la cantidad supera el stock
  if (agregarAlCarrito(codigo, cantidad)) {
    actualizarContadorCarrito();
    alert('Producto agregado al carrito');
  }
}

function toggleEdicion() {
  const f = document.getElementById('formEdicion');
  f.style.display = (f.style.display === 'none') ? 'block' : 'none';
}

function guardarCambios(codigo) {
  const nuevosDatos = {
    nombre: document.getElementById('editNombre').value,
    precioResidencial: Number(document.getElementById('editPrecio').value),
    stock: Number(document.getElementById('editStock').value)
  };

  llamarApi(`/productos/${encodeURIComponent(codigo)}`, { method: 'PUT', body: nuevosDatos })
    .then(() => {
      alert('✅ ¡Producto actualizado con éxito!');
      location.reload(); // Recarga la página para mostrar los datos frescos
    })
    .catch(err => {
      console.error('Error al guardar:', err);
      alert('❌ Error: ' + err.message);
    });
}

document.addEventListener('DOMContentLoaded', cargarDetalle);
