// Actualiza las tarjetas de resumen del dashboard.
// Los productos se cuentan desde MongoDB; los usuarios siguen guardados en este navegador.
const statProductos = document.getElementById("statProductos");
if (statProductos) {
  cargarCatalogo()
    .then(function (productos) {
      statProductos.textContent = productos.length + " productos registrados";
    })
    .catch(function () {
      statProductos.textContent = "No se pudo conectar con el servidor";
    });
}

const statUsuarios = document.getElementById("statUsuarios");
if (statUsuarios) {
  const usuarios = JSON.parse(localStorage.getItem("usuarios") || "[]");
  statUsuarios.textContent = usuarios.length + " usuarios registrados";
}
