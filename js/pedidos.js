// js/pedidos.js
// Página de pedidos: lista los pedidos guardados en MongoDB (colección pedidos).
// Cada pedido trae sus líneas de detalle DENTRO del mismo documento. Solo para personal.

function cargarPedidos() {
  const cuerpo = document.getElementById('lista-pedidos');

  llamarApi('/pedidos')
    .then(function (data) {
      if (data.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="6" style="padding:10px;">No hay pedidos.</td></tr>';
        return;
      }
      // Los más nuevos primero
      data.sort(function (a, b) { return b._id - a._id; });

      let html = '';
      data.forEach(function (p) {
        const nombreCliente = p.cliente ? p.cliente.nombre : 'Sin cliente';
        const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-CL') : '—';
        const lineas = (p.lineas || []).map(function (l) {
          return l.cantidad + ' × ' + escaparHtml(l.nombre || l.codigo);
        }).join('<br>');

        html += `<tr>
            <td style="padding:10px; border:1px solid #ddd;">${p._id}</td>
            <td style="padding:10px; border:1px solid #ddd;">${escaparHtml(nombreCliente)}</td>
            <td style="padding:10px; border:1px solid #ddd;">${fecha}</td>
            <td style="padding:10px; border:1px solid #ddd;">${lineas || '—'}</td>
            <td style="padding:10px; border:1px solid #ddd;">${escaparHtml(p.estado || 'PENDIENTE')}</td>
            <td style="padding:10px; border:1px solid #ddd;">${formatoPesos(p.total)}</td>
        </tr>`;
      });
      cuerpo.innerHTML = html;
    })
    .catch(function (err) {
      console.error('Error al cargar pedidos:', err);
      cuerpo.innerHTML = '<tr><td colspan="6" style="padding:10px;">' + escaparHtml(err.message) + '</td></tr>';
    });
}

document.addEventListener('DOMContentLoaded', function () {
  // Página solo para el personal: si no hay sesión de personal, se manda a iniciar sesión
  if (exigirStaff('login.html')) cargarPedidos();
});
