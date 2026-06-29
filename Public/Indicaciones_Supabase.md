# Manual de Integración de Supabase: Zairen Lab CMS

Este manual detalla paso a paso cómo migrar el catálogo de productos y el sistema de administración (CMS) de **Zairen Lab** desde el almacenamiento local temporal (`localStorage`) hacia una base de datos real y un sistema de autenticación seguro en la nube utilizando **Supabase**.

---

## Índice
1. [Paso 1: Configurar el Proyecto en Supabase](#paso-1-configurar-el-proyecto-en-supabase)
2. [Paso 2: Esquema de Base de Datos y Seguridad (SQL)](#paso-2-esquema-de-base-de-datos-y-seguridad-sql)
3. [Paso 3: Configuración de Autenticación (Auth)](#paso-3-configuración-de-autenticación-auth)
4. [Paso 4: Inyección del SDK de Supabase (HTML)](#paso-4-inyección-del-sdk-de-supabase-html)
5. [Paso 5: Reemplazo de Código en `storage.js` (Copia Directa)](#paso-5-reemplazo-de-código-en-storagejs-copia-directa)
6. [Paso 6: Modificaciones en `admin.js` y `catalog.js`](#paso-6-modificaciones-en-adminjs-y-catalogjs)
7. [Paso 7: Pruebas y Verificación](#paso-7-pruebas-y-verificación)

---

## Paso 1: Configurar el Proyecto en Supabase

1. Ve a [Supabase.com](https://supabase.com/) e inicia sesión (o crea una cuenta gratuita).
2. Haz clic en **New Project** y selecciona tu organización.
3. Rellena los datos de tu proyecto:
   - **Name**: `Zairen-Catalog` (o el nombre que prefieras).
   - **Database Password**: Genera una contraseña segura y **guárdala bien**.
   - **Region**: Selecciona la más cercana a tus usuarios (por ejemplo, `sa-east-1` para Sudamérica).
   - **Plan**: Selecciona el plan gratuito (Free Tier).
4. Espera un par de minutos a que la base de datos se configure.
5. Una vez creado, ve a **Project Settings** (icono de engranaje) > **API** y localiza:
   - `Project API URL` (Ej: `https://xyzcorp.supabase.co`)
   - `Project API anon key` (Una cadena larga de texto)
   *Copia estos dos valores, los necesitarás en los pasos de código.*

---

## Paso 2: Esquema de Base de Datos y Seguridad (SQL)

En el panel lateral izquierdo de Supabase, ve al **SQL Editor** y haz clic en **New Query**. Pega el siguiente script completo y haz clic en **Run**. 

Este script creará todas las tablas necesarias que coinciden exactamente con la estructura de datos del catálogo (productos, configuraciones, notificaciones, métricas de visitas, favoritos e intención de compra) y configurará políticas de seguridad RLS (Row Level Security) para proteger la base de datos de modificaciones no autorizadas.

```sql
-- ============================================================
-- 1. TABLA DE CONFIGURACIÓN
-- ============================================================
CREATE TABLE configuracion (
    id INT PRIMARY KEY DEFAULT 1,
    marca TEXT DEFAULT 'Zairen Lab',
    whatsapp_number TEXT DEFAULT '+59100000000',
    base_url TEXT DEFAULT 'https://tu-dominio.com',
    color_estado TEXT DEFAULT '#5C88B0',
    blur_intensity TEXT DEFAULT '20px',
    orden_secciones_enabled BOOLEAN DEFAULT false,
    orden_secciones TEXT[] DEFAULT '{}',
    estados JSONB DEFAULT '{
        "nuevo": {"texto": "NUEVO", "color": "#10B981"},
        "oferta": {"texto": "OFERTA", "color": "#F59E0B"},
        "agotado": {"texto": "AGOTADO", "color": "#EF4444"},
        "preventa": {"texto": "PREVENTA", "color": "#8B5CF6"},
        "disponible": {"texto": "DISPONIBLE", "color": "#3B82F6"}
    }'::jsonb,
    CONSTRAINT single_row CHECK (id = 1) -- Asegura que solo exista una fila de configuración
);

-- Insertar configuración inicial por defecto
INSERT INTO configuracion (id, marca, whatsapp_number, base_url, color_estado, blur_intensity, orden_secciones_enabled, orden_secciones)
VALUES (1, 'Zairen Lab', '+56900000000', 'https://tu-dominio.com', '#5C88B0', '20px', false, '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. TABLA DE PRODUCTOS
-- ============================================================
CREATE TABLE productos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    precio TEXT NOT NULL,
    moneda TEXT DEFAULT 'CLP',
    seccion TEXT NOT NULL,
    tipo TEXT DEFAULT 'ropa',
    estado TEXT DEFAULT 'disponible',
    tallas TEXT[] DEFAULT '{}',
    imagen TEXT,
    descripcion TEXT,
    detalles JSONB DEFAULT '{"material": "No especificado", "fit": "Standard", "cuidado": "Ver etiqueta"}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    destacado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3. TABLA DE NOTIFICACIONES
-- ============================================================
CREATE TABLE notificaciones (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    link TEXT,
    link_texto TEXT,
    fecha BIGINT NOT NULL, -- Guardado como Unix timestamp en milisegundos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 4. TABLAS DE MÉTRICAS (ESTADÍSTICAS)
-- ============================================================
-- Vistas diarias
CREATE TABLE stats_views (
    fecha DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    cantidad INTEGER DEFAULT 0
);

-- Favoritos por producto
CREATE TABLE stats_favoritos (
    producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER DEFAULT 0
);

-- Clics de WhatsApp por producto
CREATE TABLE stats_wsp (
    producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER DEFAULT 0
);

-- ============================================================
-- 5. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ============================================================
-- Habilitar RLS en todas las tablas
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_wsp ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: CONFIGURACIÓN
CREATE POLICY "Permitir lectura pública de configuracion" ON configuracion FOR SELECT USING (true);
CREATE POLICY "Permitir actualización a administradores en configuracion" ON configuracion FOR UPDATE USING (auth.role() = 'authenticated');

-- POLÍTICAS: PRODUCTOS
CREATE POLICY "Permitir lectura pública de productos" ON productos FOR SELECT USING (true);
CREATE POLICY "Permitir gestión total a administradores en productos" ON productos FOR ALL USING (auth.role() = 'authenticated');

-- POLÍTICAS: NOTIFICACIONES
CREATE POLICY "Permitir lectura pública de notificaciones" ON notificaciones FOR SELECT USING (true);
CREATE POLICY "Permitir gestión total a administradores en notificaciones" ON notificaciones FOR ALL USING (auth.role() = 'authenticated');

-- POLÍTICAS: MÉTRICAS (Permitir lectura a cualquiera, e inserción/actualización pública para registrar clicks/vistas)
CREATE POLICY "Lectura pública de stats_views" ON stats_views FOR SELECT USING (true);
CREATE POLICY "Upsert público en stats_views" ON stats_views FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lectura pública de stats_favoritos" ON stats_favoritos FOR SELECT USING (true);
CREATE POLICY "Upsert público en stats_favoritos" ON stats_favoritos FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lectura pública de stats_wsp" ON stats_wsp FOR SELECT USING (true);
CREATE POLICY "Upsert público en stats_wsp" ON stats_wsp FOR ALL USING (true) WITH CHECK (true);
```

---

## Paso 3: Configuración de Autenticación (Auth)

1. En el panel de Supabase, ve a la sección **Authentication** (icono de candado) > **Providers**.
2. Despliega **Email** y asegúrate de que esté **Enabled** (habilitado).
3. **Recomendado para testing y facilidad**: Desactiva la opción **Confirm email** para que puedas iniciar sesión inmediatamente con los usuarios que crees, sin necesidad de ir a su bandeja de correo a verificar el enlace. Guarda los cambios.
4. Ve a la pestaña **Users** y haz clic en **Add User** > **Create user**.
5. Rellena el correo y la contraseña de administrador (Ej: `admin@zairen.lab` y una clave de al menos 6 caracteres). Haz clic en **Create User**.

---

## Paso 4: Inyección del SDK de Supabase (HTML)

Debes añadir el SDK cliente de Supabase para poder hacer uso de las funciones desde el navegador.

1. Abre `Public/index.html` (catálogo público) y añade el siguiente script justo antes del cierre del `</head>` o de tu archivo `catalog.js`:
   ```html
   <!-- Supabase JS SDK -->
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```

2. Abre `Public/admin/index.html` (panel de control admin) y añade el mismo script en la cabecera `<head>` antes de `admin.js`:
   ```html
   <!-- Supabase JS SDK -->
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```

---

## Paso 5: Reemplazo de Código en `storage.js` (Copia Directa)

Abre `Public/js/storage.js` y **reemplaza completamente su contenido** con el siguiente código. Recuerda colocar la URL y la Anon Key de tu proyecto de Supabase (Paso 1).

Este archivo maneja la conversión bidireccional entre la base de datos estructurada y el objeto JSON monolítico original para evitar tener que reescribir todo el renderizado del catálogo.

```javascript
// ============================================================
// CONEXIÓN CON SUPABASE — ZAIREN LAB CMS
// ============================================================
const SUPABASE_URL = 'TU_SUPABASE_URL_AQUI'; // Reemplazar con tu URL de proyecto
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY_AQUI'; // Reemplazar con tu anon key de proyecto

// Inicialización segura del cliente de Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CatalogStorage = {
  // Carga asíncrona de datos desde Supabase
  async load() {
    if (!supabase) {
      console.warn("Supabase no está inicializado. Cargando backup local.");
      return this.loadLocalBackup();
    }

    try {
      // Cargar los datos en paralelo para un rendimiento óptimo
      const [configRes, productsRes, notificationsRes, viewsRes, favsRes, wspRes] = await Promise.all([
        supabase.from('configuracion').select('*').eq('id', 1).maybeSingle(),
        supabase.from('productos').select('*').order('created_at', { ascending: true }),
        supabase.from('notificaciones').select('*').order('fecha', { ascending: false }),
        supabase.from('stats_views').select('*').order('fecha', { ascending: true }),
        supabase.from('stats_favoritos').select('*'),
        supabase.from('stats_wsp').select('*')
      ]);

      if (configRes.error) throw configRes.error;
      if (productsRes.error) throw productsRes.error;
      if (notificationsRes.error) throw notificationsRes.error;
      if (viewsRes.error) throw viewsRes.error;
      if (favsRes.error) throw favsRes.error;
      if (wspRes.error) throw wspRes.error;

      // 1. Mapear Configuración
      const dbConfig = configRes.data;
      const formattedConfig = dbConfig ? {
        marca: dbConfig.marca,
        whatsappNumber: dbConfig.whatsapp_number,
        baseUrl: dbConfig.base_url,
        colorEstado: dbConfig.color_estado,
        blurIntensity: dbConfig.blur_intensity,
        ordenSeccionesEnabled: dbConfig.orden_secciones_enabled,
        ordenSecciones: dbConfig.orden_secciones || [],
        estados: dbConfig.estados
      } : { estados: {} };

      // 2. Mapear Productos
      const formattedProducts = (productsRes.data || []).map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        moneda: p.moneda,
        seccion: p.seccion,
        tipo: p.tipo,
        estado: p.estado,
        tallas: p.tallas || [],
        imagen: p.imagen,
        descripcion: p.descripcion,
        detalles: p.detalles || {},
        tags: p.tags || [],
        destacado: p.destacado
      }));

      // 3. Mapear Notificaciones
      const formattedNotifications = (notificationsRes.data || []).map(n => ({
        id: n.id,
        titulo: n.titulo,
        mensaje: n.mensaje,
        link: n.link,
        linkTexto: n.link_texto,
        fecha: Number(n.fecha)
      }));

      // 4. Mapear Estadísticas
      const formattedViews = (viewsRes.data || []).map(v => ({
        fecha: v.fecha,
        cantidad: v.cantidad
      }));

      const formattedFavorited = {};
      (favsRes.data || []).forEach(f => {
        formattedFavorited[f.producto_id] = f.cantidad;
      });

      const formattedWspClicks = {};
      (wspRes.data || []).forEach(w => {
        formattedWspClicks[w.producto_id] = w.cantidad;
      });

      const finalData = {
        configuracion: formattedConfig,
        productos: formattedProducts,
        notificaciones: formattedNotifications,
        stats: {
          views: formattedViews,
          favorited: formattedFavorited,
          wspClicks: formattedWspClicks
        }
      };

      // Guardar copia local de seguridad
      localStorage.setItem('zairen-catalog-backup', JSON.stringify(finalData));
      return finalData;

    } catch (e) {
      console.error("Error cargando de Supabase, recurriendo a backup:", e);
      return this.loadLocalBackup();
    }
  },

  // Guardar y sincronizar todos los datos en Supabase
  async save(data) {
    if (!data) return false;

    // Actualizar backup local
    localStorage.setItem('zairen-catalog-backup', JSON.stringify(data));

    if (!supabase) {
      console.warn("Supabase no configurado. Cambios aplicados en backup local.");
      return true;
    }

    try {
      // 1. Guardar Configuración (Upsert sobre ID 1)
      const { error: configError } = await supabase.from('configuracion').upsert({
        id: 1,
        marca: data.configuracion.marca,
        whatsapp_number: data.configuracion.whatsappNumber,
        base_url: data.configuracion.baseUrl,
        color_estado: data.configuracion.colorEstado,
        blur_intensity: data.configuracion.blurIntensity,
        orden_secciones_enabled: data.configuracion.ordenSeccionesEnabled,
        orden_secciones: data.configuracion.ordenSecciones || [],
        estados: data.configuracion.estados
      });
      if (configError) throw configError;

      // 2. Sincronizar Productos (Subir nuevos/editados, borrar eliminados en base a diferencias)
      const { data: dbProds, error: listError } = await supabase.from('productos').select('id');
      if (listError) throw listError;

      const dbIds = dbProds ? dbProds.map(p => p.id) : [];
      const currentIds = data.productos.map(p => p.id);
      const idsToDelete = dbIds.filter(id => !currentIds.includes(id));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase.from('productos').delete().in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }

      const mappedProducts = data.productos.map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        moneda: p.moneda || 'CLP',
        seccion: p.seccion,
        tipo: p.tipo || 'ropa',
        estado: p.estado || 'disponible',
        tallas: p.tallas || [],
        imagen: p.imagen,
        descripcion: p.descripcion,
        detalles: p.detalles || {},
        tags: p.tags || [],
        destacado: p.destacado || false
      }));

      if (mappedProducts.length > 0) {
        const { error: productsError } = await supabase.from('productos').upsert(mappedProducts);
        if (productsError) throw productsError;
      }

      // 3. Sincronizar Notificaciones
      if (data.notificaciones) {
        const mappedNotifs = data.notificaciones.map(n => ({
          id: n.id,
          titulo: n.titulo,
          mensaje: n.mensaje,
          link: n.link || null,
          link_texto: n.linkTexto || null,
          fecha: n.fecha
        }));

        if (mappedNotifs.length > 0) {
          const { error: notifsError } = await supabase.from('notificaciones').upsert(mappedNotifs);
          if (notifsError) throw notifsError;
        }
      }

      // 4. Sincronizar Estadísticas
      if (data.stats) {
        // Vistas
        if (data.stats.views && data.stats.views.length > 0) {
          const mappedViews = data.stats.views.map(v => ({
            fecha: v.fecha,
            cantidad: v.cantidad
          }));
          await supabase.from('stats_views').upsert(mappedViews);
        }

        // Favoritos
        if (data.stats.favorited) {
          const mappedFavs = Object.entries(data.stats.favorited).map(([prodId, qty]) => ({
            producto_id: prodId,
            cantidad: qty
          }));
          if (mappedFavs.length > 0) {
            await supabase.from('stats_favoritos').upsert(mappedFavs);
          }
        }

        // WhatsApp clicks
        if (data.stats.wspClicks) {
          const mappedWsp = Object.entries(data.stats.wspClicks).map(([prodId, qty]) => ({
            producto_id: prodId,
            cantidad: qty
          }));
          if (mappedWsp.length > 0) {
            await supabase.from('stats_wsp').upsert(mappedWsp);
          }
        }
      }

      return true;
    } catch (e) {
      console.error("Error sincronizando cambios a Supabase:", e);
      return false;
    }
  },

  loadLocalBackup() {
    try {
      const raw = localStorage.getItem('zairen-catalog-backup');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
};
```

---

## Paso 6: Modificaciones en `admin.js` y `catalog.js`

Como la base de datos se consulta a través de internet (asíncronamente), debes añadir el operador `await` antes de las operaciones de carga y guardado en tus archivos principales.

### 6.1 Modificaciones en `catalog.js` (`Public/js/catalog.js`)

Realiza los siguientes cambios en `catalog.js`:

1. Localiza la función `initCatalog()` y añade la palabra clave `await` cuando se carguen los datos:
   ```diff
   -    if (isPreview || true) {
   -        data = CatalogStorage.load();
   -    }
   +    if (isPreview || true) {
   +        data = await CatalogStorage.load();
   +    }
   ```

2. Localiza la función `trackPageView()` y conviértela en `async` para usar `await`:
   ```diff
   -function trackPageView(data) {
   +async function trackPageView(data) {
        ...
        dayEntry.cantidad += 1;
   -    CatalogStorage.save(data);
   +    await CatalogStorage.save(data);
    }
   ```

3. Localiza la función `trackFavorite()` y adáptala:
   ```diff
   -function trackFavorite(productId, isAdded) {
   -    let data = CatalogStorage.load();
   +async function trackFavorite(productId, isAdded) {
   +    let data = await CatalogStorage.load();
        if (!data) return;
        ...
   -    CatalogStorage.save(data);
   +    await CatalogStorage.save(data);
    }
   ```

4. Localiza `window.trackWspClick` al final de la lógica de tracking:
   ```diff
   -window.trackWspClick = function(productId) {
   -    let data = CatalogStorage.load();
   +window.trackWspClick = async function(productId) {
   +    let data = await CatalogStorage.load();
        if (!data) return;
        ...
   -    CatalogStorage.save(data);
   +    await CatalogStorage.save(data);
    };
   ```

---

### 6.2 Modificaciones en `admin.js` (`Public/admin/js/admin.js`)

#### 6.2.1 Bloque Auth (Seguridad Admin)
Abre `Public/admin/js/admin.js`, elimina el **[BLOQUE AUTH — TEMPORAL TEXTO PLANO]** (de la línea 1 a la 60) y reemplázalo por el código oficial conectado a Supabase Auth:

```javascript
// ============================================================
// [BLOQUE AUTH — SUPABASE AUTH]
// ============================================================
const loginScreen = document.getElementById('login-screen');
const adminApp = document.getElementById('admin-app');
const loginBtn = document.getElementById('login-btn');
const pwdInput = document.getElementById('admin-password');
const errorMsg = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// Se asume un email de administrador fijo
const ADMIN_EMAIL = 'admin@zairen.lab'; 

loginBtn.addEventListener('click', async () => {
    loginBtn.textContent = 'Autenticando...';
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    const password = pwdInput.value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: password,
    });

    if (error) {
        errorMsg.textContent = 'Contraseña o usuario incorrecto';
        errorMsg.style.display = 'block';
        loginBtn.textContent = 'Entrar';
        loginBtn.disabled = false;
    } else {
        loginScreen.style.display = 'none';
        adminApp.style.display = 'block';
        
        await initAdmin(); // Inicializar CMS
        
        const loader = document.getElementById('entrance-loader');
        if (loader) {
            loader.style.display = 'flex';
            loader.style.transform = 'translateY(0)';
        }
        triggerEntranceLoader();
    }
});

pwdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
});

// Comprobar si hay sesión activa al recargar la página
async function comprobarSesionActiva() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loginScreen.style.display = 'none';
        adminApp.style.display = 'block';
        await initAdmin();
        triggerEntranceLoader();
    } else {
        const loader = document.getElementById('entrance-loader');
        if (loader) loader.style.display = 'none';
    }
}

// Iniciar comprobación al cargar el script
comprobarSesionActiva();
```

#### 6.2.2 Carga Inicial en `initAdmin()`
Modifica la carga inicial de datos en `initAdmin()` para que espere de forma asíncrona la descarga desde la base de datos:

```diff
 async function initAdmin() {
     // Cargar datos reales desde Supabase
-    currentData = CatalogStorage.load();
+    currentData = await CatalogStorage.load();
     if (!currentData) {
         try {
             const res = await fetch('../data/products.json');
             currentData = await res.json();
-            CatalogStorage.save(currentData);
+            await CatalogStorage.save(currentData);
         } catch (e) {
             console.error("No se pudo cargar products.json", e);
             currentData = { configuracion: { colorEstado: "#5C88B0" }, productos: [] };
         }
     }
```

#### 6.2.3 Guardado de Cambios en Eventos
Dado que `CatalogStorage.save(currentData)` ahora es una promesa asíncrona, asegúrate de marcar con `async` los escuchadores de eventos y añadirle `await` antes de llamarlo para que la base de datos se actualice correctamente en la nube.

*Ejemplo para el cambio de intensidad de desenfoque:*
```javascript
configBlur.addEventListener('change', async (e) => {
    currentData.configuracion.blurIntensity = e.target.value;
    await CatalogStorage.save(currentData);
});
```

*Ejemplo para ordenar secciones:*
```javascript
upBtn.addEventListener('click', async () => {
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[index - 1];
    currentOrder[index - 1] = temp;
    currentData.configuracion.ordenSecciones = currentOrder;
    await CatalogStorage.save(currentData);
    renderSectionOrderList();
});
```

*Ejemplo para eliminar producto:*
```javascript
btn.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (confirm("¿Estás seguro de eliminar este producto?")) {
        currentData.productos = currentData.productos.filter(x => x.id !== id);
        await CatalogStorage.save(currentData);
        updateTipoFilterDropdown();
        renderInventario(true);
        renderStock(true);
    }
});
```

*Ejemplo para el formulario de agregar/editar producto:*
```javascript
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... (lógica existente para estructurar dataProd) ...
    
    if (editProductId) {
        // ...
    } else {
        // ...
    }
    
    await CatalogStorage.save(currentData);
    updateTipoFilterDropdown();
    renderInventario();
    renderStock();
    showView('view-inventario');
});
```

---

## Paso 7: Pruebas y Verificación

1. **Prueba de Autenticación**: Ve a tu panel admin (`/admin/index.html`) e intenta acceder con una clave incorrecta. Debería mostrar "Contraseña o usuario incorrecto". Luego, ingresa la clave que definiste en el panel de Supabase. Deberías ver la animación de carga elegante de Zairen y el panel con todo tu inventario actual descargado en tiempo real.
2. **Prueba de Inserción**: Agrega un nuevo producto desde la pestaña "Agregar Producto". Rellena los datos y envíalo. Ve a la pestaña **Table Editor** > **productos** en el panel de Supabase y comprueba que la fila se haya registrado correctamente en PostgreSQL.
3. **Prueba en Catálogo Público**: Abre el catálogo principal (`index.html`) y realiza las siguientes acciones:
   - Añade un producto a favoritos.
   - Presiona el botón de contactar por WhatsApp en un producto.
   - Recarga el panel admin y ve a **Métricas**. Comprueba que tanto el gráfico de clics de WhatsApp como el de favoritos y el de visitas totales muestren las interacciones que acabas de realizar en la web.
