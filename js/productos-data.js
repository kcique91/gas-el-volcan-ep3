// js/productos-data.js
// Catálogo de productos. Los datos YA NO están escritos en este archivo ni guardados en el
// navegador: vienen de MongoDB a través del servidor (GET /api/productos).
// Así la tienda, el carrito y el panel de administración ven siempre los mismos datos.
//
// Cada página que necesite el catálogo llama a cargarCatalogo() y espera su resultado.

// Arreglo con los productos (se llena al llamar a cargarCatalogo)
let PRODUCTOS = [];

// Convierte un documento de MongoDB (precios.residencial, stock_critico, _id...)
// a la forma simple que usan las páginas (precioResidencial, stockCritico, codigo...)
function adaptarProducto(doc) {
  return {
    codigo: doc._id,
    categoria: doc.categoria,
    nombre: doc.nombre,
    descripcion: doc.descripcion || '',
    unidad: doc.unidad,
    precioResidencial: doc.precios ? doc.precios.residencial : 0,
    precioComercial: doc.precios ? doc.precios.comercial : 0,
    stock: doc.stock,
    stockCritico: doc.stock_critico || 0,
    // En MongoDB solo se guarda el nombre del archivo; la ruta completa se arma aquí
    imagen: doc.imagen ? 'img/' + doc.imagen : ''
  };
}

// Pide el catálogo al servidor y lo deja en PRODUCTOS. Devuelve una promesa con el arreglo.
function cargarCatalogo() {
  return fetch(API_URL + '/productos')
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error('Error del servidor');
      return respuesta.json();
    })
    .then(function (documentos) {
      PRODUCTOS = documentos.map(adaptarProducto);
      return PRODUCTOS;
    });
}

// Ícono de respaldo por categoría, usado cuando un producto no tiene imagen asignada
const ICONOS_POR_CATEGORIA = {
  "Cilindros de Gas": "🔥",
  "Reguladores": "🔧",
  "Mangueras y Conexiones": "🔌",
  "Accesorios": "🛠️"
};

// Devuelve el HTML de la imagen de un producto: una <img> real si tiene foto asignada,
// o el ícono de su categoría si no
function obtenerImagenHtml(producto, clase) {
  if (producto.imagen) {
    return `<img class="${clase}" src="${producto.imagen}" alt="${escaparHtml(producto.nombre)}">`;
  }
  return `<div class="${clase}">${ICONOS_POR_CATEGORIA[producto.categoria] || ''}</div>`;
}
