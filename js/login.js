/**
 * js/login.js
 */

document.addEventListener("DOMContentLoaded", () => {
  // Actualizar contador del carrito
  if (typeof actualizarContadorCarrito === "function") {
    actualizarContadorCarrito();
  }

  let usuarios = JSON.parse(localStorage.getItem("usuarios"));

  if (!usuarios || usuarios.length === 0) {
    usuarios = [
      {
        run: "111111111", // Admin demostrativo
        nombre: "Admin",
        apellidos: "Gas El Volcán",
        correo: "admin@duoc.cl",
        password: "admin",
        tipoUsuario: "Administrador",
        region: "Región de Ñuble",
        comuna: "Chillán",
        direccion: "Bodega Central Chillán"
      },
      {
        run: "222222222",
        nombre: "Carlos",
        apellidos: "Repartidor Ñuble",
        correo: "vendedor@duoc.cl",
        password: "vende",
        tipoUsuario: "Vendedor",
        region: "Región de Ñuble",
        comuna: "Chillán Viejo",
        direccion: "Turno Ruta 1"
      },
      {
        run: "19011022K",
        nombre: "Juan",
        apellidos: "Pérez",
        correo: "cliente@gmail.com",
        password: "1234",
        tipoUsuario: "Cliente",
        region: "Región de Ñuble",
        comuna: "Chillán",
        direccion: "Av. Argentina 550"
      }
    ];
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
  }

  // Elementos del DOM
  const form = document.getElementById("formLogin");
  const inputCorreo = document.getElementById("correo");
  const inputPassword = document.getElementById("password");

  const errorCorreo = document.getElementById("error-correo");
  const errorPassword = document.getElementById("error-password");
  const mensajeGeneral = document.getElementById("mensaje-general");

  const dominiosValidos = ["@duoc.cl", "@profesor.duoc.cl", "@gmail.com"];

  // VALIDACIONES EN TIEMPO REAL (Formato)
  function validarCorreoFormato() {
    const valor = inputCorreo.value.trim().toLowerCase();

    if (valor === "") {
      mostrarError(inputCorreo, errorCorreo, "El correo electrónico es obligatorio.");
      return false;
    }

    if (valor.length > 100) {
      mostrarError(inputCorreo, errorCorreo, "Máximo 100 caracteres.");
      return false;
    }

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(valor)) {
      mostrarError(inputCorreo, errorCorreo, "Ingresa un formato de correo válido.");
      return false;
    }

    const tieneDominioPermitido = dominiosValidos.some(dominio => valor.endsWith(dominio));
    if (!tieneDominioPermitido) {
      mostrarError(
        inputCorreo, 
        errorCorreo, 
        "Solo se permite @duoc.cl, @profesor.duoc.cl o @gmail.com"
      );
      return false;
    }

    limpiarError(inputCorreo, errorCorreo);
    return true;
  }

  function validarPasswordFormato() {
    const valor = inputPassword.value;

    if (valor.trim() === "") {
      mostrarError(inputPassword, errorPassword, "La contraseña es obligatoria.");
      return false;
    }

    if (valor.length < 4 || valor.length > 10) {
      mostrarError(inputPassword, errorPassword, "Debe tener entre 4 y 10 caracteres.");
      return false;
    }

    limpiarError(inputPassword, errorPassword);
    return true;
  }

  function mostrarError(input, elementoError, mensaje) {
    input.classList.add("input-invalido");
    input.classList.remove("input-valido");
    elementoError.textContent = mensaje;
  }

  function limpiarError(input, elementoError) {
    input.classList.remove("input-invalido");
    input.classList.add("input-valido");
    elementoError.textContent = "";
  }

  // Si nos mandaron aquí desde una página que solo es para el personal, se explica por qué
  if (new URLSearchParams(window.location.search).get("aviso") === "staff") {
    mensajeGeneral.className = "mensaje-alerta error";
    mensajeGeneral.textContent = "Esa página es solo para el personal. Inicia sesión como Administrador o Vendedor.";
  }

  inputCorreo.addEventListener("input", validarCorreoFormato);
  inputCorreo.addEventListener("blur", validarCorreoFormato);

  inputPassword.addEventListener("input", validarPasswordFormato);
  inputPassword.addEventListener("blur", validarPasswordFormato);

  // AUTENTICACIÓN AL ENVIAR (Verificación Real)
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const correoOk = validarCorreoFormato();
    const passwordOk = validarPasswordFormato();

    if (!correoOk || !passwordOk) {
      mensajeGeneral.className = "mensaje-alerta error";
      mensajeGeneral.textContent = "Por favor, completa correctamente los campos.";
      return;
    }

    const correoIngresado = inputCorreo.value.trim().toLowerCase();
    const passwordIngresada = inputPassword.value;

    // 1. Obtener la lista actualizada de usuarios
    const usuariosRegistrados = JSON.parse(localStorage.getItem("usuarios")) || [];

    // 2. Buscar si existe un usuario con ese correo y esa contraseña
    const usuarioEncontrado = usuariosRegistrados.find(
      u => u.correo.toLowerCase() === correoIngresado && u.password === passwordIngresada
    );

    if (usuarioEncontrado) {
      const esPersonal = usuarioEncontrado.tipoUsuario === "Administrador" || usuarioEncontrado.tipoUsuario === "Vendedor";

      // Guarda la sesión activa con su ROL REAL y redirige según el rol
      const entrar = (tokenStaff) => {
        localStorage.setItem("usuarioActivo", JSON.stringify({
          run: usuarioEncontrado.run,
          nombre: `${usuarioEncontrado.nombre} ${usuarioEncontrado.apellidos}`,
          correo: usuarioEncontrado.correo,
          rol: usuarioEncontrado.tipoUsuario || "Cliente"
        }));
        if (tokenStaff) {
          localStorage.setItem("tokenStaff", tokenStaff);
        } else {
          localStorage.removeItem("tokenStaff");
        }

        mensajeGeneral.className = "mensaje-alerta exito";
        mensajeGeneral.textContent = `¡Bienvenido/a ${usuarioEncontrado.nombre}! (Rol: ${usuarioEncontrado.tipoUsuario}). Redirigiendo...`;

        setTimeout(() => {
          window.location.href = esPersonal ? "admin/home.html" : "index.html";
        }, 1500);
      };

      if (!esPersonal) {
        entrar(null);
        return;
      }

      // El personal además inicia sesión en el servidor: de ahí sale el token que
      // permite editar productos, ver pedidos y ver el historial.
      fetch(API_URL + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correoIngresado, password: passwordIngresada })
      })
        .then(async (respuesta) => {
          const datos = await respuesta.json().catch(() => ({}));
          if (!respuesta.ok) throw new Error(datos.error || "El servidor rechazó el inicio de sesión.");
          entrar(datos.token);
        })
        .catch((error) => {
          mensajeGeneral.className = "mensaje-alerta error";
          mensajeGeneral.textContent = error instanceof TypeError
            ? 'No se pudo conectar con el servidor. ¿Está encendido "node server.cjs"?'
            : error.message;
        });

    } else {
      // Error de credenciales
      mensajeGeneral.className = "mensaje-alerta error";
      mensajeGeneral.textContent = "Correo o contraseña incorrectos. Verifica tus datos o regístrate.";
      mostrarError(inputPassword, errorPassword, "Credenciales no coinciden con ninguna cuenta.");
    }
  });
});