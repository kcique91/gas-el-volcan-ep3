// 00_DEMO_en_orden.js - La demo en el orden del guion.
// Antes de empezar: pegar 01_crear_base_y_datos.js. Después, pegar los pasos de arriba hacia abajo, de a uno.

use gas_volcan

// ############ ROSA ############

// PASOS 1 y 2 · Diapositivas (sin código)

// ===== ROSA · PASO 3 · Ver las colecciones =====
show collections

// ===== ROSA · PASO 4 · Un pedido con sus líneas adentro =====
db.pedidos.findOne({ _id: 7 })

// ===== ROSA · PASO 5 · El cliente, por referencia =====
db.clientes.findOne({ _id: 7 })

// ===== ROSA · PASO 6 · Crear datos (pegar los cuatro juntos) =====
db.productos.insertOne({
  _id: "AC004",
  nombre: "Llave de paso para gas",
  descripcion: "Llave de corte rápido para la línea de gas",
  categoria: "Accesorios",
  unidad: "Unidad",
  precios: { residencial: 4990, comercial: 4200 },
  stock: 30,
  stock_critico: 6
})

db.clientes.insertMany([
  {
    _id: 10,
    nombre: "Restaurante La Brasa",
    tipo_cliente: "COMERCIAL",
    contacto: { direccion: "Av. O'Higgins 1450, Chillán", telefono: "422000010", email: "pedidos@labrasa.cl" }
  },
  {
    _id: 11,
    nombre: "Ana Torres",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Los Olmos 321, Chillán Viejo", telefono: "945000011", email: "ana.torres@mail.com" },
    cuenta_web: { run: "123456785", tipo_usuario: "Cliente" }
  }
])

db.pedidos.insertOne({
  _id: 100,
  cliente: { id_cliente: 7, nombre: "Distribuidora El Sol Ltda.", tipo_cliente: "COMERCIAL" },
  fecha_pedido: new Date(),
  estado: "PENDIENTE",
  lineas: [
    { codigo: "CL001", nombre: "Cilindro GLP 5 kg", cantidad: 3, precio_unitario: 6000, subtotal: 18000 },
    { codigo: "MG001", nombre: "Manguera gas 1.5m", cantidad: 2, precio_unitario: 3500, subtotal: 7000 }
  ],
  total: 25000,
  historial_estados: []
})

db.pedidos.insertOne({
  _id: 101,
  cliente: { id_cliente: 9, nombre: "Juan Perez", tipo_cliente: "RESIDENCIAL" },
  fecha_pedido: new Date(),
  estado: "PENDIENTE",
  lineas: [
    { codigo: "CL003", nombre: "Cilindro GLP 15 kg", cantidad: 1, precio_unitario: 16000, subtotal: 16000 }
  ],
  total: 16000,
  historial_estados: []
})

// ===== ROSA · PASO 7 · Regla que rechaza datos malos =====
db.productos.insertOne({
  _id: "AC999",
  nombre: "Producto con stock negativo",
  categoria: "Accesorios",
  unidad: "Unidad",
  precios: { residencial: 1000, comercial: 900 },
  stock: -5,
  stock_critico: 1
})

// ############ CRISTOPHER ############

// ===== CRISTOPHER · PASO 1 · Leer con filtros =====
db.productos.find(
  { "precios.residencial": { $gt: 5000, $lt: 13000 } },
  { nombre: 1, "precios.residencial": 1 }
).sort({ "precios.residencial": -1 })

// ===== CRISTOPHER · PASO 2 · Un pedido completo =====
db.pedidos.findOne({ _id: 100 })

// ===== CRISTOPHER · PASO 3 · Total vendido =====
db.pedidos.aggregate([
  { $match: { estado: "ENTREGADO" } },
  { $group: { _id: null, total_entregado: { $sum: "$total" }, pedidos: { $sum: 1 } } }
])

// ===== CRISTOPHER · PASO 4 · Cambiar un campo =====
db.productos.updateOne({ _id: "RG001" }, { $set: { "precios.residencial": 9490 } })
db.historial_productos.insertOne({
  codigo: "RG001", campo: "PRECIO_RESIDENCIAL", valor_anterior: 8990, valor_nuevo: 9490,
  usuario: "admin@duoc.cl", fecha_cambio: new Date()
})

// ===== CRISTOPHER · PASO 5 · Descontar stock =====
db.productos.updateOne({ _id: "CL001", stock: { $gte: 3 } }, { $inc: { stock: -3 } })
db.productos.updateOne({ _id: "MG001", stock: { $gte: 2 } }, { $inc: { stock: -2 } })
db.historial_productos.insertMany([
  { codigo: "CL001", campo: "STOCK", valor_anterior: 80, valor_nuevo: 77, usuario: "vendedor@duoc.cl", fecha_cambio: new Date() },
  { codigo: "MG001", campo: "STOCK", valor_anterior: 80, valor_nuevo: 78, usuario: "vendedor@duoc.cl", fecha_cambio: new Date() }
])
db.productos.find({ _id: { $in: ["CL001", "MG001"] } }, { nombre: 1, stock: 1 })

// ===== CRISTOPHER · PASO 6 · Sin stock suficiente =====
db.productos.updateOne({ _id: "AC003", stock: { $gte: 10 } }, { $inc: { stock: -10 } })
db.productos.findOne({ _id: "AC003" }, { nombre: 1, stock: 1 })

// ===== CRISTOPHER · PASO 7 · Estado e historial a la vez =====
db.pedidos.updateOne(
  { _id: 100, estado: "PENDIENTE" },
  {
    $set: { estado: "EN_CAMINO", repartidor: { id_repartidor: 1, nombre: "Carlos Munoz" } },
    $push: { historial_estados: { estado_anterior: "PENDIENTE", estado_nuevo: "EN_CAMINO", fecha_cambio: new Date(), usuario: "vendedor@duoc.cl" } }
  }
)
db.pedidos.findOne({ _id: 100 }, { estado: 1, repartidor: 1, historial_estados: 1 })

// ############ DANIEL ############

// ===== DANIEL · PASO 1 · Borrar (pegar los tres juntos) =====
db.productos.deleteOne({ _id: "AC004" })

db.clientes.deleteMany({ _id: { $in: [10, 11] } })

db.pedidos.deleteOne({ _id: 101, estado: "PENDIENTE" })

// ===== DANIEL · PASO 2 · Comprobar los datos =====
db.productos.countDocuments()
db.clientes.countDocuments()
db.pedidos.countDocuments()
db.pedidos.find({ _id: { $gte: 100 } }, { estado: 1, total: 1 })

// PASO 3 · La página, GET (sin código)

// ===== DANIEL · PASO 4 · Comprobar el cambio hecho desde la página =====
db.productos.findOne({ _id: "CL001" }, { nombre: 1, "precios.residencial": 1 })

// PASOS 5 y 6 · Conclusión (sin código)
