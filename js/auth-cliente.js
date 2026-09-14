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
}

function actualizarCuentaNav() {
  const logueado = clienteEstaLogueado();
  document.querySelectorAll('.account-btn').forEach((btn) => {
    if (logueado) {
      btn.href = 'mis-pedidos.html';
      btn.title = `Hola, ${getClienteNombre()}`;
    } else {
      const next = btn.dataset.next;
      btn.href = next ? `login.html?next=${encodeURIComponent(next)}` : 'login.html';
      btn.title = 'Iniciar sesión';
    }
    btn.classList.toggle('con-sesion', logueado);
  });
}

document.addEventListener('DOMContentLoaded', actualizarCuentaNav);
