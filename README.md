# Zairen Lab — Catálogo Digital

> Catálogo de productos con panel de administración, métricas y backend en Supabase.  
> Streetwear, anime y cultura pop con diseño minimalista japonés.

---

## Descripción

Sistema de catálogo web completo para **Zairen Lab**. Permite gestionar productos, secciones, stock, notificaciones y métricas de negocio desde un panel de administración privado. El catálogo público consume todos los datos en tiempo real desde **Supabase (PostgreSQL)**.

---

## Estructura del Proyecto

```
CatalogoV0/
├── Public/
│   ├── index.html              # Catálogo público (vista principal)
│   ├── favicon.ico             # Ícono del navegador
│   ├── admin/
│   │   ├── index.html          # Panel de administración (CMS)
│   │   ├── css/
│   │   │   ├── admin.css       # Estilos del panel admin
│   │   │   └── tokens.css      # Variables CSS del admin
│   │   └── js/
│   │       └── admin.js        # Lógica completa del CMS admin
│   ├── css/
│   │   ├── reset.css           # Reset CSS base
│   │   ├── tokens.css          # Variables CSS del catálogo
│   │   ├── components.css      # Componentes reutilizables
│   │   ├── catalog.css         # Estilos del catálogo
│   │   └── detail.css          # Estilos del modal de detalle
│   ├── js/
│   │   ├── storage.js          # Cliente Supabase — carga/guardado de datos
│   │   ├── catalog.js          # Renderizado del catálogo público
│   │   ├── detail.js           # Modal de detalle del producto
│   │   ├── whatsapp.js         # Generador de enlace WhatsApp
│   │   ├── theme.js            # Toggle claro/oscuro
│   │   └── tailwind-config.js  # Configuración de Tailwind (utilidades)
│   ├── data/
│   │   └── products.json       # Fallback local (sin Supabase activo)
│   ├── assets/                 # Imágenes de productos
│   └── Indicaciones_Supabase.md  # Manual técnico de integración
└── MANUAL_CATALOGO.md          # Manual de uso para el dueño del catálogo
```

---

## Tech Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + Vanilla CSS + JavaScript (ES2022+) |
| Estilos | Vanilla CSS + Tailwind CSS (utilidades) |
| Fuentes | Google Fonts (Hanken Grotesk, JetBrains Mono, DotGothic16, Noto Sans JP) |
| Iconos | Google Material Symbols |
| Backend / DB | [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS) |
| Gráficos | [Chart.js](https://www.chartjs.org/) |
| QR | [QR Server API](https://goqr.me/api/) |

---

## Funcionalidades

### Catálogo Público (`/`)
- Visualización de productos organizados por secciones colapsables.
- Filtros dinámicos por tipo y estado.
- Búsqueda instantánea desde la navbar.
- Modal de detalle con selector de talla y botón de WhatsApp.
- Favoritos persistidos en `localStorage`.
- Notificaciones en tiempo real desde el admin.
- Modo claro / oscuro.
- Compartir sección vía QR.
- Fondo con gradiente de malla animado.
- Loader de entrada elegante con tipografía Zairen.

### Panel de Administración (`/admin/`)
- **Inventario**: Listado completo con búsqueda, filtros y ordenamiento.
- **Agregar / Editar Producto**: Formulario con soporte para nuevas secciones y tipos.
- **Control de Stock**: Vista de tarjetas para cambiar el estado de cada producto.
- **Notificaciones**: Envío de alertas en tiempo real al catálogo público.
- **Personalización**: Color de acento, intensidad de glassmorphism, orden de secciones.
- **Métricas**: KPIs de visitas, favoritos, clics en WhatsApp y tasa de conversión, con gráficos Chart.js.
- **Autenticación** segura con Supabase Auth (email + contraseña).

---

## Base de Datos (Supabase)

El proyecto usa las siguientes tablas en PostgreSQL con Row Level Security (RLS) habilitado:

| Tabla | Descripción |
|---|---|
| `configuracion` | Ajustes globales: color, blur, orden de secciones, WhatsApp |
| `productos` | Catálogo completo con todos sus campos |
| `notificaciones` | Alertas enviadas desde el admin |
| `stats_views` | Visitas diarias al catálogo |
| `stats_favoritos` | Conteo de favoritos por producto |
| `stats_wsp` | Clics en WhatsApp por producto |

> Para el esquema SQL completo y los pasos de configuración, ver [`Public/Indicaciones_Supabase.md`](Public/Indicaciones_Supabase.md).

---

## Configuración Inicial

### Requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge).
- Proyecto activo en [Supabase](https://supabase.com).
- Conexión a internet (para fuentes, SDK de Supabase y Chart.js).

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   ```

2. **Configurar Supabase**  
   Seguir el manual [`Public/Indicaciones_Supabase.md`](Public/Indicaciones_Supabase.md) para:
   - Crear el proyecto en Supabase.
   - Ejecutar el script SQL para crear las tablas.
   - Crear el usuario administrador en Authentication.

3. **Credenciales ya integradas**  
   Las credenciales de Supabase (URL + anon key) están integradas en [`Public/js/storage.js`](Public/js/storage.js). Si necesitas cambiar de proyecto, edita las constantes `SUPABASE_URL` y `SUPABASE_ANON_KEY` en ese archivo.

4. **Número de WhatsApp**  
   El número de contacto se actualiza directamente en la tabla `configuracion` de Supabase o en [`Public/data/products.json`](Public/data/products.json) (como fallback local).

5. **Abrir el catálogo**  
   Abre `Public/index.html` en el navegador.  
   Accede al panel admin en `Public/admin/index.html`.

---

## Variables importantes

| Archivo | Variable | Descripción |
|---|---|---|
| `Public/js/storage.js` | `SUPABASE_URL` | URL del proyecto Supabase |
| `Public/js/storage.js` | `SUPABASE_ANON_KEY` | Clave pública anon de Supabase |
| `Public/admin/js/admin.js` | `ADMIN_EMAIL` | Email del administrador para login |
| `Public/data/products.json` | `whatsappNumber` | Número de WhatsApp de contacto (fallback) |
| `Public/data/products.json` | `baseUrl` | URL base del catálogo en producción |

---

## Seguridad

- **La `anon key` de Supabase es segura para incluir en el cliente** siempre que RLS (Row Level Security) esté habilitado en todas las tablas (ya configurado en el script SQL). RLS es la capa que impide modificaciones no autorizadas desde el exterior.
- **Las operaciones de escritura** (crear, editar, eliminar productos; enviar notificaciones; cambiar configuración) están protegidas por `auth.role() = 'authenticated'`, lo que significa que solo un usuario con sesión activa puede realizarlas.
- **Las métricas de visitas, favoritos y clics** se registran con permisos públicos deliberadamente para poder trackear usuarios anónimos sin requerir login.
- La contraseña de administrador nunca se almacena en el código. Se gestiona exclusivamente en Supabase Auth.

---

## Personalización de Contenido

Para gestionar el catálogo sin tocar código, usa el panel admin (`/admin/`). Para modificaciones de diseño o datos globales, ver [`MANUAL_CATALOGO.md`](MANUAL_CATALOGO.md).

---

## Licencia

Uso interno — **Zairen Lab**. Todos los derechos reservados.
