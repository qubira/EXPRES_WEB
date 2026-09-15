const PASOS = ['pagado', 'preparando', 'listo_recoger', 'recogido', 'entregado'];
const MOTIVOS_RECLAMO = {
  producto_incorrecto: 'No es lo que pedí',
  producto_danado: 'Llegó golpeado o malogrado',
  no_recibido: 'No recibí mi pedido',
  otro: 'Otro motivo',
};

let mapaEntrega = null;
let marcadorRepartidor = null;
let marcadorCliente = null;
let ultimoEstadoConocido = null;
let pedidoIdRenderizado = null;

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

function renderMapa(pedido) {
  if (pedido.estado !== 'recogido') {
    mapaEntrega = null;
    marcadorRepartidor = null;
    marcadorCliente = null;
    return '';
  }
  const tieneUbicacion = pedido.lat_repartidor && pedido.lng_repartidor;
  if (!tieneUbicacion) {
    mapaEntrega = null;
    marcadorRepartidor = null;
    marcadorCliente = null;
    return `
      <div class="card card-pad mt-16">
        <h3>🚴 Tu repartidor está en camino</h3>
        <div class="flex items-center gap-8 mt-8" style="background:var(--arena-100); border-radius:10px; padding:12px;">
          <span style="font-size:20px;">📡</span>
          <span class="text-sm text-muted">Esperando la ubicación en vivo del repartidor. Se mostrará el mapa apenas la comparta.</span>
        </div>
      </div>
    `;
  }
  return `
    <div class="card card-pad mt-16">
      <h3>🚴 Tu repartidor está en camino</h3>
      <div id="mapa-entrega" style="height:280px; border-radius:12px; margin-top:8px;"></div>
      <div class="text-sm text-muted mt-8">La ubicación se actualiza automáticamente.</div>
    </div>
  `;
}

function inicializarMapa(pedido) {
  const el = document.getElementById('mapa-entrega');
  if (!el || typeof L === 'undefined') return;
  const lat = Number(pedido.lat_repartidor);
  const lng = Number(pedido.lng_repartidor);

  if (!mapaEntrega) {
    mapaEntrega = L.map('mapa-entrega').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapaEntrega);
    marcadorRepartidor = L.marker([lat, lng], { title: 'Repartidor' }).addTo(mapaEntrega).bindPopup('🚴 Repartidor');
    if (pedido.lat_entrega && pedido.lng_entrega) {
      marcadorCliente = L.marker([Number(pedido.lat_entrega), Number(pedido.lng_entrega)], { title: 'Tu ubicación' })
        .addTo(mapaEntrega).bindPopup('📍 Tu ubicación');
      mapaEntrega.fitBounds([[lat, lng], [Number(pedido.lat_entrega), Number(pedido.lng_entrega)]], { padding: [30, 30] });
    }
  } else {
    marcadorRepartidor.setLatLng([lat, lng]);
    mapaEntrega.panTo([lat, lng]);
  }
}

function renderReclamoModal(pedidoId) {
  abrirModal(`
    <h3>Hacer un reclamo</h3>
    <p class="text-sm text-muted">Cuéntanos qué pasó con tu pedido.</p>
    <div class="form-grupo mt-16">
      <label>Motivo</label>
      <select id="reclamo-motivo">
        ${Object.entries(MOTIVOS_RECLAMO).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-grupo">
      <label>Cuéntanos más (opcional)</label>
      <textarea id="reclamo-descripcion" placeholder="Describe lo que pasó..."></textarea>
    </div>
    <div id="reclamo-error" class="form-error hidden"></div>
    <button class="btn btn-primary btn-block mt-8" id="btn-enviar-reclamo">Enviar reclamo</button>
  `);
  document.getElementById('btn-enviar-reclamo').addEventListener('click', async () => {
    const motivo = document.getElementById('reclamo-motivo').value;
    const descripcion = document.getElementById('reclamo-descripcion').value.trim();
    const errBox = document.getElementById('reclamo-error');
    try {
      await Api.clienteReclamo(pedidoId, motivo, descripcion);
      cerrarModal();
      mostrarToast('Reclamo enviado. Un administrador lo revisará pronto.', 'success');
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
}

function abrirModal(html) {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">${html}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') cerrarModal(); });
}
function cerrarModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

async function cargarPedido(id) {
  const cont = document.getElementById('contenido');
  // Solo mostramos "Buscando..." cuando aun no hay nada en pantalla o se
  // esta cambiando a otro pedido; en los refrescos de fondo del mismo
  // pedido no tiene sentido taparlo con un mensaje de carga cada vez.
  if (pedidoIdRenderizado !== id) {
    cont.innerHTML = '<p class="text-center text-muted mt-16">Buscando pedido...</p>';
  }

  try {
    const pedido = await Api.getPedido(id);
    localStorage.setItem('express_last_pedido', pedido.id);
    ultimoEstadoConocido = pedido.estado;

    // Mientras seguimos el mismo pedido "en camino" con el mapa ya montado,
    // solo movemos el marcador en vez de reconstruir todo el HTML: si no,
    // cada refresco de 5s destruye y recrea el mapa entero (recarga los
    // tiles de OpenStreetMap y resetea el zoom/pan que el usuario haya
    // hecho), convirtiendo el "tiempo real" en un parpadeo constante.
    const puedeActualizarSoloElMapa = mapaEntrega && pedidoIdRenderizado === pedido.id
      && pedido.estado === 'recogido' && pedido.lat_repartidor && pedido.lng_repartidor;
    if (puedeActualizarSoloElMapa) {
      inicializarMapa(pedido);
      return;
    }

    // El HTML se reconstruye por completo en cada carga (incluido #mapa-entrega),
    // asi que el mapa de Leaflet anterior queda huerfano y hay que recrearlo.
    if (mapaEntrega) {
      mapaEntrega.remove();
      mapaEntrega = null;
      marcadorRepartidor = null;
      marcadorCliente = null;
    }
    pedidoIdRenderizado = pedido.id;

    const necesitaPago = pedido.estado === 'pendiente_pago';
    const rechazado = pedido.estado === 'pago_rechazado';
    const rechazadoEnEntrega = pedido.estado === 'rechazado_en_entrega';
    const logueado = typeof clienteEstaLogueado === 'function' && clienteEstaLogueado();
    const puedeCancelar = logueado && ['pendiente_pago', 'pagado', 'preparando'].includes(pedido.estado);
    const puedeReclamar = logueado && ['entregado', 'rechazado_en_entrega'].includes(pedido.estado);
    const esperandoEnPunto = ['listo_recoger', 'recogido'].includes(pedido.estado);

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
        ${rechazadoEnEntrega ? `
          <p class="form-error mt-16">Este pedido fue rechazado en la entrega. Si crees que fue un error, contáctanos.</p>
        ` : ''}
        ${pedido.entrega_observada ? `
          <div class="flex items-center gap-8 mt-16" style="background:#fff7e6; border-radius:10px; padding:12px;">
            <span style="font-size:20px;">⚠️</span>
            <span class="text-sm">Esta entrega quedó marcada para revisión porque no se validó el código en el momento. Si no recibiste tu pedido o hay algo raro, haz tu reclamo abajo.</span>
          </div>
        ` : ''}
        ${esperandoEnPunto ? `
          <p class="text-sm text-muted mt-16">Si el producto llega dañado o incorrecto, no lo recibas: puedes generar un reclamo aquí mismo apenas termine la entrega.</p>
        ` : ''}

        ${puedeCancelar ? `<button class="btn btn-outline btn-block mt-16" id="btn-cancelar-pedido">Cancelar pedido</button>` : ''}
        ${puedeReclamar ? `<button class="btn btn-outline btn-block mt-16" id="btn-reclamo-pedido">📣 Hacer un reclamo</button>` : ''}
      </div>

      ${pedido.pin_entrega ? `
        <div class="pin-box mt-16">
          <div class="text-sm">Tu PIN de entrega</div>
          <div class="pin-digits">${pedido.pin_entrega}</div>
          <div class="text-sm">Dáselo al repartidor solo cuando recibas tu pedido</div>
        </div>
      ` : ''}

      ${renderMapa(pedido)}

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

    inicializarMapa(pedido);

    const btnCancelar = document.getElementById('btn-cancelar-pedido');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', async () => {
        if (!confirm('¿Seguro que quieres cancelar este pedido?')) return;
        btnCancelar.disabled = true;
        try {
          const r = await Api.clienteCancelarPedido(pedido.id);
          mostrarToast(r.mensaje || 'Pedido cancelado', 'success');
          cargarPedido(pedido.id);
        } catch (err) {
          mostrarToast(err.message, 'error');
          btnCancelar.disabled = false;
        }
      });
    }
    const btnReclamo = document.getElementById('btn-reclamo-pedido');
    if (btnReclamo) {
      btnReclamo.addEventListener('click', () => renderReclamoModal(pedido.id));
    }
  } catch (err) {
    // Si veniamos mostrando el pedido con el mapa montado y esta carga
    // fallo (ej. se corto la conexion un instante), no dejamos las
    // referencias apuntando a un mapa que ya no existe en el DOM: si no,
    // la proxima carga exitosa creeria que solo tiene que mover el
    // marcador y nunca reconstruiria la tarjeta con el mensaje de error.
    pedidoIdRenderizado = null;
    mapaEntrega = null;
    marcadorRepartidor = null;
    marcadorCliente = null;
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

// Mientras el repartidor esta en camino refrescamos mas seguido para que el
// mapa en vivo se sienta realmente "en tiempo real"; en el resto de estados
// alcanza con un refresco mas espaciado.
function programarSiguienteRefresco() {
  const intervalo = ultimoEstadoConocido === 'recogido' ? 5000 : 15000;
  setTimeout(() => {
    const id = new URLSearchParams(location.search).get('id');
    if (id && !document.hidden) cargarPedido(id).finally(programarSiguienteRefresco);
    else programarSiguienteRefresco();
  }, intervalo);
}

const idInit = idInicial();
if (idInit) {
  document.getElementById('input-id').value = idInit;
  // Se encadena para que, si el pedido ya esta "recogido" desde la primera
  // carga, el refresco rapido de 5s arranque de inmediato (y no recien
  // despues de un primer ciclo lento de 15s con el estado aun en null).
  cargarPedido(idInit).finally(programarSiguienteRefresco);
} else {
  document.getElementById('contenido').innerHTML = '<p class="text-center text-muted mt-16">Ingresa el ID de tu pedido para ver su estado.</p>';
  programarSiguienteRefresco();
}
