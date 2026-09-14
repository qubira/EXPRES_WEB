const PASOS = ['pagado', 'preparando', 'listo_recoger', 'recogido', 'entregado'];

function idInicial() {
  return new URLSearchParams(location.search).get('id') || localStorage.getItem('express_last_pedido') || '';
}

function renderTimeline(estado) {
  if (estado === 'pendiente_pago' || estado === 'pago_rechazado' || estado === 'cancelado') return '';
  const idxActual = PASOS.indexOf(estado);
  return `
    <div class="flex justify-between mt-16" style="text-align:center;">
      ${PASOS.map((p, i) => `
        <div style="flex:1;">
          <div style="width:26px;height:26px;border-radius:50%;margin:0 auto 6px;
            background:${i <= idxActual ? 'var(--verde-palma)' : 'var(--arena-300)'};
            color:white; display:flex; align-items:center; justify-content:center; font-size:13px;">
            ${i <= idxActual ? '✓' : ''}
          </div>
          <div class="text-sm" style="color:${i <= idxActual ? 'var(--mar-900)' : 'var(--tinta-300)'};">${labelEstado(p)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function cargarPedido(id) {
  const cont = document.getElementById('contenido');
  cont.innerHTML = '<p class="text-center text-muted mt-16">Buscando pedido...</p>';

  try {
    const pedido = await Api.getPedido(id);
    localStorage.setItem('express_last_pedido', pedido.id);

    const necesitaPago = pedido.estado === 'pendiente_pago';
    const rechazado = pedido.estado === 'pago_rechazado';

    cont.innerHTML = `
      <div class="card card-pad">
        <div class="flex justify-between items-center">
          <div>
            <div class="text-sm text-muted">Pedido #${pedido.id.slice(0,8).toUpperCase()}</div>
            <strong>${pedido.cliente_nombre}</strong>
          </div>
          <span class="badge badge-${pedido.estado}">${labelEstado(pedido.estado)}</span>
        </div>
        <div class="text-sm text-muted mt-8">📍 ${pedido.zona_entrega}</div>

        ${renderTimeline(pedido.estado)}

        ${necesitaPago ? `
          <a href="pago.html?pedido=${pedido.id}" class="btn btn-primary btn-block mt-16">Completar pago</a>
        ` : ''}
        ${rechazado ? `
          <p class="form-error mt-16">Tu comprobante fue rechazado. Escríbenos por WhatsApp para resolverlo.</p>
          <a href="https://wa.me/51987000000" target="_blank" class="btn btn-outline btn-block">Contactar soporte</a>
        ` : ''}
      </div>

      ${pedido.pin_entrega ? `
        <div class="pin-box mt-16">
          <div class="text-sm">Tu PIN de entrega</div>
          <div class="pin-digits">${pedido.pin_entrega}</div>
          <div class="text-sm">Dáselo al repartidor solo cuando recibas tu pedido</div>
        </div>
      ` : ''}

      <div class="card card-pad mt-16">
        <h3>Detalle del pedido</h3>
        ${pedido.items.map((i) => `
          <div class="flex justify-between mt-8">
            <div>
              <strong>${i.cantidad}x ${i.nombre_producto}</strong>
              <div class="text-sm text-muted">${i.tienda_nombre}</div>
            </div>
            <span>${formatoSoles(i.subtotal)}</span>
          </div>
        `).join('')}
        <hr class="divider">
        <div class="flex justify-between"><span>Productos</span><span>${formatoSoles(pedido.monto_productos)}</span></div>
        <div class="flex justify-between mt-8"><span>Delivery</span><span>${formatoSoles(pedido.delivery_fee)}</span></div>
        <div class="flex justify-between mt-8"><strong>Total</strong><strong>${formatoSoles(pedido.monto_total)}</strong></div>
      </div>
    `;
  } catch (err) {
    cont.innerHTML = `<p class="text-center form-error mt-16">${err.message || 'Pedido no encontrado'}</p>`;
  }
}

document.getElementById('form-buscar').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('input-id').value.trim();
  if (id) {
    history.replaceState(null, '', `pedido.html?id=${id}`);
    cargarPedido(id);
  }
});

const idInit = idInicial();
if (idInit) {
  document.getElementById('input-id').value = idInit;
  cargarPedido(idInit);
} else {
  document.getElementById('contenido').innerHTML = '<p class="text-center text-muted mt-16">Ingresa el ID de tu pedido para ver su estado.</p>';
}

setInterval(() => {
  const id = new URLSearchParams(location.search).get('id');
  if (id) cargarPedido(id);
}, 15000);
