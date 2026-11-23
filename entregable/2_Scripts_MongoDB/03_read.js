// =====================================================================
// 03_read.js  -  READ: find, findOne, operadores, proyecciones y agregaciones
// EP3 BDY1103 - Gas El Volcán (MongoDB)
// Cómo se usa: pegar los bloques de a uno en mongosh. Ejecutar DESPUÉS de 02_create.js.
// =====================================================================

use gas_volcan

/* ================= 3.1  Lo básico ================= */

// ---- R1. ¿Qué colecciones hay? ----
show collections

// ---- R2. findOne: un documento por su _id (el código del producto) ----
// Se ve el documento anidado: "precios" es un objeto dentro del producto.
db.productos.findOne({ _id: "CL001" })

// ---- R3. find con filtro y proyección (solo algunos campos) ----
// { campo: 1 } = mostrar ese campo.  El _id se muestra siempre, salvo que se pida _id: 0.
db.productos.find({ categoria: "Reguladores" }, { nombre: 1, "precios.residencial": 1, stock: 1 })

// ---- R4. Proyección sin _id, más sort y limit ----
db.productos.find({ categoria: "Cilindros de Gas" }, { _id: 0, nombre: 1, stock: 1 }).sort({ stock: -1 }).limit(3)

/* ================= 3.2  Operadores de consulta ================= */

// ---- R5. $gt y $lt: productos con precio residencial entre 5.000 y 13.000 (de mayor a menor) ----
// Esperado: 6 productos, del Carro porta cilindro / Kit conexión (12.990) hasta el Cilindro 5 kg (6.500)
db.productos.find(
  { "precios.residencial": { $gt: 5000, $lt: 13000 } },
  { nombre: 1, "precios.residencial": 1 }
).sort({ "precios.residencial": -1 })

// ---- R6. $in: productos de dos categorías ----
db.productos.find({ categoria: { $in: ["Reguladores", "Accesorios"] } }, { _id: 1, nombre: 1, categoria: 1 })

// ---- R7. $and + $or: cilindros que tienen poco stock (menos de 50) o son muy caros (más de 40.000) ----
db.productos.find({
  $and: [
    { categoria: "Cilindros de Gas" },
    { $or: [ { stock: { $lt: 50 } }, { "precios.residencial": { $gt: 40000 } } ] }
  ]
}, { nombre: 1, stock: 1, "precios.residencial": 1 })

// ---- R8. $not: productos cuyo stock NO es mayor a 20 (o sea, 20 o menos) ----
db.productos.find({ stock: { $not: { $gt: 20 } } }, { nombre: 1, stock: 1 })

// ---- R9. Productos en stock crítico (stock <= stock_critico): compara dos campos del mismo documento ----
// Es lo que en Oracle hacían fn_cantidad_stock_critico y sp_reporte_stock_critico.
// Esperado: solo el Detector de gas a batería (stock 2, crítico 4) y el conteo 1
db.productos.find({ $expr: { $lte: ["$stock", "$stock_critico"] } }, { nombre: 1, stock: 1, stock_critico: 1 })
db.productos.countDocuments({ $expr: { $lte: ["$stock", "$stock_critico"] } })

/* ================= 3.3  Pedidos: documentos anidados, arreglos y fechas ================= */

// ---- R10. Un pedido completo con sus líneas, en UNA sola lectura (sin JOIN) ----
db.pedidos.findOne({ _id: 100 })

// ---- R11. Los datos del cliente NO van copiados completos en el pedido: se buscan por referencia (id_cliente) ----
db.clientes.findOne({ _id: 7 })

// ---- R12. Pedidos por estado ----
db.pedidos.find({ estado: "ENTREGADO" }, { "cliente.nombre": 1, total: 1, estado: 1 })

// ---- R13. Buscar dentro del arreglo de líneas con notación de punto: pedidos que incluyen el cilindro de 15 kg ----
db.pedidos.find({ "lineas.codigo": "CL003" }, { estado: 1, total: 1 })

// ---- R14. $elemMatch: UNA misma línea que cumpla las dos condiciones (CL001 y cantidad >= 2) ----
db.pedidos.find(
  { lineas: { $elemMatch: { codigo: "CL001", cantidad: { $gte: 2 } } } },
  { "cliente.nombre": 1, estado: 1 }
)

// ---- R15. $exists: pedidos que aún no tienen repartidor asignado (el campo no existe) ----
db.pedidos.find({ repartidor: { $exists: false } }, { estado: 1, "cliente.nombre": 1 })

// ---- R16. Rango de fechas: pedidos hechos entre el 20 y el 23 de octubre de 2026 ----
db.pedidos.find(
  { fecha_pedido: { $gte: ISODate("2026-10-20T00:00:00Z"), $lt: ISODate("2026-10-24T00:00:00Z") } },
  { fecha_pedido: 1, estado: 1, total: 1 }
).sort({ fecha_pedido: 1 })

/* ================= 3.4  Agregaciones (reportes) ================= */

// ---- R17. Total vendido en pedidos ENTREGADOS: lo que en Oracle hacía fn_total_ventas_entregadas ----
// Esperado: total_entregado 147480 en 3 pedidos (el mismo número que en Oracle), pero con UNA sola consulta, sin recorrer pedido por pedido.
db.pedidos.aggregate([
  { $match: { estado: "ENTREGADO" } },
  { $group: { _id: null, total_entregado: { $sum: "$total" }, pedidos: { $sum: 1 } } }
])

// ---- R18. Cantidad de pedidos y monto por estado ----
db.pedidos.aggregate([
  { $group: { _id: "$estado", pedidos: { $sum: 1 }, monto: { $sum: "$total" } } },
  { $sort: { _id: 1 } }
])

// ---- R19. Los 3 productos más vendidos: $unwind abre el arreglo de líneas para poder sumarlas ----
// Esperado: CL001 con 11 unidades y, empatados con 7, CL003 y MG001 (el orden entre los empatados puede variar).
db.pedidos.aggregate([
  { $unwind: "$lineas" },
  { $group: { _id: "$lineas.codigo", nombre: { $first: "$lineas.nombre" }, unidades: { $sum: "$lineas.cantidad" }, ingresos: { $sum: "$lineas.subtotal" } } },
  { $sort: { unidades: -1 } },
  { $limit: 3 }
])

// ---- R20. Reporte de stock crítico con cuánto falta para salir de él (como sp_reporte_stock_critico) ----
// Esperado: Detector de gas a batería con faltan: 3  (4 - 2 + 1, la misma cuenta que en Oracle)
db.productos.aggregate([
  { $match: { $expr: { $lte: ["$stock", "$stock_critico"] } } },
  { $project: { nombre: 1, stock: 1, stock_critico: 1, faltan: { $add: [{ $subtract: ["$stock_critico", "$stock"] }, 1] } } }
])
