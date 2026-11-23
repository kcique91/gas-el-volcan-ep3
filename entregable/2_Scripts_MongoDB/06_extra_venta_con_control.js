// =====================================================================
// 06_extra_venta_con_control.js  -  OPCIONAL
// EP3 BDY1103 - Gas El Volcán (MongoDB)
// Para mostrar SOLO si preguntan "¿y las reglas del EP2 (package, triggers) cómo quedarían en MongoDB?".
// En MongoDB no hay packages ni triggers como en Oracle: esas reglas las implementa el programa.
// Aquí se muestran como funciones de mongosh (que es JavaScript). Cada función usa los mismos
// comandos CRUD ya vistos. Ejecutar DESPUÉS de 01 y 02 (puede ser antes o después de 03 a 05).
// =====================================================================

use gas_volcan

// ---- Equivalente a pkg_ventas_v.crear_pedido ----
function crearPedido(idCliente) {
  const cli = db.clientes.findOne({ _id: idCliente });
  if (!cli) throw new Error("El cliente " + idCliente + " no existe");                 // en Oracle: ORA-20060
  const ultimo = db.pedidos.find({}, { _id: 1 }).sort({ _id: -1 }).limit(1).toArray()[0];
  const id = ultimo._id + 1;
  db.pedidos.insertOne({
    _id: id,
    cliente: { id_cliente: cli._id, nombre: cli.nombre, tipo_cliente: cli.tipo_cliente },
    fecha_pedido: new Date(),
    estado: "PENDIENTE",
    lineas: [],
    total: 0,
    historial_estados: []
  });
  return id;
}

// ---- Equivalente a pkg_ventas_v.agregar_producto + fn_precio_producto + descontar_stock + trg_historial ----
function agregarProducto(idPedido, codigo, cantidad) {
  const ped = db.pedidos.findOne({ _id: idPedido });
  if (!ped || ped.estado !== "PENDIENTE")                                                // validar_pedido_abierto
    throw new Error("El pedido " + idPedido + " no admite cambios");
  const prod = db.productos.findOne({ _id: codigo });
  if (!prod) throw new Error("El producto " + codigo + " no existe");
  const precio = ped.cliente.tipo_cliente === "COMERCIAL"                              // fn_precio_producto
    ? prod.precios.comercial : prod.precios.residencial;
  const r = db.productos.updateOne(                                                    // descontar_stock
    { _id: codigo, stock: { $gte: cantidad } },
    { $inc: { stock: -cantidad } }
  );
  if (r.modifiedCount === 0)
    throw new Error("Stock insuficiente de " + codigo + ": disponible " + prod.stock);   // en Oracle: ORA-20032
  db.historial_productos.insertOne({                                                   // trg_historial_producto_v
    codigo: codigo, campo: "STOCK", valor_anterior: prod.stock, valor_nuevo: prod.stock - cantidad,
    usuario: "vendedor@duoc.cl", fecha_cambio: new Date()
  });
  db.pedidos.updateOne({ _id: idPedido }, {                                            // detalle + total
    $push: { lineas: { codigo: codigo, nombre: prod.nombre, cantidad: cantidad, precio_unitario: precio, subtotal: precio * cantidad } },
    $inc: { total: precio * cantidad }
  });
}

// ---- Demo: la misma venta del EP2 (cliente 7 comercial: 3 x CL001 + 2 x MG001 = $25.000) ----
var nuevo = crearPedido(7)
agregarProducto(nuevo, "CL001", 3)
agregarProducto(nuevo, "MG001", 2)
db.pedidos.findOne({ _id: nuevo }, { cliente: 1, lineas: 1, total: 1 })

// ---- Protección del stock: intentar vender 10 detectores de gas teniendo solo 2 ----
try { agregarProducto(nuevo, "AC003", 10) } catch (e) { print("Error esperado: " + e.message) }
db.productos.findOne({ _id: "AC003" }, { nombre: 1, stock: 1 })

// ---- Cliente que no existe ----
try { crearPedido(999) } catch (e) { print("Error esperado: " + e.message) }

// ---- Pedido que ya no está pendiente (el 100 quedó EN_CAMINO en 04_update.js) ----
try { agregarProducto(100, "MG002", 1) } catch (e) { print("Error esperado: " + e.message) }
