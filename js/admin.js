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
  if (vista === 'reclamos') { cargarReclamos(); cargarPagosRetenidos(); cargarObservaciones(); }
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
    cont.innerHTML = pagos.map((pg) => {
      const items = pg.items || [];
      const tiendas = [...new Set(items.map((i) => i.tienda_nombre))];
      return `
      <div class="card card-pad mt-16">
        <div class="flex justify-between items-center">
          <div>
            <strong>${pg.cliente_nombre}</strong> · ${pg.cliente_telefono}
            <div class="text-sm text-muted">${pg.zona_entrega}</div>
          </div>
          <span class="tag">${pg.tipo}</span>
        </div>
        <div class="text-sm text-muted mt-8">Pedido #${pg.pedido_id.slice(0,8).toUpperCase()} · Ref. de pago: ${pg.referencia || '—'}</div>
        ${tiendas.length > 0 ? `<div class="text-sm mt-8"><strong>Tienda${tiendas.length > 1 ? 's' : ''}:</strong> ${tiendas.join(', ')}</div>` : ''}
        ${items.length > 0 ? `
          <div class="mt-8" style="border-top:1px solid var(--arena-300); padding-top:8px;">
            ${items.map((i) => `
              <div class="flex justify-between text-sm">
                <span>${i.cantidad}x ${i.nombre_producto}</span>
                <span class="text-muted">${formatoSoles(i.subtotal)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="flex justify-between items-center mt-8" style="border-top:1px solid var(--arena-300); padding-top:8px;">
          <span class="text-sm text-muted">Productos ${formatoSoles(pg.monto_productos)} + delivery ${formatoSoles(pg.delivery_fee)}</span>
          <strong>${formatoSoles(pg.monto_total)}</strong>
        </div>
        ${pg.comprobante_url ? `<a href="${uploadsUrl(pg.comprobante_url)}" target="_blank"><img src="${uploadsUrl(pg.comprobante_url)}" style="max-height:220px;border-radius:10px;margin-top:10px;"></a>` : ''}
        <div class="flex gap-8 mt-16">
          <button class="btn btn-success btn-sm w-full" data-confirmar="${pg.id}">✓ Confirmar</button>
          <button class="btn btn-danger btn-sm w-full" data-rechazar="${pg.id}">✕ Rechazar</button>
        </div>
      </div>
    `;
    }).join('');

    cont.querySelectorAll('[data-confirmar]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await Api.adminConfirmarPago(btn.dataset.confirmar);
        mostrarToast('Pago confirmado', 'success');
        cargarPagos();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
    cont.querySelectorAll('[data-rechazar]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!(await confirmModal('¿Rechazar este pago?', { peligro: true, textoAceptar: 'Rechazar' }))) return;
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
      <tr class="fila-repartidor" data-fila-repartidor="${r.id}" style="cursor:pointer;">
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

    tbody.querySelectorAll('[data-liquidar]').forEach((btn) => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await confirmModal('¿Marcar este pago como liquidado?'))) return;
      try {
        await Api.adminLiquidarRepartidor(btn.dataset.liquidar);
        mostrarToast('Pago liquidado', 'success');
        cargarRepartidores();
      } catch (err) { mostrarToast(err.message, 'error'); }
    }));
    tbody.querySelectorAll('[data-fila-repartidor]').forEach((fila) => fila.addEventListener('click', () => {
      toggleHistorialRepartidor(fila, fila.dataset.filaRepartidor);
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="6" class="form-error">${err.message}</td></tr>`;
  }
}

function labelCodigoEntrega(p) {
  if (p.estado === 'entregado' && p.entrega_observada) return '<span class="text-muted">Sin código (observado)</span>';
  if (p.estado === 'entregado') return `<strong>${p.pin_entrega}</strong>`;
  return '<span class="text-muted">—</span>';
}

function labelHistorialEstado(p) {
  if (p.estado === 'entregado' && p.entrega_observada) return '<span class="badge badge-pendiente_pago">Observado</span>';
  return `<span class="badge badge-${p.estado}">${labelEstado(p.estado)}</span>`;
}

async function toggleHistorialRepartidor(filaRepartidor, repartidorId) {
  const filaExistente = filaRepartidor.nextElementSibling;
  if (filaExistente && filaExistente.classList.contains('fila-historial-repartidor')) {
    filaExistente.remove();
    return;
  }
  document.querySelectorAll('.fila-historial-repartidor').forEach((f) => f.remove());

  const fila = document.createElement('tr');
  fila.className = 'fila-historial-repartidor';
  fila.innerHTML = `<td colspan="6"><p class="text-muted">Cargando historial...</p></td>`;
  filaRepartidor.after(fila);

  try {
    const pedidos = await Api.adminPedidosRepartidor(repartidorId);
    if (pedidos.length === 0) {
      fila.innerHTML = `<td colspan="6"><p class="text-muted">Este repartidor aún no tiene pedidos.</p></td>`;
      return;
    }
    fila.innerHTML = `
      <td colspan="6" style="padding:0;">
        <div class="table-wrap" style="box-shadow:none; border-radius:0; margin:4px 0 8px;">
          <table>
            <thead>
              <tr>
                <th>Pedido</th><th>Fecha</th><th>Estado</th>
                <th title="Codigo que el cliente le dio al repartidor. Sin codigo = se entrego sin validar o no se entrego">Código dado</th>
                <th>Costo total</th><th>% ganancia envío</th><th>Ganancia envío</th>
              </tr>
            </thead>
            <tbody>
              ${pedidos.map((p) => {
                const pct = Number(p.monto_total) > 0 ? ((Number(p.delivery_fee) / Number(p.monto_total)) * 100).toFixed(1) : '0.0';
                return `
                <tr class="fila-repartidor" data-ver-factura="${p.id}" style="cursor:pointer;">
                  <td>#${p.id.slice(0,8).toUpperCase()}</td>
                  <td>${new Date(p.created_at).toLocaleString('es-PE')}</td>
                  <td>${labelHistorialEstado(p)}</td>
                  <td>${labelCodigoEntrega(p)}</td>
                  <td>${formatoSoles(p.monto_total)}</td>
                  <td>${pct}%</td>
                  <td>${formatoSoles(p.delivery_fee)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </td>
    `;
    fila.querySelectorAll('[data-ver-factura]').forEach((tr) => tr.addEventListener('click', () => {
      abrirModalFacturaPedido(tr.dataset.verFactura);
    }));
  } catch (err) {
    fila.innerHTML = `<td colspan="6" class="form-error">${err.message}</td>`;
  }
}

// ---------- Ventana flotante: factura/resumen completo de un pedido ----------
async function abrirModalFacturaPedido(pedidoId) {
  abrirModal(`<p class="text-muted">Cargando factura...</p>`);
  try {
    const p = await Api.adminPedido(pedidoId);
    const tiendas = [...new Set(p.items.map((i) => i.tienda_nombre))];
    abrirModal(`
      <h3>Factura del pedido</h3>
      <p class="text-sm text-muted">#${p.id.slice(0,8).toUpperCase()} · ${labelHistorialEstado(p)}</p>

      <div class="card card-pad mt-16" style="background:var(--arena-100);">
        <div class="text-sm"><strong>Cliente:</strong> ${p.cliente_nombre} · ${p.cliente_telefono}</div>
        <div class="text-sm mt-8"><strong>Zona:</strong> ${p.zona_entrega}</div>
        ${p.referencia_entrega ? `<div class="text-sm mt-8"><strong>Referencia:</strong> ${p.referencia_entrega}</div>` : ''}
        <div class="text-sm mt-8"><strong>Tienda${tiendas.length > 1 ? 's' : ''}:</strong> ${tiendas.join(', ') || '—'}</div>
        <div class="text-sm mt-8"><strong>Repartidor:</strong> ${p.repartidor_nombre || '—'}</div>
      </div>

      <div class="mt-16">
        <h4 class="mb-0">Productos</h4>
        ${p.items.map((i) => `
          <div class="flex justify-between mt-8 text-sm">
            <div>
              <strong>${i.cantidad}x ${i.nombre_producto}</strong>
              <div class="text-muted">${i.tienda_nombre}</div>
            </div>
            <span>${formatoSoles(i.subtotal)}</span>
          </div>
        `).join('')}
        <hr class="divider">
        <div class="flex justify-between text-sm"><span>Productos</span><span>${formatoSoles(p.monto_productos)}</span></div>
        <div class="flex justify-between text-sm mt-8"><span>Delivery</span><span>${formatoSoles(p.delivery_fee)}</span></div>
        <div class="flex justify-between text-sm mt-8"><span>Comisión plataforma</span><span>${formatoSoles(p.comision_total)}</span></div>
        <div class="flex justify-between mt-8"><strong>Total</strong><strong>${formatoSoles(p.monto_total)}</strong></div>
      </div>

      <div class="mt-16">
        <h4 class="mb-0">Línea de tiempo</h4>
        <div class="text-sm text-muted mt-8">🕐 Creado: ${new Date(p.created_at).toLocaleString('es-PE')}</div>
        ${p.asignado_at ? `<div class="text-sm text-muted mt-8">🚴 Asignado: ${new Date(p.asignado_at).toLocaleString('es-PE')}</div>` : ''}
        ${p.recogido_at ? `<div class="text-sm text-muted mt-8">📦 Recogido: ${new Date(p.recogido_at).toLocaleString('es-PE')}</div>` : ''}
        ${p.entregado_at ? `<div class="text-sm text-muted mt-8">✅ Entregado: ${new Date(p.entregado_at).toLocaleString('es-PE')}</div>` : ''}
      </div>

      <div class="mt-16">
        <h4 class="mb-0">Código de entrega</h4>
        <div class="text-sm mt-8">${labelCodigoEntrega(p)}</div>
        ${p.pago_retenido ? `<div class="text-sm mt-8" style="color:var(--rojo-alerta);">⚠️ Pago del repartidor retenido, pendiente de revisión</div>` : ''}
      </div>

      ${p.pagos && p.pagos.length > 0 ? `
        <div class="mt-16">
          <h4 class="mb-0">Pagos</h4>
          ${p.pagos.map((pg) => `
            <div class="text-sm mt-8">${pg.tipo} · ${pg.estado} · Ref: ${pg.referencia || '—'} · ${new Date(pg.created_at).toLocaleString('es-PE')}</div>
          `).join('')}
        </div>
      ` : ''}
    `);
  } catch (err) {
    abrirModal(`<p class="form-error">${err.message}</p>`);
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

const ESTADO_CUENTA_LABELS = { activo: 'Activa', suspendido: 'Suspendida', bloqueado: 'Bloqueada' };

async function cargarUsuarios() {
  const tbody = document.getElementById('tabla-usuarios');
  tbody.innerHTML = '<tr><td colspan="10" class="text-muted">Cargando...</td></tr>';
  try {
    const usuarios = await Api.adminUsuarios();
    usuariosCache = usuarios;
    if (usuarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-muted">Aún no hay cuentas de clientes</td></tr>';
      return;
    }
    tbody.innerHTML = usuarios.map((u) => `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.email || '—'}</td>
        <td>${u.telefono}</td>
        <td>${u.zona || '—'}</td>
        <td>${u.compras_efectivas}</td>
        <td>${formatoSoles(u.total_gastado)}</td>
        <td>${u.incidentes > 0 ? `<span class="tag" style="background:#fde3e1;color:var(--rojo-alerta);">⚠️ ${u.incidentes}</span>` : '0'}</td>
        <td><span class="badge badge-${u.estado_cuenta}">${ESTADO_CUENTA_LABELS[u.estado_cuenta] || u.estado_cuenta}</span></td>
        <td>${new Date(u.created_at).toLocaleDateString('es-PE')}</td>
        <td><button class="btn btn-outline btn-sm" data-editar-usuario="${u.id}">Ver / Editar</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-editar-usuario]').forEach((btn) => btn.addEventListener('click', () => {
      const u = usuariosCache.find((x) => x.id === btn.dataset.editarUsuario);
      if (u) abrirModalEditarUsuario(u);
    }));
  } catch (err) {
    if (!manejarError401(err)) tbody.innerHTML = `<tr><td colspan="10" class="form-error">${err.message}</td></tr>`;
  }
}

const MOTIVO_INCIDENTE_LABELS = { falta_respeto: 'Falta de respeto', acoso: 'Acoso', otro: 'Otro' };

async function abrirModalEditarUsuario(u) {
  const [zonaHtml, incidentes] = await Promise.all([
    zonaOptionsHtml(u.zona || ''),
    Api.adminIncidentesUsuario(u.id).catch(() => []),
  ]);

  const suspendidoHastaTexto = u.suspendido_hasta ? new Date(u.suspendido_hasta).toLocaleDateString('es-PE') : null;

  abrirModal(`
    <h3>${u.nombre}</h3>
    <p class="text-sm text-muted">${u.total_pedidos} pedido(s) · ${u.compras_efectivas} compra(s) efectiva(s) · ${formatoSoles(u.total_gastado)} comprado</p>

    <div class="card card-pad mt-16" style="background:var(--arena-100);">
      <div class="flex justify-between items-center">
        <div>
          <strong>Estado de la cuenta:</strong>
          <span class="badge badge-${u.estado_cuenta}">${ESTADO_CUENTA_LABELS[u.estado_cuenta] || u.estado_cuenta}</span>
        </div>
      </div>
      ${suspendidoHastaTexto ? `<div class="text-sm text-muted mt-8">Suspendida hasta: ${suspendidoHastaTexto}</div>` : ''}
      ${u.estado_cuenta_motivo ? `<div class="text-sm text-muted mt-8">Motivo: ${u.estado_cuenta_motivo}</div>` : ''}
      <div class="flex gap-8 mt-8" style="flex-wrap:wrap;">
        ${u.estado_cuenta !== 'suspendido' ? `<button class="btn btn-outline btn-sm" id="btn-suspender-usuario">⏸️ Suspender (5 días hábiles)</button>` : ''}
        ${u.estado_cuenta !== 'bloqueado' ? `<button class="btn btn-danger btn-sm" id="btn-bloquear-usuario">🚫 Bloquear</button>` : ''}
        ${u.estado_cuenta !== 'activo' ? `<button class="btn btn-success btn-sm" id="btn-reactivar-usuario">✓ Reactivar</button>` : ''}
      </div>
    </div>

    <div class="mt-16">
      <div class="flex justify-between items-center">
        <h4 class="mb-0">Incidentes (${incidentes.length})</h4>
        <button class="btn btn-outline btn-sm" id="btn-reportar-incidente">+ Reportar</button>
      </div>
      <div id="lista-incidentes" class="mt-8">
        ${incidentes.length === 0 ? '<p class="text-sm text-muted">Sin incidentes registrados.</p>' : incidentes.map((i) => `
          <div class="text-sm mt-8" style="border-bottom:1px solid var(--arena-300); padding-bottom:8px;">
            <strong>${MOTIVO_INCIDENTE_LABELS[i.tipo] || i.tipo}</strong> · ${new Date(i.created_at).toLocaleString('es-PE')}
            ${i.descripcion ? `<div class="text-muted">${i.descripcion}</div>` : ''}
            <div class="text-muted">Reportado por: ${i.reportado_por_nombre || i.reportado_por_rol || '—'}</div>
          </div>
        `).join('')}
      </div>
      <div id="form-incidente" class="hidden mt-8">
        <div class="form-grupo">
          <label>Tipo</label>
          <select id="inc-tipo">
            ${Object.entries(MOTIVO_INCIDENTE_LABELS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-grupo"><label>Descripción</label><textarea id="inc-descripcion" placeholder="¿Qué pasó?"></textarea></div>
        <button class="btn btn-primary btn-block btn-sm" id="btn-guardar-incidente">Guardar incidente</button>
      </div>
    </div>

    <hr class="divider">
    <div class="form-grupo"><label>Nombre</label><input id="eu-nombre" value="${u.nombre}"></div>
    <div class="form-grupo"><label>Correo</label><input id="eu-email" type="email" value="${u.email || ''}"></div>
    <div class="form-grupo"><label>Teléfono</label><input id="eu-telefono" value="${u.telefono}"></div>
    <div class="form-grupo"><label>Zona</label><select id="eu-zona">${zonaHtml}</select></div>
    <hr class="divider">
    <div class="form-grupo"><label>Nueva contraseña (opcional)</label><input id="eu-password" type="text" placeholder="Dejar vacío para no cambiar"></div>
    <div id="eu-error" class="form-error hidden"></div>
    <button class="btn btn-primary btn-block" id="btn-guardar-usuario">Guardar cambios</button>
  `);

  const btnSuspender = document.getElementById('btn-suspender-usuario');
  if (btnSuspender) btnSuspender.addEventListener('click', async () => {
    if (!(await confirmModal('¿Suspender esta cuenta por 5 días hábiles?', { peligro: true, textoAceptar: 'Suspender' }))) return;
    const motivo = (await promptModal('Motivo de la suspensión (opcional)', { titulo: 'Suspender cuenta' })) || '';
    try {
      const r = await Api.adminSuspenderUsuario(u.id, motivo);
      mostrarToast(`Cuenta suspendida hasta el ${new Date(r.suspendido_hasta).toLocaleDateString('es-PE')}`, 'success');
      cerrarModal();
      cargarUsuarios();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });

  const btnBloquear = document.getElementById('btn-bloquear-usuario');
  if (btnBloquear) btnBloquear.addEventListener('click', async () => {
    if (!(await confirmModal('¿Bloquear esta cuenta? Ya no podrá iniciar sesión, pero su historial se conserva.', { peligro: true, textoAceptar: 'Bloquear' }))) return;
    const motivo = (await promptModal('Motivo del bloqueo (opcional)', { titulo: 'Bloquear cuenta' })) || '';
    try {
      await Api.adminBloquearUsuario(u.id, motivo);
      mostrarToast('Cuenta bloqueada', 'success');
      cerrarModal();
      cargarUsuarios();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });

  const btnReactivar = document.getElementById('btn-reactivar-usuario');
  if (btnReactivar) btnReactivar.addEventListener('click', async () => {
    try {
      await Api.adminReactivarUsuario(u.id);
      mostrarToast('Cuenta reactivada', 'success');
      cerrarModal();
      cargarUsuarios();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });

  document.getElementById('btn-reportar-incidente').addEventListener('click', () => {
    document.getElementById('form-incidente').classList.remove('hidden');
  });
  document.getElementById('btn-guardar-incidente').addEventListener('click', async () => {
    const tipo = document.getElementById('inc-tipo').value;
    const descripcion = document.getElementById('inc-descripcion').value.trim();
    try {
      await Api.adminReportarIncidente(u.id, tipo, descripcion);
      mostrarToast('Incidente registrado', 'success');
      cerrarModal();
      await cargarUsuarios();
      const uActualizado = usuariosCache.find((x) => x.id === u.id);
      abrirModalEditarUsuario(uActualizado || u);
    } catch (err) { mostrarToast(err.message, 'error'); }
  });

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
  trato_del_personal: 'Trato del personal',
  otro: 'Otro',
};
const ESTADO_RECLAMO_LABELS = { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto' };

const ESTADOS_RECLAMO = ['abierto', 'en_revision', 'resuelto'];
let vistaReclamos = 'tarjetas';
let filtroEstadoReclamos = '';
let filtroOrigenReclamos = 'todos';
let todosReclamosCache = null;

// Los reclamos vienen de 3 canales distintos: el reclamo ligado a un pedido
// (desde la app o registrado por telefono/whatsapp), y el Libro de
// Reclamaciones Virtual publico, que a su vez distingue Reclamo de Queja
// (exigencia del Codigo de Proteccion y Defensa del Consumidor).
function origenReclamoInfo(r) {
  if (r.origen === 'libro_reclamaciones') {
    return r.tipo_libro === 'queja'
      ? { clave: 'libro_queja', label: '📖 Libro: Queja' }
      : { clave: 'libro_reclamo', label: '📖 Libro: Reclamo' };
  }
  if (r.origen === 'admin') return { clave: 'pedido', label: '☎️ Registrado por admin' };
  return { clave: 'pedido', label: '📱 Desde la app' };
}

function plazoReclamoHtml(r) {
  if (r.estado === 'resuelto') return '';
  const esLibro = r.origen === 'libro_reclamaciones';
  // El libro de reclamaciones tiene plazo legal en dias CALENDARIO (30, segun
  // el Codigo de Proteccion y Defensa del Consumidor); el reclamo ligado a un
  // pedido usa un SLA interno en dias HABILES (7) que ya calcula el backend.
  let dias, unidad;
  if (esLibro) {
    if (!r.plazo_respuesta_hasta) return '';
    dias = Math.ceil((new Date(r.plazo_respuesta_hasta) - new Date()) / (24 * 60 * 60 * 1000));
    unidad = dias === 1 ? 'día calendario' : 'días calendario';
  } else {
    dias = r.dias_habiles_restantes;
    if (dias === null || dias === undefined) return '';
    unidad = dias === 1 ? 'día hábil' : 'días hábiles';
  }
  const urgente = dias <= (esLibro ? 3 : 1);
  const texto = dias <= 0 ? 'Plazo vencido' : `${dias} ${unidad} para responder`;
  return `<span style="display:inline-block; font-size:12px; font-weight:700; padding:4px 10px; border-radius:20px; background:${urgente ? '#fde3e1' : '#fff2e0'};color:${urgente ? 'var(--rojo-alerta)' : '#b7690a'};">⏳ ${texto}</span>`;
}

function tarjetaReclamoHtml(r) {
  const origen = origenReclamoInfo(r);
  const esLibro = origen.clave !== 'pedido';
  return `
    <div class="card card-pad-sm reclamo-card" data-estado="${r.estado}">
      <div class="flex justify-between items-center" style="flex-wrap:wrap; gap:6px;">
        <div class="text-sm text-muted">${new Date(r.created_at).toLocaleString('es-PE')}</div>
        <span class="badge badge-${r.estado}">${ESTADO_RECLAMO_LABELS[r.estado] || r.estado}</span>
      </div>
      <div class="mt-6"><span class="tag" style="${esLibro ? 'background:#eef0ff;color:#5b52d6;' : ''}">${origen.label}</span></div>
      <div class="mt-6"><strong>${r.nombre_reclamante || r.cliente_nombre || 'Sin nombre'}</strong>${r.dni_ce ? ` · ${(r.tipo_documento || '').toUpperCase()} ${r.dni_ce}` : ''}</div>
      ${r.direccion_reclamante ? `<div class="text-sm text-muted mt-6">📍 ${r.direccion_reclamante}</div>` : ''}
      <div class="text-sm text-muted mt-6">
        ${r.telefono_contacto ? `📞 ${r.telefono_contacto}${r.permite_whatsapp ? ' (acepta WhatsApp)' : ''}` : ''}
        ${r.email_contacto ? ` · ✉️ ${r.email_contacto}` : ''}
      </div>
      ${r.cuenta_nombre ? `<div class="text-sm text-muted mt-6">Cuenta registrada: ${r.cuenta_nombre} (${r.cuenta_email || 'sin correo'})</div>` : ''}
      ${r.pedido_id ? `<div class="text-sm text-muted mt-6">Pedido #${r.pedido_id.slice(0,8).toUpperCase()} · ${r.pedido_estado || ''}</div>` : ''}
      ${esLibro ? '' : `<div class="mt-6"><span class="tag">${MOTIVO_RECLAMO_LABELS[r.motivo] || r.motivo}</span></div>`}
      ${r.bien_contratado ? `<div class="text-sm mt-6"><strong>Bien contratado:</strong> ${r.bien_contratado}</div>` : ''}
      ${r.descripcion ? `<div class="text-sm mt-6">${r.descripcion}</div>` : ''}
      ${r.solicitud_consumidor ? `<div class="text-sm mt-6"><strong>Solicita:</strong> ${r.solicitud_consumidor}</div>` : ''}
      ${r.imagenes && r.imagenes.length > 0 ? `
        <div class="flex gap-6 mt-6" style="flex-wrap:wrap;">
          ${r.imagenes.map((url) => `<a href="${url}" target="_blank"><img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;"></a>`).join('')}
        </div>
      ` : ''}
      ${r.resolucion ? `<div class="text-sm mt-6" style="color:var(--verde-palma);"><strong>Resolución:</strong> ${r.resolucion}</div>` : ''}
      <div class="flex justify-between items-center mt-6">
        <div>${plazoReclamoHtml(r)}</div>
        ${r.estado !== 'resuelto' ? `<button class="btn btn-secondary btn-xs" data-resolver="${r.id}">Resolver</button>` : ''}
      </div>
    </div>
  `;
}

function renderReclamosComoTarjetas(cont, reclamos) {
  cont.innerHTML = `<div class="grid-reclamos-tarjetas">${reclamos.map(tarjetaReclamoHtml).join('')}</div>`;
}

function renderReclamosComoTabla(cont, reclamos) {
  cont.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Origen</th><th>Reclamante</th><th>Motivo</th><th>Pedido</th><th>Estado</th><th>Plazo</th><th>Acción</th></tr></thead>
        <tbody>
          ${reclamos.map((r) => {
            const origen = origenReclamoInfo(r);
            return `
            <tr>
              <td>${new Date(r.created_at).toLocaleDateString('es-PE')}</td>
              <td>${origen.label}</td>
              <td>${r.nombre_reclamante || r.cliente_nombre || 'Sin nombre'}</td>
              <td>${origen.clave === 'pedido' ? (MOTIVO_RECLAMO_LABELS[r.motivo] || r.motivo) : (r.bien_contratado || '—')}</td>
              <td>${r.pedido_id ? `#${r.pedido_id.slice(0,8).toUpperCase()}` : '—'}</td>
              <td><span class="badge badge-${r.estado}">${ESTADO_RECLAMO_LABELS[r.estado] || r.estado}</span></td>
              <td>${plazoReclamoHtml(r) || '—'}</td>
              <td>${r.estado !== 'resuelto' ? `<button class="btn btn-secondary btn-xs" data-resolver="${r.id}">Resolver</button>` : ''}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderReclamosComoEstados(cont, reclamos) {
  const columnas = ESTADOS_RECLAMO.map((estado) => ({ estado, items: reclamos.filter((r) => r.estado === estado) }))
    .filter((col) => col.items.length > 0);
  if (columnas.length === 0) {
    cont.innerHTML = '<p class="text-muted">Sin reclamos por ahora.</p>';
    return;
  }
  cont.innerHTML = `
    <div class="tablero-estados">
      ${columnas.map((col) => `
        <div class="tablero-columna">
          <div class="tablero-columna-titulo">
            <span class="badge badge-${col.estado}">${ESTADO_RECLAMO_LABELS[col.estado]}</span>
            <span class="text-muted">${col.items.length}</span>
          </div>
          <div class="tablero-columna-lista">${col.items.map(tarjetaReclamoHtml).join('')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function cargarReclamos(estado = filtroEstadoReclamos) {
  filtroEstadoReclamos = estado;
  const cont = document.getElementById('lista-reclamos');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    todosReclamosCache = await Api.adminReclamos(estado);
    renderReclamos();
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

function renderReclamos() {
  const cont = document.getElementById('lista-reclamos');
  const reclamos = filtroOrigenReclamos === 'todos'
    ? todosReclamosCache
    : todosReclamosCache.filter((r) => origenReclamoInfo(r).clave === filtroOrigenReclamos);

  if (todosReclamosCache.length === 0) {
    cont.innerHTML = '<p class="text-muted">Sin reclamos por ahora.</p>';
    return;
  }
  if (reclamos.length === 0) {
    cont.innerHTML = '<p class="text-muted">No hay reclamos de ese tipo.</p>';
    return;
  }
  if (vistaReclamos === 'tabla') renderReclamosComoTabla(cont, reclamos);
  else if (vistaReclamos === 'estados') renderReclamosComoEstados(cont, reclamos);
  else renderReclamosComoTarjetas(cont, reclamos);
  cont.querySelectorAll('[data-resolver]').forEach((btn) => btn.addEventListener('click', () => abrirModalResolverReclamo(btn.dataset.resolver)));
}

document.querySelectorAll('#filtro-vista-reclamos .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    vistaReclamos = chip.dataset.vista;
    document.querySelectorAll('#filtro-vista-reclamos .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    renderReclamos();
  });
});

document.querySelectorAll('#filtro-origen-reclamos .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    filtroOrigenReclamos = chip.dataset.origen;
    document.querySelectorAll('#filtro-origen-reclamos .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    renderReclamos();
  });
});

// ---------- Registrar reclamo (intake manual: telefono/WhatsApp) ----------
document.getElementById('btn-registrar-reclamo').addEventListener('click', () => abrirModalRegistrarReclamo());

function abrirModalRegistrarReclamo() {
  let cuentaEncontrada = null;
  const imagenesSubidas = [];

  abrirModal(`
    <h3>Registrar reclamo</h3>
    <p class="text-sm text-muted">Para reclamos recibidos por teléfono, WhatsApp o en persona.</p>

    <div class="form-grupo mt-16"><label>Tipo de documento</label>
      <select id="rr-tipo-doc"><option value="dni">DNI</option><option value="ce">Carné de Extranjería (CE)</option></select>
    </div>
    <div class="form-grupo"><label>Número de documento</label>
      <div class="flex" style="gap:8px;">
        <input id="rr-dni-ce" inputmode="numeric" style="flex:1;">
        <button type="button" class="btn btn-outline btn-sm" id="rr-buscar-doc">Buscar</button>
      </div>
    </div>
    <div class="form-grupo"><label>Nombre</label><input id="rr-nombre" placeholder="Se completa automáticamente al buscar"></div>
    <div class="form-grupo"><label>Teléfono de contacto</label><input id="rr-telefono"></div>
    <div class="form-grupo flex justify-between items-center">
      <label class="mb-0">¿Acepta que lo contactemos por WhatsApp?</label>
      <span class="toggle-switch"><input type="checkbox" id="rr-whatsapp"><span class="toggle-slider"></span></span>
    </div>
    <div class="form-grupo"><label>Correo (opcional)</label>
      <div class="flex" style="gap:8px;">
        <input id="rr-email" type="email" style="flex:1;">
        <button type="button" class="btn btn-outline btn-sm" id="rr-buscar-cuenta">Buscar cuenta</button>
      </div>
      <p class="text-sm text-muted mt-8" id="rr-cuenta-resultado"></p>
    </div>
    <div class="form-grupo"><label>ID del pedido (opcional)</label><input id="rr-pedido-id" placeholder="Cópialo de la pestaña Pedidos"></div>
    <div class="form-grupo"><label>Motivo</label>
      <select id="rr-motivo">${Object.entries(MOTIVO_RECLAMO_LABELS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
    </div>
    <div class="form-grupo"><label>Descripción</label><textarea id="rr-descripcion" placeholder="¿Qué pasó?"></textarea></div>
    <div class="form-grupo"><label>Imágenes como evidencia (opcional)</label><input type="file" id="rr-imagenes" accept="image/*" multiple></div>
    <div id="rr-error" class="form-error hidden"></div>
    <button class="btn btn-primary btn-block" id="btn-guardar-reclamo">Registrar reclamo</button>
  `);

  document.getElementById('rr-buscar-doc').addEventListener('click', async () => {
    const tipo = document.getElementById('rr-tipo-doc').value;
    const numero = document.getElementById('rr-dni-ce').value.trim();
    const btn = document.getElementById('rr-buscar-doc');
    if (!numero) { mostrarToast('Ingresa el número de documento', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Buscando...';
    try {
      const { nombre } = tipo === 'dni' ? await Api.consultarDni(numero) : await Api.consultarCe(numero);
      document.getElementById('rr-nombre').value = nombre || '';
      mostrarToast(nombre ? 'Nombre encontrado' : 'No se encontró, ingresa el nombre manualmente', nombre ? 'success' : 'error');
    } catch (err) {
      mostrarToast(err.message || 'No se pudo consultar', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Buscar';
    }
  });

  document.getElementById('rr-buscar-cuenta').addEventListener('click', async () => {
    const email = document.getElementById('rr-email').value.trim();
    const resultado = document.getElementById('rr-cuenta-resultado');
    if (!email) { mostrarToast('Ingresa un correo', 'error'); return; }
    try {
      const cuenta = await Api.adminBuscarUsuarioPorEmail(email);
      cuentaEncontrada = cuenta;
      if (cuenta) {
        resultado.textContent = `✓ Cuenta encontrada: ${cuenta.nombre} · ${cuenta.telefono}`;
        resultado.style.color = 'var(--verde-palma)';
        if (!document.getElementById('rr-nombre').value) document.getElementById('rr-nombre').value = cuenta.nombre;
        if (!document.getElementById('rr-telefono').value) document.getElementById('rr-telefono').value = cuenta.telefono;
      } else {
        resultado.textContent = 'No hay ninguna cuenta registrada con ese correo.';
        resultado.style.color = 'var(--tinta-300)';
      }
    } catch (err) { mostrarToast(err.message, 'error'); }
  });

  document.getElementById('btn-guardar-reclamo').addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-reclamo');
    const errBox = document.getElementById('rr-error');
    errBox.classList.add('hidden');
    const nombre_reclamante = document.getElementById('rr-nombre').value.trim();
    const telefono_contacto = document.getElementById('rr-telefono').value.trim();
    if (!nombre_reclamante || !telefono_contacto) {
      errBox.textContent = 'Nombre y teléfono de contacto son obligatorios';
      errBox.classList.remove('hidden');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    try {
      const archivos = Array.from(document.getElementById('rr-imagenes').files || []);
      for (const file of archivos) {
        const fd = new FormData();
        fd.append('imagen', file);
        const { url } = await Api.adminSubirImagen(fd, 'reclamos');
        imagenesSubidas.push(url);
      }
      await Api.adminRegistrarReclamo({
        pedido_id: document.getElementById('rr-pedido-id').value.trim() || null,
        usuario_id: cuentaEncontrada ? cuentaEncontrada.id : null,
        motivo: document.getElementById('rr-motivo').value,
        descripcion: document.getElementById('rr-descripcion').value.trim(),
        tipo_documento: document.getElementById('rr-tipo-doc').value,
        dni_ce: document.getElementById('rr-dni-ce').value.trim(),
        nombre_reclamante,
        telefono_contacto,
        email_contacto: document.getElementById('rr-email').value.trim(),
        permite_whatsapp: document.getElementById('rr-whatsapp').checked,
        imagenes: imagenesSubidas,
      });
      mostrarToast('Reclamo registrado', 'success');
      cerrarModal();
      cargarReclamos();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Registrar reclamo';
    }
  });
}

// ---------- Observaciones de repartidores ----------
const TIPO_OBSERVACION_LABELS = {
  entrega_incorrecta: 'Entrega incorrecta',
  producto_danado: 'Producto dañado',
  falta_respeto: 'Falta de respeto',
  acoso: 'Acoso',
  otro: 'Otro',
};

async function cargarObservaciones() {
  const cont = document.getElementById('lista-observaciones');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const obs = await Api.adminObservacionesRepartidor('pendiente_revision');
    if (obs.length === 0) {
      cont.innerHTML = '<p class="text-muted">No hay observaciones pendientes de revisión.</p>';
      return;
    }
    cont.innerHTML = obs.map((o) => `
      <div class="card card-pad-sm mt-6">
        <div class="flex justify-between items-center">
          <div class="text-sm text-muted">${new Date(o.created_at).toLocaleString('es-PE')} · Repartidor: ${o.repartidor_nombre}</div>
          <span class="tag" style="background:${o.dirigido_a === 'cliente' ? '#fde3e1' : '#fff2e0'};color:${o.dirigido_a === 'cliente' ? 'var(--rojo-alerta)' : '#b7690a'};">
            Sobre ${o.dirigido_a === 'cliente' ? 'el cliente' : 'la tienda'}
          </span>
        </div>
        <div class="mt-6"><strong>${TIPO_OBSERVACION_LABELS[o.tipo] || o.tipo}</strong> · Pedido #${o.pedido_id.slice(0,8).toUpperCase()} · Cliente: ${o.cliente_nombre}</div>
        ${o.descripcion ? `<div class="text-sm mt-6">${o.descripcion}</div>` : ''}
        <div class="flex gap-6 mt-6">
          <button class="btn btn-outline btn-xs w-full" data-descartar-obs="${o.id}">Descartar</button>
          <button class="btn btn-primary btn-xs w-full" data-confirmar-obs="${o.id}">Confirmar</button>
        </div>
      </div>
    `).join('');
    cont.querySelectorAll('[data-confirmar-obs]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await Api.adminConfirmarObservacion(btn.dataset.confirmarObs);
        mostrarToast(r.accion_automatica ? `Confirmado. Cuenta del cliente: ${r.accion_automatica}` : 'Observación confirmada', 'success');
        cargarObservaciones();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
    cont.querySelectorAll('[data-descartar-obs]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await Api.adminDescartarObservacion(btn.dataset.descartarObs);
        mostrarToast('Observación descartada', 'success');
        cargarObservaciones();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
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
      if (!(await confirmModal('¿Confirmas que la entrega fue correcta y se debe pagar al repartidor?'))) return;
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
