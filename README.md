# Express Ancón — Web (frontend)

Sitio 100% estático (HTML + CSS + JS vanilla), mobile-first, pensado para desplegarse en **Vercel**.

## Estructura

```
WEB/
  index.html              Landing page pública
  catalogo.html           Catálogo público con filtros por categoría
  carrito.html            Carrito + datos de entrega
  pago.html               Subida de comprobante Yape/Plin
  pedido.html             Seguimiento del pedido + PIN de entrega
  registro-tienda.html    Formulario de solicitud para nuevas tiendas
  admin/                  Panel del administrador (dueño de la plataforma)
  panel-tienda/           Panel para tiendas/ambulantes socios
  panel-repartidor/       Panel para repartidores en bicicleta
  css/styles.css          Sistema de diseño (tema playa: mar, arena, coral)
  js/                     Lógica de cada pantalla + cliente API (js/api.js)
```

## Configurar la URL de la API

Antes de desplegar, edita **`js/config.js`** y coloca la URL pública de tu API en Render:

```js
window.EXPRESS_API_BASE = 'https://tu-api.onrender.com';
```

Ese es el único cambio necesario para conectar el frontend con el backend.

## Probar en local

No requiere build. Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
npx serve .
```

Asegúrate de que la API (`API/`) esté corriendo (por defecto en `http://localhost:4000`) y que `js/config.js` apunte a esa URL en local.

## Desplegar en Vercel

1. Sube esta carpeta como el repositorio Git dedicado al frontend.
2. En Vercel: **New Project**, importa el repo y configura:
   - **Framework Preset:** Other (sitio estático, sin build)
3. Despliega. Vercel servirá los `.html` directamente (ej. `/catalogo.html`, `/admin/login.html`).
4. En la API (Render), agrega el dominio de Vercel a la variable `CORS_ORIGIN`.

## Accesos internos

- Panel administrador: `/admin/login.html`
- Panel de tienda: `/panel-tienda/login.html`
- Panel de repartidor: `/panel-repartidor/login.html`

Las credenciales de prueba se generan con `npm run seed` en la API (ver `API/README.md`).
