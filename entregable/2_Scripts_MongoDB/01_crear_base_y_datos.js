// =====================================================================
// 01_crear_base_y_datos.js
// EP3 BDY1103 - Gas El Volcán - Base de datos NO relacional (MongoDB)
//
// Qué hace: crea la base "gas_volcan" desde cero, con sus colecciones,
//   reglas de validación, índices y los datos que ya existían en Oracle
//   (14 productos, 9 clientes, 10 pedidos con sus líneas).
// Cómo se ejecuta (cualquiera de las dos):
//   a) desde una terminal, en la carpeta del archivo:  mongosh --file 01_crear_base_y_datos.js
//   b) dentro de mongosh:                               load("01_crear_base_y_datos.js")
// Se puede ejecutar cuantas veces se quiera: borra la base y la deja como nueva.
// =====================================================================

db = db.getSiblingDB("gas_volcan");
db.dropDatabase();

/* ============ PASO 1: colecciones con reglas de validación ============
   MongoDB no obliga a tener esquema, pero se le puede pedir que valide.
   Son las mismas reglas que en Oracle eran CHECK / NOT NULL / UNIQUE. */

// productos: _id = código del producto (en Oracle: columna codigo, UNIQUE)
db.createCollection("productos", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["_id", "nombre", "categoria", "unidad", "precios", "stock", "stock_critico"],
    properties: {
      _id:           { bsonType: "string", minLength: 3 },          // ck_producto_codigo
      nombre:        { bsonType: "string" },
      categoria:     { enum: ["Cilindros de Gas", "Reguladores", "Mangueras y Conexiones", "Accesorios"] },
      unidad:        { enum: ["Unidad", "Kit"] },
      precios: {
        bsonType: "object",
        required: ["residencial", "comercial"],
        properties: {
          residencial: { bsonType: "number", minimum: 0 },
          comercial:   { bsonType: "number", minimum: 0 }
        }
      },
      stock:         { bsonType: "number", minimum: 0 },            // ck_producto_stock
      stock_critico: { bsonType: "number", minimum: 0 }
    }
  } }
});

// clientes: _id = id_cliente de Oracle
db.createCollection("clientes", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["_id", "nombre", "tipo_cliente"],
    properties: {
      nombre:       { bsonType: "string" },
      tipo_cliente: { enum: ["RESIDENCIAL", "COMERCIAL"] }          // ck_cliente_tipo
    }
  } }
});

// pedidos: el pedido guarda DENTRO sus líneas de detalle y su historial de estados
db.createCollection("pedidos", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["_id", "cliente", "fecha_pedido", "estado", "lineas", "total"],
    properties: {
      cliente:      { bsonType: "object", required: ["id_cliente", "nombre"] },
      fecha_pedido: { bsonType: "date" },
      estado:       { enum: ["PENDIENTE", "EN_CAMINO", "ENTREGADO"] },
      lineas: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["codigo", "cantidad", "precio_unitario", "subtotal"],
          properties: {
            cantidad:        { bsonType: "number", minimum: 1 },
            precio_unitario: { bsonType: "number", minimum: 0 }
          }
        }
      },
      total: { bsonType: "number", minimum: 0 }
    }
  } }
});

// historial_productos: cambios de stock y precios (en Oracle: historial_producto_v)
db.createCollection("historial_productos", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["codigo", "campo", "valor_anterior", "valor_nuevo", "usuario", "fecha_cambio"],
    properties: {
      campo:        { enum: ["STOCK", "PRECIO_RESIDENCIAL", "PRECIO_COMERCIAL"] },
      fecha_cambio: { bsonType: "date" }
    }
  } }
});

/* ============ PASO 2: índices ============
   El índice de _id existe siempre. Estos aceleran las consultas más usadas. */
db.productos.createIndex({ categoria: 1 });
db.pedidos.createIndex({ "cliente.id_cliente": 1 });
db.pedidos.createIndex({ estado: 1 });
db.historial_productos.createIndex({ codigo: 1, fecha_cambio: -1 });
// un usuario web corresponde a un solo cliente (en Oracle: uq_cliente_run)
db.clientes.createIndex(
  { "cuenta_web.run": 1 },
  { unique: true, partialFilterExpression: { "cuenta_web.run": { $exists: true } } }
);

/* ============ PASO 3: datos migrados desde Oracle ============ */

// ---- productos (producto_v): el catálogo de la tienda web, 14 productos y todos con imagen.
// No se migraron CL005 (balón portátil 2 kg) ni CL006 (recarga del balón): no se venden en la tienda web.
// En los pedidos 4, 5, 9 y 10 esa línea se reemplazó por un producto del catálogo: el balón por la manguera de 3 m
// (mismo precio, $6.990, así los pedidos entregados siguen sumando $147.480) y la recarga por la manguera de 1.5 m.
// Ajuste del dato de ejemplo: el detector de gas (AC003) parte con stock 2 y crítico 4 (en Oracle: 8 y 2),
// para que los reportes de stock crítico tengan un caso que mostrar.
db.productos.insertMany([
  {
    _id: "AC001",
    nombre: "Carro porta cilindro 11/15kg",
    descripcion: "Carro metálico con ruedas para transportar cilindros dentro del hogar con seguridad",
    categoria: "Accesorios",
    unidad: "Unidad",
    precios: { residencial: 12990, comercial: 11000 },
    stock: 20,
    stock_critico: 4,
    imagen: "carro-gas.jpg"
  },
  {
    _id: "AC002",
    nombre: "Tapa protectora para válvula",
    descripcion: "Tapa de plástico ABS para proteger la válvula del cilindro durante el transporte",
    categoria: "Accesorios",
    unidad: "Unidad",
    precios: { residencial: 1490, comercial: 1200 },
    stock: 60,
    stock_critico: 12,
    imagen: "tapa-gas.jpg"
  },
  {
    _id: "AC003",
    nombre: "Detector de gas a batería",
    descripcion: "Sensor electroquímico. Alarma sonora y visual ante fuga de gas GLP o metano",
    categoria: "Accesorios",
    unidad: "Unidad",
    precios: { residencial: 19990, comercial: 17000 },
    stock: 2,
    stock_critico: 4,
    imagen: "detector-gas.jpg"
  },
  {
    _id: "CL001",
    nombre: "Cilindro GLP 5 kg",
    descripcion: "Cilindro de gas licuado de petróleo 5 kg. Para uso residencial (cocina, calefacción pequeña)",
    categoria: "Cilindros de Gas",
    unidad: "Unidad",
    precios: { residencial: 6500, comercial: 6000 },
    stock: 80,
    stock_critico: 16,
    imagen: "cilindro-5kg.jpg"
  },
  {
    _id: "CL002",
    nombre: "Cilindro GLP 11 kg",
    descripcion: "Cilindro estándar doméstico. El más utilizado en hogares chilenos. Compatible con reguladores estándar",
    categoria: "Cilindros de Gas",
    unidad: "Unidad",
    precios: { residencial: 12000, comercial: 11000 },
    stock: 200,
    stock_critico: 40,
    imagen: "cilindro-11kg.jpg"
  },
  {
    _id: "CL003",
    nombre: "Cilindro GLP 15 kg",
    descripcion: "Cilindro de mayor capacidad para hogares de alto consumo o locales pequeños",
    categoria: "Cilindros de Gas",
    unidad: "Unidad",
    precios: { residencial: 16000, comercial: 14500 },
    stock: 90,
    stock_critico: 18,
    imagen: "cilindro-15kg.jpg"
  },
  {
    _id: "CL004",
    nombre: "Cilindro GLP 45 kg",
    descripcion: "Cilindro industrial. Uso comercial: restaurantes, talleres, calefacción de locales",
    categoria: "Cilindros de Gas",
    unidad: "Unidad",
    precios: { residencial: 45000, comercial: 40000 },
    stock: 30,
    stock_critico: 6,
    imagen: "cilindro-45kg.jpg"
  },
  {
    _id: "MG001",
    nombre: "Manguera gas 1.5m",
    descripcion: "Manguera flexible homologada. Diámetro interior 9mm. Compatible con reguladores estándar",
    categoria: "Mangueras y Conexiones",
    unidad: "Unidad",
    precios: { residencial: 3990, comercial: 3500 },
    stock: 80,
    stock_critico: 16,
    imagen: "manguera-gas.jpg"
  },
  {
    _id: "MG002",
    nombre: "Manguera gas 3m",
    descripcion: "Manguera larga para instalaciones donde el artefacto está alejado del cilindro",
    categoria: "Mangueras y Conexiones",
    unidad: "Unidad",
    precios: { residencial: 6990, comercial: 6200 },
    stock: 50,
    stock_critico: 10,
    imagen: "manguera-gas-3m.jpg"
  },
  {
    _id: "MG003",
    nombre: "Abrazadera metálica",
    descripcion: "Abrazadera de acero para asegurar la conexión manguera-regulador y manguera-artefacto",
    categoria: "Mangueras y Conexiones",
    unidad: "Unidad",
    precios: { residencial: 990, comercial: 800 },
    stock: 200,
    stock_critico: 40,
    imagen: "abrazadera-metalica.jpg"
  },
  {
    _id: "MG004",
    nombre: "Kit conexión completo (regulador + manguera 1.5m + abrazaderas)",
    descripcion: "Todo lo necesario para instalar un cilindro nuevo",
    categoria: "Mangueras y Conexiones",
    unidad: "Kit",
    precios: { residencial: 12990, comercial: 11500 },
    stock: 25,
    stock_critico: 5,
    imagen: "kit-conexion.jpg"
  },
  {
    _id: "RG001",
    nombre: "Regulador doméstico estándar",
    descripcion: "Regulador de 1 etapa para cilindros 5, 11 y 15 kg. Presión de salida 28 mbar",
    categoria: "Reguladores",
    unidad: "Unidad",
    precios: { residencial: 8990, comercial: 8200 },
    stock: 45,
    stock_critico: 9,
    imagen: "regulador-domestico.jpg"
  },
  {
    _id: "RG002",
    nombre: "Regulador de alta presión",
    descripcion: "Regulador para cocinas industriales o equipos de mayor consumo. Presión regulable",
    categoria: "Reguladores",
    unidad: "Unidad",
    precios: { residencial: 18990, comercial: 17000 },
    stock: 12,
    stock_critico: 3,
    imagen: "regulador-de-alta-presion.jpg"
  },
  {
    _id: "RG003",
    nombre: "Regulador dual (2 salidas)",
    descripcion: "Permite conectar dos artefactos simultáneamente al mismo cilindro",
    categoria: "Reguladores",
    unidad: "Unidad",
    precios: { residencial: 14990, comercial: 13500 },
    stock: 18,
    stock_critico: 4,
    imagen: "regulador-dual.jpg"
  }
]);

// ---- clientes (cliente_v). Solo el cliente 9 tiene cuenta web: los demás no llevan el campo cuenta_web.
db.clientes.insertMany([
  {
    _id: 1,
    nombre: "Juan Perez",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Av. Principal 123, Santiago", telefono: "912345678", email: "juan.perez@mail.com" }
  },
  {
    _id: 2,
    nombre: "Maria Gonzalez",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Calle Los Aromos 456, Santiago", telefono: "923456789", email: "maria.gonzalez@mail.com" }
  },
  {
    _id: 3,
    nombre: "Pedro Sanchez",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Pasaje Las Flores 789, Santiago", telefono: "934567890", email: "pedro.sanchez@mail.com" }
  },
  {
    _id: 4,
    nombre: "Camila Reyes",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Los Alerces 234, Providencia", telefono: "945000001", email: "camila.reyes@mail.com" }
  },
  {
    _id: 5,
    nombre: "Diego Fuentes",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Camino Real 55, Maipu", telefono: "945000002", email: "diego.fuentes@mail.com" }
  },
  {
    _id: 6,
    nombre: "Fernanda Ortiz",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Los Castanos 12, Nunoa", telefono: "945000003", email: "fernanda.ortiz@mail.com" }
  },
  {
    _id: 7,
    nombre: "Distribuidora El Sol Ltda.",
    tipo_cliente: "COMERCIAL",
    contacto: { direccion: "Ruta 5 Km 10, Rancagua", telefono: "722000004", email: "contacto@elsol.cl" }
  },
  {
    _id: 8,
    nombre: "Ignacio Vera",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Pje. Cordillera 89, Puente Alto", telefono: "945000005", email: "ignacio.vera@mail.com" }
  },
  {
    _id: 9,
    nombre: "Juan Perez",
    tipo_cliente: "RESIDENCIAL",
    contacto: { direccion: "Av Argentina 550, Chillán", telefono: "933333333", email: "cliente@gmail.com" },
    cuenta_web: { run: "190110222", tipo_usuario: "Cliente" }
  }
]);

// ---- pedidos (pedido_v + detalle_pedido_v). Cada línea guarda el precio al que se vendió (igual que precio_unitario en Oracle).
// historial_estados parte vacío: en Oracle auditoria_pedido_v también partía vacía y solo registraba cambios de estado.
// Las fechas son ilustrativas (en Oracle eran SYSDATE, el día en que se corrió el script).
db.pedidos.insertMany([
  {
    _id: 1,
    cliente: { id_cliente: 1, nombre: "Juan Perez", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 1, nombre: "Carlos Munoz" },
    fecha_pedido: ISODate("2026-10-12T14:00:00Z"),
    estado: "PENDIENTE",
    lineas: [
      { codigo: "CL003", nombre: "Cilindro GLP 15 kg", cantidad: 2, precio_unitario: 16000, subtotal: 32000 },
      { codigo: "CL001", nombre: "Cilindro GLP 5 kg", cantidad: 1, precio_unitario: 6500, subtotal: 6500 }
    ],
    total: 38500,
    historial_estados: []
  },
  {
    _id: 2,
    cliente: { id_cliente: 2, nombre: "Maria Gonzalez", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 2, nombre: "Andrea Rojas" },
    fecha_pedido: ISODate("2026-10-13T14:00:00Z"),
    estado: "EN_CAMINO",
    lineas: [{ codigo: "CL004", nombre: "Cilindro GLP 45 kg", cantidad: 1, precio_unitario: 45000, subtotal: 45000 }],
    total: 45000,
    historial_estados: []
  },
  {
    _id: 3,
    cliente: { id_cliente: 3, nombre: "Pedro Sanchez", tipo_cliente: "RESIDENCIAL" },
    fecha_pedido: ISODate("2026-10-14T14:00:00Z"),
    estado: "PENDIENTE",
    lineas: [{ codigo: "CL003", nombre: "Cilindro GLP 15 kg", cantidad: 3, precio_unitario: 16000, subtotal: 48000 }],
    total: 48000,
    historial_estados: []
  },
  {
    _id: 4,
    cliente: { id_cliente: 4, nombre: "Camila Reyes", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 1, nombre: "Carlos Munoz" },
    fecha_pedido: ISODate("2026-10-15T14:00:00Z"),
    estado: "ENTREGADO",
    lineas: [
      { codigo: "CL001", nombre: "Cilindro GLP 5 kg", cantidad: 2, precio_unitario: 6500, subtotal: 13000 },
      { codigo: "MG002", nombre: "Manguera gas 3m", cantidad: 1, precio_unitario: 6990, subtotal: 6990 }
    ],
    total: 19990,
    historial_estados: []
  },
  {
    _id: 5,
    cliente: { id_cliente: 5, nombre: "Diego Fuentes", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 1, nombre: "Carlos Munoz" },
    fecha_pedido: ISODate("2026-10-16T14:00:00Z"),
    estado: "PENDIENTE",
    lineas: [
      { codigo: "CL002", nombre: "Cilindro GLP 11 kg", cantidad: 1, precio_unitario: 12000, subtotal: 12000 },
      { codigo: "MG001", nombre: "Manguera gas 1.5m", cantidad: 3, precio_unitario: 3990, subtotal: 11970 }
    ],
    total: 23970,
    historial_estados: []
  },
  {
    _id: 6,
    cliente: { id_cliente: 6, nombre: "Fernanda Ortiz", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 2, nombre: "Andrea Rojas" },
    fecha_pedido: ISODate("2026-10-19T14:00:00Z"),
    estado: "EN_CAMINO",
    lineas: [
      { codigo: "CL003", nombre: "Cilindro GLP 15 kg", cantidad: 1, precio_unitario: 16000, subtotal: 16000 },
      { codigo: "CL001", nombre: "Cilindro GLP 5 kg", cantidad: 1, precio_unitario: 6500, subtotal: 6500 }
    ],
    total: 22500,
    historial_estados: []
  },
  {
    _id: 7,
    cliente: { id_cliente: 7, nombre: "Distribuidora El Sol Ltda.", tipo_cliente: "COMERCIAL" },
    repartidor: { id_repartidor: 4, nombre: "Paula Vidal" },
    fecha_pedido: ISODate("2026-10-20T14:00:00Z"),
    estado: "ENTREGADO",
    lineas: [
      { codigo: "CL004", nombre: "Cilindro GLP 45 kg", cantidad: 2, precio_unitario: 45000, subtotal: 90000 },
      { codigo: "CL002", nombre: "Cilindro GLP 11 kg", cantidad: 2, precio_unitario: 12000, subtotal: 24000 }
    ],
    total: 114000,
    historial_estados: []
  },
  {
    _id: 8,
    cliente: { id_cliente: 8, nombre: "Ignacio Vera", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 4, nombre: "Paula Vidal" },
    fecha_pedido: ISODate("2026-10-21T14:00:00Z"),
    estado: "PENDIENTE",
    lineas: [{ codigo: "CL001", nombre: "Cilindro GLP 5 kg", cantidad: 3, precio_unitario: 6500, subtotal: 19500 }],
    total: 19500,
    historial_estados: []
  },
  {
    _id: 9,
    cliente: { id_cliente: 1, nombre: "Juan Perez", tipo_cliente: "RESIDENCIAL" },
    fecha_pedido: ISODate("2026-10-22T14:00:00Z"),
    estado: "PENDIENTE",
    lineas: [{ codigo: "MG001", nombre: "Manguera gas 1.5m", cantidad: 2, precio_unitario: 3990, subtotal: 7980 }],
    total: 7980,
    historial_estados: []
  },
  {
    _id: 10,
    cliente: { id_cliente: 2, nombre: "Maria Gonzalez", tipo_cliente: "RESIDENCIAL" },
    repartidor: { id_repartidor: 1, nombre: "Carlos Munoz" },
    fecha_pedido: ISODate("2026-10-23T14:00:00Z"),
    estado: "ENTREGADO",
    lineas: [
      { codigo: "MG002", nombre: "Manguera gas 3m", cantidad: 1, precio_unitario: 6990, subtotal: 6990 },
      { codigo: "CL001", nombre: "Cilindro GLP 5 kg", cantidad: 1, precio_unitario: 6500, subtotal: 6500 }
    ],
    total: 13490,
    historial_estados: []
  }
]);

/* ============ PASO 4: resumen ============ */
print("Base gas_volcan lista:");
print("  productos  : " + db.productos.countDocuments());
print("  clientes   : " + db.clientes.countDocuments());
print("  pedidos    : " + db.pedidos.countDocuments());
print("  historial  : " + db.historial_productos.countDocuments() + " (parte vacío, se llena al cambiar stock o precios)");
