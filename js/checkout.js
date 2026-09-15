function renderCarrito() {
  const items = getCart();
  const lista = document.getElementById('lista-carrito');
  const vacio = document.getElementById('vacio-carrito');
  const resumen = document.getElementById('resumen-carrito');
  const form = document.getElementById('form-checkout');
  const loginGate = document.getElementById('login-gate');

  if (items.length === 0) {
    lista.innerHTML = '';
    vacio.classList.remove('hidden');
    resumen.classList.add('hidden');
    form.classList.add('hidden');
    loginGate.classList.add('hidden');
    return;
  }
  vacio.classList.add('hidden');
  resumen.classList.remove('hidden');

  // Regla del negocio: toda compra requiere una cuenta iniciada.
  const logueado = typeof clienteEstaLogueado === 'function' && clienteEstaLogueado();
  form.classList.toggle('hidden', !logueado);
  loginGate.classList.toggle('hidden', logueado);

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

let ubicacionEntrega = null;

const btnGps = document.getElementById('btn-gps-entrega');
const gpsEstado = document.getElementById('gps-entrega-estado');

function mensajeErrorGps(err) {
  // GeolocationPositionError.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
  if (err && err.code === 1) {
    return 'Bloqueaste el permiso de ubicación. Actívalo en la configuración de tu navegador (ícono de candado junto a la URL) e intenta de nuevo.';
  }
  if (err && err.code === 3) {
    return 'Tu señal GPS está muy débil ahora. Puedes intentar de nuevo o continuar con la referencia escrita.';
  }
  return 'No se pudo obtener tu ubicación (revisa que el GPS de tu celular esté activado). Puedes continuar igual con la referencia escrita.';
}

function obtenerUbicacionGps() {
  btnGps.disabled = true;
  gpsEstado.textContent = 'Obteniendo tu ubicación...';

  const onExito = (pos) => {
    ubicacionEntrega = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    gpsEstado.textContent = '✓ Ubicación GPS lista. El repartidor podrá verla al llegar a tu zona.';
    btnGps.textContent = '📍 Ubicación compartida';
    btnGps.disabled = false;
  };

  navigator.geolocation.getCurrentPosition(
    onExito,
    (err) => {
      // Si la alta precision (satelite) falla o tarda, reintentamos una vez con
      // baja precision (red/celda): es mas lento en precision pero mucho mas
      // confiable en interiores o con bateria baja, donde el GPS de precision
      // suele fallar o no responder a tiempo.
      if (err && (err.code === 2 || err.code === 3)) {
        gpsEstado.textContent = 'Señal débil, intentando con ubicación aproximada...';
        navigator.geolocation.getCurrentPosition(
          onExito,
          (err2) => {
            gpsEstado.textContent = mensajeErrorGps(err2);
            btnGps.disabled = false;
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
        return;
      }
      gpsEstado.textContent = mensajeErrorGps(err);
      btnGps.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

if (btnGps) {
  btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      gpsEstado.textContent = 'Tu navegador no permite compartir ubicación GPS.';
      return;
    }
    obtenerUbicacionGps();
  });
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
      lat_entrega: ubicacionEntrega ? ubicacionEntrega.lat : null,
      lng_entrega: ubicacionEntrega ? ubicacionEntrega.lng : null,
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

// Si el cliente ya eligio una zona desde el home/catalogo, se la dejamos lista
if (typeof getZonaGuardada === 'function') {
  const zonaGuardada = getZonaGuardada();
  const campoZona = document.querySelector('input[name="zona_entrega"]');
  if (zonaGuardada && campoZona && !campoZona.value) {
    campoZona.value = zonaGuardada;
  }
}

// Si el cliente tiene sesion iniciada, precargamos su nombre y celular
if (typeof clienteEstaLogueado === 'function' && clienteEstaLogueado()) {
  Api.clientePerfil().then((perfil) => {
    const campoNombre = document.querySelector('input[name="cliente_nombre"]');
    const campoTelefono = document.querySelector('input[name="cliente_telefono"]');
    if (campoNombre && !campoNombre.value) campoNombre.value = perfil.nombre;
    if (campoTelefono && !campoTelefono.value) campoTelefono.value = perfil.telefono;
  }).catch(() => {});
}
