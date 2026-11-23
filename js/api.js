// js/api.js
// Ayudas compartidas para hablar con el servidor (server.cjs) y manejar la sesión del personal.
// Se carga en TODAS las páginas que usan datos de MongoDB.

const API_URL = 'http://localhost:5000/api';

// Datos del usuario que inició sesión (los guarda login.js)
function obtenerSesion() {
  try {
    return JSON.parse(localStorage.getItem('usuarioActivo'));
  } catch (e) {
    return null;
  }
}

// Token que entrega el servidor cuando inicia sesión el personal (Administrador / Vendedor)
function obtenerTokenStaff() {
  return localStorage.getItem('tokenStaff');
}

function esStaff() {
  const s = obtenerSesion();
  return !!(s && (s.rol === 'Administrador' || s.rol === 'Vendedor') && obtenerTokenStaff());
}

function esAdministrador() {
  const s = obtenerSesion();
  return !!(s && s.rol === 'Administrador' && obtenerTokenStaff());
}

function cerrarSesion() {
  localStorage.removeItem('usuarioActivo');
  localStorage.removeItem('tokenStaff');
}

// Protege una página: si no hay sesión de personal, manda a iniciar sesión.
// rutaLogin: 'login.html' (páginas de la tienda) o '../login.html' (panel admin).
function exigirStaff(rutaLogin) {
  if (!esStaff()) {
    window.location.replace(rutaLogin + '?aviso=staff');
    return false;
  }
  return true;
}

// Llama a la API. Agrega el token si hay uno y devuelve el JSON.
// Si el servidor responde con error, lanza un Error con el mensaje que mandó el servidor.
async function llamarApi(ruta, opciones) {
  const config = Object.assign({}, opciones);
  config.headers = Object.assign({ 'Content-Type': 'application/json' }, config.headers);
  const token = obtenerTokenStaff();
  if (token) config.headers.Authorization = 'Bearer ' + token;
  if (config.body && typeof config.body !== 'string') config.body = JSON.stringify(config.body);

  let respuesta;
  try {
    respuesta = await fetch(API_URL + ruta, config);
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor. ¿Está encendido "node server.cjs"?');
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (e) {
    datos = null;
  }

  if (!respuesta.ok) {
    // La sesión del personal venció (por ejemplo, se reinició el servidor): hay que entrar de nuevo
    if (respuesta.status === 401 && token) {
      cerrarSesion();
      alert('Tu sesión terminó. Inicia sesión de nuevo.');
      const enAdmin = window.location.pathname.indexOf('/admin/') !== -1;
      window.location.replace((enAdmin ? '../' : '') + 'login.html');
    }
    const error = new Error((datos && datos.error) || 'Error del servidor (' + respuesta.status + ')');
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

// Escapa texto antes de ponerlo en el HTML (por si un nombre trae símbolos como < o &)
function escaparHtml(texto) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatoPesos(numero) {
  return '$' + Number(numero || 0).toLocaleString('es-CL');
}
