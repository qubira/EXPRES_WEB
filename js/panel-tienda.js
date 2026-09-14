if (!localStorage.getItem('express_token_tienda')) {
  location.href = 'login.html';
}
document.getElementById('tienda-nombre').textContent = localStorage.getItem('express_nombre_tienda') || '';

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('express_token_tienda');
  location.href = 'login.html';
});

function manejarError401(err) {
  if (err.status === 401 || err.status === 403) {
    localStorage.removeItem('express_token_tienda');
    location.href = 'login.html';
    return true;
  }
  return false;
}

const TITULOS = { pedidos: 'Pedidos', productos: 'Mis productos' };

function irAVista(vista) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${vista}`).classList.remove('hidden');
  document.querySelectorAll('.panel-link[data-view]').forEach((l) => l.classList.toggle('activo', l.dataset.view === vista));
  document.getElementById('titulo-vista').textContent = TITULOS[vista];
  if (vista === 'pedidos') cargarPedidos();
  if (vista === 'productos') cargarProductos();
}
document.querySelectorAll('.panel-link[data-view]').forEach((link) => link.addEventListener('click', () => irAVista(link.dataset.view)));

function abrirModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-box">${html}</div></div>`;
  document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') cerrarModal(); });
}
function cerrarModal() { document.getElementById('modal-root').innerHTML = ''; }

// ---------- Pedidos ----------
async function cargarPedidos() {
  const cont = document.getElementById('lista-pedidos-tienda');
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const items = await Api.tiendaPedidos();
    if (items.length === 0) {
      cont.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Aún no tienes pedidos.</p></div>';
      return;
    }
    cont.innerHTML = items.map((i) => `
      <div class="card card-pad mt-16">
        <div class="flex justify-between items-center">
          <div>
            <strong>${i.cantidad}x ${i.nombre_producto}</strong>
            <div class="text-sm text-muted">Pedido #${i.pedido_id.slice(0,8).toUpperCase()} · ${i.zona_entrega}</div>
          </div>
          <span class="badge badge-${i.pedido_estado}">${labelEstado(i.pedido_estado)}</span>
        </div>
        <div class="flex justify-between items-center mt-8">
          <span>${formatoSoles(i.subtotal)}</span>
          ${i.estado_tienda === 'listo'
            ? '<span class="tag" style="background:#e9f9ee;color:var(--verde-palma);">✓ Listo para recoger</span>'
            : `<button class="btn btn-success btn-sm" data-listo="${i.pedido_id}|${i.item_id}">Marcar listo</button>`}
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-listo]').forEach((btn) => btn.addEventListener('click', async () => {
      const [pedidoId, itemId] = btn.dataset.listo.split('|');
      btn.disabled = true;
      try {
        await Api.tiendaMarcarListo(pedidoId, itemId);
        mostrarToast('Marcado como listo', 'success');
        cargarPedidos();
      } catch (err) { mostrarToast(err.message, 'error'); btn.disabled = false; }
    }));
  } catch (err) {
    if (!manejarError401(err)) cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }
}

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
      <div class="card card-pad">
        <span class="tag">${p.categoria}${p.subcategoria ? ` · ${p.subcategoria}` : ''}</span>
        <strong>${p.nombre}</strong>
        ${p.marca ? `<div class="text-sm text-muted">${p.marca}</div>` : ''}
        <div class="precio">${formatoSoles(p.precio)} <span class="text-sm text-muted" style="font-weight:600;">/ ${labelUnidad(p.unidad)}</span></div>
        <div class="text-sm text-muted">Stock: ${p.stock} ${p.activo ? '' : '· ⚪ Inactivo'}</div>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-outline btn-sm w-full" data-editar="${p.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-eliminar="${p.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-editar]').forEach((btn) => btn.addEventListener('click', () => {
      const producto = productos.find((p) => p.id === btn.dataset.editar);
      abrirModalProducto(producto);
    }));
    grid.querySelectorAll('[data-eliminar]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este producto?')) return;
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
    <div class="form-grupo"><label>Nombre</label><input id="p-nombre" value="${p ? p.nombre : ''}" required></div>
    <div class="form-grupo"><label>Marca (opcional)</label><input id="p-marca" value="${p ? (p.marca||'') : ''}" placeholder="Ej. Inca Kola, San Luis..."></div>
    <div class="grid-cols grid-cols-2">
      <div class="form-grupo"><label>Categoría</label>
        <select id="p-categoria">${CATEGORIAS.map((c) => `<option value="${c}" ${p && p.categoria===c?'selected':''}>${c}</option>`).join('')}</select>
      </div>
      <div class="form-grupo"><label>Subcategoría</label><input id="p-subcategoria" value="${p ? (p.subcategoria||'') : ''}" placeholder="Ej. jugos, sombreros..." required></div>
    </div>
    <div class="form-grupo"><label>Detalle (opcional)</label><textarea id="p-descripcion">${p ? (p.descripcion||'') : ''}</textarea></div>
    <div class="grid-cols grid-cols-2">
      <div class="form-grupo"><label>Precio de venta (S/)</label><input id="p-precio" type="number" step="0.10" value="${p ? p.precio : ''}" required></div>
      <div class="form-grupo"><label>Unidad</label>
        <select id="p-unidad">${UNIDADES.map((u) => `<option value="${u}" ${p && p.unidad===u?'selected':''}>${labelUnidad(u)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-grupo"><label>Stock</label><input id="p-stock" type="number" value="${p ? p.stock : 10}" required></div>
    <div class="form-grupo">
      <label>Foto del producto</label>
      <input type="file" id="p-foto-file" accept="image/*" capture="environment">
      <div class="form-hint">Sube una foto desde tu celular, o pega una URL abajo.</div>
      <img id="p-foto-preview" src="${p && p.foto_url ? p.foto_url : ''}" style="max-height:120px;border-radius:10px;margin-top:8px;${p && p.foto_url ? '' : 'display:none;'}">
    </div>
    <div class="form-grupo"><label>URL de foto</label><input id="p-foto" value="${p ? (p.foto_url||'') : ''}" placeholder="https://..."></div>
    ${editando ? `<div class="form-grupo"><label><input type="checkbox" id="p-activo" ${p.activo?'checked':''} style="width:auto;display:inline-block;margin-right:6px;"> Producto activo</label></div>` : ''}
    <button class="btn btn-primary btn-block" id="btn-guardar-producto">${editando ? 'Guardar cambios' : 'Crear producto'}</button>
  `);

  document.getElementById('p-foto-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('p-foto-preview');
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      mostrarToast('Subiendo imagen...', '');
      const { url } = await Api.tiendaSubirImagen(fd);
      document.getElementById('p-foto').value = url;
      preview.src = url;
      preview.style.display = 'block';
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
      stock: Number(document.getElementById('p-stock').value),
      foto_url: document.getElementById('p-foto').value,
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

cargarPedidos();
