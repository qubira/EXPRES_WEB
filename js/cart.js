// ============================================================
// Carrito de compra (persistido en localStorage)
// ============================================================

const CART_KEY = 'express_cart_v1';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  actualizarBadgeCarrito();
}

function addToCart(producto, cantidad = 1) {
  const items = getCart();
  const existente = items.find((i) => i.producto_id === producto.id);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    items.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      tienda_nombre: producto.tienda_nombre,
      cantidad,
    });
  }
  saveCart(items);
}

function updateCartQty(productoId, cantidad) {
  let items = getCart();
  if (cantidad <= 0) {
    items = items.filter((i) => i.producto_id !== productoId);
  } else {
    const item = items.find((i) => i.producto_id === productoId);
    if (item) item.cantidad = cantidad;
  }
  saveCart(items);
}

function removeFromCart(productoId) {
  const items = getCart().filter((i) => i.producto_id !== productoId);
  saveCart(items);
}

function clearCart() {
  saveCart([]);
}

function cartTotal() {
  return getCart().reduce((sum, i) => sum + i.precio * i.cantidad, 0);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.cantidad, 0);
}

function cartQtyFor(productoId) {
  const item = getCart().find((i) => i.producto_id === productoId);
  return item ? item.cantidad : 0;
}

function actualizarBadgeCarrito() {
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    const count = cartCount();
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
  });
  document.querySelectorAll('[data-cart-total]').forEach((el) => {
    el.textContent = formatoSoles(cartTotal());
  });
}

function rebotarCarrito() {
  document.querySelectorAll('.icon-btn, .tabbar-item .tabbar-icon').forEach((el) => {
    el.classList.remove('rebote');
    void el.offsetWidth;
    el.classList.add('rebote');
  });
}

// ---------- Favoritos (tiendas) ----------
const FAV_KEY = 'express_favoritos_v1';

function getFavoritos() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function esFavorito(tiendaId) {
  return getFavoritos().includes(tiendaId);
}

function toggleFavorito(tiendaId) {
  let favs = getFavoritos();
  const yaEsta = favs.includes(tiendaId);
  favs = yaEsta ? favs.filter((id) => id !== tiendaId) : [...favs, tiendaId];
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  return !yaEsta;
}

document.addEventListener('DOMContentLoaded', actualizarBadgeCarrito);
