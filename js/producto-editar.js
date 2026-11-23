// Lee el producto a editar desde MongoDB (el código lo deja la tabla de productos.html en localStorage)
// y precarga el formulario con sus datos actuales

const codigoEditar = localStorage.getItem("codigoProductoEditar");

cargarCatalogo()
    .then(function () {
        const producto = PRODUCTOS.find(p => p.codigo === codigoEditar);

        if (!producto) {
            alert("No se encontró el producto a editar");
            window.location.href = "productos.html";
            return;
        }

        document.getElementById("codigo").value = producto.codigo;
        document.getElementById("nombre").value = producto.nombre;
        document.getElementById("descripcion").value = producto.descripcion || "";
        document.getElementById("categoria").value = producto.categoria;
        document.getElementById("unidad").value = producto.unidad;
        document.getElementById("precioResidencial").value = producto.precioResidencial;
        document.getElementById("precioComercial").value = producto.precioComercial;
        document.getElementById("stock").value = producto.stock;
        document.getElementById("stockCritico").value = producto.stockCritico;
        document.getElementById("imagen").value = producto.imagen || "";
    })
    .catch(function (error) {
        alert("No se pudo cargar el producto desde el servidor: " + error.message);
    });

function validarNombreEditar() {
    const valor = document.getElementById("nombre").value.trim();
    if (valor.length === 0) {
        mostrarError("errorNombre", "El nombre es obligatorio.");
        return false;
    }
    if (valor.length > 100) {
        mostrarError("errorNombre", "El nombre no puede superar los 100 caracteres.");
        return false;
    }
    limpiarError("errorNombre");
    return true;
}

function validarDescripcionEditar() {
    const valor = document.getElementById("descripcion").value.trim();
    if (valor.length > 500) {
        mostrarError("errorDescripcion", "La descripción no puede superar los 500 caracteres.");
        return false;
    }
    limpiarError("errorDescripcion");
    return true;
}

function validarCategoriaEditar() {
    const valor = document.getElementById("categoria").value;
    if (valor === "") {
        mostrarError("errorCategoria", "Debes seleccionar una categoría.");
        return false;
    }
    limpiarError("errorCategoria");
    return true;
}

function validarUnidadEditar() {
    const valor = document.getElementById("unidad").value;
    if (valor === "") {
        mostrarError("errorUnidad", "Debes seleccionar una unidad.");
        return false;
    }
    limpiarError("errorUnidad");
    return true;
}

function validarPrecioResidencialEditar() {
    const valor = document.getElementById("precioResidencial").value;
    if (valor === "" || isNaN(valor) || Number(valor) < 0) {
        mostrarError("errorPrecioResidencial", "Ingresa un precio residencial válido (0 o mayor).");
        return false;
    }
    limpiarError("errorPrecioResidencial");
    return true;
}

function validarPrecioComercialEditar() {
    const valor = document.getElementById("precioComercial").value;
    if (valor === "" || isNaN(valor) || Number(valor) < 0) {
        mostrarError("errorPrecioComercial", "Ingresa un precio comercial válido (0 o mayor).");
        return false;
    }
    limpiarError("errorPrecioComercial");
    return true;
}

function validarStockEditar() {
    const valor = document.getElementById("stock").value;
    if (valor === "" || !Number.isInteger(Number(valor)) || Number(valor) < 0) {
        mostrarError("errorStock", "El stock debe ser un número entero de 0 o más.");
        return false;
    }
    limpiarError("errorStock");
    return true;
}

function validarStockCriticoEditar() {
    const valor = document.getElementById("stockCritico").value;
    if (valor !== "" && (!Number.isInteger(Number(valor)) || Number(valor) < 0)) {
        mostrarError("errorStockCritico", "El stock crítico debe ser un número entero de 0 o más.");
        return false;
    }
    limpiarError("errorStockCritico");
    return true;
}

document.getElementById("formProductoEditar").addEventListener("submit", function (e) {
    e.preventDefault();

    const nombreValido = validarNombreEditar();
    const descripcionValida = validarDescripcionEditar();
    const categoriaValida = validarCategoriaEditar();
    const unidadValida = validarUnidadEditar();
    const precioResidencialValido = validarPrecioResidencialEditar();
    const precioComercialValido = validarPrecioComercialEditar();
    const stockValido = validarStockEditar();
    const stockCriticoValido = validarStockCriticoEditar();

    const formularioValido = nombreValido && descripcionValida && categoriaValida &&
        unidadValida && precioResidencialValido && precioComercialValido &&
        stockValido && stockCriticoValido;

    if (!formularioValido) return;

    // Se guarda en MongoDB a través del servidor. La base aplica sus reglas de validación
    // y el servidor deja el registro en el historial si cambió el stock o algún precio.
    const cambios = {
        nombre: document.getElementById("nombre").value.trim(),
        descripcion: document.getElementById("descripcion").value.trim(),
        categoria: document.getElementById("categoria").value,
        unidad: document.getElementById("unidad").value,
        precioResidencial: Number(document.getElementById("precioResidencial").value),
        precioComercial: Number(document.getElementById("precioComercial").value),
        stock: Number(document.getElementById("stock").value),
        stockCritico: document.getElementById("stockCritico").value !== "" ? Number(document.getElementById("stockCritico").value) : 0,
        imagen: document.getElementById("imagen").value.trim()
    };

    llamarApi("/productos/" + encodeURIComponent(codigoEditar), { method: "PUT", body: cambios })
        .then(function () {
            alert("Producto actualizado correctamente.");
            window.location.href = "productos.html";
        })
        .catch(function (error) {
            alert("❌ No se pudo actualizar: " + error.message);
        });
});
