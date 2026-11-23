// =====================================================================
// server.cjs  -  API de Distribuidora Gas El Volcán (Express + MongoDB)
// EP3 BDY1103
//
// Esta versión corrige las fallas encontradas en las pruebas:
//   1. Las acciones que modifican datos (editar/crear/borrar productos, ver pedidos
//      e historial) ahora exigen iniciar sesión como personal (Administrador/Vendedor).
//   2. Ya NO se salta las reglas de validación de la base (se quitó bypassDocumentValidation):
//      si alguien intenta guardar stock o precio negativo, MongoDB lo rechaza.
//   3. El historial se guarda en el MISMO formato que usa nuestra base
//      (codigo, campo, valor_anterior, valor_nuevo, usuario, fecha_cambio).
//   4. El panel de administración y el carrito leen y escriben en MongoDB
//      (antes usaban datos guardados en el navegador).
//   5. Nuevo: POST /api/pedidos crea un pedido real descontando el stock con control.
//
// Recordatorio: MongoDB no tiene triggers. Lo que en Oracle hacía el trigger
// (guardar el historial al cambiar stock o precio) aquí lo hace este programa.
// =====================================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 5000;
// Si no se define MONGO_URL se usa la base local de siempre.
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/gas_volcan';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Conectado a MongoDB: gas_volcan'))
  .catch(err => console.error('❌ Error de conexión:', err.message));

// --- MODELOS ---
// Las lecturas usan estos modelos. Las escrituras usan ".collection" (el driver nativo),
// así MongoDB aplica las reglas de validación que creamos en el script 01.

const productoSchema = new mongoose.Schema({
  _id: String,
  nombre: String,
  descripcion: String,
  categoria: String,
  precios: { residencial: Number, comercial: Number },
  stock: Number,
  stock_critico: Number,
  imagen: String
}, { collection: 'productos', strict: false });
const Producto = mongoose.model('Producto', productoSchema);

const historialSchema = new mongoose.Schema({}, { strict: false, collection: 'historial_productos' });
const Historial = mongoose.model('Historial', historialSchema);

const clienteSchema = new mongoose.Schema({ _id: Number }, { strict: false, collection: 'clientes' });
const Cliente = mongoose.model('Cliente', clienteSchema);

const pedidoSchema = new mongoose.Schema({ _id: Number }, { strict: false, collection: 'pedidos' });
const Pedidos = mongoose.model('Pedidos', pedidoSchema);

// --- ERRORES CONTROLADOS ---
// Sirve para devolver un mensaje claro al navegador (400, 401, 403, 404, 409).
class ErrorNegocio extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

// --- SESIÓN DEL PERSONAL (login) ---
// Cuentas del personal. En un sistema real irían en una colección con la contraseña cifrada.
const CUENTAS_STAFF = [
  { correo: 'admin@duoc.cl', password: 'admin', nombre: 'Admin Gas El Volcán', rol: 'Administrador' },
  { correo: 'vendedor@duoc.cl', password: 'vende', nombre: 'Carlos Repartidor', rol: 'Vendedor' }
];
const DURACION_SESION_MS = 8 * 60 * 60 * 1000; // 8 horas
const sesiones = new Map(); // token -> { correo, nombre, rol, expira }

// POST /api/login  { correo, password }  ->  { token, nombre, rol, correo }
app.post('/api/login', (req, res) => {
  const { correo, password } = req.body || {};
  const cuenta = CUENTAS_STAFF.find(c =>
    typeof correo === 'string' && c.correo === correo.trim().toLowerCase() && c.password === password);
  if (!cuenta) throw new ErrorNegocio(401, 'Correo o contraseña incorrectos para una cuenta del personal.');

  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, { correo: cuenta.correo, nombre: cuenta.nombre, rol: cuenta.rol, expira: Date.now() + DURACION_SESION_MS });
  res.json({ token, correo: cuenta.correo, nombre: cuenta.nombre, rol: cuenta.rol });
});

// Middleware: deja pasar solo a quien trae un token válido (y, si se indica, con uno de los roles permitidos).
function requerirStaff(...rolesPermitidos) {
  return (req, res, next) => {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
    const sesion = sesiones.get(token);
    if (!sesion || sesion.expira < Date.now()) {
      sesiones.delete(token);
      throw new ErrorNegocio(401, 'Debes iniciar sesión como personal para realizar esta acción.');
    }
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(sesion.rol)) {
      throw new ErrorNegocio(403, 'Tu rol (' + sesion.rol + ') no tiene permiso para esta acción.');
    }
    req.usuario = sesion;
    next();
  };
}

// --- AYUDAS DE VALIDACIÓN ---
// Solo se comprueba que sea un número. Que no sea negativo lo decide la BASE DE DATOS con su regla de validación
// (minimum: 0 en el script 01), no este programa.
const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const quitarPrefijoImg = (ruta) => String(ruta).trim().replace(/^img\//, '');

// Convierte lo que manda el navegador (nombres simples) a las rutas del documento de MongoDB.
// Solo se aceptan estos campos; cualquier otro se ignora.
function armarCambiosProducto(body) {
  const set = {};
  const unset = {};

  if (body.nombre !== undefined) {
    if (typeof body.nombre !== 'string' || body.nombre.trim() === '') throw new ErrorNegocio(400, 'El nombre es obligatorio.');
    set.nombre = body.nombre.trim();
  }
  if (body.descripcion !== undefined) set.descripcion = String(body.descripcion).trim();
  if (body.categoria !== undefined) set.categoria = body.categoria;
  if (body.unidad !== undefined) set.unidad = body.unidad;

  const numericos = [
    ['precioResidencial', 'precios.residencial', 'El precio residencial'],
    ['precioComercial', 'precios.comercial', 'El precio comercial'],
    ['stock', 'stock', 'El stock'],
    ['stockCritico', 'stock_critico', 'El stock crítico']
  ];
  for (const [campoEntrada, campoMongo, etiqueta] of numericos) {
    if (body[campoEntrada] === undefined) continue;
    if (!esNumero(body[campoEntrada])) throw new ErrorNegocio(400, etiqueta + ' debe ser un número.');
    set[campoMongo] = body[campoEntrada];
  }

  if (body.imagen !== undefined) {
    const img = quitarPrefijoImg(body.imagen);
    if (img === '') unset.imagen = ''; // sin imagen = el campo no existe
    else set.imagen = img;
  }
  return { set, unset };
}

// --- PRODUCTOS ---

// Obtener todos los productos (público: es el catálogo de la tienda)
app.get('/api/productos', async (req, res) => {
  const productos = await Producto.find().sort({ _id: 1 });
  res.json(productos);
});

// Obtener un producto por código (público)
app.get('/api/productos/:codigo', async (req, res) => {
  const producto = await Producto.findById(req.params.codigo);
  if (!producto) throw new ErrorNegocio(404, 'Producto no encontrado');
  res.json(producto);
});

// Crear un producto (solo Administrador).
// insertOne SIN bypass: si falta un dato o no cumple las reglas, MongoDB lo rechaza (error 121).
app.post('/api/productos', requerirStaff('Administrador'), async (req, res) => {
  const b = req.body || {};
  if (typeof b.codigo !== 'string' || b.codigo.trim().length < 3) {
    throw new ErrorNegocio(400, 'El código es obligatorio y debe tener al menos 3 caracteres.');
  }
  const { set, unset } = armarCambiosProducto(b);
  const doc = {
    _id: b.codigo.trim(),
    nombre: set.nombre,
    descripcion: set.descripcion,
    categoria: set.categoria,
    unidad: set.unidad,
    precios: { residencial: set['precios.residencial'], comercial: set['precios.comercial'] },
    stock: set.stock,
    stock_critico: set.stock_critico !== undefined ? set.stock_critico : 0
  };
  if (set.imagen) doc.imagen = set.imagen;
  if (doc.descripcion === undefined) delete doc.descripcion;

  await Producto.collection.insertOne(doc); // si el código ya existe -> error 11000 (409)
  res.status(201).json(await Producto.findById(doc._id));
});

// Editar un producto (Administrador o Vendedor) con auditoría.
// 1) findOneAndUpdate cambia el producto y devuelve cómo estaba ANTES (en una sola operación).
// 2) Por cada campo auditable que cambió (stock, precio residencial, precio comercial)
//    se guarda un registro en historial_productos con el formato de nuestra base.
app.put('/api/productos/:codigo', requerirStaff('Administrador', 'Vendedor'), async (req, res) => {
  const { codigo } = req.params;
  const { set, unset } = armarCambiosProducto(req.body || {});
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    throw new ErrorNegocio(400, 'No se envió ningún dato para cambiar.');
  }

  const operacion = {};
  if (Object.keys(set).length > 0) operacion.$set = set;
  if (Object.keys(unset).length > 0) operacion.$unset = unset;

  // Sin bypassDocumentValidation: las reglas del script 01 se respetan (ej.: stock >= 0).
  const anterior = await Producto.collection.findOneAndUpdate(
    { _id: codigo },
    operacion,
    { returnDocument: 'before' }
  );
  if (!anterior) throw new ErrorNegocio(404, 'Producto no encontrado');

  // Comparar antes y después solo en lo que se auditaba en Oracle.
  const auditables = [
    { campo: 'STOCK', ruta: 'stock', antes: anterior.stock, despues: set.stock },
    { campo: 'PRECIO_RESIDENCIAL', ruta: 'precios.residencial', antes: anterior.precios && anterior.precios.residencial, despues: set['precios.residencial'] },
    { campo: 'PRECIO_COMERCIAL', ruta: 'precios.comercial', antes: anterior.precios && anterior.precios.comercial, despues: set['precios.comercial'] }
  ];
  const registros = auditables
    .filter(a => a.despues !== undefined && a.despues !== a.antes)
    .map(a => ({
      codigo,
      campo: a.campo,
      valor_anterior: a.antes,
      valor_nuevo: a.despues,
      usuario: req.usuario.correo,
      fecha_cambio: new Date()
    }));
  if (registros.length > 0) await Historial.collection.insertMany(registros);

  res.json(await Producto.findById(codigo));
});

// Eliminar un producto (solo Administrador).
// Los pedidos antiguos NO se ven afectados: cada línea del pedido guarda su propia copia del nombre y el precio.
app.delete('/api/productos/:codigo', requerirStaff('Administrador'), async (req, res) => {
  const r = await Producto.collection.deleteOne({ _id: req.params.codigo });
  if (r.deletedCount === 0) throw new ErrorNegocio(404, 'Producto no encontrado');
  res.json({ ok: true });
});

// --- CLIENTES ---
// Datos personales: solo personal autenticado.
app.get('/api/clientes', requerirStaff(), async (req, res) => {
  res.json(await Cliente.find().sort({ _id: 1 }).lean());
});

// --- PEDIDOS ---

// Ver pedidos (personal). Cada pedido trae dentro sus líneas de detalle.
app.get('/api/pedidos', requerirStaff(), async (req, res) => {
  res.json(await Pedidos.find().sort({ _id: 1 }).lean());
});

// Siguiente número libre (MongoDB no tiene secuencias como Oracle: se busca el mayor _id y se suma 1).
async function siguienteId(coleccion) {
  const ultimo = await coleccion.find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1).toArray();
  return ultimo.length > 0 ? ultimo[0]._id + 1 : 1;
}

// Inserta un documento con _id numérico; si dos personas piden el mismo número a la vez, reintenta.
async function insertarConIdNuevo(coleccion, documentoSinId) {
  for (let intento = 1; intento <= 5; intento++) {
    const _id = await siguienteId(coleccion);
    try {
      await coleccion.insertOne({ _id, ...documentoSinId });
      return _id;
    } catch (e) {
      if (e.code !== 11000 || intento === 5) throw e;
    }
  }
}

// Busca al cliente por su correo; si no existe todavía, crea su ficha en la colección clientes.
async function buscarOCrearCliente(datos) {
  const correo = String(datos.correo || '').trim().toLowerCase();
  if (!correo.includes('@')) throw new ErrorNegocio(400, 'Falta el correo del cliente.');

  const existente = await Cliente.collection.findOne({ 'contacto.email': correo });
  if (existente) return existente;

  if (datos.run) {
    const porRun = await Cliente.collection.findOne({ 'cuenta_web.run': datos.run });
    if (porRun) return porRun;
  }

  const contacto = { email: correo };
  if (datos.direccion) contacto.direccion = String(datos.direccion);
  if (datos.telefono) contacto.telefono = String(datos.telefono);
  const nuevo = {
    nombre: String(datos.nombre || correo).trim(),
    tipo_cliente: 'RESIDENCIAL',
    contacto
  };
  if (datos.run) nuevo.cuenta_web = { run: String(datos.run), tipo_usuario: 'Cliente' };

  const _id = await insertarConIdNuevo(Cliente.collection, nuevo);
  return { _id, ...nuevo };
}

// Crear un pedido desde el carrito (botón "Pagar").
// Body: { cliente: { correo, nombre, run, direccion, telefono }, items: [ { codigo, cantidad } ] }
// Equivale al flujo del script 06 (crearPedido + agregarProducto), pero en una sola llamada:
//   - por cada producto se descuenta el stock SOLO si alcanza (filtro stock >= cantidad);
//   - si algún producto no alcanza, se devuelve el stock ya descontado y no se crea el pedido
//     (sin transacciones, esa "marcha atrás" la hace el programa);
//   - se guarda el pedido con sus líneas dentro y el historial de cada cambio de stock.
app.post('/api/pedidos', async (req, res) => {
  const { cliente: datosCliente, items } = req.body || {};
  if (!datosCliente) throw new ErrorNegocio(400, 'Faltan los datos del cliente.');
  if (!Array.isArray(items) || items.length === 0) throw new ErrorNegocio(400, 'El carrito está vacío.');

  // Juntar cantidades por código y validarlas
  const cantidades = new Map();
  for (const it of items) {
    if (!it || typeof it.codigo !== 'string' || !Number.isInteger(it.cantidad) || it.cantidad < 1 || it.cantidad > 1000) {
      throw new ErrorNegocio(400, 'Cada producto debe tener un código y una cantidad entera de 1 o más.');
    }
    cantidades.set(it.codigo, (cantidades.get(it.codigo) || 0) + it.cantidad);
  }

  const cliente = await buscarOCrearCliente(datosCliente);
  const tipoCliente = cliente.tipo_cliente || 'RESIDENCIAL';

  const descontados = []; // para poder devolver el stock si algo falla
  const lineas = [];
  const registrosHistorial = [];
  let total = 0;
  let idPedido;

  try {
    for (const [codigo, cantidad] of cantidades) {
      // Descuenta solo si alcanza y devuelve cómo estaba el producto antes de descontar.
      const antes = await Producto.collection.findOneAndUpdate(
        { _id: codigo, stock: { $gte: cantidad } },
        { $inc: { stock: -cantidad } },
        { returnDocument: 'before' }
      );
      if (!antes) {
        const actual = await Producto.collection.findOne({ _id: codigo });
        if (!actual) throw new ErrorNegocio(400, 'El producto ' + codigo + ' no existe.');
        throw new ErrorNegocio(409, 'Stock insuficiente de ' + actual.nombre + ': disponible ' + actual.stock + ', pediste ' + cantidad + '.');
      }
      descontados.push({ codigo, cantidad });

      const precio = tipoCliente === 'COMERCIAL' ? antes.precios.comercial : antes.precios.residencial;
      lineas.push({ codigo, nombre: antes.nombre, cantidad, precio_unitario: precio, subtotal: precio * cantidad });
      total += precio * cantidad;
      registrosHistorial.push({
        codigo, campo: 'STOCK', valor_anterior: antes.stock, valor_nuevo: antes.stock - cantidad,
        usuario: String(datosCliente.correo).trim().toLowerCase(), fecha_cambio: new Date()
      });
    }

    idPedido = await insertarConIdNuevo(Pedidos.collection, {
      cliente: { id_cliente: cliente._id, nombre: cliente.nombre, tipo_cliente: tipoCliente },
      fecha_pedido: new Date(),
      estado: 'PENDIENTE',
      lineas,
      total,
      historial_estados: []
    });
  } catch (error) {
    // Marcha atrás: devolver el stock que ya se había descontado
    for (const d of descontados) {
      await Producto.collection.updateOne({ _id: d.codigo }, { $inc: { stock: d.cantidad } });
    }
    throw error;
  }

  await Historial.collection.insertMany(registrosHistorial);
  res.status(201).json({ id_pedido: idPedido, total, estado: 'PENDIENTE', lineas });
});

// --- HISTORIAL ---
// Registro de cambios de stock y precios (solo personal). Lo más reciente primero.
app.get('/api/historial', requerirStaff(), async (req, res) => {
  const historial = await Historial.collection.find().sort({ fecha_cambio: -1 }).limit(300).toArray();
  res.json(historial);
});

// --- MANEJO DE ERRORES ---
// Traduce los errores de MongoDB y los controlados a respuestas JSON claras.
app.use((err, req, res, next) => {
  if (err instanceof ErrorNegocio) return res.status(err.status).json({ error: err.message });
  if (err.code === 121) {
    return res.status(400).json({
      error: 'La base de datos rechazó el cambio porque no cumple sus reglas de validación (por ejemplo stock o precio negativo, o categoría no permitida).'
    });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'Ya existe un registro con ese código.' });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: err.message });
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
