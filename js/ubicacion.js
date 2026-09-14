// ============================================================
// Selector de ubicacion (zona dentro de Playa Ancon)
// ============================================================

const ZONA_KEY = 'express_zona_entrega';

const ZONAS_SUGERIDAS = [
  'Playa Ancón - Malecón Sur',
  'Playa Ancón - Malecón Norte',
  'Playa Ancón - Zona Muelle',
  'Playa Ancón - Frente al mar',
];

function getZonaGuardada() {
  return localStorage.getItem(ZONA_KEY) || '';
}

function guardarZona(zona) {
  localStorage.setItem(ZONA_KEY, zona);
  actualizarLocationBar();
  if (typeof mostrarToast === 'function') mostrarToast('Ubicación guardada', 'success');
}

function actualizarLocationBar() {
  const zona = getZonaGuardada();
  document.querySelectorAll('.location-bar .zona-texto').forEach((el) => {
    el.textContent = zona || 'Entregando en Playa Ancón';
  });
}

function obtenerModalRoot() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

function cerrarSelectorUbicacion() {
  obtenerModalRoot().innerHTML = '';
}

function abrirSelectorUbicacion() {
  const root = obtenerModalRoot();
  root.innerHTML = `
    <div class="modal-overlay" id="ubicacion-overlay">
      <div class="modal-box">
        <h3>¿Dónde estás en la playa?</h3>
        <p class="text-sm text-muted">Elige tu zona para agilizar tu próximo pedido.</p>
        <div class="flex flex-col gap-8 mt-16">
          ${ZONAS_SUGERIDAS.map((z) => `
            <button class="btn btn-outline btn-block" data-zona="${z}" style="justify-content:flex-start;">📍 ${z}</button>
          `).join('')}
        </div>
        <hr class="divider">
        <div class="form-grupo mb-0">
          <label>O escribe tu punto exacto</label>
          <input type="text" id="zona-input-libre" placeholder="Ej. Sombrilla azul #12, frente al muelle">
        </div>
        <button class="btn btn-primary btn-block mt-16" id="btn-guardar-zona">Guardar ubicación</button>
      </div>
    </div>
  `;

  document.getElementById('ubicacion-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'ubicacion-overlay') cerrarSelectorUbicacion();
  });
  root.querySelectorAll('[data-zona]').forEach((btn) => {
    btn.addEventListener('click', () => {
      guardarZona(btn.dataset.zona);
      cerrarSelectorUbicacion();
    });
  });
  document.getElementById('btn-guardar-zona').addEventListener('click', () => {
    const valor = document.getElementById('zona-input-libre').value.trim();
    if (valor) {
      guardarZona(valor);
      cerrarSelectorUbicacion();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarLocationBar();
  document.querySelectorAll('.location-bar').forEach((bar) => {
    bar.addEventListener('click', abrirSelectorUbicacion);
  });
});
