// ============================================================
// Selector de ubicacion (zona dentro de Playa Ancon)
// Si el cliente tiene sesion, la zona queda ligada a su cuenta.
// ============================================================

const ZONA_KEY = 'express_zona_entrega';

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
  // avisa a la pagina actual (catalogo, producto, portada) para que refresque
  // lo que depende de la zona sin necesidad de recargar.
  document.dispatchEvent(new CustomEvent('zona-actualizada', { detail: { zona } }));
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
// Solo se puede elegir una zona real (la misma lista que usan las tiendas):
// asi el catalogo puede filtrar por zona con la certeza de que va a
// coincidir con alguna tienda.
async function abrirSelectorUbicacion(onListo) {
  const root = obtenerModalRoot();
  const puedeOmitir = typeof onListo === 'function';

  root.innerHTML = `
    <div class="modal-overlay" id="ubicacion-overlay">
      <div class="modal-box">
        <h3>¿Dónde estás en la playa?</h3>
        <p class="text-sm text-muted">Elige tu zona para ver las tiendas y productos disponibles ahí. Queda guardada en tu cuenta.</p>
        <div class="flex flex-col gap-8 mt-16" id="lista-zonas-picker">
          <p class="text-muted text-sm">Cargando zonas...</p>
        </div>
        ${puedeOmitir ? '<button type="button" class="btn btn-ghost btn-block mt-16" id="btn-omitir-zona">Ahora no</button>' : ''}
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
  if (puedeOmitir) {
    document.getElementById('btn-omitir-zona').addEventListener('click', () => {
      cerrarSelectorUbicacion();
      onListo();
    });
  }

  try {
    const zonas = await Api.getZonas();
    const lista = document.getElementById('lista-zonas-picker');
    if (!lista) return; // el modal se cerro mientras cargaba
    lista.innerHTML = zonas.map((z) => `
      <button class="btn btn-outline btn-block" data-zona="${z}" style="justify-content:flex-start;">📍 ${z}</button>
    `).join('') || '<p class="text-muted text-sm">Aún no hay zonas registradas.</p>';
    lista.querySelectorAll('[data-zona]').forEach((btn) => {
      btn.addEventListener('click', () => confirmar(btn.dataset.zona));
    });
  } catch (err) {
    const lista = document.getElementById('lista-zonas-picker');
    if (lista) lista.innerHTML = '<p class="form-error">No se pudieron cargar las zonas.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarLocationBar();
  sincronizarZonaDesdeCuenta();
  document.querySelectorAll('.location-bar').forEach((bar) => {
    bar.addEventListener('click', () => abrirSelectorUbicacion());
  });
});
