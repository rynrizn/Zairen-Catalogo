// ============================================================
// CONEXIÓN CON SUPABASE — ZAIREN LAB CMS
// ============================================================
const SUPABASE_URL = 'https://ylrzgszltyrxqovdtymz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlscnpnc3psdHlyeHFvdmR0eW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MTc5MTEsImV4cCI6MjA5ODI5MzkxMX0.Fi3Ux--hI6nyAHJpd8Wc1P-emrf_z5FkKAf2K_ulH60';

// Inicialización segura del cliente — se inicializa una sola vez y se reutiliza
const _supabaseClient = (() => {
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
})();

const CatalogStorage = {
  // ============================================================
  // CARGA ASÍNCRONA — Lee todos los datos desde Supabase
  // ============================================================
  async load() {
    if (!_supabaseClient) {
      console.warn('[Zairen CMS] Supabase SDK no disponible. Usando respaldo local.');
      return this._loadLocalBackup();
    }

    try {
      const [configRes, productsRes, notifsRes, viewsRes, favsRes, wspRes] = await Promise.all([
        _supabaseClient.from('configuracion').select('*').eq('id', 1).maybeSingle(),
        _supabaseClient.from('productos').select('*').order('created_at', { ascending: true }),
        _supabaseClient.from('notificaciones').select('*').order('fecha', { ascending: false }),
        _supabaseClient.from('stats_views').select('*').order('fecha', { ascending: true }),
        _supabaseClient.from('stats_favoritos').select('*'),
        _supabaseClient.from('stats_wsp').select('*')
      ]);

      if (configRes.error) throw configRes.error;
      if (productsRes.error) throw productsRes.error;
      if (notifsRes.error) throw notifsRes.error;
      if (viewsRes.error) throw viewsRes.error;
      if (favsRes.error) throw favsRes.error;
      if (wspRes.error) throw wspRes.error;

      // Mapear Configuración
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

      // Mapear Productos
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
        destacado: p.destacado,
        created_at: p.created_at
      }));

      // Mapear Notificaciones
      const formattedNotifs = (notifsRes.data || []).map(n => ({
        id: n.id,
        titulo: n.titulo,
        mensaje: n.mensaje,
        link: n.link,
        linkTexto: n.link_texto,
        fecha: Number(n.fecha)
      }));

      // Mapear Estadísticas
      const formattedViews = (viewsRes.data || []).map(v => ({ fecha: v.fecha, cantidad: v.cantidad }));
      const formattedFavorited = {};
      (favsRes.data || []).forEach(f => { formattedFavorited[f.producto_id] = f.cantidad; });
      const formattedWspClicks = {};
      (wspRes.data || []).forEach(w => { formattedWspClicks[w.producto_id] = w.cantidad; });

      const finalData = {
        configuracion: formattedConfig,
        productos: formattedProducts,
        notificaciones: formattedNotifs,
        stats: {
          views: formattedViews,
          favorited: formattedFavorited,
          wspClicks: formattedWspClicks
        }
      };

      // Copia local de seguridad
      try { localStorage.setItem('zairen-catalog-backup', JSON.stringify(finalData)); } catch(e) {}
      return finalData;

    } catch (e) {
      console.error('[Zairen CMS] Error cargando desde Supabase, usando respaldo local:', e);
      return this._loadLocalBackup();
    }
  },

  // ============================================================
  // GUARDADO ASÍNCRONO — Sincroniza datos hacia Supabase
  // Solo guarda en caché local SI Supabase confirma el guardado.
  // ============================================================
  async save(data) {
    if (!data) return { ok: false, error: 'No hay datos para guardar.' };

    if (!_supabaseClient) {
      return { ok: false, error: 'Supabase no está disponible. Verifica tu conexión a internet y recarga la página.' };
    }

    try {
      // 1. Guardar Configuración
      if (data.configuracion) {
        const { error } = await _supabaseClient.from('configuracion').upsert({
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
        if (error) throw error;
      }

      // 2. Sincronizar Productos
      if (data.productos) {
        const { data: dbProds, error: listErr } = await _supabaseClient.from('productos').select('id');
        if (listErr) throw listErr;

        const dbIds = (dbProds || []).map(p => p.id);
        const currentIds = data.productos.map(p => p.id);
        const idsToDelete = dbIds.filter(id => !currentIds.includes(id));

        if (idsToDelete.length > 0) {
          const { error } = await _supabaseClient.from('productos').delete().in('id', idsToDelete);
          if (error) throw error;
        }

        if (data.productos.length > 0) {
          const mapped = data.productos.map(p => ({
            id: p.id, nombre: p.nombre, precio: p.precio, moneda: p.moneda || 'Bs.',
            seccion: p.seccion, tipo: p.tipo || 'ropa', estado: p.estado || 'disponible',
            tallas: p.tallas || [], imagen: p.imagen, descripcion: p.descripcion,
            detalles: p.detalles || {}, tags: p.tags || [], destacado: p.destacado || false
          }));
          const { error } = await _supabaseClient.from('productos').upsert(mapped);
          if (error) throw error;
        }
      }

      // 3. Sincronizar Notificaciones
      if (data.notificaciones) {
        const { data: dbNotifs, error: listErr } = await _supabaseClient.from('notificaciones').select('id');
        if (listErr) throw listErr;

        const dbIds = (dbNotifs || []).map(n => n.id);
        const currentIds = data.notificaciones.map(n => n.id);
        const idsToDelete = dbIds.filter(id => !currentIds.includes(id));

        if (idsToDelete.length > 0) {
          const { error } = await _supabaseClient.from('notificaciones').delete().in('id', idsToDelete);
          if (error) throw error;
        }

        if (data.notificaciones.length > 0) {
          const mapped = data.notificaciones.map(n => ({
            id: n.id, titulo: n.titulo, mensaje: n.mensaje,
            link: n.link || null, link_texto: n.linkTexto || null, fecha: n.fecha
          }));
          const { error } = await _supabaseClient.from('notificaciones').upsert(mapped);
          if (error) throw error;
        }
      }

      // 4. Sincronizar Estadísticas
      if (data.stats) {
        if (data.stats.views && data.stats.views.length > 0) {
          await _supabaseClient.from('stats_views').upsert(
            data.stats.views.map(v => ({ fecha: v.fecha, cantidad: v.cantidad }))
          );
        }
        if (data.stats.favorited) {
          const favs = Object.entries(data.stats.favorited).map(([id, qty]) => ({ producto_id: id, cantidad: qty }));
          if (favs.length > 0) await _supabaseClient.from('stats_favoritos').upsert(favs);
        }
        if (data.stats.wspClicks) {
          const wsps = Object.entries(data.stats.wspClicks).map(([id, qty]) => ({ producto_id: id, cantidad: qty }));
          if (wsps.length > 0) await _supabaseClient.from('stats_wsp').upsert(wsps);
        }
      }

      // ✅ Supabase confirmó — AHORA sí guardar copia local de respaldo
      try { localStorage.setItem('zairen-catalog-backup', JSON.stringify(data)); } catch(e) {}
      return { ok: true };

    } catch (e) {
      console.error('[Zairen CMS] Error sincronizando a Supabase:', e);
      const msg = e.message || e.details || 'Error desconocido al conectar con la base de datos.';
      const code = e.code || '';
      let userMsg = `Error al guardar en la base de datos: ${msg}`;
      if (code === '42501' || (typeof msg === 'string' && msg.includes('policy'))) {
        userMsg = 'Error de permisos (RLS). Ejecuta el script SQL de reparación en Supabase. Ver consola para detalles.';
      }
      return { ok: false, error: userMsg, raw: e };
    }
  },

  // ============================================================
  // MÉTODOS PÚBLICOS DE MÉTRICAS (Seguros, evitan errores RLS)
  // ============================================================
  async incrementPageView() {
    if (!_supabaseClient) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await _supabaseClient
        .from('stats_views')
        .select('cantidad')
        .eq('fecha', today)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error; // Ignorar si no se encuentra registro

      const currentQty = data ? data.cantidad : 0;
      await _supabaseClient
        .from('stats_views')
        .upsert({ fecha: today, cantidad: currentQty + 1 });
    } catch (e) {
      console.warn('[Zairen CMS] No se pudo guardar vista diaria:', e);
    }
  },

  async incrementFavorite(productId, isAdded) {
    if (!_supabaseClient) return;
    try {
      const { data, error } = await _supabaseClient
        .from('stats_favoritos')
        .select('cantidad')
        .eq('producto_id', productId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      const currentQty = data ? data.cantidad : 0;
      const newQty = isAdded ? currentQty + 1 : Math.max(0, currentQty - 1);
      await _supabaseClient
        .from('stats_favoritos')
        .upsert({ producto_id: productId, cantidad: newQty });
    } catch (e) {
      console.warn('[Zairen CMS] No se pudo actualizar favorito para:', productId, e);
    }
  },

  async incrementWspClick(productId) {
    if (!_supabaseClient) return;
    try {
      const { data, error } = await _supabaseClient
        .from('stats_wsp')
        .select('cantidad')
        .eq('producto_id', productId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      const currentQty = data ? data.cantidad : 0;
      await _supabaseClient
        .from('stats_wsp')
        .upsert({ producto_id: productId, cantidad: currentQty + 1 });
    } catch (e) {
      console.warn('[Zairen CMS] No se pudo guardar click de WhatsApp para:', productId, e);
    }
  },

  // Respaldo local de emergencia
  _loadLocalBackup() {
    try {
      const raw = localStorage.getItem('zairen-catalog-backup');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  // Exportar copia local como JSON (útil para migración de datos)
  export() {
    const data = this._loadLocalBackup();
    if (!data) {
      alert('No hay copia local para exportar.');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zairen-backup.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  },

  // Exponer cliente Supabase para uso en otros módulos (auth, etc.)
  getClient() { return _supabaseClient; }
};

// ============================================================
// PREVENCIÓN DE INYECCIONES Y XSS (GLOBAL HELPER)
// ============================================================
window.escapeHTML = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Alias global para acceso directo desde admin.js
window._supabase = _supabaseClient;
