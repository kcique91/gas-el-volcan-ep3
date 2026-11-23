// =====================================================================
// 05_delete.js  -  DELETE: deleteOne y deleteMany
// EP3 BDY1103 - Gas El Volcán (MongoDB)
// Cómo se usa: pegar los bloques de a uno en mongosh. Ejecutar DESPUÉS de 04_update.js.
// Se borra solo lo que se creó de prueba en 02_create.js; los datos originales y la venta (pedido 100) se quedan.
// =====================================================================

use gas_volcan

// ---- D1. deleteOne: borrar un documento (el producto de prueba) ----
db.productos.deleteOne({ _id: "AC004" })

// ---- D2. deleteMany: borrar varios documentos que cumplen un filtro (los dos clientes de prueba) ----
db.clientes.deleteMany({ _id: { $in: [10, 11] } })

// ---- D3. deleteOne con condición: cancelar el pedido de prueba, solo si sigue PENDIENTE ----
// (En un negocio real un pedido no se borra: se marca como cancelado. Aquí es un pedido de prueba.)
db.pedidos.deleteOne({ _id: 101, estado: "PENDIENTE" })

// ---- D4. Comprobar: un delete sin coincidencias no falla, solo informa deletedCount: 0 ----
db.productos.deleteOne({ _id: "AC004" })

// ---- D5. Comprobar el resultado final ----
// Esperado: 14 productos, 9 clientes y 11 pedidos (los 10 originales + la venta, pedido 100, que queda EN_CAMINO)
db.productos.countDocuments()
db.clientes.countDocuments()
db.pedidos.countDocuments()
db.pedidos.find({ _id: { $gte: 100 } }, { estado: 1, total: 1 })
