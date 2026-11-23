// =====================================================================
// 02_create.js  -  CREATE: insertOne e insertMany
// EP3 BDY1103 - Gas El Volcán (MongoDB)
// Cómo se usa: abrir mongosh y pegar los bloques de a uno (o todo el archivo).
// Ejecutar DESPUÉS de 01_crear_base_y_datos.js.
// =====================================================================

use gas_volcan

// ---- C1. insertOne: un producto nuevo en el catálogo ----
// Se entrega el _id (el código del producto); el resto de los campos es el documento.
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

// ---- C2. insertMany: dos clientes nuevos de una sola vez ----
// El cliente 10 no tiene cuenta web (no lleva el campo cuenta_web); el cliente 11 sí.
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

// ---- C3. insertOne: la venta del EP2 como UN documento (pedido + líneas) ----
// Cliente 7 (comercial) compra 3 x CL001 a $6.000 y 2 x MG001 a $3.500 = $25.000.
// Las líneas van DENTRO del pedido (documentos anidados): un pedido se lee y se guarda de una vez.
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

// ---- C4. insertOne: un segundo pedido (cliente 9, residencial) para practicar update y delete ----
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

// ---- C5. Una inserción que MongoDB debe rechazar (stock negativo) ----
// La regla de validación de la colección hace el papel del CHECK de Oracle (ck_producto_stock, ORA-02290).
// Esperado: error "Document failed validation"; en el detalle aparece stock: minimum 0, valor -5. No se inserta nada.
db.productos.insertOne({
  _id: "AC999",
  nombre: "Producto con stock negativo",
  categoria: "Accesorios",
  unidad: "Unidad",
  precios: { residencial: 1000, comercial: 900 },
  stock: -5,
  stock_critico: 1
})

// ---- C6. Comprobar cuántos documentos hay ahora ----
// Esperado: 15 productos, 11 clientes y 12 pedidos
db.productos.countDocuments()
db.clientes.countDocuments()
db.pedidos.countDocuments()
