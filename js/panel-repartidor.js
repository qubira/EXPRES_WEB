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

const TITULOS = { activos: 'Mis entregas', historial: 'Historial' };

function irAVista(vista) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${vista}`).classList.remove('hidden');
  document.querySelectorAll('.panel-link[data-view]').forEach((l) => l.classList.toggle('activo', l.dataset.view === vista));
  document.getElementById('titulo-vista').textContent = TITULOS[vista];
  if (vista === 'activos') cargarActivos();
  if (vista === 'historial') cargarHistorial();
}
document.querySelectorAll('.panel-link[data-view]').forEach((link) => link.addEventListener('click', () => irAVista(link.dataset.view)));

function abrirModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">${html}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') cerrarModal(); });
}
function cerrarModal() { document.getElementById('modal-root').innerHTML = ''; }

async function cargarPerfil() {
  try {
    const perfil = await Api.repartidorPerfil();
    document.getElementById('pago-pendiente').textContent = formatoSoles(perfil.pago_pendiente);
    document.getElementById('toggle-disponible').checked = perfil.disponible;
  } catch (err) { manejarError401(err); }
}

document.getElementById('toggle-disponible').addEventListener('change', async (e) => {
  try {
    await Api.repartidorDisponibilidad(e.target.checked);
    mostrarToast(e.target.checked ? 'Ahora estás disponible' : 'Ya no estás disponible', 'success');
  } catch (err) { mostrarToast(err.message, 'error'); }
});

// ---------- Entregas activas ----------
async function cargarActivos() {
  const cont = document.getElementById('lista-activos');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const pedidos = await Api.repartidorPedidos();
    if (pedidos.length === 0) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">🚴</div><p>No tienes entregas asignadas por ahora.</p></div>';
      return;
    }
    cont.innerHTML = pedidos.map((p) => `
      <div class="card card-pad mt-16">
        <div class="flex justify-between items-center">
          <strong>#${p.id.slice(0,8).toUpperCase()}</strong>
          <span class="badge badge-${p.estado}">${labelEstado(p.estado)}</span>
        </div>
        <div class="text-sm text-muted mt-8">📍 ${p.zona_entrega}</div>
        ${p.referencia_entrega ? `<div class="text-sm text-muted">${p.referencia_entrega}</div>` : ''}
        <div class="text-sm mt-8">👤 ${p.cliente_nombre} · <a href="tel:${p.cliente_telefono}">${p.cliente_telefono}</a></div>
        <div class="flex justify-between items-center mt-8">
          <span class="text-sm">Tarifa de entrega: <strong>${formatoSoles(p.delivery_fee)}</strong></span>
        </div>
        <div class="mt-16">
          ${p.estado === 'listo_recoger' ? `<button class="btn btn-secondary btn-block" data-recoger="${p.id}">He recogido el pedido</button>` : ''}
          ${p.estado === 'recogido' ? `<button class="btn btn-success btn-block" data-entregar="${p.id}">Confirmar entrega (PIN)</button>` : ''}
          ${!['listo_recoger','recogido'].includes(p.estado) ? `<div class="text-sm text-muted text-center">Esperando que la tienda prepare el pedido...</div>` : ''}
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-recoger]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await Api.repartidorRecogido(btn.dataset.recoger);
        mostrarToast('Pedido marcado como recogido', 'success');
        cargarActivos();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
    cont.querySelectorAll('[data-entregar]').forEach((btn) => btn.addEventListener('click', () => abrirModalPin(btn.dataset.entregar)));
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

function abrirModalPin(pedidoId) {
  abrirModal(`
    <h3>Confirmar entrega</h3>
    <p class="text-muted text-sm">Pídele al cliente su PIN de 4 dígitos.</p>
    <div class="form-grupo">
      <input id="input-pin" type="text" inputmode="numeric" maxlength="4" placeholder="0000" style="font-size:28px; text-align:center; letter-spacing:10px;">
    </div>
    <div id="pin-error" class="form-error hidden"></div>
    <button class="btn btn-success btn-block" id="btn-confirmar-pin">Confirmar entrega</button>
  `);
  document.getElementById('btn-confirmar-pin').addEventListener('click', async () => {
    const pin = document.getElementById('input-pin').value.trim();
    const errorBox = document.getElementById('pin-error');
    errorBox.classList.add('hidden');
    if (pin.length !== 4) { errorBox.textContent = 'El PIN debe tener 4 dígitos'; errorBox.classList.remove('hidden'); return; }
    try {
      await Api.repartidorEntregar(pedidoId, pin);
      mostrarToast('¡Entrega confirmada!', 'success');
      cerrarModal();
      cargarActivos();
      cargarPerfil();
    } catch (err) {
      errorBox.textContent = err.message || 'PIN incorrecto';
      errorBox.classList.remove('hidden');
    }
  });
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

cargarPerfil();
cargarActivos();
