// ---------- Guard de sesion ----------
if (!localStorage.getItem('express_token_admin')) {
  location.href = 'login.html';
}
document.getElementById('admin-nombre').textContent = localStorage.getItem('express_nombre_admin') || '';

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('express_token_admin');
  location.href = 'login.html';
});

function manejarError401(err) {
  if (err.status === 401) {
    localStorage.removeItem('express_token_admin');
    location.href = 'login.html';
    return true;
  }
  return false;
}

// ---------- Navegacion entre vistas ----------
const TITULOS = { resumen: 'Resumen', pagos: 'Pagos pendientes', pedidos: 'Pedidos', tiendas: 'Tiendas', repartidores: 'Repartidores' };

function irAVista(vista) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${vista}`).classList.remove('hidden');
  document.querySelectorAll('.panel-link[data-view]').forEach((l) => l.classList.toggle('activo', l.dataset.view === vista));
  document.getElementById('titulo-vista').textContent = TITULOS[vista];

  if (vista === 'resumen') cargarResumen();
  if (vista === 'pagos') cargarPagos();
  if (vista === 'pedidos') cargarPedidos();
  if (vista === 'tiendas') cargarTiendas();
  if (vista === 'repartidores') cargarRepartidores();
}

document.querySelectorAll('.panel-link[data-view]').forEach((link) => {
  link.addEventListener('click', () => irAVista(link.dataset.view));
});

// ---------- Resumen ----------
async function cargarResumen() {
  try {
    const m = await Api.adminMetricas();
    document.getElementById('m-pedidos-hoy').textContent = m.hoy.total;
    document.getElementById('m-ventas-hoy').textContent = formatoSoles(m.hoy.ventas);
    document.getElementById('m-comisiones-hoy').textContent = formatoSoles(m.hoy.comisiones);
    document.getElementById('m-pagos-pendientes').textContent = m.pagos_pendientes;

    document.getElementById('tabla-estados').innerHTML = m.por_estado.map((r) => `
      <tr><td>${labelEstado(r.estado)}</td><td>${r.total}</td></tr>
    `).join('') || '<tr><td colspan="2" class="text-muted">Sin datos aún</td></tr>';
  } catch (err) {
    if (!manejarError401(err)) mostrarToast(err.message, 'error');
  }
}

// ---------- Pagos pendientes ----------
async function cargarPagos() {
  const cont = document.getElementById('lista-pagos');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const pagos = await Api.adminPagos('pendiente');
    if (pagos.length === 0) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No hay pagos pendientes por confirmar.</p></div>';
      return;
    }
    cont.innerHTML = pagos.map((pg) => `
      <div class="card card-pad mt-16">
        <div class="flex justify-between items-center">
          <div>
            <strong>${pg.cliente_nombre}</strong> · ${pg.cliente_telefono}
            <div class="text-sm text-muted">${pg.zona_entrega}</div>
          </div>
          <span class="tag">${pg.tipo}</span>
        </div>
        <div class="flex justify-between items-center mt-8">
          <span class="text-sm text-muted">Ref: ${pg.referencia || '—'}</span>
          <strong>${formatoSoles(pg.monto_total)}</strong>
        </div>
        ${pg.comprobante_url ? `<a href="${uploadsUrl(pg.comprobante_url)}" target="_blank"><img src="${uploadsUrl(pg.comprobante_url)}" style="max-height:220px;border-radius:10px;margin-top:10px;"></a>` : ''}
        <div class="flex gap-8 mt-16">
          <button class="btn btn-success btn-sm w-full" data-confirmar="${pg.id}">✓ Confirmar</button>
          <button class="btn btn-danger btn-sm w-full" data-rechazar="${pg.id}">✕ Rechazar</button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-confirmar]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await Api.adminConfirmarPago(btn.dataset.confirmar);
        mostrarToast('Pago confirmado', 'success');
        cargarPagos();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
    cont.querySelectorAll('[data-rechazar]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Rechazar este pago?')) return;
      btn.disabled = true;
      try {
        await Api.adminRechazarPago(btn.dataset.rechazar);
        mostrarToast('Pago rechazado', 'success');
        cargarPagos();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

// ---------- Pedidos ----------
let repartidoresCache = [];

async function cargarPedidos(estado = '') {
  const tbody = document.getElementById('tabla-pedidos');
  tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Cargando...</td></tr>';
  try {
    const [pedidos, repartidores] = await Promise.all([Api.adminPedidos(estado), Api.adminGetRepartidores()]);
    repartidoresCache = repartidores.filter((r) => r.activo);

    if (pedidos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Sin pedidos en este filtro</td></tr>';
      return;
    }

    tbody.innerHTML = pedidos.map((p) => `
      <tr>
        <td>#${p.id.slice(0,8).toUpperCase()}</td>
        <td>${p.cliente_nombre}</td>
        <td>${p.zona_entrega}</td>
        <td><span class="badge badge-${p.estado}">${labelEstado(p.estado)}</span></td>
        <td>${formatoSoles(p.monto_total)}</td>
        <td>${p.repartidor_nombre || '—'}</td>
        <td>
          ${['pagado','preparando','listo_recoger'].includes(p.estado) && !p.repartidor_nombre
            ? `<button class="btn btn-outline btn-sm" data-asignar="${p.id}">Asignar</button>` : ''}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-asignar]').forEach((btn) => btn.addEventListener('click', () => abrirModalAsignar(btn.dataset.asignar)));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="7" class="form-error">${err.message}</td></tr>`;
  }
}

document.querySelectorAll('#filtro-pedidos .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#filtro-pedidos .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    cargarPedidos(chip.dataset.estado);
  });
});

function abrirModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">${html}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') cerrarModal();
  });
}
function cerrarModal() { document.getElementById('modal-root').innerHTML = ''; }

function abrirModalAsignar(pedidoId) {
  abrirModal(`
    <h3>Asignar repartidor</h3>
    <div class="form-grupo">
      <select id="select-repartidor">
        ${repartidoresCache.map((r) => `<option value="${r.id}">${r.nombre} ${r.disponible ? '(disponible)' : ''}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-block" id="btn-confirmar-asignar">Asignar</button>
  `);
  document.getElementById('btn-confirmar-asignar').addEventListener('click', async () => {
    try {
      const repId = document.getElementById('select-repartidor').value;
      await Api.adminAsignarRepartidor(pedidoId, repId);
      mostrarToast('Repartidor asignado', 'success');
      cerrarModal();
      cargarPedidos();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });
}

// ---------- Tiendas ----------
async function cargarTiendas() {
  const tbody = document.getElementById('tabla-tiendas');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Cargando...</td></tr>';
  try {
    const tiendas = await Api.adminGetTiendas();
    tbody.innerHTML = tiendas.map((t) => `
      <tr>
        <td>${t.nombre}</td>
        <td>${labelTipoNegocio(t.categoria)}</td>
        <td>${t.zona || '—'}</td>
        <td>${t.comision_pactada}%</td>
        <td>${t.activo ? '<span class="badge badge-entregado">Activa</span>' : '<span class="badge badge-cancelado">Inactiva</span>'}</td>
        <td><button class="btn btn-outline btn-sm" data-editar-tienda="${t.id}">Editar</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted">Aún no hay tiendas registradas</td></tr>';

    tbody.querySelectorAll('[data-editar-tienda]').forEach((btn) => btn.addEventListener('click', () => {
      const tienda = tiendas.find((t) => t.id === btn.dataset.editarTienda);
      abrirModalEditarTienda(tienda);
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="6" class="form-error">${err.message}</td></tr>`;
  }
}

async function abrirModalEditarTienda(t) {
  const tipos = await Api.getTiposNegocio();
  abrirModal(`
    <h3>${t.nombre}</h3>
    <div class="form-grupo"><label>Nombre</label><input id="e-nombre" value="${t.nombre}"></div>
    <div class="form-grupo"><label>Categoría (tipo de negocio)</label>
      <select id="e-categoria">
        ${tipos.map((c) => `<option value="${c}" ${c===t.categoria?'selected':''}>${labelTipoNegocio(c)}</option>`).join('')}
      </select>
    </div>
    <div class="form-grupo"><label>¿Qué vende?</label><input id="e-subcategoria" value="${t.subcategoria || ''}" placeholder="Ej. Ropa, helados, libros, bikinis..."></div>
    <div class="form-grupo"><label>Zona</label>
      <select id="e-zona">${zonaOptionsHtml(t.zona || '')}</select>
    </div>
    <div class="form-grupo"><label>DNI del titular</label>
      <div class="flex" style="gap:8px;">
        <input id="e-dni" value="${t.dni_titular || ''}" inputmode="numeric" maxlength="8" placeholder="Ej. 12345678" style="flex:1;">
        <button type="button" class="btn btn-outline btn-sm" id="e-buscar-dni">Buscar</button>
      </div>
    </div>
    <div class="form-grupo"><label>Nombre del titular</label><input id="e-nombre-titular" value="${t.nombre_titular || ''}" readonly placeholder="Se completa automáticamente al buscar el DNI"></div>
    <div class="form-grupo"><label>Comisión (%)</label><input id="e-comision" type="number" step="0.5" value="${t.comision_pactada}"></div>
    <div class="form-grupo"><label>WhatsApp</label><input id="e-whatsapp" value="${t.contacto_whatsapp || ''}"></div>
    <div class="form-grupo flex justify-between items-center">
      <label class="mb-0">Tienda activa</label>
      <span class="toggle-switch">
        <input type="checkbox" id="e-activo" ${t.activo ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </span>
    </div>
    <hr class="divider">
    <div class="form-grupo"><label>Nueva contraseña (opcional)</label><input id="e-password" type="text" placeholder="Dejar vacío para no cambiar"></div>
    <button class="btn btn-primary btn-block" id="btn-guardar-tienda">Guardar cambios</button>
  `);
  habilitarBuscarDni('e-dni', 'e-nombre-titular', 'e-buscar-dni');
  document.getElementById('btn-guardar-tienda').addEventListener('click', async () => {
    try {
      await Api.adminActualizarTienda(t.id, {
        nombre: document.getElementById('e-nombre').value,
        categoria: document.getElementById('e-categoria').value,
        subcategoria: document.getElementById('e-subcategoria').value,
        descripcion: t.descripcion,
        dni_titular: document.getElementById('e-dni').value,
        nombre_titular: document.getElementById('e-nombre-titular').value,
        contacto_telefono: t.contacto_telefono,
        contacto_whatsapp: document.getElementById('e-whatsapp').value,
        zona: document.getElementById('e-zona').value,
        comision_pactada: Number(document.getElementById('e-comision').value),
        activo: document.getElementById('e-activo').checked,
      });
      const pass = document.getElementById('e-password').value;
      if (pass) await Api.adminCambiarPasswordTienda(t.id, pass);
      mostrarToast('Tienda actualizada', 'success');
      cerrarModal();
      cargarTiendas();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });
}

document.getElementById('btn-nueva-tienda').addEventListener('click', async () => {
  const tipos = await Api.getTiposNegocio();
  abrirModal(`
    <h3>Nueva tienda</h3>
    <div class="form-grupo"><label>Nombre</label><input id="n-nombre" required></div>
    <div class="form-grupo"><label>Categoría (tipo de negocio)</label>
      <select id="n-categoria">
        ${tipos.map((c) => `<option value="${c}">${labelTipoNegocio(c)}</option>`).join('')}
      </select>
    </div>
    <div class="form-grupo"><label>¿Qué vende?</label><input id="n-subcategoria" placeholder="Ej. Ropa, helados, libros, bikinis..."></div>
    <div class="form-grupo"><label>Zona</label>
      <select id="n-zona">${zonaOptionsHtml('')}</select>
    </div>
    <div class="form-grupo"><label>DNI del titular</label>
      <div class="flex" style="gap:8px;">
        <input id="n-dni" inputmode="numeric" maxlength="8" placeholder="Ej. 12345678" style="flex:1;">
        <button type="button" class="btn btn-outline btn-sm" id="n-buscar-dni">Buscar</button>
      </div>
    </div>
    <div class="form-grupo"><label>Nombre del titular</label><input id="n-nombre-titular" readonly placeholder="Se completa automáticamente al buscar el DNI"></div>
    <div class="form-grupo"><label>Comisión (%)</label><input id="n-comision" type="number" value="12" step="0.5"></div>
    <div class="form-grupo"><label>WhatsApp</label><input id="n-whatsapp"></div>
    <div class="form-grupo"><label>Email de acceso</label><input id="n-email" type="email" required></div>
    <div class="form-grupo"><label>Contraseña</label><input id="n-password" type="text" required></div>
    <button class="btn btn-primary btn-block" id="btn-crear-tienda">Crear tienda</button>
  `);
  habilitarBuscarDni('n-dni', 'n-nombre-titular', 'n-buscar-dni');
  document.getElementById('btn-crear-tienda').addEventListener('click', async () => {
    try {
      await Api.adminCrearTienda({
        nombre: document.getElementById('n-nombre').value,
        categoria: document.getElementById('n-categoria').value,
        subcategoria: document.getElementById('n-subcategoria').value,
        zona: document.getElementById('n-zona').value,
        dni_titular: document.getElementById('n-dni').value,
        nombre_titular: document.getElementById('n-nombre-titular').value,
        comision_pactada: Number(document.getElementById('n-comision').value),
        contacto_whatsapp: document.getElementById('n-whatsapp').value,
        email: document.getElementById('n-email').value,
        password: document.getElementById('n-password').value,
      });
      mostrarToast('Tienda creada', 'success');
      cerrarModal();
      cargarTiendas();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });
});

// ---------- Repartidores ----------
async function cargarRepartidores() {
  const tbody = document.getElementById('tabla-repartidores');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Cargando...</td></tr>';
  try {
    const reps = await Api.adminGetRepartidores();
    tbody.innerHTML = reps.map((r) => `
      <tr>
        <td>${r.nombre}</td>
        <td>${r.dni}</td>
        <td>${r.telefono}</td>
        <td>${r.disponible ? '🟢 Sí' : '⚪ No'}</td>
        <td>${formatoSoles(r.pago_pendiente)}</td>
        <td>
          ${Number(r.pago_pendiente) > 0 ? `<button class="btn btn-outline btn-sm" data-liquidar="${r.id}">Liquidar</button>` : ''}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-muted">Aún no hay repartidores</td></tr>';

    tbody.querySelectorAll('[data-liquidar]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Marcar este pago como liquidado?')) return;
      try {
        await Api.adminLiquidarRepartidor(btn.dataset.liquidar);
        mostrarToast('Pago liquidado', 'success');
        cargarRepartidores();
      } catch (err) { mostrarToast(err.message, 'error'); }
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="6" class="form-error">${err.message}</td></tr>`;
  }
}

document.getElementById('btn-nuevo-repartidor').addEventListener('click', () => {
  abrirModal(`
    <h3>Nuevo repartidor</h3>
    <div class="form-grupo"><label>Nombre</label><input id="r-nombre" required></div>
    <div class="form-grupo"><label>DNI</label><input id="r-dni" required></div>
    <div class="form-grupo"><label>Teléfono</label><input id="r-telefono" required></div>
    <div class="form-grupo"><label>Email de acceso</label><input id="r-email" type="email" required></div>
    <div class="form-grupo"><label>Contraseña</label><input id="r-password" type="text" required></div>
    <button class="btn btn-primary btn-block" id="btn-crear-repartidor">Crear repartidor</button>
  `);
  document.getElementById('btn-crear-repartidor').addEventListener('click', async () => {
    try {
      await Api.adminCrearRepartidor({
        nombre: document.getElementById('r-nombre').value,
        dni: document.getElementById('r-dni').value,
        telefono: document.getElementById('r-telefono').value,
        email: document.getElementById('r-email').value,
        password: document.getElementById('r-password').value,
      });
      mostrarToast('Repartidor creado', 'success');
      cerrarModal();
      cargarRepartidores();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });
});

cargarResumen();
