// js/historial.js
// Página de auditoría: muestra los cambios de stock y precios guardados en MongoDB
// (colección historial_productos). Solo para personal con sesión iniciada.

// Nombre legible de cada tipo de cambio
const ETIQUETAS_CAMPO = {
  STOCK: 'Stock',
  PRECIO_RESIDENCIAL: 'Precio residencial',
  PRECIO_COMERCIAL: 'Precio comercial'
};

function formatoValor(campo, valor) {
  if (valor === undefined || valor === null) return '—';
  if (typeof valor === 'object') return escaparHtml(JSON.stringify(valor)); // registros con formato antiguo
  return campo === 'STOCK' ? valor + ' unidades' : formatoPesos(valor);
}

function cargarHistorial() {
  const contenedorHistorial = document.getElementById('contenedor-historial');

  llamarApi('/historial')
    .then(function (data) {
      if (data.length === 0) {
        contenedorHistorial.innerHTML = '<p>No hay registros de cambios aún.</p>';
        return;
      }
      let html = '';
      data.forEach(function (h) {
        const fecha = h.fecha_cambio || h.fecha;
        const fechaTexto = fecha ? new Date(fecha).toLocaleString('es-CL') : 'Sin fecha';
        const codigo = h.codigo || h.codigo_producto || '—';
        const campo = h.campo || 'CAMBIO';
        const etiqueta = ETIQUETAS_CAMPO[campo] || campo;

        html += `<div style="border:1px solid #ddd; padding:15px; margin-bottom:15px; border-radius:8px; background:#fff;">
            <p style="margin:0; color:#666;">📅 ${escaparHtml(fechaTexto)} | 🆔 Producto: <strong>${escaparHtml(codigo)}</strong> | 👤 ${escaparHtml(h.usuario || 'Sin usuario')}</p>
            <hr style="border:0; border-top:1px solid #eee; margin:10px 0;">
            <p style="margin:5px 0;"><strong>${escaparHtml(etiqueta)}</strong></p>
            <p style="margin:5px 0; color:#d9534f;">❌ <strong>Antes:</strong> ${formatoValor(campo, h.valor_anterior)}</p>
            <p style="margin:5px 0; color:#5cb85c;">✅ <strong>Después:</strong> ${formatoValor(campo, h.valor_nuevo)}</p>
        </div>`;
      });
      contenedorHistorial.innerHTML = html;
    })
    .catch(function (err) {
      console.error('Error al cargar historial:', err);
      contenedorHistorial.innerHTML = '<p>' + escaparHtml(err.message) + '</p>';
    });
}

document.addEventListener('DOMContentLoaded', function () {
  // Página solo para el personal: si no hay sesión de personal, se manda a iniciar sesión
  if (exigirStaff('login.html')) cargarHistorial();
});
