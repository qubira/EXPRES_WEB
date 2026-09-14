const CATEGORIAS_ICONOS = {
  comida: '🍢',
  bebidas: '🥤',
  ropa: '👙',
  servicios: '⛱️',
  artesanias: '🎨',
  otros: '🛍️',
};

let categoriaActiva = new URLSearchParams(location.search).get('categoria') || '';
let terminoBusqueda = new URLSearchParams(location.search).get('q') || '';
let debounceTimer = null;
let ultimosProductos = [];

function skeletonGrid(n) {
  return Array.from({ length: n }).map(() => `
    <div class="skel-pcard">
      <div class="skeleton skel-media"></div>
      <div class="skeleton skel-line w60"></div>
      <div class="skeleton skel-line w40"></div>
    </div>
  `).join('');
}

async function cargarFiltros() {
  const categorias = await Api.getCategorias();
  const cont = document.getElementById('filtros');
  const todas = [{ valor: '', label: 'Todo' }, ...categorias.map((c) => ({ valor: c, label: `${CATEGORIAS_ICONOS[c] || ''} ${c[0].toUpperCase()}${c.slice(1)}` }))];

  cont.innerHTML = todas.map((c) => `
    <button class="chip ${c.valor === categoriaActiva ? 'activo' : ''}" data-valor="${c.valor}">${c.label}</button>
  `).join('');

  cont.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      categoriaActiva = chip.dataset.valor;
      cont.querySelectorAll('.chip').forEach((c) => c.classList.remove('activo'));
      chip.classList.add('activo');
      cargarProductos();
    });
  });
}

function controlHtml(p) {
  const qty = cartQtyFor(p.id);
  if (qty > 0) {
    return `
      <div class="pcard-stepper" data-stepper="${p.id}">
        <button data-menos="${p.id}" aria-label="Quitar uno">−</button>
        <span class="qty">${qty}</span>
        <button data-mas="${p.id}" aria-label="Agregar uno">+</button>
      </div>
    `;
  }
  return `<button class="pcard-add" data-add="${p.id}" aria-label="Agregar">+</button>`;
}

function tarjetaProducto(p, index) {
  const icon = CATEGORIAS_ICONOS[p.categoria] || '🛍️';
  const media = p.foto_url
    ? `<div class="pcard-media" style="background-image:url('${p.foto_url}')"></div>`
    : `<div class="pcard-media">${icon}</div>`;
  return `
    <div class="pcard fade-in-up" data-id="${p.id}" data-abrir="${p.id}" style="animation-delay:${Math.min(index * 40, 300)}ms">
      <div style="position:relative;">
        ${media}
        <div class="pcard-control" data-control="${p.id}">${controlHtml(p)}</div>
      </div>
      <div class="pcard-body">
        <span class="pcard-name">${p.nombre}</span>
        <span class="pcard-store">${p.tienda_nombre} · ${labelUnidad(p.unidad)}</span>
        <span class="pcard-price">${formatoSoles(p.precio)}</span>
      </div>
    </div>
  `;
}

function refrescarControl(productoId) {
  const producto = ultimosProductos.find((p) => p.id === productoId);
  const cont = document.querySelector(`[data-control="${productoId}"]`);
  if (producto && cont) {
    cont.innerHTML = controlHtml(producto);
    enlazarControl(productoId);
  }
}

function enlazarControl(productoId) {
  const cont = document.querySelector(`[data-control="${productoId}"]`);
  if (!cont) return;

  const btnAdd = cont.querySelector('[data-add]');
  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      const producto = ultimosProductos.find((p) => p.id === productoId);
      addToCart(producto, 1);
      rebotarCarrito();
      mostrarToast(`${producto.nombre} agregado`, 'success');
      actualizarCartBar();
      refrescarControl(productoId);
    });
  }
  const btnMas = cont.querySelector('[data-mas]');
  if (btnMas) {
    btnMas.addEventListener('click', (e) => {
      e.stopPropagation();
      updateCartQty(productoId, cartQtyFor(productoId) + 1);
      rebotarCarrito();
      actualizarCartBar();
      refrescarControl(productoId);
    });
  }
  const btnMenos = cont.querySelector('[data-menos]');
  if (btnMenos) {
    btnMenos.addEventListener('click', (e) => {
      e.stopPropagation();
      updateCartQty(productoId, cartQtyFor(productoId) - 1);
      actualizarCartBar();
      refrescarControl(productoId);
    });
  }
}

async function cargarProductos() {
  const grid = document.getElementById('grid-productos');
  const estadoCarga = document.getElementById('estado-carga');
  const vacio = document.getElementById('vacio');
  estadoCarga.classList.add('hidden');
  vacio.classList.add('hidden');
  grid.innerHTML = skeletonGrid(6);

  try {
    const params = {};
    if (categoriaActiva) params.categoria = categoriaActiva;
    if (terminoBusqueda) params.q = terminoBusqueda;
    const productos = await Api.getProductos(params);
    ultimosProductos = productos;

    if (productos.length === 0) {
      grid.innerHTML = '';
      vacio.classList.remove('hidden');
      return;
    }

    grid.innerHTML = productos.map(tarjetaProducto).join('');
    productos.forEach((p) => enlazarControl(p.id));
    grid.querySelectorAll('[data-abrir]').forEach((card) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        location.href = `producto.html?id=${card.dataset.abrir}`;
      });
    });
  } catch (err) {
    grid.innerHTML = '';
    estadoCarga.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
    estadoCarga.classList.remove('hidden');
  }
}

function actualizarCartBar() {
  const bar = document.getElementById('cart-bar');
  bar.classList.toggle('hidden', cartCount() === 0);
}

document.getElementById('buscador').value = terminoBusqueda;
document.getElementById('buscador').addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    terminoBusqueda = e.target.value.trim();
    cargarProductos();
  }, 350);
});

cargarFiltros();
cargarProductos();
actualizarCartBar();
