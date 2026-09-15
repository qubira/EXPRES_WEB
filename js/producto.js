const CATEGORIAS_ICONOS = {
  comida: '🍢',
  bebidas: '🥤',
  ropa: '👙',
  servicios: '⛱️',
  artesanias: '🎨',
  otros: '🛍️',
};

const productoIdActual = new URLSearchParams(location.search).get('id');
const mapaProductos = {};

// ---------- Control del producto principal (boton grande / stepper en linea) ----------
function controlDetalleHtml(p) {
  const qty = cartQtyFor(p.id);
  if (qty > 0) {
    return `
      <div class="stepper-inline" data-stepper="${p.id}">
        <button data-menos="${p.id}" aria-label="Quitar uno">−</button>
        <span class="qty">${qty}</span>
        <button data-mas="${p.id}" aria-label="Agregar uno">+</button>
      </div>
    `;
  }
  return `<button class="btn btn-primary" data-add="${p.id}">Agregar al carrito</button>`;
}

function enlazarControlDetalle(id) {
  const cont = document.getElementById('detalle-control');
  const btnAdd = cont.querySelector('[data-add]');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      addToCart(mapaProductos[id], 1);
      rebotarCarrito();
      mostrarToast(`${mapaProductos[id].nombre} agregado`, 'success');
      actualizarCartBar();
      refrescarControlDetalle(id);
    });
  }
  const btnMas = cont.querySelector('[data-mas]');
  if (btnMas) {
    btnMas.addEventListener('click', () => {
      updateCartQty(id, cartQtyFor(id) + 1);
      rebotarCarrito();
      actualizarCartBar();
      refrescarControlDetalle(id);
    });
  }
  const btnMenos = cont.querySelector('[data-menos]');
  if (btnMenos) {
    btnMenos.addEventListener('click', () => {
      updateCartQty(id, cartQtyFor(id) - 1);
      actualizarCartBar();
      refrescarControlDetalle(id);
    });
  }
}

function refrescarControlDetalle(id) {
  const cont = document.getElementById('detalle-control');
  cont.innerHTML = controlDetalleHtml(mapaProductos[id]);
  enlazarControlDetalle(id);
}

// ---------- Tarjetas de "tambien te puede interesar" (mismo estilo del catalogo) ----------
function controlTarjetaHtml(p) {
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

function enlazarControlTarjeta(id) {
  const cont = document.querySelector(`[data-control="${id}"]`);
  if (!cont) return;
  const btnAdd = cont.querySelector('[data-add]');
  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(mapaProductos[id], 1);
      rebotarCarrito();
      mostrarToast(`${mapaProductos[id].nombre} agregado`, 'success');
      actualizarCartBar();
      refrescarControlTarjeta(id);
    });
  }
  const btnMas = cont.querySelector('[data-mas]');
  if (btnMas) {
    btnMas.addEventListener('click', (e) => {
      e.stopPropagation();
      updateCartQty(id, cartQtyFor(id) + 1);
      rebotarCarrito();
      actualizarCartBar();
      refrescarControlTarjeta(id);
    });
  }
  const btnMenos = cont.querySelector('[data-menos]');
  if (btnMenos) {
    btnMenos.addEventListener('click', (e) => {
      e.stopPropagation();
      updateCartQty(id, cartQtyFor(id) - 1);
      actualizarCartBar();
      refrescarControlTarjeta(id);
    });
  }
}

function refrescarControlTarjeta(id) {
  const cont = document.querySelector(`[data-control="${id}"]`);
  if (cont) {
    cont.innerHTML = controlTarjetaHtml(mapaProductos[id]);
    enlazarControlTarjeta(id);
  }
}

function tarjetaSimilar(p, index) {
  const icon = CATEGORIAS_ICONOS[p.categoria] || '🛍️';
  const media = p.foto_url
    ? `<div class="pcard-media" style="background-image:url('${p.foto_url}')"></div>`
    : `<div class="pcard-media">${icon}</div>`;
  return `
    <div class="pcard fade-in-up" data-abrir="${p.id}" style="animation-delay:${Math.min(index * 40, 300)}ms">
      <div style="position:relative;">
        ${media}
        <button class="heart-btn ${esFavorito(p.id) ? 'activo' : ''}" data-fav="${p.id}" aria-label="Favorito">${esFavorito(p.id) ? '❤️' : '🤍'}</button>
        <div class="pcard-control" data-control="${p.id}">${controlTarjetaHtml(p)}</div>
      </div>
      <div class="pcard-body">
        <span class="pcard-name">${p.nombre}</span>
        <span class="pcard-store">${p.tienda_nombre} · ${formatoContenido(p.contenido, p.unidad)}</span>
        <span class="pcard-price">${formatoSoles(p.precio)}</span>
      </div>
    </div>
  `;
}

function actualizarCartBar() {
  document.getElementById('cart-bar').classList.toggle('hidden', cartCount() === 0);
}

async function cargarProducto() {
  if (!productoIdActual) {
    location.href = 'catalogo.html';
    return;
  }
  try {
    const p = await Api.getProducto(productoIdActual, getZonaGuardada());
    mapaProductos[p.id] = p;
    (p.similares || []).forEach((s) => { mapaProductos[s.id] = s; });

    document.getElementById('estado-carga').classList.add('hidden');
    document.getElementById('contenido').classList.remove('hidden');

    const icon = CATEGORIAS_ICONOS[p.categoria] || '🛍️';
    const media = document.getElementById('producto-media');
    if (p.foto_url) {
      media.style.backgroundImage = `url('${p.foto_url}')`;
      media.style.backgroundSize = 'cover';
      media.style.backgroundPosition = 'center';
      media.textContent = '';
    } else {
      media.textContent = icon;
    }
    // ojo: cargarProducto se re-ejecuta con el auto-refresco, asi que este boton
    // se reutiliza si ya existe en vez de duplicarse en cada ciclo.
    let btnFav = document.getElementById('btn-favorito-producto');
    if (!btnFav) {
      media.insertAdjacentHTML('beforeend', `<button class="heart-btn" id="btn-favorito-producto" aria-label="Favorito"></button>`);
      btnFav = document.getElementById('btn-favorito-producto');
      btnFav.addEventListener('click', () => {
        const activo = toggleFavorito(p.id);
        btnFav.textContent = activo ? '❤️' : '🤍';
        btnFav.classList.toggle('activo', activo);
      });
    }
    btnFav.textContent = esFavorito(p.id) ? '❤️' : '🤍';
    btnFav.classList.toggle('activo', esFavorito(p.id));

    document.getElementById('producto-tags').innerHTML = `
      <span class="tag">${p.categoria}</span>
      ${p.subcategoria ? `<span class="tag" style="background:var(--arena-200);color:var(--tinta-600);">${p.subcategoria}</span>` : ''}
    `;
    document.getElementById('producto-nombre').textContent = p.nombre;
    document.getElementById('producto-marca').textContent = p.marca ? `Marca: ${p.marca}` : '';
    document.getElementById('producto-precio').textContent = formatoSoles(p.precio);
    document.getElementById('producto-unidad').textContent = `Por ${formatoContenido(p.contenido, p.unidad)}`;

    document.getElementById('detalle-control').innerHTML = controlDetalleHtml(p);
    enlazarControlDetalle(p.id);

    if (p.descripcion) {
      document.getElementById('producto-detalle-wrap').classList.remove('hidden');
      document.getElementById('producto-descripcion').textContent = p.descripcion;
    }

    document.getElementById('producto-tienda-nombre').textContent = p.tienda_nombre;
    document.getElementById('producto-tienda-zona').textContent = p.tienda_zona || '';

    const gridSimilares = document.getElementById('grid-similares');
    const similares = p.similares || [];
    if (similares.length === 0) {
      document.getElementById('similares-wrap').classList.add('hidden');
    } else {
      gridSimilares.innerHTML = similares.map(tarjetaSimilar).join('');
      similares.forEach((s) => enlazarControlTarjeta(s.id));
      gridSimilares.querySelectorAll('[data-abrir]').forEach((card) => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          location.href = `producto.html?id=${card.dataset.abrir}`;
        });
      });
      gridSimilares.querySelectorAll('[data-fav]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const activo = toggleFavorito(btn.dataset.fav);
          btn.textContent = activo ? '❤️' : '🤍';
          btn.classList.toggle('activo', activo);
        });
      });
    }

    actualizarCartBar();
    document.title = `${p.nombre} | Express Ancon`;
  } catch (err) {
    document.getElementById('estado-carga').textContent = err.message || 'No se pudo cargar el producto';
  }
}

cargarProducto();
iniciarAutoRefresco(cargarProducto);
document.addEventListener('zona-actualizada', cargarProducto);
