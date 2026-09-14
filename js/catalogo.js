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

function tarjetaProducto(p) {
  const icon = CATEGORIAS_ICONOS[p.categoria] || '🛍️';
  const media = p.foto_url
    ? `<div class="pcard-media" style="background-image:url('${p.foto_url}')"></div>`
    : `<div class="pcard-media">${icon}</div>`;
  return `
    <div class="pcard" data-id="${p.id}">
      <div style="position:relative;">
        ${media}
        <button class="pcard-add" data-add="${p.id}" aria-label="Agregar">+</button>
      </div>
      <div class="pcard-body">
        <span class="pcard-name">${p.nombre}</span>
        <span class="pcard-store">${p.tienda_nombre}</span>
        <span class="pcard-price">${formatoSoles(p.precio)}</span>
      </div>
    </div>
  `;
}

async function cargarProductos() {
  const grid = document.getElementById('grid-productos');
  const estadoCarga = document.getElementById('estado-carga');
  const vacio = document.getElementById('vacio');
  estadoCarga.classList.remove('hidden');
  grid.innerHTML = '';
  vacio.classList.add('hidden');

  try {
    const params = {};
    if (categoriaActiva) params.categoria = categoriaActiva;
    if (terminoBusqueda) params.q = terminoBusqueda;
    const productos = await Api.getProductos(params);

    estadoCarga.classList.add('hidden');
    if (productos.length === 0) {
      vacio.classList.remove('hidden');
      return;
    }

    grid.innerHTML = productos.map(tarjetaProducto).join('');
    grid.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const producto = productos.find((p) => p.id === btn.dataset.add);
        addToCart(producto, 1);
        mostrarToast(`${producto.nombre} agregado al carrito`, 'success');
        actualizarCartBar();
      });
    });
  } catch (err) {
    estadoCarga.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
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
