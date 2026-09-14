// ============================================================
// Selector de ubicacion (zona dentro de Playa Ancon)
// Si el cliente tiene sesion, la zona queda ligada a su cuenta.
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

async function guardarZona(zona) {
  localStorage.setItem(ZONA_KEY, zona);
  actualizarLocationBar();
  if (typeof clienteEstaLogueado === 'function' && clienteEstaLogueado()) {
    try {
      await Api.clienteActualizarZona(zona);
    } catch (err) {
      // si falla el guardado en la cuenta, al menos queda en este navegador
    }
  }
  if (typeof mostrarToast === 'function') mostrarToast('Ubicación guardada', 'success');
}

// Trae la zona guardada en la cuenta (si la hay) y la sincroniza a este navegador
async function sincronizarZonaDesdeCuenta() {
  if (typeof clienteEstaLogueado !== 'function' || !clienteEstaLogueado()) return;
  try {
    const perfil = await Api.clientePerfil();
    if (perfil.zona) {
      localStorage.setItem(ZONA_KEY, perfil.zona);
      actualizarLocationBar();
    }
  } catch (err) {
    // sin conexion o token vencido: se queda con lo que haya en este navegador
  }
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

// onListo (opcional): callback tras guardar u omitir. Se usa en el
// flujo de bienvenida justo despues de crear cuenta / iniciar sesion.
function abrirSelectorUbicacion(onListo) {
  const root = obtenerModalRoot();
  const puedeOmitir = typeof onListo === 'function';

  root.innerHTML = `
    <div class="modal-overlay" id="ubicacion-overlay">
      <div class="modal-box">
        <h3>¿Dónde estás en la playa?</h3>
        <p class="text-sm text-muted">Elige tu zona para agilizar tus próximos pedidos. Queda guardada en tu cuenta.</p>
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
        ${puedeOmitir ? '<button type="button" class="btn btn-ghost btn-block mt-8" id="btn-omitir-zona">Ahora no</button>' : ''}
      </div>
    </div>
  `;

  const confirmar = async (zona) => {
    await guardarZona(zona);
    cerrarSelectorUbicacion();
    if (onListo) onListo();
  };

  if (!puedeOmitir) {
    document.getElementById('ubicacion-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'ubicacion-overlay') cerrarSelectorUbicacion();
    });
  }
  root.querySelectorAll('[data-zona]').forEach((btn) => {
    btn.addEventListener('click', () => confirmar(btn.dataset.zona));
  });
  document.getElementById('btn-guardar-zona').addEventListener('click', () => {
    const valor = document.getElementById('zona-input-libre').value.trim();
    if (valor) confirmar(valor);
  });
  if (puedeOmitir) {
    document.getElementById('btn-omitir-zona').addEventListener('click', () => {
      cerrarSelectorUbicacion();
      onListo();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarLocationBar();
  sincronizarZonaDesdeCuenta();
  document.querySelectorAll('.location-bar').forEach((bar) => {
    bar.addEventListener('click', () => abrirSelectorUbicacion());
  });
});
