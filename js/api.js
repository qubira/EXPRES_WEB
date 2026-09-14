// ============================================================
// Configuracion y cliente HTTP para la API de Express Ancon
// ============================================================

// La URL base se define en js/config.js (window.EXPRESS_API_BASE).
const API_BASE_URL = (window.EXPRESS_API_BASE || 'http://localhost:4000') + '/api';

function authHeader(role) {
  const token = localStorage.getItem(`express_token_${role}`);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(path, { method = 'GET', body, role, isForm = false } = {}) {
  const headers = { ...(role ? authHeader(role) : {}) };
  let payload = body;

  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const error = new Error((data && data.error) || `Error ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

const Api = {
  // Publico
  getCategorias: () => apiRequest('/categorias'),
  getTiendas: (categoria) => apiRequest(`/tiendas${categoria ? `?categoria=${categoria}` : ''}`),
  getTienda: (id) => apiRequest(`/tiendas/${id}`),
  getProductos: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/productos${qs ? `?${qs}` : ''}`);
  },
  crearPedido: (data) => apiRequest('/pedidos', { method: 'POST', body: data, role: 'cliente' }),
  subirComprobante: (pedidoId, formData) => apiRequest(`/pedidos/${pedidoId}/pago`, { method: 'POST', body: formData, isForm: true }),
  getPedido: (id) => apiRequest(`/pedidos/${id}`),
  solicitarTienda: (data) => apiRequest('/tiendas/solicitud', { method: 'POST', body: data }),

  // Admin
  adminLogin: (data) => apiRequest('/admin/login', { method: 'POST', body: data }),
  adminMetricas: () => apiRequest('/admin/metricas', { role: 'admin' }),
  adminPedidos: (estado) => apiRequest(`/admin/pedidos${estado ? `?estado=${estado}` : ''}`, { role: 'admin' }),
  adminPagos: (estado) => apiRequest(`/admin/pagos${estado ? `?estado=${estado}` : ''}`, { role: 'admin' }),
  adminPedido: (id) => apiRequest(`/admin/pedidos/${id}`, { role: 'admin' }),
  adminConfirmarPago: (pagoId) => apiRequest(`/admin/pagos/${pagoId}/confirmar`, { method: 'POST', role: 'admin' }),
  adminRechazarPago: (pagoId) => apiRequest(`/admin/pagos/${pagoId}/rechazar`, { method: 'POST', role: 'admin' }),
  adminAsignarRepartidor: (pedidoId, repartidor_id) => apiRequest(`/admin/pedidos/${pedidoId}/asignar`, { method: 'POST', body: { repartidor_id }, role: 'admin' }),
  adminGetTiendas: () => apiRequest('/admin/tiendas', { role: 'admin' }),
  adminCrearTienda: (data) => apiRequest('/admin/tiendas', { method: 'POST', body: data, role: 'admin' }),
  adminActualizarTienda: (id, data) => apiRequest(`/admin/tiendas/${id}`, { method: 'PUT', body: data, role: 'admin' }),
  adminCambiarPasswordTienda: (id, password) => apiRequest(`/admin/tiendas/${id}/password`, { method: 'POST', body: { password }, role: 'admin' }),
  adminGetRepartidores: () => apiRequest('/admin/repartidores', { role: 'admin' }),
  adminCrearRepartidor: (data) => apiRequest('/admin/repartidores', { method: 'POST', body: data, role: 'admin' }),
  adminActualizarRepartidor: (id, data) => apiRequest(`/admin/repartidores/${id}`, { method: 'PUT', body: data, role: 'admin' }),
  adminLiquidarRepartidor: (id) => apiRequest(`/admin/repartidores/${id}/liquidar`, { method: 'POST', role: 'admin' }),
  adminGetProductos: (tiendaId) => apiRequest(`/admin/productos${tiendaId ? `?tienda_id=${tiendaId}` : ''}`, { role: 'admin' }),

  // Tienda
  tiendaLogin: (data) => apiRequest('/tienda/login', { method: 'POST', body: data }),
  tiendaPerfil: () => apiRequest('/tienda/perfil', { role: 'tienda' }),
  tiendaProductos: () => apiRequest('/tienda/productos', { role: 'tienda' }),
  tiendaCrearProducto: (data) => apiRequest('/tienda/productos', { method: 'POST', body: data, role: 'tienda' }),
  tiendaSubirImagen: (formData) => apiRequest('/tienda/upload', { method: 'POST', body: formData, isForm: true, role: 'tienda' }),
  tiendaActualizarProducto: (id, data) => apiRequest(`/tienda/productos/${id}`, { method: 'PUT', body: data, role: 'tienda' }),
  tiendaEliminarProducto: (id) => apiRequest(`/tienda/productos/${id}`, { method: 'DELETE', role: 'tienda' }),
  tiendaPedidos: () => apiRequest('/tienda/pedidos', { role: 'tienda' }),
  tiendaMarcarListo: (pedidoId, itemId) => apiRequest(`/tienda/pedidos/${pedidoId}/items/${itemId}/listo`, { method: 'POST', role: 'tienda' }),

  // Repartidor
  repartidorLogin: (data) => apiRequest('/repartidor/login', { method: 'POST', body: data }),
  repartidorPerfil: () => apiRequest('/repartidor/perfil', { role: 'repartidor' }),
  repartidorDisponibilidad: (disponible) => apiRequest('/repartidor/disponibilidad', { method: 'POST', body: { disponible }, role: 'repartidor' }),
  repartidorPedidos: () => apiRequest('/repartidor/pedidos', { role: 'repartidor' }),
  repartidorHistorial: () => apiRequest('/repartidor/pedidos/historial', { role: 'repartidor' }),
  repartidorPedido: (id) => apiRequest(`/repartidor/pedidos/${id}`, { role: 'repartidor' }),
  repartidorRecogido: (id) => apiRequest(`/repartidor/pedidos/${id}/recogido`, { method: 'POST', role: 'repartidor' }),
  repartidorEntregar: (id, pin) => apiRequest(`/repartidor/pedidos/${id}/entregar`, { method: 'POST', body: { pin }, role: 'repartidor' }),

  // Cliente (cuenta de usuario)
  clienteRegistro: (data) => apiRequest('/cliente/registro', { method: 'POST', body: data }),
  clienteLogin: (data) => apiRequest('/cliente/login', { method: 'POST', body: data }),
  clientePerfil: () => apiRequest('/cliente/perfil', { role: 'cliente' }),
  clienteActualizarPerfil: (data) => apiRequest('/cliente/perfil', { method: 'PUT', body: data, role: 'cliente' }),
  clienteCambiarPassword: (data) => apiRequest('/cliente/perfil/password', { method: 'POST', body: data, role: 'cliente' }),
  clienteEliminarCuenta: (password) => apiRequest('/cliente/perfil', { method: 'DELETE', body: { password }, role: 'cliente' }),
  clienteActualizarZona: (zona) => apiRequest('/cliente/zona', { method: 'POST', body: { zona }, role: 'cliente' }),
  clientePedidos: () => apiRequest('/cliente/pedidos', { role: 'cliente' }),
};

function uploadsUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const base = API_BASE_URL.replace(/\/api$/, '');
  return `${base}${path}`;
}

function mostrarToast(mensaje, tipo = '') {
  const existente = document.querySelector('.toast');
  if (existente) existente.remove();
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = mensaje;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function formatoSoles(monto) {
  return `S/ ${Number(monto || 0).toFixed(2)}`;
}

const ESTADO_LABELS = {
  pendiente_pago: 'Pendiente de pago',
  pago_rechazado: 'Pago rechazado',
  pagado: 'Pago confirmado',
  preparando: 'Preparando',
  listo_recoger: 'Listo para recoger',
  recogido: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

function labelEstado(estado) {
  return ESTADO_LABELS[estado] || estado;
}
