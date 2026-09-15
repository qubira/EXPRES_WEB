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
const TITULOS = { resumen: 'Resumen', registro: 'Registrar cuenta', pagos: 'Pagos pendientes', pedidos: 'Pedidos', tiendas: 'Tiendas', repartidores: 'Repartidores', usuarios: 'Cuentas de usuario', reclamos: 'Reclamos', auditoria: 'Auditoría' };

function irAVista(vista) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${vista}`).classList.remove('hidden');
  document.querySelectorAll('.panel-link[data-view]').forEach((l) => l.classList.toggle('activo', l.dataset.view === vista));
  document.getElementById('titulo-vista').textContent = TITULOS[vista];

  if (vista === 'resumen') cargarResumen();
  if (vista === 'registro') initVistaRegistro();
  if (vista === 'pagos') cargarPagos();
  if (vista === 'pedidos') cargarPedidos();
  if (vista === 'tiendas') cargarTiendas();
  if (vista === 'repartidores') cargarRepartidores();
  if (vista === 'usuarios') cargarUsuarios();
  if (vista === 'reclamos') { cargarReclamos(); cargarPagosRetenidos(); }
  if (vista === 'auditoria') cargarAuditoria();
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
  tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Cargando...</td></tr>';
  try {
    const tiendas = await Api.adminGetTiendas();
    tbody.innerHTML = tiendas.map((t) => `
      <tr class="fila-tienda" data-fila-tienda="${t.id}" style="cursor:pointer;">
        <td>${t.nombre}</td>
        <td class="text-sm text-muted">${t.email || '—'}</td>
        <td>${labelTipoNegocio(t.categoria)}</td>
        <td>${t.zona || '—'}</td>
        <td>${t.comision_pactada}%</td>
        <td>${t.activo ? '<span class="badge badge-entregado">Activa</span>' : '<span class="badge badge-cancelado">Inactiva</span>'}</td>
        <td><button class="btn btn-outline btn-sm" data-editar-tienda="${t.id}">Editar</button></td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="text-muted">Aún no hay tiendas registradas</td></tr>';

    tbody.querySelectorAll('[data-editar-tienda]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tienda = tiendas.find((t) => t.id === btn.dataset.editarTienda);
      abrirModalEditarTienda(tienda);
    }));
    tbody.querySelectorAll('[data-fila-tienda]').forEach((fila) => fila.addEventListener('click', () => {
      toggleProductosTienda(fila, fila.dataset.filaTienda);
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="7" class="form-error">${err.message}</td></tr>`;
  }
}

async function toggleProductosTienda(filaTienda, tiendaId) {
  const filaExistente = filaTienda.nextElementSibling;
  if (filaExistente && filaExistente.classList.contains('fila-productos-tienda')) {
    filaExistente.remove();
    return;
  }
  // Cierra cualquier otra tienda expandida (solo una a la vez)
  document.querySelectorAll('.fila-productos-tienda').forEach((f) => f.remove());

  const fila = document.createElement('tr');
  fila.className = 'fila-productos-tienda';
  fila.innerHTML = `<td colspan="7"><p class="text-muted">Cargando productos...</p></td>`;
  filaTienda.after(fila);

  try {
    const productos = await Api.adminProductosTienda(tiendaId);
    if (productos.length === 0) {
      fila.innerHTML = `<td colspan="7"><p class="text-muted">Esta tienda aún no tiene productos.</p></td>`;
      return;
    }
    fila.innerHTML = `
      <td colspan="7" style="padding:0;">
        <div class="table-wrap" style="box-shadow:none; border-radius:0; margin:4px 0 8px;">
          <table>
            <thead>
              <tr>
                <th>Producto</th><th>Categoría</th><th>Subcategoría</th><th>Tamaño</th><th>Costo</th>
                <th title="Veces que se abrió la ficha del producto">👁️ Vistas</th>
                <th title="Veces que se agregó a un pedido">🛒 Pedidos</th>
                <th title="Pedidos entregados con éxito">✅ Ventas</th>
                <th title="Pedidos cancelados o rechazados">❌ Cancelados</th>
              </tr>
            </thead>
            <tbody>
              ${productos.map((p) => `
                <tr>
                  <td>${p.nombre}${!p.activo ? ' <span class="text-sm text-muted">(inactivo)</span>' : ''}</td>
                  <td>${p.categoria}</td>
                  <td>${p.subcategoria || '—'}</td>
                  <td>${formatoContenido(p.contenido, p.unidad)}</td>
                  <td>${formatoSoles(p.precio)}</td>
                  <td>${p.vistas}</td>
                  <td>${p.total_pedidos}</td>
                  <td>${p.ventas}</td>
                  <td>${p.cancelados}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </td>
    `;
  } catch (err) {
    fila.innerHTML = `<td colspan="7" class="form-error">${err.message}</td>`;
  }
}

async function abrirModalEditarTienda(t) {
  const tipos = await Api.getTiposNegocio();
  const zonaHtml = await zonaOptionsHtml(t.zona || '');
  abrirModal(`
    <h3>${t.nombre}</h3>
    <div class="form-grupo">
      <label>Logo / imagen del negocio</label>
      <label class="file-drop ${t.logo_url ? 'con-imagen' : ''}" id="e-logo-drop">
        <input type="file" id="e-logo-file" accept="image/*" class="file-drop-input">
        <img id="e-logo-preview" class="file-drop-preview" src="${t.logo_url || ''}" style="${t.logo_url ? '' : 'display:none;'}">
        <div id="e-logo-placeholder" style="${t.logo_url ? 'display:none;' : 'display:flex;flex-direction:column;align-items:center;gap:6px;'}">
          <span class="file-drop-icon">🏪</span>
          <span class="file-drop-text">Toca para subir el logo</span>
          <span class="file-drop-hint">JPG o PNG, máx. 5MB</span>
        </div>
      </label>
    </div>
    <div class="form-grupo"><label>Email (login)</label><input value="${t.email || ''}" readonly style="opacity:0.7;"></div>
    <div class="form-grupo"><label>Nombre</label><input id="e-nombre" value="${t.nombre}"></div>
    <div class="form-grupo"><label>Categoría (tipo de negocio)</label>
      <div class="flex" style="gap:8px;">
        <select id="e-categoria" style="flex:1;">
          ${tipos.map((tn) => `<option value="${tn.clave}" ${tn.clave===t.categoria?'selected':''}>${tn.etiqueta}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-outline btn-sm" id="e-categoria-add" title="Agregar tipo de negocio">+</button>
      </div>
    </div>
    <div class="form-grupo"><label>¿Qué vende?</label><input id="e-subcategoria" value="${t.subcategoria || ''}" placeholder="Ej. Ropa, helados, libros, bikinis..."></div>
    <div class="form-grupo"><label>Zona</label>
      <select id="e-zona">${zonaHtml}</select>
    </div>
    <div class="form-grupo"><label>DNI del titular</label>
      <div class="flex" style="gap:8px;">
        <input id="e-dni" value="${t.dni_titular || ''}" inputmode="numeric" maxlength="8" placeholder="Ej. 12345678" style="flex:1;">
        <button type="button" class="btn btn-outline btn-sm" id="e-buscar-dni">Buscar</button>
      </div>
    </div>
    <div class="form-grupo"><label>Nombre del titular</label><input id="e-nombre-titular" value="${t.nombre_titular || ''}" readonly placeholder="Se completa automáticamente al buscar el DNI"></div>
    <div class="form-grupo"><label>Dirección del local (opcional)</label><input id="e-direccion" value="${t.direccion || ''}" placeholder="Ej. Malecón 123, frente a la playa"></div>
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
  habilitarAgregarTipoNegocio('e-categoria', 'e-categoria-add', 'admin');
  let eLogoUrl = t.logo_url || '';
  document.getElementById('e-logo-file').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const preview = document.getElementById('e-logo-preview');
    const placeholder = document.getElementById('e-logo-placeholder');
    const drop = document.getElementById('e-logo-drop');
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      mostrarToast('Subiendo logo...', '');
      const { url } = await Api.adminSubirImagen(fd, 'tiendas');
      eLogoUrl = url;
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      drop.classList.add('con-imagen');
      mostrarToast('Logo subido', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se pudo subir el logo', 'error');
    }
  });
  document.getElementById('btn-guardar-tienda').addEventListener('click', async () => {
    try {
      await Api.adminActualizarTienda(t.id, {
        nombre: document.getElementById('e-nombre').value,
        categoria: document.getElementById('e-categoria').value,
        logo_url: eLogoUrl,
        subcategoria: document.getElementById('e-subcategoria').value,
        descripcion: t.descripcion,
        dni_titular: document.getElementById('e-dni').value,
        nombre_titular: document.getElementById('e-nombre-titular').value,
        direccion: document.getElementById('e-direccion').value,
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

// ---------- Repartidores ----------
async function cargarRepartidores() {
  const tbody = document.getElementById('tabla-repartidores');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Cargando...</td></tr>';
  try {
    const reps = await Api.adminGetRepartidores();
    tbody.innerHTML = reps.map((r) => `
      <tr>
        <td>${r.nombre}</td>
        <td>${r.tipo_documento === 'ce' ? 'CE' : 'DNI'} ${r.dni}</td>
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

// ---------- Registro unificado (Tienda / Entrega) ----------
let registroInicializado = false;
async function initVistaRegistro() {
  if (registroInicializado) return;
  registroInicializado = true;

  const tipos = await Api.getTiposNegocio();
  document.getElementById('rt-categoria').innerHTML = tipos.map((t) => `<option value="${t.clave}">${t.etiqueta}</option>`).join('');
  document.getElementById('rt-zona').innerHTML = await zonaOptionsHtml('');
  habilitarBuscarDni('rt-dni', 'rt-nombre-titular', 'rt-buscar-dni');
  habilitarAgregarTipoNegocio('rt-categoria', 'rt-categoria-add', 'admin');

  let rtLogoUrl = '';
  document.getElementById('rt-logo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('rt-logo-preview');
    const placeholder = document.getElementById('rt-logo-placeholder');
    const drop = document.getElementById('rt-logo-drop');
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      mostrarToast('Subiendo logo...', '');
      const { url } = await Api.adminSubirImagen(fd, 'tiendas');
      rtLogoUrl = url;
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      drop.classList.add('con-imagen');
      mostrarToast('Logo subido', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se pudo subir el logo', 'error');
    }
  });

  const btnTienda = document.getElementById('btn-tipo-tienda');
  const btnRepartidor = document.getElementById('btn-tipo-repartidor');
  const formTienda = document.getElementById('form-registro-tienda');
  const formRepartidor = document.getElementById('form-registro-repartidor');

  btnTienda.addEventListener('click', () => {
    btnTienda.classList.replace('btn-outline', 'btn-primary');
    btnRepartidor.classList.replace('btn-primary', 'btn-outline');
    formTienda.classList.remove('hidden');
    formRepartidor.classList.add('hidden');
  });
  btnRepartidor.addEventListener('click', () => {
    btnRepartidor.classList.replace('btn-outline', 'btn-primary');
    btnTienda.classList.replace('btn-primary', 'btn-outline');
    formRepartidor.classList.remove('hidden');
    formTienda.classList.add('hidden');
  });

  formTienda.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await Api.adminCrearTienda({
        nombre: document.getElementById('rt-nombre').value,
        categoria: document.getElementById('rt-categoria').value,
        subcategoria: document.getElementById('rt-subcategoria').value,
        zona: document.getElementById('rt-zona').value,
        dni_titular: document.getElementById('rt-dni').value,
        nombre_titular: document.getElementById('rt-nombre-titular').value,
        direccion: document.getElementById('rt-direccion').value,
        comision_pactada: Number(document.getElementById('rt-comision').value),
        contacto_whatsapp: document.getElementById('rt-whatsapp').value,
        email: document.getElementById('rt-email').value,
        password: document.getElementById('rt-password').value,
        logo_url: rtLogoUrl,
      });
      mostrarToast('Tienda creada', 'success');
      formTienda.reset();
      document.getElementById('rt-nombre-titular').value = '';
      rtLogoUrl = '';
      document.getElementById('rt-logo-preview').style.display = 'none';
      document.getElementById('rt-logo-placeholder').style.display = 'flex';
      document.getElementById('rt-logo-drop').classList.remove('con-imagen');
      cargarTiendas();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });

  // ---------- Repartidor: nacionalidad (DNI peruano vs CE extranjero) ----------
  habilitarBuscarDni('rr-dni', 'rr-nombre-peru', 'rr-buscar-dni');
  habilitarBuscarCe('rr-ce', 'rr-nombre-extranjero', 'rr-buscar-ce');
  const btnPeruano = document.getElementById('rr-btn-peruano');
  const btnExtranjero = document.getElementById('rr-btn-extranjero');
  const bloquePeru = document.getElementById('rr-bloque-peru');
  const bloqueExtranjero = document.getElementById('rr-bloque-extranjero');
  let rrEsExtranjero = false;

  btnPeruano.addEventListener('click', () => {
    rrEsExtranjero = false;
    btnPeruano.classList.replace('btn-outline', 'btn-primary');
    btnExtranjero.classList.replace('btn-primary', 'btn-outline');
    bloquePeru.classList.remove('hidden');
    bloqueExtranjero.classList.add('hidden');
  });
  btnExtranjero.addEventListener('click', () => {
    rrEsExtranjero = true;
    btnExtranjero.classList.replace('btn-outline', 'btn-primary');
    btnPeruano.classList.replace('btn-primary', 'btn-outline');
    bloqueExtranjero.classList.remove('hidden');
    bloquePeru.classList.add('hidden');
  });

  // ---------- Repartidor: foto ----------
  let rrFotoUrl = '';
  document.getElementById('rr-foto-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('rr-foto-preview');
    const placeholder = document.getElementById('rr-foto-placeholder');
    const drop = document.getElementById('rr-foto-drop');
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      mostrarToast('Subiendo foto...', '');
      const { url } = await Api.adminSubirImagen(fd);
      rrFotoUrl = url;
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      drop.classList.add('con-imagen');
      mostrarToast('Foto subida', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se pudo subir la foto', 'error');
    }
  });

  formRepartidor.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const datos = {
        nombre: rrEsExtranjero ? document.getElementById('rr-nombre-extranjero').value : document.getElementById('rr-nombre-peru').value,
        dni: rrEsExtranjero ? document.getElementById('rr-ce').value : document.getElementById('rr-dni').value,
        tipo_documento: rrEsExtranjero ? 'ce' : 'dni',
        nacionalidad: rrEsExtranjero ? document.getElementById('rr-nacionalidad').value : 'Peruana',
        edad: document.getElementById('rr-edad').value ? Number(document.getElementById('rr-edad').value) : null,
        telefono: document.getElementById('rr-telefono').value,
        direccion: document.getElementById('rr-direccion').value,
        contacto_emergencia_nombre: document.getElementById('rr-emergencia-nombre').value,
        contacto_emergencia_telefono: document.getElementById('rr-emergencia-telefono').value,
        antecedentes_penales: document.getElementById('rr-antecedentes').checked,
        foto_url: rrFotoUrl,
        email: document.getElementById('rr-email').value,
        password: document.getElementById('rr-password').value,
      };
      if (!datos.nombre || !datos.dni) {
        mostrarToast(rrEsExtranjero ? 'Completa el nombre y el CE' : 'Completa el nombre (usa Buscar) y el DNI', 'error');
        return;
      }
      await Api.adminCrearRepartidor(datos);
      mostrarToast('Repartidor creado', 'success');
      formRepartidor.reset();
      rrFotoUrl = '';
      document.getElementById('rr-foto-preview').style.display = 'none';
      document.getElementById('rr-foto-placeholder').style.display = 'flex';
      document.getElementById('rr-foto-drop').classList.remove('con-imagen');
      cargarRepartidores();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });
}

// ---------- Cuentas de usuario (clientes) ----------
let usuariosCache = [];

async function cargarUsuarios() {
  const tbody = document.getElementById('tabla-usuarios');
  tbody.innerHTML = '<tr><td colspan="8" class="text-muted">Cargando...</td></tr>';
  try {
    const usuarios = await Api.adminUsuarios();
    usuariosCache = usuarios;
    if (usuarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted">Aún no hay cuentas de clientes</td></tr>';
      return;
    }
    tbody.innerHTML = usuarios.map((u) => `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.email || '—'}</td>
        <td>${u.telefono}</td>
        <td>${u.zona || '—'}</td>
        <td>${u.total_pedidos}</td>
        <td>${formatoSoles(u.total_gastado)}</td>
        <td>${new Date(u.created_at).toLocaleDateString('es-PE')}</td>
        <td><button class="btn btn-outline btn-sm" data-editar-usuario="${u.id}">Editar</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-editar-usuario]').forEach((btn) => btn.addEventListener('click', () => {
      const u = usuariosCache.find((x) => x.id === btn.dataset.editarUsuario);
      if (u) abrirModalEditarUsuario(u);
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="8" class="form-error">${err.message}</td></tr>`;
  }
}

async function abrirModalEditarUsuario(u) {
  const zonaHtml = await zonaOptionsHtml(u.zona || '');
  abrirModal(`
    <h3>${u.nombre}</h3>
    <p class="text-sm text-muted">${u.total_pedidos} pedido(s) · ${formatoSoles(u.total_gastado)} comprado</p>
    <div class="form-grupo"><label>Nombre</label><input id="eu-nombre" value="${u.nombre}"></div>
    <div class="form-grupo"><label>Correo</label><input id="eu-email" type="email" value="${u.email || ''}"></div>
    <div class="form-grupo"><label>Teléfono</label><input id="eu-telefono" value="${u.telefono}"></div>
    <div class="form-grupo"><label>Zona</label><select id="eu-zona">${zonaHtml}</select></div>
    <hr class="divider">
    <div class="form-grupo"><label>Nueva contraseña (opcional)</label><input id="eu-password" type="text" placeholder="Dejar vacío para no cambiar"></div>
    <div id="eu-error" class="form-error hidden"></div>
    <button class="btn btn-primary btn-block" id="btn-guardar-usuario">Guardar cambios</button>
  `);
  document.getElementById('btn-guardar-usuario').addEventListener('click', async () => {
    const errBox = document.getElementById('eu-error');
    errBox.classList.add('hidden');
    try {
      await Api.adminActualizarUsuario(u.id, {
        nombre: document.getElementById('eu-nombre').value,
        email: document.getElementById('eu-email').value,
        telefono: document.getElementById('eu-telefono').value,
        zona: document.getElementById('eu-zona').value,
      });
      const pass = document.getElementById('eu-password').value;
      if (pass) await Api.adminCambiarPasswordUsuario(u.id, pass);
      mostrarToast('Cuenta actualizada', 'success');
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });
}

// ---------- Reclamos y pagos retenidos ----------
const MOTIVO_RECLAMO_LABELS = {
  producto_incorrecto: 'No era lo que pidió',
  producto_danado: 'Llegó dañado/golpeado',
  no_recibido: 'No recibió el pedido',
  otro: 'Otro',
};
const ESTADO_RECLAMO_LABELS = { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto' };

async function cargarReclamos(estado = '') {
  const tbody = document.getElementById('tabla-reclamos');
  tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Cargando...</td></tr>';
  try {
    const reclamos = await Api.adminReclamos(estado);
    if (reclamos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Sin reclamos por ahora</td></tr>';
      return;
    }
    tbody.innerHTML = reclamos.map((r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleString('es-PE')}</td>
        <td>#${r.pedido_id.slice(0,8).toUpperCase()}</td>
        <td>${r.cliente_nombre || '—'}</td>
        <td>${MOTIVO_RECLAMO_LABELS[r.motivo] || r.motivo}</td>
        <td class="text-sm" style="max-width:220px;">${r.descripcion || '—'}</td>
        <td><span class="badge badge-${r.estado === 'resuelto' ? 'entregado' : 'pendiente_pago'}">${ESTADO_RECLAMO_LABELS[r.estado] || r.estado}</span></td>
        <td>${r.estado !== 'resuelto' ? `<button class="btn btn-secondary btn-sm" data-resolver="${r.id}">Resolver</button>` : '—'}</td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-resolver]').forEach((btn) => btn.addEventListener('click', () => abrirModalResolverReclamo(btn.dataset.resolver)));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="7" class="form-error">${err.message}</td></tr>`;
  }
}

document.querySelectorAll('#filtro-reclamos .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#filtro-reclamos .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    cargarReclamos(chip.dataset.estado);
  });
});

function abrirModalResolverReclamo(id) {
  abrirModal(`
    <h3>Resolver reclamo</h3>
    <div class="form-grupo mt-16">
      <label>¿Qué se hizo / decidió?</label>
      <textarea id="resolucion-texto" placeholder="Ej. Se coordinó reembolso con la tienda"></textarea>
    </div>
    <div class="flex gap-8 mt-8">
      <button class="btn btn-outline btn-block" id="btn-marcar-revision">Marcar en revisión</button>
      <button class="btn btn-primary btn-block" id="btn-marcar-resuelto">Marcar resuelto</button>
    </div>
  `);
  const enviar = async (estado) => {
    const resolucion = document.getElementById('resolucion-texto').value.trim();
    try {
      await Api.adminResolverReclamo(id, { estado, resolucion });
      mostrarToast('Reclamo actualizado', 'success');
      cerrarModal();
      cargarReclamos();
    } catch (err) { mostrarToast(err.message, 'error'); }
  };
  document.getElementById('btn-marcar-revision').addEventListener('click', () => enviar('en_revision'));
  document.getElementById('btn-marcar-resuelto').addEventListener('click', () => enviar('resuelto'));
}

async function cargarPagosRetenidos() {
  const tbody = document.getElementById('tabla-pagos-retenidos');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Cargando...</td></tr>';
  try {
    const pedidos = await Api.adminPedidosRetenidos();
    if (pedidos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No hay pagos retenidos</td></tr>';
      return;
    }
    tbody.innerHTML = pedidos.map((p) => `
      <tr>
        <td>#${p.id.slice(0,8).toUpperCase()}</td>
        <td>${p.repartidor_nombre}</td>
        <td>${p.zona_entrega}</td>
        <td>${formatoSoles(p.delivery_fee)}</td>
        <td>${new Date(p.entregado_at).toLocaleString('es-PE')}</td>
        <td><button class="btn btn-success btn-sm" data-liberar="${p.id}">Liberar pago</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-liberar]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Confirmas que la entrega fue correcta y se debe pagar al repartidor?')) return;
      btn.disabled = true;
      try {
        await Api.adminLiberarPago(btn.dataset.liberar);
        mostrarToast('Pago liberado', 'success');
        cargarPagosRetenidos();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="6" class="form-error">${err.message}</td></tr>`;
  }
}

// ---------- Auditoria (conexiones del equipo) ----------
const ROL_LABELS = { admin: 'Admin', tienda: 'Tienda', repartidor: 'Repartidor' };

async function cargarAuditoria(rol = '') {
  const tbody = document.getElementById('tabla-auditoria');
  tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Cargando...</td></tr>';
  try {
    const registros = await Api.adminAuditoria(rol);
    if (registros.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Sin registros todavía</td></tr>';
      return;
    }
    tbody.innerHTML = registros.map((r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleString('es-PE')}</td>
        <td>${ROL_LABELS[r.rol] || r.rol}</td>
        <td>${r.nombre || '—'}</td>
        <td>${r.accion === 'login_ok' ? '<span class="badge badge-entregado">Exitoso</span>' : '<span class="badge badge-cancelado">Fallido</span>'}</td>
        <td>${r.ip || '—'}</td>
        <td class="text-sm text-muted" style="max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.user_agent || ''}">${r.user_agent || '—'}</td>
      </tr>
    `).join('');
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="6" class="form-error">${err.message}</td></tr>`;
  }
}

document.querySelectorAll('#filtro-auditoria .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#filtro-auditoria .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    cargarAuditoria(chip.dataset.rol);
  });
});

cargarResumen();
