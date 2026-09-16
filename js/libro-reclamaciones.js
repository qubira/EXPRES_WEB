document.querySelectorAll('.tipo-libro-opcion input').forEach((input) => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.tipo-libro-opcion').forEach((op) => op.classList.remove('activo'));
    input.closest('.tipo-libro-opcion').classList.add('activo');
  });
});
document.getElementById('opcion-reclamo').classList.add('activo');

document.getElementById('form-libro-reclamaciones').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('lr-error');
  errBox.classList.add('hidden');

  const telefono = document.getElementById('lr-telefono').value.trim();
  const email = document.getElementById('lr-email').value.trim();
  if (!telefono && !email) {
    errBox.textContent = 'Déjanos al menos un dato de contacto: teléfono o correo';
    errBox.classList.remove('hidden');
    return;
  }

  const datos = {
    tipo: document.querySelector('input[name="tipo"]:checked').value,
    nombre_reclamante: document.getElementById('lr-nombre').value.trim(),
    tipo_documento: document.getElementById('lr-tipo-documento').value,
    dni_ce: document.getElementById('lr-dni-ce').value.trim(),
    direccion_reclamante: document.getElementById('lr-direccion').value.trim(),
    telefono_contacto: telefono,
    email_contacto: email,
    permite_whatsapp: document.getElementById('lr-whatsapp').checked,
    pedido_id: document.getElementById('lr-pedido-id').value.trim(),
    bien_contratado: document.getElementById('lr-bien').value.trim(),
    descripcion: document.getElementById('lr-descripcion').value.trim(),
    solicitud_consumidor: document.getElementById('lr-solicitud').value.trim(),
  };
  const imagenes = Array.from(document.getElementById('lr-imagenes').files || []);

  const btn = document.getElementById('btn-enviar-libro');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const r = await Api.libroReclamaciones(datos, imagenes);
    document.getElementById('formulario-libro').classList.add('hidden');
    const cont = document.getElementById('confirmacion-libro');
    cont.classList.remove('hidden');
    const tipoLabel = datos.tipo === 'queja' ? 'Queja registrada' : 'Reclamo registrado';
    cont.innerHTML = `
      <div class="card card-pad" style="text-align:center;">
        <div style="font-size:38px;">✅</div>
        <h3>${tipoLabel}</h3>
        <p class="text-sm text-muted">Esta es tu constancia de presentación.</p>
        <div class="text-sm mt-16" style="text-align:left; background:var(--arena-100); border-radius:10px; padding:12px;">
          <div><strong>N° de reclamación:</strong> #${r.id.slice(0,8).toUpperCase()}</div>
          <div><strong>Fecha de presentación:</strong> ${new Date(r.created_at).toLocaleString('es-PE')}</div>
          <div><strong>Plazo de respuesta:</strong> hasta el ${new Date(r.plazo_respuesta_hasta).toLocaleDateString('es-PE')} (30 días calendario)</div>
        </div>
        <p class="text-sm text-muted mt-16">Te contactaremos con la respuesta a los datos que registraste.</p>
        <a href="index.html" class="btn btn-outline btn-block mt-8">Volver al inicio</a>
      </div>
    `;
  } catch (err) {
    errBox.textContent = err.message || 'No se pudo registrar tu reclamación. Intenta de nuevo.';
    errBox.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Enviar';
  }
});
