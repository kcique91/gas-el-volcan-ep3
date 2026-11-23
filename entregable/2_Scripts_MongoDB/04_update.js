// =====================================================================
// 04_update.js  -  UPDATE: updateOne, updateMany, replaceOne con $set, $inc, $push, $pull
// EP3 BDY1103 - Gas El Volcán (MongoDB)
// Cómo se usa: pegar los bloques de a uno en mongosh. Ejecutar DESPUÉS de 02_create.js.
// IMPORTANTE: MongoDB no tiene triggers como Oracle. Lo que en Oracle hacía trg_historial_producto_v
// automáticamente, aquí lo hace el programa: después de cambiar stock o precio, se inserta el registro en historial_productos.
// =====================================================================

use gas_volcan

// ---- U1. $set: cambiar un valor (y dejar el registro en el historial) ----
// Se cambia solo "precios.residencial"; el resto del producto queda igual.
db.productos.updateOne({ _id: "RG001" }, { $set: { "precios.residencial": 9490 } })
db.historial_productos.insertOne({
  codigo: "RG001", campo: "PRECIO_RESIDENCIAL", valor_anterior: 8990, valor_nuevo: 9490,
  usuario: "admin@duoc.cl", fecha_cambio: new Date()
})

// ---- U2. $inc: descontar el stock de la venta del pedido 100 ----
// El filtro incluye "stock: { $gte: cantidad }": solo descuenta si alcanza (en Oracle lo hacía descontar_stock).
db.productos.updateOne({ _id: "CL001", stock: { $gte: 3 } }, { $inc: { stock: -3 } })
db.productos.updateOne({ _id: "MG001", stock: { $gte: 2 } }, { $inc: { stock: -2 } })
db.historial_productos.insertMany([
  { codigo: "CL001", campo: "STOCK", valor_anterior: 80, valor_nuevo: 77, usuario: "vendedor@duoc.cl", fecha_cambio: new Date() },
  { codigo: "MG001", campo: "STOCK", valor_anterior: 80, valor_nuevo: 78, usuario: "vendedor@duoc.cl", fecha_cambio: new Date() }
])
// Esperado: CL001 pasa de 80 a 77 y MG001 de 80 a 78
db.productos.find({ _id: { $in: ["CL001", "MG001"] } }, { nombre: 1, stock: 1 })

// ---- U3. Intento de vender más de lo que hay: el filtro no encuentra nada y el stock no cambia ----
// Es el equivalente al error ORA-20032 (stock insuficiente) de Oracle.
// Esperado: matchedCount: 0 y modifiedCount: 0 (no se descontó nada); el detector de gas sigue con stock 2.
db.productos.updateOne({ _id: "AC003", stock: { $gte: 10 } }, { $inc: { stock: -10 } })
db.productos.findOne({ _id: "AC003" }, { nombre: 1, stock: 1 })

// ---- U4. $set + $push: cambiar el estado del pedido y registrar el cambio en su historial ----
// Las dos cosas se guardan juntas (un solo documento = una sola operación atómica).
// El filtro "estado: PENDIENTE" evita cambiar un pedido que ya no está pendiente.
db.pedidos.updateOne(
  { _id: 100, estado: "PENDIENTE" },
  {
    $set: { estado: "EN_CAMINO", repartidor: { id_repartidor: 1, nombre: "Carlos Munoz" } },
    $push: { historial_estados: { estado_anterior: "PENDIENTE", estado_nuevo: "EN_CAMINO", fecha_cambio: new Date(), usuario: "vendedor@duoc.cl" } }
  }
)
db.pedidos.findOne({ _id: 100 }, { estado: 1, repartidor: 1, historial_estados: 1 })

// ---- U5. $push + $inc: agregar una línea a un pedido PENDIENTE y subir su total ----
// Solo funciona si el pedido sigue PENDIENTE (en Oracle: validar_pedido_abierto).
db.pedidos.updateOne(
  { _id: 101, estado: "PENDIENTE" },
  {
    $push: { lineas: { codigo: "MG001", nombre: "Manguera gas 1.5m", cantidad: 1, precio_unitario: 3990, subtotal: 3990 } },
    $inc: { total: 3990 }
  }
)
db.pedidos.findOne({ _id: 101 }, { lineas: 1, total: 1 })

// ---- U6. $pull: el cliente se arrepiente y se saca esa línea del pedido (y baja el total) ----
db.pedidos.updateOne(
  { _id: 101, estado: "PENDIENTE" },
  { $pull: { lineas: { codigo: "MG001" } }, $inc: { total: -3990 } }
)
db.pedidos.findOne({ _id: 101 }, { lineas: 1, total: 1 })

// ---- U7. updateMany: llegó mercadería, +10 unidades a TODOS los reguladores ----
// Esperado: matchedCount: 3 y modifiedCount: 3; los reguladores pasan a 55, 22 y 28
// Primero se guarda cómo estaban para poder dejar el historial; luego se actualiza en una sola instrucción.
var antes = db.productos.find({ categoria: "Reguladores" }).toArray()
db.productos.updateMany({ categoria: "Reguladores" }, { $inc: { stock: 10 } })
db.historial_productos.insertMany(antes.map(p => ({
  codigo: p._id, campo: "STOCK", valor_anterior: p.stock, valor_nuevo: p.stock + 10,
  usuario: "admin@duoc.cl", fecha_cambio: new Date()
})))
db.productos.find({ categoria: "Reguladores" }, { nombre: 1, stock: 1 })

// ---- U8. replaceOne: reemplazar el documento COMPLETO (a diferencia de $set, lo que no se incluye desaparece) ----
// Se corrige el nombre de la cliente 11; como el nuevo documento no trae cuenta_web, ese campo se elimina.
db.clientes.replaceOne(
  { _id: 11 },
  {
    _id: 11,
    nombre: "Ana Torres Vega",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Los Olmos 321, Chillán Viejo", telefono: "945000011", email: "ana.torres@mail.com" }
  }
)
db.clientes.findOne({ _id: 11 })

// ---- U9. Leer el historial que quedó registrado ----
db.historial_productos.find({}, { _id: 0 }).sort({ fecha_cambio: 1 })
db.historial_productos.find({ codigo: "RG001" }, { _id: 0 })
