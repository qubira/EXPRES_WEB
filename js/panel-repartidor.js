if (!localStorage.getItem('express_token_repartidor')) {
  location.href = 'login.html';
}
document.getElementById('rep-nombre').textContent = localStorage.getItem('express_nombre_repartidor') || '';

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('express_token_repartidor');
  location.href = 'login.html';
});

function manejarError401(err) {
  if (err.status === 401 || err.status === 403) {
    localStorage.removeItem('express_token_repartidor');
    location.href = 'login.html';
    return true;
  }
  return false;
}

const TITULOS = { disponibles: 'Pedidos disponibles', activos: 'Mis entregas', historial: 'Historial', perfil: 'Mi perfil', conectividad: 'Conectividad' };

function irAVista(vista) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${vista}`).classList.remove('hidden');
  document.querySelectorAll('.panel-link[data-view]').forEach((l) => l.classList.toggle('activo', l.dataset.view === vista));
  document.getElementById('titulo-vista').textContent = TITULOS[vista];
  if (vista === 'disponibles') cargarDisponibles();
  if (vista === 'activos') cargarActivos();
  if (vista === 'historial') cargarHistorial();
  if (vista === 'perfil') cargarPerfilFormRepartidor();
  if (vista === 'conectividad') cargarConectividad('repartidor', 'lista-sesiones', 'btn-cerrar-otras-sesiones');
}
document.querySelectorAll('.panel-link[data-view]').forEach((link) => link.addEventListener('click', () => irAVista(link.dataset.view)));

function abrirModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">${html}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') cerrarModal(); });
}
function cerrarModal() { document.getElementById('modal-root').innerHTML = ''; }

function actualizarEtiquetaDisponible(disponible) {
  document.getElementById('disponible-label').textContent = disponible ? 'Disponible' : 'No disponible';
}

async function cargarPerfil() {
  try {
    const perfil = await Api.repartidorPerfil();
    document.getElementById('pago-pendiente').textContent = formatoSoles(perfil.pago_pendiente);
    document.getElementById('toggle-disponible').checked = perfil.disponible;
    actualizarEtiquetaDisponible(perfil.disponible);
  } catch (err) { manejarError401(err); }
}

document.getElementById('toggle-disponible').addEventListener('change', async (e) => {
  try {
    await Api.repartidorDisponibilidad(e.target.checked);
    actualizarEtiquetaDisponible(e.target.checked);
    mostrarToast(e.target.checked ? 'Ahora estás disponible' : 'Ya no estás disponible', 'success');
  } catch (err) { mostrarToast(err.message, 'error'); }
});

// ---------- Entregas activas ----------
const ESTADOS_ENTREGA_ACTIVA = ['pagado', 'preparando', 'listo_recoger', 'recogido'];
let vistaActivosRepartidor = 'tarjetas';
let todosActivosRepartidorCache = null;

async function cargarActivos() {
  const cont = document.getElementById('lista-activos');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    todosActivosRepartidorCache = await Api.repartidorPedidos();
    actualizarSeguimientoGPS(todosActivosRepartidorCache);
    renderActivosRepartidor();
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

function tarjetaEntregaHtml(p) {
  return `
    <div class="card card-pad entrega-card estado-${p.estado}">
      <div class="flex justify-between items-center">
        <strong>#${p.id.slice(0,8).toUpperCase()}</strong>
        <span class="badge badge-${p.estado}">${labelEstado(p.estado)}</span>
      </div>
      <div class="mt-8">
        <div class="entrega-info-row">📍 <span>${p.zona_entrega}</span></div>
        ${p.referencia_entrega ? `<div class="entrega-info-row text-muted">💬 <span>${p.referencia_entrega}</span></div>` : ''}
        <div class="entrega-info-row">👤 <span>${p.cliente_nombre}</span></div>
      </div>
      <div class="flex gap-8 mt-8">
        <a href="tel:${p.cliente_telefono}" class="btn btn-ghost btn-sm w-full">📞 Llamar</a>
        <a href="https://wa.me/51${p.cliente_telefono}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm w-full">💬 WhatsApp</a>
      </div>
      ${p.lat_entrega && p.lng_entrega ? `
        <a href="https://www.google.com/maps?q=${p.lat_entrega},${p.lng_entrega}" target="_blank" rel="noopener" class="btn btn-outline btn-block mt-8">🗺️ Ver ubicación del cliente</a>
      ` : ''}
      <div class="entrega-tarifa">
        <span class="text-sm">Tarifa de entrega</span>
        <strong>${formatoSoles(p.delivery_fee)}</strong>
      </div>
      <div class="mt-16">
        ${p.estado === 'listo_recoger' ? `<button class="btn btn-secondary btn-block" data-recoger="${p.id}">🚲 He recogido el pedido</button>` : ''}
        ${p.estado === 'recogido' ? `
          <button class="btn btn-success btn-block" data-entregar="${p.id}">🔑 Confirmar entrega (PIN)</button>
          <button class="btn btn-outline btn-block mt-8" data-rechazado="${p.id}">❌ El cliente rechazó el pedido</button>
          <button class="btn btn-ghost btn-block mt-8" data-sin-pin="${p.id}" style="color:var(--tinta-300);">Entregó pero no dio el código</button>
        ` : ''}
        ${!['listo_recoger','recogido'].includes(p.estado) ? `<div class="text-sm text-muted text-center">⏳ Esperando que la tienda prepare el pedido...</div>` : ''}
        ${['listo_recoger','recogido'].includes(p.estado) ? `<button class="btn btn-ghost btn-block mt-8" data-observacion="${p.id}" style="color:var(--rojo-alerta);">⚠️ Reportar un problema</button>` : ''}
      </div>
    </div>
  `;
}

function accionPrincipalEntregaHtml(p) {
  if (p.estado === 'listo_recoger') return `<button class="btn btn-secondary btn-xs" data-recoger="${p.id}">🚲 Recogido</button>`;
  if (p.estado === 'recogido') return `<button class="btn btn-success btn-xs" data-entregar="${p.id}">🔑 Entregar</button>`;
  return '<span class="text-sm text-muted">⏳ Esperando</span>';
}

function renderActivosComoTarjetas(cont, pedidos) {
  cont.innerHTML = `<div class="grid-pedidos-tarjetas">${pedidos.map(tarjetaEntregaHtml).join('')}</div>`;
}

function renderActivosComoTabla(cont, pedidos) {
  cont.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pedido</th><th>Zona</th><th>Cliente</th><th>Estado</th><th>Tarifa</th><th>Contacto</th><th>Acción</th></tr></thead>
        <tbody>
          ${pedidos.map((p) => `
            <tr>
              <td>#${p.id.slice(0,8).toUpperCase()}</td>
              <td>${p.zona_entrega}</td>
              <td>${p.cliente_nombre}</td>
              <td><span class="badge badge-${p.estado}">${labelEstado(p.estado)}</span></td>
              <td>${formatoSoles(p.delivery_fee)}</td>
              <td>
                <div class="flex gap-6">
                  <a href="tel:${p.cliente_telefono}" class="btn btn-ghost btn-xs" title="Llamar">📞</a>
                  <a href="https://wa.me/51${p.cliente_telefono}" target="_blank" rel="noopener" class="btn btn-ghost btn-xs" title="WhatsApp">💬</a>
                  ${p.lat_entrega && p.lng_entrega ? `<a href="https://www.google.com/maps?q=${p.lat_entrega},${p.lng_entrega}" target="_blank" rel="noopener" class="btn btn-outline btn-xs" title="Ver ubicación">🗺️</a>` : ''}
                </div>
              </td>
              <td>${accionPrincipalEntregaHtml(p)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderActivosComoEstados(cont, pedidos) {
  const columnas = ESTADOS_ENTREGA_ACTIVA.map((estado) => ({ estado, items: pedidos.filter((p) => p.estado === estado) }))
    .filter((col) => col.items.length > 0);
  if (columnas.length === 0) {
    cont.innerHTML = '<p class="text-muted">No hay entregas activas.</p>';
    return;
  }
  cont.innerHTML = `
    <div class="tablero-estados">
      ${columnas.map((col) => `
        <div class="tablero-columna">
          <div class="tablero-columna-titulo">
            <span class="badge badge-${col.estado}">${labelEstado(col.estado)}</span>
            <span class="text-muted">${col.items.length}</span>
          </div>
          <div class="tablero-columna-lista">${col.items.map(tarjetaEntregaHtml).join('')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function enlazarAccionesActivos(cont) {
  cont.querySelectorAll('[data-recoger]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await Api.repartidorRecogido(btn.dataset.recoger);
      mostrarToast('Pedido marcado como recogido', 'success');
      cargarActivos();
    } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
  }));
  cont.querySelectorAll('[data-entregar]').forEach((btn) => btn.addEventListener('click', () => abrirModalPin(btn.dataset.entregar)));
  cont.querySelectorAll('[data-rechazado]').forEach((btn) => btn.addEventListener('click', () => abrirModalRechazado(btn.dataset.rechazado)));
  cont.querySelectorAll('[data-sin-pin]').forEach((btn) => btn.addEventListener('click', () => abrirModalSinPin(btn.dataset.sinPin)));
  cont.querySelectorAll('[data-observacion]').forEach((btn) => btn.addEventListener('click', () => abrirModalObservacion(btn.dataset.observacion)));
}

function renderActivosRepartidor() {
  const cont = document.getElementById('lista-activos');
  if (todosActivosRepartidorCache.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">🚴</div><p>No tienes entregas asignadas por ahora.</p></div>';
    return;
  }
  if (vistaActivosRepartidor === 'tabla') renderActivosComoTabla(cont, todosActivosRepartidorCache);
  else if (vistaActivosRepartidor === 'estados') renderActivosComoEstados(cont, todosActivosRepartidorCache);
  else renderActivosComoTarjetas(cont, todosActivosRepartidorCache);
  enlazarAccionesActivos(cont);
}

document.querySelectorAll('#filtro-vista-activos .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    vistaActivosRepartidor = chip.dataset.vista;
    document.querySelectorAll('#filtro-vista-activos .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    renderActivosRepartidor();
  });
});

function abrirModalRechazado(pedidoId) {
  abrirModal(`
    <div class="text-center">
      <div style="font-size:38px;">❌</div>
      <h3>El cliente rechazó el pedido</h3>
      <p class="text-muted text-sm">Úsalo solo si el cliente no acepta el producto al momento de la entrega (llegó dañado, no es lo que pidió, etc). No recibirás pago por esta entrega.</p>
    </div>
    <div class="form-grupo mt-16">
      <label>¿Qué pasó? (opcional)</label>
      <textarea id="rechazado-motivo" placeholder="Ej. El cliente dijo que no era su pedido"></textarea>
    </div>
    <div id="rechazado-error" class="form-error hidden text-center"></div>
    <button class="btn btn-outline btn-block mt-8" id="btn-confirmar-rechazado">Confirmar rechazo</button>
  `);
  document.getElementById('btn-confirmar-rechazado').addEventListener('click', async () => {
    const motivo = document.getElementById('rechazado-motivo').value.trim();
    try {
      await Api.repartidorRechazado(pedidoId, motivo);
      mostrarToast('Pedido marcado como rechazado por el cliente', 'success');
      cerrarModal();
      cargarActivos();
    } catch (err) {
      const errorBox = document.getElementById('rechazado-error');
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}

const TIPOS_OBSERVACION_REPARTIDOR = {
  tienda: { entrega_incorrecta: 'La tienda me entregó el producto equivocado', producto_danado: 'El producto ya venía dañado', otro: 'Otro problema con la tienda' },
  cliente: { falta_respeto: 'El cliente me faltó el respeto', acoso: 'El cliente me acosó', otro: 'Otro problema con el cliente' },
};

function abrirModalObservacion(pedidoId) {
  abrirModal(`
    <div class="text-center">
      <div style="font-size:38px;">⚠️</div>
      <h3>Reportar un problema</h3>
      <p class="text-muted text-sm">Un administrador lo revisará antes de que quede registrado.</p>
    </div>
    <div class="form-grupo mt-16">
      <label>¿Sobre quién es?</label>
      <select id="obs-dirigido">
        <option value="tienda">La tienda</option>
        <option value="cliente">El cliente</option>
      </select>
    </div>
    <div class="form-grupo">
      <label>Tipo</label>
      <select id="obs-tipo"></select>
    </div>
    <div class="form-grupo">
      <label>Cuéntanos qué pasó</label>
      <textarea id="obs-descripcion" placeholder="Describe la situación..."></textarea>
    </div>
    <div id="obs-error" class="form-error hidden text-center"></div>
    <button class="btn btn-primary btn-block mt-8" id="btn-enviar-observacion">Enviar reporte</button>
  `);

  const selectDirigido = document.getElementById('obs-dirigido');
  const selectTipo = document.getElementById('obs-tipo');
  function actualizarTipos() {
    const opciones = TIPOS_OBSERVACION_REPARTIDOR[selectDirigido.value];
    selectTipo.innerHTML = Object.entries(opciones).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  }
  actualizarTipos();
  selectDirigido.addEventListener('change', actualizarTipos);

  document.getElementById('btn-enviar-observacion').addEventListener('click', async () => {
    const descripcion = document.getElementById('obs-descripcion').value.trim();
    const errorBox = document.getElementById('obs-error');
    try {
      await Api.repartidorObservacion(pedidoId, selectDirigido.value, selectTipo.value, descripcion);
      mostrarToast('Reporte enviado. Un administrador lo revisará.', 'success');
      cerrarModal();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}

function abrirModalSinPin(pedidoId) {
  abrirModal(`
    <div class="text-center">
      <div style="font-size:38px;">⚠️</div>
      <h3>Entregar sin código de confirmación</h3>
      <p class="text-muted text-sm">Úsalo solo si ya le diste el producto al cliente pero no pudo o no quiso darte el código. Tu pago por esta entrega quedará retenido hasta que un administrador lo revise.</p>
    </div>
    <div id="sin-pin-error" class="form-error hidden text-center"></div>
    <button class="btn btn-ghost btn-block mt-8" id="btn-confirmar-sin-pin">Sí, ya entregué el producto</button>
  `);
  document.getElementById('btn-confirmar-sin-pin').addEventListener('click', async () => {
    try {
      const r = await Api.repartidorEntregarSinPin(pedidoId);
      mostrarToast(r.mensaje || 'Entrega registrada como observada', 'success');
      cargarActivos();
      cargarPerfil();
      abrirModalEncuesta(pedidoId);
    } catch (err) {
      const errorBox = document.getElementById('sin-pin-error');
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}

// ---------- Compartir ubicacion GPS en vivo (mientras hay pedidos "recogido") ----------
let gpsWatchId = null;
let ultimoEnvioGPS = 0;
let pedidosRecogidoActuales = [];

function actualizarSeguimientoGPS(pedidos) {
  pedidosRecogidoActuales = pedidos.filter((p) => p.estado === 'recogido').map((p) => p.id);

  if (pedidosRecogidoActuales.length === 0) {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    return;
  }
  if (gpsWatchId !== null || !navigator.geolocation) return;

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const ahora = Date.now();
      if (ahora - ultimoEnvioGPS < 5000) return; // no saturar la API
      ultimoEnvioGPS = ahora;
      const { latitude, longitude } = pos.coords;
      pedidosRecogidoActuales.forEach((pedidoId) => {
        Api.repartidorUbicacion(pedidoId, latitude, longitude).catch(() => {});
      });
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
}

function abrirModalPin(pedidoId) {
  abrirModal(`
    <div class="text-center">
      <div style="font-size:38px;">🔑</div>
      <h3>Confirmar entrega</h3>
      <p class="text-muted text-sm">Pídele al cliente su PIN de 4 dígitos.</p>
    </div>
    <div class="form-grupo mt-16">
      <input id="input-pin" type="text" inputmode="numeric" maxlength="4" placeholder="0000" style="font-size:32px; text-align:center; letter-spacing:12px; font-weight:800;">
    </div>
    <div id="pin-error" class="form-error hidden text-center"></div>
    <button class="btn btn-success btn-block mt-8" id="btn-confirmar-pin">Confirmar entrega</button>
  `);
  document.getElementById('btn-confirmar-pin').addEventListener('click', async () => {
    const pin = document.getElementById('input-pin').value.trim();
    const errorBox = document.getElementById('pin-error');
    errorBox.classList.add('hidden');
    if (pin.length !== 4) { errorBox.textContent = 'El PIN debe tener 4 dígitos'; errorBox.classList.remove('hidden'); return; }
    try {
      await Api.repartidorEntregar(pedidoId, pin);
      mostrarToast('¡Entrega confirmada!', 'success');
      cargarActivos();
      cargarPerfil();
      abrirModalEncuesta(pedidoId);
    } catch (err) {
      errorBox.textContent = err.message || 'PIN incorrecto';
      errorBox.classList.remove('hidden');
    }
  });
}

// ---------- Encuesta de entrega (obligatoria tras cada entrega) ----------
function abrirModalEncuesta(pedidoId) {
  const root = document.getElementById('modal-root');
  // Sin cierre al tocar fuera: la encuesta es obligatoria tras cada entrega.
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <div class="text-center">
          <div style="font-size:38px;">📋</div>
          <h3>¿Cómo fue la entrega?</h3>
          <p class="text-muted text-sm">Ayúdanos a mantener la comunidad segura respondiendo esto.</p>
        </div>
        <div class="form-grupo mt-16 flex justify-between items-center">
          <label class="mb-0">¿El cliente fue amable contigo?</label>
          <span class="toggle-switch"><input type="checkbox" id="enc-amable" checked><span class="toggle-slider"></span></span>
        </div>
        <div class="form-grupo flex justify-between items-center">
          <label class="mb-0">¿Hubo algún problema?</label>
          <span class="toggle-switch"><input type="checkbox" id="enc-problema"><span class="toggle-slider"></span></span>
        </div>
        <div class="form-grupo">
          <label>Comentario (opcional)</label>
          <textarea id="enc-comentario" placeholder="Cuéntanos si quieres agregar algo..."></textarea>
        </div>
        <button class="btn btn-primary btn-block mt-8" id="btn-enviar-encuesta">Enviar</button>
      </div>
    </div>
  `;
  document.getElementById('btn-enviar-encuesta').addEventListener('click', async () => {
    const btn = document.getElementById('btn-enviar-encuesta');
    btn.disabled = true;
    try {
      await Api.repartidorEncuesta(pedidoId, {
        cliente_amable: document.getElementById('enc-amable').checked,
        hubo_problema: document.getElementById('enc-problema').checked,
        comentario: document.getElementById('enc-comentario').value.trim(),
      });
      cerrarModal();
    } catch (err) {
      mostrarToast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

// ---------- Pedidos disponibles (pool sin asignar, en mi zona) ----------
async function cargarDisponibles() {
  const cont = document.getElementById('lista-disponibles');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const pedidos = await Api.repartidorPedidosDisponibles();
    if (pedidos.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="icon">📥</div>
          <p>No hay pedidos disponibles en tu zona por ahora.</p>
          <p class="text-sm text-muted">Si no configuraste tu zona, hazlo en "Mi perfil" para empezar a ver pedidos aquí.</p>
        </div>
      `;
      return;
    }
    cont.innerHTML = `<div class="grid-pedidos-tarjetas">${pedidos.map((p) => `
      <div class="card card-pad entrega-card estado-${p.estado}">
        <div class="flex justify-between items-center">
          <strong>#${p.id.slice(0,8).toUpperCase()}</strong>
          <span class="badge badge-${p.estado}">${labelEstado(p.estado)}</span>
        </div>
        <div class="mt-8">
          <div class="entrega-info-row">📍 <span>${p.zona_entrega}</span></div>
          ${p.referencia_entrega ? `<div class="entrega-info-row text-muted">💬 <span>${p.referencia_entrega}</span></div>` : ''}
        </div>
        <div class="entrega-tarifa">
          <span class="text-sm">Tarifa de entrega</span>
          <strong>${formatoSoles(p.delivery_fee)}</strong>
        </div>
        <button class="btn btn-primary btn-block mt-16" data-reclamar="${p.id}">📥 Tomar este pedido</button>
      </div>
    `).join('')}</div>`;

    cont.querySelectorAll('[data-reclamar]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await Api.repartidorReclamarPedido(btn.dataset.reclamar);
        mostrarToast('Pedido tomado, ya está en Mis entregas', 'success');
        cargarDisponibles();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

// ---------- Historial ----------
async function cargarHistorial() {
  const cont = document.getElementById('lista-historial');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const pedidos = await Api.repartidorHistorial();
    if (pedidos.length === 0) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">🗂️</div><p>Aún no tienes entregas completadas.</p></div>';
      return;
    }
    cont.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Zona</th><th>Total</th><th>Tarifa</th><th>Fecha</th></tr></thead>
          <tbody>
            ${pedidos.map((p) => `
              <tr>
                <td>#${p.id.slice(0,8).toUpperCase()}</td>
                <td>${p.zona_entrega}</td>
                <td>${formatoSoles(p.monto_total)}</td>
                <td>${formatoSoles(p.delivery_fee)}</td>
                <td>${new Date(p.entregado_at).toLocaleString('es-PE')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

// ---------- Mi perfil ----------
async function cargarPerfilFormRepartidor() {
  try {
    const p = await Api.repartidorPerfil();
    document.getElementById('rp-nombre').value = p.nombre || '';
    document.getElementById('rp-telefono').value = p.telefono || '';
    document.getElementById('rp-zona').innerHTML = await zonaOptionsHtml(p.zona || '');
    document.getElementById('rp-foto').value = p.foto_url || '';
    const preview = document.getElementById('rp-foto-preview');
    if (p.foto_url) {
      preview.src = p.foto_url;
      preview.style.display = 'block';
      document.getElementById('rp-foto-placeholder').style.display = 'none';
      document.getElementById('rp-foto-drop').classList.add('con-imagen');
    }
  } catch (err) {
    if (!manejarError401(err)) mostrarToast(err.message, 'error');
  }
}

document.getElementById('rp-foto-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById('rp-foto-preview');
  const placeholder = document.getElementById('rp-foto-placeholder');
  const drop = document.getElementById('rp-foto-drop');
  try {
    const fd = new FormData();
    fd.append('imagen', file);
    mostrarToast('Subiendo imagen...', '');
    const { url } = await Api.repartidorSubirImagen(fd);
    document.getElementById('rp-foto').value = url;
    preview.src = url;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    drop.classList.add('con-imagen');
    mostrarToast('Imagen subida', 'success');
  } catch (err) {
    mostrarToast(err.message || 'No se pudo subir la imagen', 'error');
  }
});

document.getElementById('form-perfil-repartidor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-guardar-perfil-repartidor');
  const errorBox = document.getElementById('error-perfil-repartidor');
  errorBox.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await Api.repartidorActualizarPerfil({
      nombre: document.getElementById('rp-nombre').value,
      telefono: document.getElementById('rp-telefono').value,
      zona: document.getElementById('rp-zona').value,
      foto_url: document.getElementById('rp-foto').value,
    });
    document.getElementById('rep-nombre').textContent = document.getElementById('rp-nombre').value;
    localStorage.setItem('express_nombre_repartidor', document.getElementById('rp-nombre').value);
    mostrarToast('Perfil actualizado', 'success');
  } catch (err) {
    errorBox.textContent = err.message || 'No se pudo actualizar el perfil';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
});

document.getElementById('form-password-repartidor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-cambiar-password-repartidor');
  const errorBox = document.getElementById('error-password-repartidor');
  errorBox.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Actualizando...';
  try {
    await Api.repartidorCambiarPassword({
      password_actual: document.getElementById('rp-pass-actual').value,
      password_nueva: document.getElementById('rp-pass-nueva').value,
    });
    mostrarToast('Contraseña actualizada', 'success');
    e.target.reset();
  } catch (err) {
    errorBox.textContent = err.message || 'No se pudo cambiar la contraseña';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Actualizar contraseña';
  }
});

cargarPerfil();
cargarActivos();
