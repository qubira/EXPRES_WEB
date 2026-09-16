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
  getCategorias: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/categorias${qs ? `?${qs}` : ''}`);
  },
  getTiposNegocio: () => apiRequest('/tipos-negocio'),
  agregarTipoNegocio: (etiqueta, role) => apiRequest('/tipos-negocio', { method: 'POST', body: { etiqueta }, role }),
  getZonas: () => apiRequest('/zonas'),
  getTiendas: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/tiendas${qs ? `?${qs}` : ''}`);
  },
  getTienda: (id) => apiRequest(`/tiendas/${id}`),
  getProductos: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/productos${qs ? `?${qs}` : ''}`);
  },
  getProducto: (id, zona) => apiRequest(`/productos/${id}${zona ? `?zona=${encodeURIComponent(zona)}` : ''}`),
  crearPedido: (data) => apiRequest('/pedidos', { method: 'POST', body: data, role: 'cliente' }),
  subirComprobante: (pedidoId, formData) => apiRequest(`/pedidos/${pedidoId}/pago`, { method: 'POST', body: formData, isForm: true }),
  getPedido: (id) => apiRequest(`/pedidos/${id}`),
  solicitarTienda: (data) => apiRequest('/tiendas/solicitud', { method: 'POST', body: data }),
  loginUnificado: (data) => apiRequest('/login', { method: 'POST', body: data }),
  misSesiones: (role) => apiRequest('/mis-sesiones', { role }),
  cerrarSesionRemota: (id, role) => apiRequest(`/mis-sesiones/${id}/cerrar`, { method: 'POST', role }),
  cerrarOtrasSesiones: (role) => apiRequest('/mis-sesiones/cerrar-otras', { method: 'POST', role }),
  consultarDni: (numero) => apiRequest(`/consulta-dni/${numero}`),
  consultarCe: (numero) => apiRequest(`/consulta-ce/${numero}`),

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
  adminProductosTienda: (id) => apiRequest(`/admin/tiendas/${id}/productos`, { role: 'admin' }),
  adminCrearTienda: (data) => apiRequest('/admin/tiendas', { method: 'POST', body: data, role: 'admin' }),
  adminActualizarTienda: (id, data) => apiRequest(`/admin/tiendas/${id}`, { method: 'PUT', body: data, role: 'admin' }),
  adminCambiarPasswordTienda: (id, password) => apiRequest(`/admin/tiendas/${id}/password`, { method: 'POST', body: { password }, role: 'admin' }),
  adminGetRepartidores: () => apiRequest('/admin/repartidores', { role: 'admin' }),
  adminPedidosRepartidor: (id) => apiRequest(`/admin/repartidores/${id}/pedidos`, { role: 'admin' }),
  adminCrearRepartidor: (data) => apiRequest('/admin/repartidores', { method: 'POST', body: data, role: 'admin' }),
  adminActualizarRepartidor: (id, data) => apiRequest(`/admin/repartidores/${id}`, { method: 'PUT', body: data, role: 'admin' }),
  adminLiquidarRepartidor: (id) => apiRequest(`/admin/repartidores/${id}/liquidar`, { method: 'POST', role: 'admin' }),
  adminGetProductos: (tiendaId) => apiRequest(`/admin/productos${tiendaId ? `?tienda_id=${tiendaId}` : ''}`, { role: 'admin' }),
  adminAuditoria: (rol) => apiRequest(`/admin/auditoria${rol ? `?rol=${rol}` : ''}`, { role: 'admin' }),
  adminUsuarios: () => apiRequest('/admin/usuarios', { role: 'admin' }),
  adminActualizarUsuario: (id, data) => apiRequest(`/admin/usuarios/${id}`, { method: 'PUT', body: data, role: 'admin' }),
  adminCambiarPasswordUsuario: (id, password) => apiRequest(`/admin/usuarios/${id}/password`, { method: 'POST', body: { password }, role: 'admin' }),
  adminIncidentesUsuario: (id) => apiRequest(`/admin/usuarios/${id}/incidentes`, { role: 'admin' }),
  adminReportarIncidente: (id, tipo, descripcion) => apiRequest(`/admin/usuarios/${id}/incidentes`, { method: 'POST', body: { tipo, descripcion }, role: 'admin' }),
  adminSuspenderUsuario: (id, motivo) => apiRequest(`/admin/usuarios/${id}/suspender`, { method: 'POST', body: { motivo }, role: 'admin' }),
  adminBloquearUsuario: (id, motivo) => apiRequest(`/admin/usuarios/${id}/bloquear`, { method: 'POST', body: { motivo }, role: 'admin' }),
  adminReactivarUsuario: (id) => apiRequest(`/admin/usuarios/${id}/reactivar`, { method: 'POST', role: 'admin' }),
  adminReclamos: (estado) => apiRequest(`/admin/reclamos${estado ? `?estado=${estado}` : ''}`, { role: 'admin' }),
  adminResolverReclamo: (id, data) => apiRequest(`/admin/reclamos/${id}/resolver`, { method: 'POST', body: data, role: 'admin' }),
  adminRegistrarReclamo: (data) => apiRequest('/admin/reclamos', { method: 'POST', body: data, role: 'admin' }),
  adminBuscarUsuarioPorEmail: (email) => apiRequest(`/admin/usuarios/buscar-por-email?email=${encodeURIComponent(email)}`, { role: 'admin' }),
  adminPedidosRetenidos: () => apiRequest('/admin/pedidos-retenidos', { role: 'admin' }),
  adminLiberarPago: (pedidoId) => apiRequest(`/admin/pedidos/${pedidoId}/liberar-pago`, { method: 'POST', role: 'admin' }),
  adminObservacionesRepartidor: (estado) => apiRequest(`/admin/observaciones-repartidor${estado ? `?estado=${estado}` : ''}`, { role: 'admin' }),
  adminConfirmarObservacion: (id) => apiRequest(`/admin/observaciones-repartidor/${id}/confirmar`, { method: 'POST', role: 'admin' }),
  adminDescartarObservacion: (id) => apiRequest(`/admin/observaciones-repartidor/${id}/descartar`, { method: 'POST', role: 'admin' }),
  adminSubirImagen: (formData, carpeta = 'repartidores') => apiRequest(`/admin/upload?carpeta=${carpeta}`, { method: 'POST', body: formData, isForm: true, role: 'admin' }),

  // Tienda
  tiendaLogin: (data) => apiRequest('/tienda/login', { method: 'POST', body: data }),
  tiendaPerfil: () => apiRequest('/tienda/perfil', { role: 'tienda' }),
  tiendaActualizarPerfil: (data) => apiRequest('/tienda/perfil', { method: 'PUT', body: data, role: 'tienda' }),
  tiendaCambiarPassword: (data) => apiRequest('/tienda/perfil/password', { method: 'POST', body: data, role: 'tienda' }),
  tiendaDisponibilidad: (disponible) => apiRequest('/tienda/disponibilidad', { method: 'POST', body: { disponible }, role: 'tienda' }),
  tiendaProductos: () => apiRequest('/tienda/productos', { role: 'tienda' }),
  tiendaCrearProducto: (data) => apiRequest('/tienda/productos', { method: 'POST', body: data, role: 'tienda' }),
  tiendaSubirImagen: (formData) => apiRequest('/tienda/upload', { method: 'POST', body: formData, isForm: true, role: 'tienda' }),
  tiendaActualizarProducto: (id, data) => apiRequest(`/tienda/productos/${id}`, { method: 'PUT', body: data, role: 'tienda' }),
  tiendaEliminarProducto: (id) => apiRequest(`/tienda/productos/${id}`, { method: 'DELETE', role: 'tienda' }),
  tiendaPedidos: () => apiRequest('/tienda/pedidos', { role: 'tienda' }),
  tiendaConfirmarItem: (pedidoId, itemId) => apiRequest(`/tienda/pedidos/${pedidoId}/items/${itemId}/confirmar`, { method: 'POST', role: 'tienda' }),
  tiendaMarcarListo: (pedidoId, itemId) => apiRequest(`/tienda/pedidos/${pedidoId}/items/${itemId}/listo`, { method: 'POST', role: 'tienda' }),

  // Repartidor
  repartidorLogin: (data) => apiRequest('/repartidor/login', { method: 'POST', body: data }),
  repartidorPerfil: () => apiRequest('/repartidor/perfil', { role: 'repartidor' }),
  repartidorSubirImagen: (formData) => apiRequest('/repartidor/upload', { method: 'POST', body: formData, isForm: true, role: 'repartidor' }),
  repartidorActualizarPerfil: (data) => apiRequest('/repartidor/perfil', { method: 'PUT', body: data, role: 'repartidor' }),
  repartidorCambiarPassword: (data) => apiRequest('/repartidor/perfil/password', { method: 'POST', body: data, role: 'repartidor' }),
  repartidorDisponibilidad: (disponible) => apiRequest('/repartidor/disponibilidad', { method: 'POST', body: { disponible }, role: 'repartidor' }),
  repartidorPedidos: () => apiRequest('/repartidor/pedidos', { role: 'repartidor' }),
  repartidorPedidosDisponibles: () => apiRequest('/repartidor/pedidos/disponibles', { role: 'repartidor' }),
  repartidorReclamarPedido: (id) => apiRequest(`/repartidor/pedidos/${id}/reclamar`, { method: 'POST', role: 'repartidor' }),
  repartidorHistorial: () => apiRequest('/repartidor/pedidos/historial', { role: 'repartidor' }),
  repartidorPedido: (id) => apiRequest(`/repartidor/pedidos/${id}`, { role: 'repartidor' }),
  repartidorRecogido: (id) => apiRequest(`/repartidor/pedidos/${id}/recogido`, { method: 'POST', role: 'repartidor' }),
  repartidorEntregar: (id, pin) => apiRequest(`/repartidor/pedidos/${id}/entregar`, { method: 'POST', body: { pin }, role: 'repartidor' }),
  repartidorEntregarSinPin: (id) => apiRequest(`/repartidor/pedidos/${id}/entregar-sin-pin`, { method: 'POST', role: 'repartidor' }),
  repartidorRechazado: (id, motivo) => apiRequest(`/repartidor/pedidos/${id}/rechazado`, { method: 'POST', body: { motivo }, role: 'repartidor' }),
  repartidorUbicacion: (id, lat, lng) => apiRequest(`/repartidor/pedidos/${id}/ubicacion`, { method: 'POST', body: { lat, lng }, role: 'repartidor' }),
  repartidorObservacion: (id, dirigido_a, tipo, descripcion) => apiRequest(`/repartidor/pedidos/${id}/observacion`, { method: 'POST', body: { dirigido_a, tipo, descripcion }, role: 'repartidor' }),
  repartidorEncuesta: (id, data) => apiRequest(`/repartidor/pedidos/${id}/encuesta`, { method: 'POST', body: data, role: 'repartidor' }),

  // Cliente (cuenta de usuario)
  clienteRegistro: (data) => apiRequest('/cliente/registro', { method: 'POST', body: data }),
  clienteLogin: (data) => apiRequest('/cliente/login', { method: 'POST', body: data }),
  clientePerfil: () => apiRequest('/cliente/perfil', { role: 'cliente' }),
  clienteActualizarPerfil: (data) => apiRequest('/cliente/perfil', { method: 'PUT', body: data, role: 'cliente' }),
  clienteCambiarPassword: (data) => apiRequest('/cliente/perfil/password', { method: 'POST', body: data, role: 'cliente' }),
  clienteEliminarCuenta: (password) => apiRequest('/cliente/perfil', { method: 'DELETE', body: { password }, role: 'cliente' }),
  clienteActualizarZona: (zona) => apiRequest('/cliente/zona', { method: 'POST', body: { zona }, role: 'cliente' }),
  clientePedidos: () => apiRequest('/cliente/pedidos', { role: 'cliente' }),
  clienteCancelarPedido: (id) => apiRequest(`/cliente/pedidos/${id}/cancelar`, { method: 'POST', role: 'cliente' }),
  clienteReclamo: (id, motivo, descripcion, imagenes = []) => {
    if (imagenes.length === 0) {
      return apiRequest(`/cliente/pedidos/${id}/reclamo`, { method: 'POST', body: { motivo, descripcion }, role: 'cliente' });
    }
    const fd = new FormData();
    fd.append('motivo', motivo);
    fd.append('descripcion', descripcion || '');
    imagenes.forEach((f) => fd.append('imagenes', f));
    return apiRequest(`/cliente/pedidos/${id}/reclamo`, { method: 'POST', body: fd, isForm: true, role: 'cliente' });
  },
  clienteReclamosPedido: (id) => apiRequest(`/cliente/pedidos/${id}/reclamos`, { role: 'cliente' }),

  // Libro de Reclamaciones Virtual (publico, sin necesidad de cuenta)
  libroReclamaciones: (datos, imagenes = []) => {
    const fd = new FormData();
    Object.entries(datos).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
    imagenes.forEach((f) => fd.append('imagenes', f));
    return apiRequest('/libro-reclamaciones', { method: 'POST', body: fd, isForm: true });
  },
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

// Reemplazan confirm()/prompt() nativos (que el navegador muestra sin el
// diseño del sitio) por un modal propio. Usan su propio contenedor
// (#dialogo-modal-root, con z-index por encima de .modal-overlay) en vez de
// #modal-root, porque a veces se llaman con otro modal ya abierto detras
// (ej. suspender una cuenta desde dentro del modal "Editar usuario").
function _abrirDialogoModal(html) {
  let root = document.getElementById('dialogo-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dialogo-modal-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `<div class="modal-overlay" id="dialogo-modal-overlay" style="z-index:400;">${html}</div>`;
  return root;
}
function _cerrarDialogoModal() {
  const root = document.getElementById('dialogo-modal-root');
  if (root) root.innerHTML = '';
}

function confirmModal(mensaje, opciones = {}) {
  const { titulo = '¿Estás seguro?', textoAceptar = 'Aceptar', textoCancelar = 'Cancelar', peligro = false } = opciones;
  return new Promise((resolve) => {
    _abrirDialogoModal(`
      <div class="modal-box" style="max-width:380px;">
        <h3 style="margin-top:0;">${titulo}</h3>
        <p class="text-sm" style="color:var(--tinta-600);">${mensaje}</p>
        <div class="flex gap-8 mt-16">
          <button type="button" class="btn btn-outline btn-block" id="dialogo-cancelar">${textoCancelar}</button>
          <button type="button" class="btn ${peligro ? 'btn-danger' : 'btn-primary'} btn-block" id="dialogo-aceptar">${textoAceptar}</button>
        </div>
      </div>
    `);
    const cerrar = (resultado) => { _cerrarDialogoModal(); resolve(resultado); };
    document.getElementById('dialogo-aceptar').addEventListener('click', () => cerrar(true));
    document.getElementById('dialogo-cancelar').addEventListener('click', () => cerrar(false));
    document.getElementById('dialogo-modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'dialogo-modal-overlay') cerrar(false); });
  });
}

function promptModal(mensaje, opciones = {}) {
  const { titulo = '', textoAceptar = 'Aceptar', textoCancelar = 'Cancelar', placeholder = '', valorInicial = '' } = opciones;
  return new Promise((resolve) => {
    _abrirDialogoModal(`
      <div class="modal-box" style="max-width:380px;">
        ${titulo ? `<h3 style="margin-top:0;">${titulo}</h3>` : ''}
        <p class="text-sm" style="color:var(--tinta-600);">${mensaje}</p>
        <div class="form-grupo"><input id="dialogo-input" value="${valorInicial}" placeholder="${placeholder}"></div>
        <div class="flex gap-8">
          <button type="button" class="btn btn-outline btn-block" id="dialogo-cancelar">${textoCancelar}</button>
          <button type="button" class="btn btn-primary btn-block" id="dialogo-aceptar">${textoAceptar}</button>
        </div>
      </div>
    `);
    const input = document.getElementById('dialogo-input');
    input.focus();
    const cerrar = (resultado) => { _cerrarDialogoModal(); resolve(resultado); };
    document.getElementById('dialogo-aceptar').addEventListener('click', () => cerrar(input.value));
    document.getElementById('dialogo-cancelar').addEventListener('click', () => cerrar(null));
    document.getElementById('dialogo-modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'dialogo-modal-overlay') cerrar(null); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cerrar(input.value); });
  });
}

// Refresca datos automaticamente sin que el usuario tenga que recargar la
// pagina (ej. si una tienda cambia un precio o nombre mientras alguien esta
// viendo el catalogo). Se pausa cuando la pestaña esta en segundo plano para
// no gastar peticiones de mas, y refresca de inmediato al volver a ella.
function iniciarAutoRefresco(fn, intervaloMs = 20000) {
  setInterval(() => {
    if (!document.hidden) fn();
  }, intervaloMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fn();
  });
}

function formatoSoles(monto) {
  return `S/ ${Number(monto || 0).toFixed(2)}`;
}

const UNIDAD_LABELS = {
  unidad: 'unidad', kg: 'Kg', g: 'g', l: 'L', ml: 'ml', cm: 'cm', m: 'm',
  paquete: 'paquete', docena: 'docena',
};
function labelUnidad(unidad) {
  return UNIDAD_LABELS[unidad] || unidad || 'unidad';
}

// Combina el numero (contenido) con el tipo de unidad, ej: 500 + 'g' -> "500 g".
// Si no hay numero (productos viejos sin este dato), muestra solo el tipo de unidad.
function formatoContenido(contenido, unidad) {
  const etiqueta = labelUnidad(unidad);
  if (contenido == null || contenido === '') return etiqueta;
  const numero = Number(contenido);
  const numeroTexto = Number.isInteger(numero) ? numero : numero.toFixed(2).replace(/\.?0+$/, '');
  return `${numeroTexto} ${etiqueta}`;
}

// Conecta un boton "Buscar" a un input de DNI: al hacer click, consulta RENIEC
// y autocompleta el input de nombre. Si falla, no bloquea (se llena a mano).
function habilitarBuscarDni(dniInputId, nombreInputId, btnId) {
  const btn = document.getElementById(btnId);
  const dniInput = document.getElementById(dniInputId);
  const nombreInput = document.getElementById(nombreInputId);
  if (!btn || !dniInput || !nombreInput) return;
  btn.addEventListener('click', async () => {
    const numero = dniInput.value.trim();
    if (!/^\d{8}$/.test(numero)) {
      mostrarToast('Ingresa un DNI válido de 8 dígitos', 'error');
      return;
    }
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Buscando...';
    try {
      const { nombre } = await Api.consultarDni(numero);
      nombreInput.value = nombre || '';
      mostrarToast('Nombre encontrado', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se encontró el DNI, ingresa el nombre manualmente', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
}

// Igual que habilitarBuscarDni, pero para Carne de Extranjeria (sin formato fijo de digitos).
function habilitarBuscarCe(ceInputId, nombreInputId, btnId) {
  const btn = document.getElementById(btnId);
  const ceInput = document.getElementById(ceInputId);
  const nombreInput = document.getElementById(nombreInputId);
  if (!btn || !ceInput || !nombreInput) return;
  btn.addEventListener('click', async () => {
    const numero = ceInput.value.trim();
    if (!numero) {
      mostrarToast('Ingresa el número de CE', 'error');
      return;
    }
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Buscando...';
    try {
      const { nombre } = await Api.consultarCe(numero);
      nombreInput.value = nombre || '';
      mostrarToast('Nombre encontrado', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se encontró el CE, ingresa el nombre manualmente', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
}

async function zonaOptionsHtml(seleccionada) {
  const zonas = await Api.getZonas();
  return `<option value="">Selecciona una zona</option>` +
    zonas.map((z) => `<option value="${z}" ${z === seleccionada ? 'selected' : ''}>${z}</option>`).join('');
}

// Conecta un boton "+" a un <select> de tipo de negocio: pide el nombre y lo agrega
// a la lista compartida (queda disponible para todos desde ese momento).
function habilitarAgregarTipoNegocio(selectId, btnId, role) {
  const btn = document.getElementById(btnId);
  const select = document.getElementById(selectId);
  if (!btn || !select) return;
  btn.addEventListener('click', async () => {
    const etiqueta = ((await promptModal('Nombre del nuevo tipo de negocio', { titulo: 'Agregar tipo de negocio', placeholder: 'Ej. Chichería' })) || '').trim();
    if (!etiqueta) return;
    try {
      const nuevo = await Api.agregarTipoNegocio(etiqueta, role);
      const opt = document.createElement('option');
      opt.value = nuevo.clave;
      opt.textContent = nuevo.etiqueta;
      select.appendChild(opt);
      select.value = nuevo.clave;
      mostrarToast('Tipo de negocio agregado', 'success');
    } catch (err) {
      mostrarToast(err.message || 'No se pudo agregar', 'error');
    }
  });
}

// ---------- Conectividad (sesiones activas de la cuenta) ----------
function resumenDispositivo(ua) {
  if (!ua) return 'Dispositivo desconocido';
  let nav = 'Navegador';
  if (/Edg\//.test(ua)) nav = 'Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) nav = 'Chrome';
  else if (/Firefox\//.test(ua)) nav = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) nav = 'Safari';
  let so = '';
  if (/Windows/.test(ua)) so = 'Windows';
  else if (/Android/.test(ua)) so = 'Android';
  else if (/iPhone|iPad/.test(ua)) so = 'iOS';
  else if (/Mac OS/.test(ua)) so = 'Mac';
  else if (/Linux/.test(ua)) so = 'Linux';
  return so ? `${nav} · ${so}` : nav;
}
function iconoDispositivo(ua) {
  if (!ua) return '🖥️';
  if (/Android|iPhone|iPad/.test(ua)) return '📱';
  return '🖥️';
}

// role: 'tienda' | 'repartidor' | 'admin' | 'cliente'. Reutilizable en cualquier panel.
async function cargarConectividad(role, listaId, btnOtrasId) {
  const cont = document.getElementById(listaId);
  if (!cont) return;
  cont.innerHTML = '<p class="text-muted">Cargando...</p>';
  try {
    const sesiones = await Api.misSesiones(role);
    if (sesiones.length === 0) {
      cont.innerHTML = '<p class="text-muted">No hay sesiones activas.</p>';
      return;
    }
    cont.innerHTML = sesiones.map((s) => `
      <div class="card card-pad-sm mt-8 flex justify-between items-center sesion-card ${s.actual ? 'sesion-actual' : ''}" style="flex-wrap:wrap; gap:8px;">
        <div class="flex items-center gap-8">
          <span class="sesion-icon">${iconoDispositivo(s.user_agent)}</span>
          <div>
            <strong>${resumenDispositivo(s.user_agent)}</strong>
            ${s.actual ? '<span class="tag" style="background:#e9f9ee;color:var(--verde-palma);margin-left:6px;">Esta sesión</span>' : ''}
            <div class="text-sm text-muted">IP: ${s.ip || '—'} · Conectado: ${new Date(s.creado_en).toLocaleString('es-PE')}</div>
          </div>
        </div>
        ${s.actual ? '' : `<button class="btn btn-outline btn-xs" data-cerrar-sesion="${s.id}">Cerrar sesión</button>`}
      </div>
    `).join('');

    cont.querySelectorAll('[data-cerrar-sesion]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!(await confirmModal('¿Cerrar esta sesión? Ese dispositivo tendrá que iniciar sesión de nuevo.'))) return;
      try {
        await Api.cerrarSesionRemota(btn.dataset.cerrarSesion, role);
        mostrarToast('Sesión cerrada', 'success');
        cargarConectividad(role, listaId, btnOtrasId);
      } catch (err) { mostrarToast(err.message, 'error'); }
    }));
  } catch (err) {
    cont.innerHTML = `<p class="form-error">${err.message}</p>`;
  }

  const btnOtras = document.getElementById(btnOtrasId);
  if (btnOtras) {
    btnOtras.onclick = async () => {
      if (!(await confirmModal('¿Cerrar todas las demás sesiones? Solo quedará activa esta.'))) return;
      try {
        const r = await Api.cerrarOtrasSesiones(role);
        mostrarToast(r.mensaje, 'success');
        cargarConectividad(role, listaId, btnOtrasId);
      } catch (err) { mostrarToast(err.message, 'error'); }
    };
  }
}

const TIPO_NEGOCIO_LABELS = {
  tienda: 'Tienda', minimarket: 'Minimarket', bazar: 'Bazar', ferreteria: 'Ferretería',
  heladeria: 'Heladería', restaurante: 'Restaurante', ambulante: 'Ambulante',
  boutique: 'Boutique / Ropa', artesanias: 'Artesanías', servicios_playa: 'Servicios de playa',
  otro: 'Otro',
};
function labelTipoNegocio(tipo) {
  return TIPO_NEGOCIO_LABELS[tipo] || tipo;
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
  rechazado_en_entrega: 'Rechazado en la entrega',
};

function labelEstado(estado) {
  return ESTADO_LABELS[estado] || estado;
}
