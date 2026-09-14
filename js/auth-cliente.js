// ============================================================
// Sesion de cliente (cuenta de usuario, opcional para checkout)
// ============================================================

function getClienteToken() {
  return localStorage.getItem('express_token_cliente');
}

function getClienteNombre() {
  return localStorage.getItem('express_nombre_cliente') || '';
}

function clienteEstaLogueado() {
  return !!getClienteToken();
}

function guardarSesionCliente(token, nombre) {
  localStorage.setItem('express_token_cliente', token);
  localStorage.setItem('express_nombre_cliente', nombre);
}

function cerrarSesionCliente() {
  localStorage.removeItem('express_token_cliente');
  localStorage.removeItem('express_nombre_cliente');
  actualizarCuentaNav();
  location.href = 'index.html';
}

function cerrarDropdownsCuenta() {
  document.querySelectorAll('.account-dropdown').forEach((d) => d.classList.add('hidden'));
}

// Un dueño de tienda o un repartidor no maneja una cuenta aparte: si inicio
// sesion (aqui o en su propio panel), el menu de cuenta del sitio normal lo
// reconoce igual y le ofrece un acceso directo a su dashboard.
function getSesionActiva() {
  for (const rol of ['cliente', 'tienda', 'repartidor']) {
    const token = localStorage.getItem(`express_token_${rol}`);
    if (token) return { rol, nombre: localStorage.getItem(`express_nombre_${rol}`) || '' };
  }
  return null;
}

function cerrarSesionActiva() {
  const sesion = getSesionActiva();
  if (!sesion) return;
  localStorage.removeItem(`express_token_${sesion.rol}`);
  localStorage.removeItem(`express_nombre_${sesion.rol}`);
  actualizarCuentaNav();
  location.href = 'index.html';
}

const DASHBOARD_POR_ROL = {
  tienda: { href: 'panel-tienda/dashboard.html', etiqueta: '🏪 Ir a mi Dashboard' },
  repartidor: { href: 'panel-repartidor/dashboard.html', etiqueta: '🚴 Ir a mi Dashboard' },
};

function actualizarCuentaNav() {
  const sesion = getSesionActiva();
  document.querySelectorAll('.account-menu').forEach((menu) => {
    const iconEl = menu.querySelector('.account-btn');
    const nameEl = menu.querySelector('.account-name');
    const dropdown = menu.querySelector('.account-dropdown');
    if (!iconEl || !nameEl || !dropdown) return;

    if (!sesion) {
      nameEl.textContent = '';
      nameEl.classList.add('hidden');
      iconEl.classList.remove('con-sesion');
      dropdown.classList.add('hidden');
      return;
    }

    const primerNombre = sesion.nombre.split(' ')[0];
    nameEl.textContent = primerNombre;
    nameEl.classList.remove('hidden');
    iconEl.classList.add('con-sesion');

    if (sesion.rol === 'cliente') {
      dropdown.innerHTML = `
        <div class="account-dropdown-header">Hola, ${primerNombre}</div>
        <a href="mis-pedidos.html">📦 Mis pedidos</a>
        <a href="mi-cuenta.html">✏️ Editar datos</a>
        <button type="button" class="btn-logout-cuenta salir">🚪 Cerrar sesión</button>
      `;
    } else {
      const d = DASHBOARD_POR_ROL[sesion.rol];
      dropdown.innerHTML = `
        <div class="account-dropdown-header">Hola, ${primerNombre}</div>
        <a href="${d.href}">${d.etiqueta}</a>
        <button type="button" class="btn-logout-cuenta salir">🚪 Cerrar sesión</button>
      `;
    }

    dropdown.querySelector('.btn-logout-cuenta').addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesionActiva();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarCuentaNav();

  document.querySelectorAll('.account-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!getSesionActiva()) {
        const next = trigger.dataset.next;
        location.href = next ? `login.html?next=${encodeURIComponent(next)}` : 'login.html';
        return;
      }

      const dropdown = trigger.closest('.account-menu').querySelector('.account-dropdown');
      const yaAbierto = !dropdown.classList.contains('hidden');
      cerrarDropdownsCuenta();
      dropdown.classList.toggle('hidden', yaAbierto);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account-menu')) cerrarDropdownsCuenta();
  });
});
