if (!localStorage.getItem('express_token_tienda')) {
  location.href = 'login.html';
}
document.getElementById('tienda-nombre').textContent = localStorage.getItem('express_nombre_tienda') || '';

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('express_token_tienda');
  location.href = 'login.html';
});

habilitarBuscarDni('tp-dni', 'tp-nombre-titular', 'tp-buscar-dni');

// ---------- Disponibilidad (pausa temporal: oculta los productos a los clientes) ----------
function actualizarEtiquetaDisponible(disponible) {
  document.getElementById('disponible-label').textContent = disponible ? 'Disponible' : 'No disponible';
}
async function cargarDisponibilidad() {
  try {
    const perfil = await Api.tiendaPerfil();
    document.getElementById('toggle-disponible').checked = perfil.disponible;
    actualizarEtiquetaDisponible(perfil.disponible);
  } catch (err) { manejarError401(err); }
}
document.getElementById('toggle-disponible').addEventListener('change', async (e) => {
  try {
    await Api.tiendaDisponibilidad(e.target.checked);
    actualizarEtiquetaDisponible(e.target.checked);
    mostrarToast(e.target.checked ? 'Ahora estás disponible' : 'Ya no estás disponible', 'success');
  } catch (err) { mostrarToast(err.message, 'error'); }
});

function manejarError401(err) {
  if (err.status === 401 || err.status === 403) {
    localStorage.removeItem('express_token_tienda');
    location.href = 'login.html';
    return true;
  }
  return false;
}

const TITULOS = { pedidos: 'Pedidos', productos: 'Mis productos', perfil: 'Mi perfil', conectividad: 'Conectividad' };

function irAVista(vista) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${vista}`).classList.remove('hidden');
  document.querySelectorAll('.panel-link[data-view]').forEach((l) => l.classList.toggle('activo', l.dataset.view === vista));
  document.getElementById('titulo-vista').textContent = TITULOS[vista];
  document.getElementById('filtros-pedidos-tienda').classList.toggle('hidden', vista !== 'pedidos');
  if (vista === 'pedidos') cargarPedidos();
  if (vista === 'productos') cargarProductos();
  if (vista === 'perfil') cargarPerfilTienda();
  if (vista === 'conectividad') cargarConectividad('tienda', 'lista-sesiones', 'btn-cerrar-otras-sesiones');
}
document.querySelectorAll('.panel-link[data-view]').forEach((link) => link.addEventListener('click', () => irAVista(link.dataset.view)));

function abrirModal(html, ancho = false) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box${ancho ? ' modal-box-ancho' : ''}">${html}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') cerrarModal(); });
}
function cerrarModal() { document.getElementById('modal-root').innerHTML = ''; }

// ---------- Pedidos ----------
function esMismoDiaPedido(fechaA, fechaB) {
  return fechaA.getFullYear() === fechaB.getFullYear()
    && fechaA.getMonth() === fechaB.getMonth()
    && fechaA.getDate() === fechaB.getDate();
}

// Solo los estados que la tienda realmente puede ver (el backend ya excluye
// pendiente_pago/pago_rechazado de /tienda/pedidos).
const ESTADOS_PEDIDO_TIENDA = ['pagado', 'preparando', 'listo_recoger', 'recogido', 'entregado', 'cancelado', 'rechazado_en_entrega'];

document.getElementById('filtro-estado-pedidos-tienda').innerHTML = [
  '<option value="todos">Todos los estados</option>',
  ...ESTADOS_PEDIDO_TIENDA.map((e) => `<option value="${e}">${labelEstado(e)}</option>`),
].join('');

let rangoFechaPedidosTienda = 'hoy';
let filtroEstadoPedidosTienda = 'todos';
let vistaPedidosTienda = 'tarjetas';
let todosPedidosTiendaCache = null;

async function cargarPedidos() {
  const cont = document.getElementById('lista-pedidos-tienda');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    todosPedidosTiendaCache = await Api.tiendaPedidos();
    renderPedidosTiendaFiltrados();
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

function tarjetaPedidoTiendaHtml(i) {
  return `
    <div class="card card-pad-sm pedido-card" data-estado="${i.pedido_estado}">
      <div class="flex justify-between items-center">
        <div>
          <strong>${i.cantidad}x ${i.nombre_producto}</strong>
          <div class="text-sm text-muted">#${i.pedido_id.slice(0,8).toUpperCase()} · ${i.zona_entrega}</div>
        </div>
        <span class="badge badge-${i.pedido_estado}">${labelEstado(i.pedido_estado)}</span>
      </div>
      <div class="mt-6">
        <div class="entrega-info-row">👤 <span>${i.cliente_nombre}</span></div>
        ${i.referencia_entrega ? `<div class="entrega-info-row text-muted">💬 <span>${i.referencia_entrega}</span></div>` : ''}
      </div>
      <div class="flex gap-6 mt-6">
        <a href="tel:${i.cliente_telefono}" class="btn btn-ghost btn-xs w-full">📞 Llamar</a>
        <a href="https://wa.me/51${i.cliente_telefono}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-xs w-full">💬 WhatsApp</a>
        ${i.lat_entrega && i.lng_entrega ? `
          <a href="https://www.google.com/maps?q=${i.lat_entrega},${i.lng_entrega}" target="_blank" rel="noopener" class="btn btn-outline btn-xs" style="flex:0 0 44px;" title="Ver ubicación del cliente">🗺️</a>
        ` : ''}
      </div>
      <div class="flex justify-between items-center mt-6">
        <span class="pedido-precio">${formatoSoles(i.subtotal)}</span>
        ${accionPedidoTiendaHtml(i)}
      </div>
    </div>
  `;
}

function accionPedidoTiendaHtml(i) {
  if (i.pedido_estado === 'cancelado') return '<span class="tag" style="background:#f0f0f0;color:var(--tinta-300);">✕ Cancelado por el cliente</span>';
  if (i.estado_tienda === 'listo') return '<span class="tag" style="background:#e9f9ee;color:var(--verde-palma);">✓ Listo para recoger</span>';
  if (i.estado_tienda === 'confirmado') return `<button class="btn btn-success btn-xs" data-listo="${i.pedido_id}|${i.item_id}">Marcar listo</button>`;
  return `<button class="btn btn-primary btn-xs" data-confirmar="${i.pedido_id}|${i.item_id}">Confirmar pedido</button>`;
}

function renderPedidosComoTarjetas(cont, items) {
  cont.innerHTML = `<div class="grid-pedidos-tarjetas">${items.map(tarjetaPedidoTiendaHtml).join('')}</div>`;
}

function renderPedidosComoTabla(cont, items) {
  cont.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Producto</th><th>Pedido</th><th>Cliente</th><th>Zona</th><th>Estado</th><th>Precio</th><th>Contacto</th><th>Acción</th></tr></thead>
        <tbody>
          ${items.map((i) => `
            <tr>
              <td>${i.cantidad}x ${i.nombre_producto}</td>
              <td>#${i.pedido_id.slice(0,8).toUpperCase()}</td>
              <td>${i.cliente_nombre}</td>
              <td>${i.zona_entrega}</td>
              <td><span class="badge badge-${i.pedido_estado}">${labelEstado(i.pedido_estado)}</span></td>
              <td>${formatoSoles(i.subtotal)}</td>
              <td>
                <div class="flex gap-6">
                  <a href="tel:${i.cliente_telefono}" class="btn btn-ghost btn-xs" title="Llamar">📞</a>
                  <a href="https://wa.me/51${i.cliente_telefono}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-xs" title="WhatsApp">💬</a>
                  ${i.lat_entrega && i.lng_entrega ? `<a href="https://www.google.com/maps?q=${i.lat_entrega},${i.lng_entrega}" target="_blank" rel="noopener" class="btn btn-outline btn-xs" title="Ver ubicación">🗺️</a>` : ''}
                </div>
              </td>
              <td>${accionPedidoTiendaHtml(i)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPedidosComoEstados(cont, items) {
  const columnas = ESTADOS_PEDIDO_TIENDA.map((estado) => ({ estado, items: items.filter((i) => i.pedido_estado === estado) }))
    .filter((col) => col.items.length > 0);
  if (columnas.length === 0) {
    cont.innerHTML = '<p class="text-muted">No hay pedidos en ese rango.</p>';
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
          <div class="tablero-columna-lista">${col.items.map(tarjetaPedidoTiendaHtml).join('')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function enlazarAccionesPedidosTienda(cont) {
  cont.querySelectorAll('[data-confirmar]').forEach((btn) => btn.addEventListener('click', async () => {
    const [pedidoId, itemId] = btn.dataset.confirmar.split('|');
    btn.disabled = true;
    try {
      await Api.tiendaConfirmarItem(pedidoId, itemId);
      mostrarToast('Pedido confirmado, ¡a prepararlo!', 'success');
      cargarPedidos();
    } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
  }));
  cont.querySelectorAll('[data-listo]').forEach((btn) => btn.addEventListener('click', async () => {
    const [pedidoId, itemId] = btn.dataset.listo.split('|');
    btn.disabled = true;
    try {
      await Api.tiendaMarcarListo(pedidoId, itemId);
      mostrarToast('Marcado como listo', 'success');
      cargarPedidos();
    } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
  }));
}

function renderPedidosTiendaFiltrados() {
  const cont = document.getElementById('lista-pedidos-tienda');
  const ahora = new Date();
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);

  const items = todosPedidosTiendaCache.filter((i) => {
    if (filtroEstadoPedidosTienda !== 'todos' && i.pedido_estado !== filtroEstadoPedidosTienda) return false;
    if (rangoFechaPedidosTienda === 'todos') return true;
    const fecha = new Date(i.created_at);
    if (rangoFechaPedidosTienda === 'hoy') return esMismoDiaPedido(fecha, ahora);
    if (rangoFechaPedidosTienda === 'manana') return esMismoDiaPedido(fecha, manana);
    return true;
  });

  if (todosPedidosTiendaCache.length === 0) {
    cont.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Aún no tienes pedidos.</p></div>';
    return;
  }
  if (items.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        <p>No tienes pedidos con ese filtro.</p>
        <button type="button" class="btn btn-outline btn-sm mt-8" id="btn-ver-todos-pedidos-tienda">Ver todos</button>
      </div>
    `;
    const btnVerTodos = document.getElementById('btn-ver-todos-pedidos-tienda');
    if (btnVerTodos) {
      btnVerTodos.addEventListener('click', () => {
        rangoFechaPedidosTienda = 'todos';
        filtroEstadoPedidosTienda = 'todos';
        document.querySelectorAll('#filtro-fecha-pedidos-tienda .chip').forEach((c) => c.classList.toggle('activo', c.dataset.rango === 'todos'));
        document.getElementById('filtro-estado-pedidos-tienda').value = 'todos';
        renderPedidosTiendaFiltrados();
      });
    }
    return;
  }

  if (vistaPedidosTienda === 'tabla') renderPedidosComoTabla(cont, items);
  else if (vistaPedidosTienda === 'estados') renderPedidosComoEstados(cont, items);
  else renderPedidosComoTarjetas(cont, items);

  enlazarAccionesPedidosTienda(cont);
}

document.querySelectorAll('#filtro-fecha-pedidos-tienda .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    rangoFechaPedidosTienda = chip.dataset.rango;
    document.querySelectorAll('#filtro-fecha-pedidos-tienda .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    renderPedidosTiendaFiltrados();
  });
});

document.getElementById('filtro-estado-pedidos-tienda').addEventListener('change', (e) => {
  filtroEstadoPedidosTienda = e.target.value;
  renderPedidosTiendaFiltrados();
});

document.querySelectorAll('#filtro-vista-pedidos-tienda .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    vistaPedidosTienda = chip.dataset.vista;
    document.querySelectorAll('#filtro-vista-pedidos-tienda .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    renderPedidosTiendaFiltrados();
  });
});

// ---------- Productos ----------
const CATEGORIAS = ['ropa','comida','bebidas','servicios','artesanias','otros'];
const UNIDADES = ['unidad','kg','g','l','ml','cm','m','paquete','docena'];

async function cargarProductos() {
  const grid = document.getElementById('grid-productos-tienda');
  grid.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const productos = await Api.tiendaProductos();
    if (productos.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">🛍️</div><p>Aún no tienes productos. ¡Agrega el primero!</p></div>';
      return;
    }
    grid.innerHTML = productos.map((p) => `
      <div class="card producto-admin-card">
        <div class="pcard-media" style="${p.foto_url ? `background-image:url('${p.foto_url}')` : ''}">${p.foto_url ? '' : (p.es_combo ? '🎁' : '🛍️')}</div>
        <div class="card-pad-sm">
          <div class="flex gap-6" style="flex-wrap:wrap;">
            <span class="tag">${p.categoria}${p.subcategoria ? ` · ${p.subcategoria}` : ''}</span>
            ${p.es_combo ? '<span class="tag" style="background:#fff3d6;color:#b7690a;">🎁 Combo</span>' : ''}
          </div>
          <strong class="producto-admin-nombre">${p.nombre}${p.marca ? ` · ${p.marca}` : ''}</strong>
          <div class="precio">${formatoSoles(p.precio)} <span class="text-sm text-muted" style="font-weight:600;">/ ${formatoContenido(p.contenido, p.unidad)}</span></div>
          <div class="text-sm text-muted">Stock: ${p.stock} ${p.activo ? '' : '· ⚪ Inactivo'}</div>
          <div class="flex gap-6 mt-6">
            <button class="btn btn-outline btn-xs w-full" data-editar="${p.id}">Editar</button>
            <button class="btn btn-danger btn-xs" data-eliminar="${p.id}">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-editar]').forEach((btn) => btn.addEventListener('click', () => {
      const producto = productos.find((p) => p.id === btn.dataset.editar);
      abrirModalProducto(producto);
    }));
    grid.querySelectorAll('[data-eliminar]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!(await confirmModal('¿Eliminar este producto?', { peligro: true, textoAceptar: 'Eliminar' }))) return;
      try {
        await Api.tiendaEliminarProducto(btn.dataset.eliminar);
        mostrarToast('Producto eliminado', 'success');
        cargarProductos();
      } catch (err) { mostrarToast(err.message, 'error'); }
    }));
  } catch (err) {
    if (!manejarError401(err)) grid.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

function abrirModalProducto(p) {
  const editando = !!p;
  abrirModal(`
    <h3>${editando ? 'Editar producto' : 'Nuevo producto'}</h3>
    <div class="modal-form-cols mt-16">
      <div class="modal-form-col-izq">
        <div class="form-grupo">
          <label>Foto del producto</label>
          <label class="file-drop ${p && p.foto_url ? 'con-imagen' : ''}" id="p-foto-drop">
            <input type="file" id="p-foto-file" accept="image/*" capture="environment" class="file-drop-input">
            <img id="p-foto-preview" class="file-drop-preview" src="${p && p.foto_url ? p.foto_url : ''}" style="${p && p.foto_url ? '' : 'display:none;'}">
            <div id="p-foto-placeholder" style="${p && p.foto_url ? 'display:none;' : 'display:flex;flex-direction:column;align-items:center;gap:6px;'}">
              <span class="file-drop-icon">📷</span>
              <span class="file-drop-text">Toca para subir una foto</span>
              <span class="file-drop-hint">JPG o PNG, máx. 5MB</span>
            </div>
          </label>
        </div>
        <div class="form-grupo"><label>URL de foto (opcional)</label><input id="p-foto" value="${p ? (p.foto_url||'') : ''}" placeholder="https://..."></div>
        <div class="form-grupo"><label>Detalle (opcional)</label><textarea id="p-descripcion" rows="4" placeholder="Si es un combo, cuenta que incluye. Ej: 3 anticuchos + 1 gaseosa 500ml">${p ? (p.descripcion||'') : ''}</textarea></div>
        <div class="form-grupo flex justify-between items-center">
          <label class="mb-0">🎁 Es un combo</label>
          <span class="toggle-switch">
            <input type="checkbox" id="p-es-combo" ${p && p.es_combo ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </span>
        </div>
        ${editando ? `
          <div class="form-grupo flex justify-between items-center">
            <label class="mb-0">Producto activo</label>
            <span class="toggle-switch">
              <input type="checkbox" id="p-activo" ${p.activo?'checked':''}>
              <span class="toggle-slider"></span>
            </span>
          </div>
        ` : ''}
      </div>
      <div class="modal-form-col-der">
        <div class="form-grupo"><label>Nombre</label><input id="p-nombre" value="${p ? p.nombre : ''}" required></div>
        <div class="form-grupo"><label>Marca (opcional)</label><input id="p-marca" value="${p ? (p.marca||'') : ''}" placeholder="Ej. Inca Kola, San Luis..."></div>
        <div class="grid-cols grid-cols-2">
          <div class="form-grupo"><label>Categoría</label>
            <select id="p-categoria">${CATEGORIAS.map((c) => `<option value="${c}" ${p && p.categoria===c?'selected':''}>${c}</option>`).join('')}</select>
          </div>
          <div class="form-grupo"><label>Subcategoría</label><input id="p-subcategoria" value="${p ? (p.subcategoria||'') : ''}" placeholder="Ej. jugos, sombreros..." required></div>
        </div>
        <div class="form-grupo"><label>Precio de venta (S/)</label><input id="p-precio" type="number" step="0.10" value="${p ? p.precio : ''}" required></div>
        <div class="grid-cols grid-cols-2">
          <div class="form-grupo"><label>Cantidad</label><input id="p-contenido" type="number" step="0.01" min="0" value="${p && p.contenido != null ? p.contenido : ''}" placeholder="Ej. 500"></div>
          <div class="form-grupo"><label>Unidad</label>
            <select id="p-unidad">${UNIDADES.map((u) => `<option value="${u}" ${p && p.unidad===u?'selected':''}>${labelUnidad(u)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-hint" style="margin-top:-8px;margin-bottom:12px;">Ej. Cantidad 500 + Unidad "g" se vera como "500 g" para el cliente.</div>
        <div class="form-grupo"><label>Stock</label><input id="p-stock" type="number" value="${p ? p.stock : 10}" required></div>
      </div>
    </div>
    <button class="btn btn-primary btn-block mt-8" id="btn-guardar-producto">${editando ? 'Guardar cambios' : 'Crear producto'}</button>
  `, true);

  document.getElementById('p-foto-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('p-foto-preview');
    const placeholder = document.getElementById('p-foto-placeholder');
    const drop = document.getElementById('p-foto-drop');
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      mostrarToast('Subiendo imagen...', '');
      const { url } = await Api.tiendaSubirImagen(fd);
      document.getElementById('p-foto').value = url;
      preview.src = url;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      drop.classList.add('con-imagen');
      mostrarToast('Imagen subida', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se pudo subir la imagen', 'error');
    }
  });

  document.getElementById('btn-guardar-producto').addEventListener('click', async () => {
    const datos = {
      nombre: document.getElementById('p-nombre').value,
      marca: document.getElementById('p-marca').value,
      categoria: document.getElementById('p-categoria').value,
      subcategoria: document.getElementById('p-subcategoria').value,
      descripcion: document.getElementById('p-descripcion').value,
      precio: Number(document.getElementById('p-precio').value),
      unidad: document.getElementById('p-unidad').value,
      contenido: document.getElementById('p-contenido').value ? Number(document.getElementById('p-contenido').value) : null,
      stock: Number(document.getElementById('p-stock').value),
      foto_url: document.getElementById('p-foto').value,
      es_combo: document.getElementById('p-es-combo').checked,
    };
    if (!datos.nombre || !datos.precio) { mostrarToast('Completa nombre y precio', 'error'); return; }
    if (!datos.subcategoria) { mostrarToast('Completa la subcategoría', 'error'); return; }
    try {
      if (editando) {
        datos.activo = document.getElementById('p-activo').checked;
        await Api.tiendaActualizarProducto(p.id, datos);
      } else {
        await Api.tiendaCrearProducto(datos);
      }
      mostrarToast('Producto guardado', 'success');
      cerrarModal();
      cargarProductos();
    } catch (err) { mostrarToast(err.message, 'error'); }
  });
}

document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto(null));

// ---------- Mi perfil ----------
let tiposNegocioCargados = false;
async function cargarPerfilTienda() {
  try {
    if (!tiposNegocioCargados) {
      const tipos = await Api.getTiposNegocio();
      document.getElementById('tp-categoria').innerHTML = tipos.map((t) => `<option value="${t.clave}">${t.etiqueta}</option>`).join('');
      habilitarAgregarTipoNegocio('tp-categoria', 'tp-categoria-add', 'tienda');
      tiposNegocioCargados = true;
    }
    const p = await Api.tiendaPerfil();
    document.getElementById('tp-nombre').value = p.nombre || '';
    document.getElementById('tp-categoria').value = p.categoria || 'tienda';
    document.getElementById('tp-subcategoria').value = p.subcategoria || '';
    document.getElementById('tp-descripcion').value = p.descripcion || '';
    document.getElementById('tp-direccion').value = p.direccion || '';
    document.getElementById('tp-zona').innerHTML = await zonaOptionsHtml(p.zona || '');
    document.getElementById('tp-dni').value = p.dni_titular || '';
    document.getElementById('tp-nombre-titular').value = p.nombre_titular || '';
    document.getElementById('tp-telefono').value = p.contacto_telefono || '';
    document.getElementById('tp-whatsapp').value = p.contacto_whatsapp || '';
    const preview = document.getElementById('tp-logo-preview');
    if (p.logo_url) {
      preview.src = p.logo_url;
      preview.style.display = 'block';
      document.getElementById('tp-logo-placeholder').style.display = 'none';
      document.getElementById('tp-logo-drop').classList.add('con-imagen');
    }
  } catch (err) {
    if (!manejarError401(err)) mostrarToast(err.message, 'error');
  }
}

let logoUrlActual = '';
document.getElementById('tp-logo-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById('tp-logo-preview');
  const placeholder = document.getElementById('tp-logo-placeholder');
  const drop = document.getElementById('tp-logo-drop');
  try {
    const fd = new FormData();
    fd.append('imagen', file);
    mostrarToast('Subiendo logo...', '');
    const { url } = await Api.tiendaSubirImagen(fd);
    logoUrlActual = url;
    preview.src = url;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    drop.classList.add('con-imagen');
    mostrarToast('Logo subido', 'success');
  } catch (err) {
    mostrarToast(err.message || 'No se pudo subir el logo', 'error');
  }
});

document.getElementById('form-perfil-tienda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-guardar-perfil-tienda');
  const errorBox = document.getElementById('error-perfil-tienda');
  errorBox.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    const preview = document.getElementById('tp-logo-preview');
    await Api.tiendaActualizarPerfil({
      nombre: document.getElementById('tp-nombre').value,
      categoria: document.getElementById('tp-categoria').value,
      subcategoria: document.getElementById('tp-subcategoria').value,
      descripcion: document.getElementById('tp-descripcion').value,
      direccion: document.getElementById('tp-direccion').value,
      zona: document.getElementById('tp-zona').value,
      dni_titular: document.getElementById('tp-dni').value,
      nombre_titular: document.getElementById('tp-nombre-titular').value,
      contacto_telefono: document.getElementById('tp-telefono').value,
      contacto_whatsapp: document.getElementById('tp-whatsapp').value,
      logo_url: logoUrlActual || (preview.style.display !== 'none' ? preview.src : ''),
    });
    mostrarToast('Perfil actualizado', 'success');
  } catch (err) {
    errorBox.textContent = err.message || 'No se pudo actualizar el perfil';
    errorBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
});

document.getElementById('form-password-tienda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-cambiar-password-tienda');
  const errorBox = document.getElementById('error-password-tienda');
  errorBox.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Actualizando...';
  try {
    await Api.tiendaCambiarPassword({
      password_actual: document.getElementById('tp-pass-actual').value,
      password_nueva: document.getElementById('tp-pass-nueva').value,
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

cargarPedidos();
cargarDisponibilidad();
