function renderCarrito() {
  const items = getCart();
  const lista = document.getElementById('lista-carrito');
  const vacio = document.getElementById('vacio-carrito');
  const resumen = document.getElementById('resumen-carrito');
  const form = document.getElementById('form-checkout');

  if (items.length === 0) {
    lista.innerHTML = '';
    vacio.classList.remove('hidden');
    resumen.classList.add('hidden');
    form.classList.add('hidden');
    return;
  }
  vacio.classList.add('hidden');
  resumen.classList.remove('hidden');
  form.classList.remove('hidden');

  lista.innerHTML = items.map((i) => `
    <div class="card card-pad mt-16 flex justify-between items-center" data-id="${i.producto_id}">
      <div>
        <strong>${i.nombre}</strong>
        <div class="text-sm text-muted">${i.tienda_nombre || ''}</div>
        <div class="text-sm">${formatoSoles(i.precio)} c/u</div>
      </div>
      <div class="flex items-center gap-8">
        <button class="btn btn-ghost btn-sm" data-menos="${i.producto_id}">−</button>
        <span>${i.cantidad}</span>
        <button class="btn btn-ghost btn-sm" data-mas="${i.producto_id}">+</button>
      </div>
    </div>
  `).join('');

  lista.querySelectorAll('[data-mas]').forEach((btn) => btn.addEventListener('click', () => {
    const item = items.find((i) => i.producto_id === btn.dataset.mas);
    updateCartQty(item.producto_id, item.cantidad + 1);
    renderCarrito();
  }));
  lista.querySelectorAll('[data-menos]').forEach((btn) => btn.addEventListener('click', () => {
    const item = items.find((i) => i.producto_id === btn.dataset.menos);
    updateCartQty(item.producto_id, item.cantidad - 1);
    renderCarrito();
  }));

  const subtotal = cartTotal();
  const delivery = 5.0;
  document.getElementById('r-subtotal').textContent = formatoSoles(subtotal);
  document.getElementById('r-delivery').textContent = formatoSoles(delivery);
  document.getElementById('r-total').textContent = formatoSoles(subtotal + delivery);
}

document.getElementById('form-checkout').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-continuar');
  btn.disabled = true;
  btn.textContent = 'Procesando...';

  try {
    const fd = new FormData(e.target);
    const items = getCart().map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad }));

    const pedido = await Api.crearPedido({
      cliente_nombre: fd.get('cliente_nombre'),
      cliente_telefono: fd.get('cliente_telefono'),
      zona_entrega: fd.get('zona_entrega'),
      referencia_entrega: fd.get('referencia_entrega'),
      items,
    });

    localStorage.setItem('express_last_pedido', pedido.id);
    clearCart();
    location.href = `pago.html?pedido=${pedido.id}`;
  } catch (err) {
    mostrarToast(err.message || 'No se pudo crear el pedido', 'error');
    btn.disabled = false;
    btn.textContent = 'Continuar al pago →';
  }
});

renderCarrito();
