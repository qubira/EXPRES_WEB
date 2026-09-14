const pedidoId = new URLSearchParams(location.search).get('pedido');
let tipoPagoSeleccionado = 'yape';

if (!pedidoId) {
  location.href = 'catalogo.html';
}

async function cargarPedido() {
  try {
    const pedido = await Api.getPedido(pedidoId);
    document.getElementById('pedido-id-corto').textContent = `#${pedido.id.slice(0, 8).toUpperCase()}`;
    document.getElementById('pedido-total').textContent = formatoSoles(pedido.monto_total);

    if (pedido.estado !== 'pendiente_pago') {
      location.href = `pedido.html?id=${pedido.id}`;
    }
  } catch (err) {
    mostrarToast('No se encontró el pedido', 'error');
  }
}

document.querySelectorAll('#metodos-pago .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#metodos-pago .chip').forEach((c) => c.classList.remove('activo'));
    chip.classList.add('activo');
    tipoPagoSeleccionado = chip.dataset.tipo;
  });
});

document.getElementById('comprobante-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById('comprobante-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
  document.getElementById('comprobante-placeholder').style.display = 'none';
  document.getElementById('comprobante-drop').classList.add('con-imagen');
});

document.getElementById('form-pago').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-pago');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const fd = new FormData(e.target);
    fd.append('tipo', tipoPagoSeleccionado);
    await Api.subirComprobante(pedidoId, fd);
    mostrarToast('¡Comprobante recibido!', 'success');
    setTimeout(() => { location.href = `pedido.html?id=${pedidoId}`; }, 900);
  } catch (err) {
    mostrarToast(err.message || 'No se pudo enviar el comprobante', 'error');
    btn.disabled = false;
    btn.textContent = 'Enviar comprobante';
  }
});

cargarPedido();
