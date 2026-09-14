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

function actualizarCuentaNav() {
  const logueado = clienteEstaLogueado();
  document.querySelectorAll('.account-menu').forEach((menu) => {
    const iconEl = menu.querySelector('.account-btn');
    const nameEl = menu.querySelector('.account-name');
    const headerEl = menu.querySelector('.account-dropdown-header');
    if (!iconEl || !nameEl) return;

    if (logueado) {
      const primerNombre = getClienteNombre().split(' ')[0];
      nameEl.textContent = primerNombre;
      nameEl.classList.remove('hidden');
      iconEl.classList.add('con-sesion');
      if (headerEl) headerEl.textContent = `Hola, ${primerNombre}`;
    } else {
      nameEl.textContent = '';
      nameEl.classList.add('hidden');
      iconEl.classList.remove('con-sesion');
      const dropdown = menu.querySelector('.account-dropdown');
      if (dropdown) dropdown.classList.add('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarCuentaNav();

  document.querySelectorAll('.account-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!clienteEstaLogueado()) {
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

  document.querySelectorAll('.btn-logout-cuenta').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesionCliente();
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account-menu')) cerrarDropdownsCuenta();
  });
});
