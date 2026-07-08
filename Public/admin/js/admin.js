// ============================================================
// [BLOQUE AUTH — SUPABASE AUTH]
// ============================================================

// El cliente Supabase ya está inicializado en storage.js como window._supabase
// y está disponible en el scope global.

// Elementos de la UI
const loginScreen = document.getElementById('login-screen');
const adminApp = document.getElementById('admin-app');
const loginBtn = document.getElementById('login-btn');
const pwdInput = document.getElementById('admin-password');
const errorMsg = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// El email del administrador está fijo para la sesión de un solo usuario
const ADMIN_EMAIL = 'admin@zairen.lab';

loginBtn.addEventListener('click', async () => {
    loginBtn.textContent = 'Verificando...';
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    const sb = window._supabase;
    if (!sb) {
        // Fallback temporal si Supabase SDK no cargó
        errorMsg.textContent = 'Error de conexión. Intenta recargar la página.';
        errorMsg.style.display = 'block';
        loginBtn.textContent = 'Entrar';
        loginBtn.disabled = false;
        return;
    }

    const { data, error } = await sb.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: pwdInput.value,
    });

    if (error) {
        errorMsg.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
        errorMsg.style.display = 'block';
        loginBtn.textContent = 'Entrar';
        loginBtn.disabled = false;
    } else {
        loginScreen.style.display = 'none';
        adminApp.style.display = 'block';
        await initAdmin();
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

const handleLogout = async () => {
    const sb = window._supabase;
    if (sb) await sb.auth.signOut();
    window.location.reload();
};

if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

// ============================================================
// [BLOQUE ESTADO LOCAL]
// ============================================================
let currentData = null;
let currentSort = 'date-desc';
let activeTypeFilter = 'todos';
let inventarioSearchQuery = '';
let activeStockTypeFilter = 'todos';
let currentStockSort = 'date-desc';
let stockSearchQuery = '';
let editProductId = null;
let inventarioTimeout = null;
let stockTimeout = null;

// Helper centralizado: guarda en Supabase y muestra error si falla
async function guardarEnSupabase(data, type = 'product_change') {
    const result = await CatalogStorage.save(data);
    if (!result.ok) {
        alert('⚠️ NO SE GUARDÓ en la base de datos.\n\n' + result.error);
        return false;
    }
    broadcastUpdate(type);
    return true;
}

function broadcastUpdate(type) {
    const sb = window._supabase;
    if (sb) {
        const channel = sb.channel('catalog-broadcast');
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                channel.send({
                    type: 'broadcast',
                    event: 'update',
                    payload: { type: type, timestamp: Date.now() }
                }).then(() => {
                    console.log('[Realtime Admin] Broadcast de actualización enviado:', type);
                });
            }
        });
    }
}

async function initAdmin() {
    // Cargar datos desde Supabase (con fallback a respaldo local)
    currentData = await CatalogStorage.load();
    if (!currentData) {
        try {
            const res = await fetch('/data/products.json');
            currentData = await res.json();
            await guardarEnSupabase(currentData);
        } catch (e) {
            console.error("No se pudo cargar products.json", e);
            currentData = { configuracion: { colorEstado: "#5C88B0" }, productos: [] };
        }
    }

    if(!currentData.configuracion.colorEstado) {
        currentData.configuracion.colorEstado = "#5C88B0";
    }
    if(!currentData.configuracion.blurIntensity) {
        currentData.configuracion.blurIntensity = "20px";
    }
    
    if(!currentData.notificaciones) {
        currentData.notificaciones = [];
    }

    updateTipoFilterDropdown();
    setupInventarioSearch();
    setupStockFilters();
    renderInventario();
    renderStock();
    renderColorPicker();
    setupFormAgregar();
    setupNotificaciones();
    setupBlurConfig();
    setupConfigSectionOrder();
    renderNotificacionesHistorial();
    setupRealtimeAdmin();
}

function setupBlurConfig() {
    const configBlur = document.getElementById('config-blur');
    if (configBlur) {
        configBlur.value = currentData.configuracion.blurIntensity || "20px";
        configBlur.addEventListener('change', async (e) => {
            currentData.configuracion.blurIntensity = e.target.value;
            await guardarEnSupabase(currentData);
        });
    }
}

function getDefaultSectionsOrder() {
    const firstOccurrences = {};
    currentData.productos.forEach((p, idx) => {
        const sec = p.seccion || 'general';
        if (firstOccurrences[sec] === undefined) {
            firstOccurrences[sec] = idx;
        }
    });
    // Sort sections descending by first occurrence index (latest created first)
    const uniqueSections = Object.keys(firstOccurrences);
    uniqueSections.sort((a, b) => firstOccurrences[b] - firstOccurrences[a]);
    return uniqueSections;
}

function renderSectionOrderList() {
    const container = document.getElementById('section-order-container');
    if (!container) return;
    
    const enableToggle = document.getElementById('config-custom-sections-enable');
    const isEnabled = currentData.configuracion.ordenSeccionesEnabled || false;
    enableToggle.checked = isEnabled;
    
    const uniqueSections = getDefaultSectionsOrder();
    
    // Align with saved custom order if present
    let currentOrder = currentData.configuracion.ordenSecciones || [];
    currentOrder = currentOrder.filter(sec => uniqueSections.includes(sec));
    
    uniqueSections.forEach(sec => {
        if (!currentOrder.includes(sec)) {
            currentOrder.push(sec);
        }
    });
    
    currentData.configuracion.ordenSecciones = currentOrder;
    
    container.innerHTML = '';
    
    if (!isEnabled) {
        container.innerHTML = '<p style="color: var(--z-text-secondary); font-size: 13px; font-style: italic; padding: 12px; border: 1px dashed var(--z-border); border-radius: 8px; text-align: center;">Orden predeterminado activo (Cronológico inverso)</p>';
        return;
    }
    
    currentOrder.forEach((sec, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--z-surface-alt); border: 1px solid var(--z-border); border-radius: var(--z-radius-sm);';
        
        const label = escapeHTML(sec.charAt(0).toUpperCase() + sec.slice(1));
        
        item.innerHTML = `
            <span style="font-weight: 600; font-size: 14px; color: var(--z-text-primary);">${label}</span>
            <div style="display: flex; gap: 8px;">
                <button class="icon-btn move-up-btn" data-index="${index}" style="width: 28px; height: 28px;" ${index === 0 ? 'disabled style="opacity: 0.3;"' : ''}>
                    <span class="material-symbols-outlined" style="font-size: 18px;">keyboard_arrow_up</span>
                </button>
                <button class="icon-btn move-down-btn" data-index="${index}" style="width: 28px; height: 28px;" ${index === currentOrder.length - 1 ? 'disabled style="opacity: 0.3;"' : ''}>
                    <span class="material-symbols-outlined" style="font-size: 18px;">keyboard_arrow_down</span>
                </button>
            </div>
        `;
        
        const upBtn = item.querySelector('.move-up-btn');
        const downBtn = item.querySelector('.move-down-btn');
        
        if (index > 0) {
            upBtn.addEventListener('click', async () => {
                const temp = currentOrder[index];
                currentOrder[index] = currentOrder[index - 1];
                currentOrder[index - 1] = temp;
                currentData.configuracion.ordenSecciones = currentOrder;
                await guardarEnSupabase(currentData);
                renderSectionOrderList();
            });
        }
        
        if (index < currentOrder.length - 1) {
            downBtn.addEventListener('click', async () => {
                const temp = currentOrder[index];
                currentOrder[index] = currentOrder[index + 1];
                currentOrder[index + 1] = temp;
                currentData.configuracion.ordenSecciones = currentOrder;
                await guardarEnSupabase(currentData);
                renderSectionOrderList();
            });
        }
        
        container.appendChild(item);
    });
}

function setupConfigSectionOrder() {
    const enableToggle = document.getElementById('config-custom-sections-enable');
    if (enableToggle) {
        enableToggle.addEventListener('change', async (e) => {
            currentData.configuracion.ordenSeccionesEnabled = e.target.checked;
            await guardarEnSupabase(currentData);
            renderSectionOrderList();
        });
    }
    renderSectionOrderList();
}

// ============================================================
// [BLOQUE NAVEGACIÓN — VISTAS SPA]
// ============================================================
const navLinks = document.querySelectorAll('.admin-nav-link');
const views = document.querySelectorAll('.admin-view');
const mobileBtn = document.getElementById('mobile-menu-btn');
const navContainer = document.getElementById('nav-links-container');

function showView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navLinks.forEach(l => l.classList.remove('active'));
    
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');
    
    const targetLink = document.querySelector(`[data-view="${viewId}"]`);
    if (targetLink) targetLink.classList.add('active');
    
    navContainer.classList.remove('mobile-open');
    
    if (viewId === 'view-metricas') {
        renderMetricas();
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(link.dataset.view);
    });
});

mobileBtn.addEventListener('click', () => {
    navContainer.classList.toggle('mobile-open');
});

// ============================================================
// [BLOQUE VER INVENTARIO]
// ============================================================
const statusColors = {
    "nuevo": "var(--z-admin-stock-new)",
    "oferta": "var(--z-admin-stock-low)",
    "agotado": "var(--z-admin-stock-out)",
    "preventa": "var(--z-admin-stock-pre)",
    "disponible": "var(--z-admin-stock-ok)"
};

function getSortedProducts() {
    let prods = [...currentData.productos];
    
    // Apply search query
    if (inventarioSearchQuery !== '') {
        prods = prods.filter(p => matchesSearch(p, inventarioSearchQuery));
    }
    
    // Apply type filter
    if (activeTypeFilter !== 'todos') {
        prods = prods.filter(p => p.tipo === activeTypeFilter);
    }
    
    // Apply sorting
    if (currentSort === 'default' || currentSort === 'date-desc') {
        prods.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    if (currentSort === 'date-asc') {
        prods.sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }
    if (currentSort === 'name-asc') prods.sort((a,b) => a.nombre.localeCompare(b.nombre));
    if (currentSort === 'name-desc') prods.sort((a,b) => b.nombre.localeCompare(a.nombre));
    if (currentSort === 'price-asc') prods.sort((a,b) => {
        const valA = parseFloat(String(a.precio).replace(/\./g, '').replace(/,/g, '.'));
        const valB = parseFloat(String(b.precio).replace(/\./g, '').replace(/,/g, '.'));
        return valA - valB;
    });
    if (currentSort === 'price-desc') prods.sort((a,b) => {
        const valA = parseFloat(String(a.precio).replace(/\./g, '').replace(/,/g, '.'));
        const valB = parseFloat(String(b.precio).replace(/\./g, '').replace(/,/g, '.'));
        return valB - valA;
    });
    return prods;
}

document.getElementById('sort-inventario').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderInventario();
});

document.getElementById('filter-tipo-inventario').addEventListener('change', (e) => {
    activeTypeFilter = e.target.value;
    renderInventario();
});

function renderInventario(immediate = false) {
    const tbody = document.getElementById('inventario-tbody');
    if (!tbody) return;

    if (inventarioTimeout) clearTimeout(inventarioTimeout);

    if (immediate) {
        drawInventarioTable();
    } else {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 40px 0; text-align: center;">
                    <div class="nothing-loader">
                        <div class="nothing-spinner" style="margin: 0 auto;"></div>
                        <div class="nothing-text" style="margin-top: 16px;">Cargando<span class="nothing-dots"></span></div>
                    </div>
                </td>
            </tr>
        `;
        inventarioTimeout = setTimeout(() => {
            drawInventarioTable();
        }, 200);
    }
}

function drawInventarioTable() {
    const tbody = document.getElementById('inventario-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const sorted = getSortedProducts();
    
    sorted.forEach((p) => {
        const tr = document.createElement('tr');
        const escNombre = escapeHTML(p.nombre);
        const escPrecio = escapeHTML(p.precio);
        const escMoneda = escapeHTML(p.moneda || 'Bs.');
        const escSeccion = escapeHTML(p.seccion);
        const escEstado = escapeHTML(p.estado);
        const escId = escapeHTML(p.id);

        tr.innerHTML = `
            <td>
                <img src="${p.imagen}" alt="${escNombre}" class="product-thumb">
            </td>
            <td style="font-weight: 600;">${escNombre}</td>
            <td style="font-family: 'DotGothic16', monospace;">${escMoneda} ${escPrecio}</td>
            <td style="text-transform: capitalize; color: var(--z-text-secondary);">${escSeccion}</td>
            <td>
                <span class="status-badge" style="background-color: ${statusColors[p.estado] || '#666'}">${escEstado}</span>
            </td>
            <td>
                <div class="table-actions" style="justify-content: flex-end;">
                    <button class="icon-btn btn-edit" data-id="${escId}" title="Editar">
                        <span class="material-symbols-outlined" style="font-size: 18px; pointer-events:none;">edit</span>
                    </button>
                    <button class="icon-btn btn-del" data-id="${escId}" title="Eliminar">
                        <span class="material-symbols-outlined" style="font-size: 18px; pointer-events:none;">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const prod = currentData.productos.find(x => x.id === id);
            if (prod) cargarParaEditar(prod);
        });
    });

    document.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm("¿Estás seguro de eliminar este producto?")) {
                const backup = [...currentData.productos];
                currentData.productos = currentData.productos.filter(x => x.id !== id);
                const saved = await guardarEnSupabase(currentData);
                if (!saved) {
                    currentData.productos = backup;
                    return;
                }
                updateTipoFilterDropdown();
                renderInventario(true);
                renderStock(true);
            }
        });
    });
}

// ============================================================
// [BLOQUE AGREGAR/EDITAR PRODUCTO]
// ============================================================
function cargarParaEditar(prod) {
    editProductId = prod.id;
    document.getElementById('add-nombre').value = prod.nombre;
    document.getElementById('add-precio').value = prod.precio;
    
    const selSeccion = document.getElementById('add-seccion');
    let optionExists = Array.from(selSeccion.options).some(opt => opt.value === prod.seccion);
    if (!optionExists) {
        const newOpt = new Option(prod.seccion.charAt(0).toUpperCase() + prod.seccion.slice(1), prod.seccion);
        selSeccion.insertBefore(newOpt, selSeccion.options[selSeccion.options.length - 1]);
    }
    selSeccion.value = prod.seccion;
    
    const selTipo = document.getElementById('add-tipo');
    let typeOptionExists = Array.from(selTipo.options).some(opt => opt.value === prod.tipo);
    if (!typeOptionExists && prod.tipo) {
        const newOpt = new Option(prod.tipo.charAt(0).toUpperCase() + prod.tipo.slice(1), prod.tipo);
        selTipo.insertBefore(newOpt, selTipo.options[selTipo.options.length - 1]);
    }
    selTipo.value = prod.tipo || 'ropa';
    
    document.getElementById('add-imagen').value = prod.imagen;
    document.getElementById('add-estado').value = prod.estado;
    document.getElementById('add-tallas').value = prod.tallas.join(', ');
    document.getElementById('add-desc').value = prod.descripcion;
    
    document.getElementById('btn-cancelar-edicion').style.display = 'inline-flex';
    document.querySelector('#view-agregar h2').textContent = 'Editar Producto';
    document.querySelector('#view-agregar p').textContent = 'Modifica los datos del artículo existente.';
    
    // Clear hidden inputs and remove required to prevent form validation errors
    const inputNuevaSeccion = document.getElementById('add-seccion-nueva');
    const inputNuevoTipo = document.getElementById('add-tipo-nuevo');
    inputNuevaSeccion.style.display = 'none';
    inputNuevaSeccion.required = false;
    inputNuevaSeccion.value = '';
    inputNuevoTipo.style.display = 'none';
    inputNuevoTipo.required = false;
    inputNuevoTipo.value = '';
    
    showView('view-agregar');
}

function setupFormAgregar() {
    const selSeccion = document.getElementById('add-seccion');
    const inputNuevaSeccion = document.getElementById('add-seccion-nueva');
    const selTipo = document.getElementById('add-tipo');
    const inputNuevoTipo = document.getElementById('add-tipo-nuevo');
    
    selSeccion.addEventListener('change', (e) => {
        if (e.target.value === 'nueva') {
            inputNuevaSeccion.style.display = 'block';
            inputNuevaSeccion.required = true;
        } else {
            inputNuevaSeccion.style.display = 'none';
            inputNuevaSeccion.required = false;
        }
    });

    selTipo.addEventListener('change', (e) => {
        if (e.target.value === 'otro') {
            inputNuevoTipo.style.display = 'block';
            inputNuevoTipo.required = true;
        } else {
            inputNuevoTipo.style.display = 'none';
            inputNuevoTipo.required = false;
        }
    });

    document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
        editProductId = null;
        document.getElementById('form-agregar').reset();
        document.getElementById('btn-cancelar-edicion').style.display = 'none';
        document.querySelector('#view-agregar h2').textContent = 'Agregar Producto';
        document.querySelector('#view-agregar p').textContent = 'Crea un nuevo artículo en la base de datos.';
        inputNuevaSeccion.style.display = 'none';
        inputNuevaSeccion.required = false;
        inputNuevoTipo.style.display = 'none';
        inputNuevoTipo.required = false;
    });

    document.getElementById('nav-agregar-btn').addEventListener('click', () => {
        if (editProductId) document.getElementById('btn-cancelar-edicion').click();
    });

    const form = document.getElementById('form-agregar');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let seccion = selSeccion.value;
        if (seccion === 'nueva') {
            seccion = inputNuevaSeccion.value.trim().toLowerCase().replace(/\s+/g, '-');
            const newOpt = new Option(inputNuevaSeccion.value.trim(), seccion);
            selSeccion.insertBefore(newOpt, selSeccion.options[selSeccion.options.length - 1]);
        }

        let tipo = selTipo.value;
        if (tipo === 'otro') {
            tipo = inputNuevoTipo.value.trim().toLowerCase().replace(/\s+/g, '-');
            let optionExists = Array.from(selTipo.options).some(opt => opt.value === tipo);
            if (!optionExists) {
                const newOpt = new Option(inputNuevoTipo.value.trim(), tipo);
                selTipo.insertBefore(newOpt, selTipo.options[selTipo.options.length - 1]);
            }
        }
        
        const tallasRaw = document.getElementById('add-tallas').value;
        const tallasArr = tallasRaw.split(',').map(t => t.trim()).filter(t => t !== '');
        
        const dataProd = {
            nombre: document.getElementById('add-nombre').value,
            precio: document.getElementById('add-precio').value,
            moneda: "Bs.",
            seccion: seccion,
            tipo: tipo,
            estado: document.getElementById('add-estado').value,
            tallas: tallasArr,
            imagen: document.getElementById('add-imagen').value,
            descripcion: document.getElementById('add-desc').value,
            detalles: editProductId 
                ? (currentData.productos.find(p => p.id === editProductId) || {}).detalles || { material: "No especificado", fit: "Standard", cuidado: "Ver etiqueta" }
                : { material: "No especificado", fit: "Standard", cuidado: "Ver etiqueta" },
            tags: editProductId
                ? (currentData.productos.find(p => p.id === editProductId) || {}).tags || [seccion, tipo]
                : [seccion, tipo],
            destacado: editProductId
                ? (currentData.productos.find(p => p.id === editProductId) || {}).destacado || false
                : false
        };

        let rollbackFn = null;

        if (editProductId) {
            dataProd.id = editProductId;
            const index = currentData.productos.findIndex(p => p.id === editProductId);
            const oldProd = index !== -1 ? { ...currentData.productos[index] } : null;
            if(index !== -1) currentData.productos[index] = dataProd;
            rollbackFn = () => { if (oldProd && index !== -1) currentData.productos[index] = oldProd; };
        } else {
            dataProd.id = `${seccion}-${Date.now().toString().slice(-4)}`;
            currentData.productos.push(dataProd);
            rollbackFn = () => { currentData.productos = currentData.productos.filter(p => p.id !== dataProd.id); };
        }

        const saved = await guardarEnSupabase(currentData);
        if (!saved) {
            rollbackFn();
            return;
        }

        if (editProductId) {
            alert("✅ Producto actualizado exitosamente!");
            document.getElementById('btn-cancelar-edicion').click();
        } else {
            alert("✅ Producto agregado exitosamente!");
            form.reset();
        }

        updateTipoFilterDropdown();
        renderInventario();
        renderStock();
        showView('view-inventario');
    });
}

// ============================================================
// [BLOQUE CONTROL DE STOCK]
// ============================================================
function getFilteredStockProducts() {
    let prods = [...currentData.productos];
    
    // Apply search query
    if (stockSearchQuery !== '') {
        prods = prods.filter(p => matchesSearch(p, stockSearchQuery));
    }
    
    // Apply type filter
    if (activeStockTypeFilter !== 'todos') {
        prods = prods.filter(p => p.tipo === activeStockTypeFilter);
    }
    
    // Apply sorting
    if (currentStockSort === 'default' || currentStockSort === 'date-desc') {
        prods.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    if (currentStockSort === 'date-asc') {
        prods.sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }
    if (currentStockSort === 'name-asc') prods.sort((a,b) => a.nombre.localeCompare(b.nombre));
    if (currentStockSort === 'name-desc') prods.sort((a,b) => b.nombre.localeCompare(a.nombre));
    if (currentStockSort === 'price-asc') prods.sort((a,b) => {
        const valA = parseFloat(String(a.precio).replace(/\./g, '').replace(/,/g, '.'));
        const valB = parseFloat(String(b.precio).replace(/\./g, '').replace(/,/g, '.'));
        return valA - valB;
    });
    if (currentStockSort === 'price-desc') prods.sort((a,b) => {
        const valA = parseFloat(String(a.precio).replace(/\./g, '').replace(/,/g, '.'));
        const valB = parseFloat(String(b.precio).replace(/\./g, '').replace(/,/g, '.'));
        return valB - valA;
    });
    
    return prods;
}

function renderStock(immediate = false) {
    const container = document.getElementById('stock-container');
    if (!container) return;
    
    if (stockTimeout) clearTimeout(stockTimeout);
    
    if (immediate) {
        drawStockGrid();
    } else {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:40px;">
                <div class="nothing-loader">
                    <div class="nothing-spinner" style="margin: 0 auto;"></div>
                    <div class="nothing-text" style="margin-top: 16px;">Cargando<span class="nothing-dots"></span></div>
                </div>
            </div>
        `;
        stockTimeout = setTimeout(() => {
            drawStockGrid();
        }, 200);
    }
}

function drawStockGrid() {
    const container = document.getElementById('stock-container');
    if (!container) return;
    container.innerHTML = '';
    
    const filteredProds = getFilteredStockProducts();
    
    if (filteredProds.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--z-text-secondary);">No se encontraron productos con estos filtros.</div>';
        return;
    }
    
    filteredProds.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'bento-cell stock-card';
        
        const escNombre = escapeHTML(p.nombre);
        const escId = escapeHTML(p.id);
        const escEstado = escapeHTML(p.estado);

        card.innerHTML = `
            <img src="${p.imagen}" alt="${escNombre}" class="product-thumb">
            <div class="stock-info">
                <div class="stock-name">${escNombre}</div>
                <div style="font-size: 12px; color: var(--z-text-secondary); margin-bottom: 8px;">ID: ${escId}</div>
                <select class="admin-input admin-select stock-select" data-id="${escId}" style="padding: 8px 12px; margin-bottom: 0;">
                    <option value="nuevo" ${p.estado === 'nuevo' ? 'selected' : ''}>NUEVO</option>
                    <option value="disponible" ${p.estado === 'disponible' ? 'selected' : ''}>DISPONIBLE</option>
                    <option value="preventa" ${p.estado === 'preventa' ? 'selected' : ''}>PREVENTA</option>
                    <option value="oferta" ${p.estado === 'oferta' ? 'selected' : ''}>OFERTA</option>
                    <option value="agotado" ${p.estado === 'agotado' ? 'selected' : ''}>AGOTADO</option>
                </select>
            </div>
        `;
        container.appendChild(card);
    });

    document.querySelectorAll('.stock-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const newVal = e.target.value;
            const p = currentData.productos.find(x => x.id === id);
            if(p) {
                const oldEstado = p.estado;
                p.estado = newVal;
                const saved = await guardarEnSupabase(currentData);
                if (!saved) {
                    p.estado = oldEstado;
                    e.target.value = oldEstado;
                    return;
                }
                renderInventario(true);
            }
        });
    });
}

let editNotifId = null;

function renderNotificacionesHistorial() {
    const list = document.getElementById('notif-historial-list');
    if (!list) return;
    
    list.innerHTML = '';
    const notifs = currentData.notificaciones || [];
    
    if (notifs.length === 0) {
        list.innerHTML = '<p style="color:var(--z-text-secondary); text-align:center; padding:20px; font-style:italic; font-size:13px;">No hay notificaciones registradas.</p>';
        return;
    }
    
    notifs.forEach(n => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:14px; background:var(--z-surface-alt); border:1px solid var(--z-border); border-radius:var(--z-radius-sm); position:relative; box-sizing:border-box;';
        
        const escTitulo = escapeHTML(n.titulo);
        const escMensaje = escapeHTML(n.mensaje);
        const escLink = n.link ? escapeHTML(n.link) : '';
        const escLinkTexto = n.linkTexto ? escapeHTML(n.linkTexto) : 'Ver Enlace';
        const dateStr = new Date(n.fecha).toLocaleString('es-CL');
        
        item.innerHTML = `
            <div style="padding-right: 64px;">
                <h4 style="font-weight:600; font-size:13px; margin-bottom:4px; color:var(--z-text-primary);">${escTitulo}</h4>
                <p style="font-size:12px; color:var(--z-text-secondary); line-height:1.4; margin-bottom:6px;">${escMensaje}</p>
                ${n.link ? `<a href="${escLink}" target="_blank" style="font-size:11px; color:var(--z-crimson); text-decoration:none; font-family:\'JetBrains Mono\',monospace; font-weight:600;">${escLinkTexto}</a>` : ''}
                <div style="font-size:10px; color:var(--z-text-secondary); margin-top:8px; font-family:\'JetBrains Mono\',monospace;">${dateStr}</div>
            </div>
            <div style="position:absolute; top:12px; right:12px; display:flex; gap:4px;">
                <button class="icon-btn btn-edit-notif" data-id="${n.id}" title="Editar" style="width:28px; height:28px;">
                    <span class="material-symbols-outlined" style="font-size:16px; pointer-events:none;">edit</span>
                </button>
                <button class="icon-btn btn-del-notif" data-id="${n.id}" title="Eliminar" style="width:28px; height:28px;">
                    <span class="material-symbols-outlined" style="font-size:16px; pointer-events:none;">delete</span>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
    
    // Asignar listeners
    list.querySelectorAll('.btn-edit-notif').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const notif = currentData.notificaciones.find(n => n.id === id);
            if (notif) cargarNotifParaEditar(notif);
        });
    });
    
    list.querySelectorAll('.btn-del-notif').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm('¿Estás seguro de eliminar esta notificación?')) {
                const backup = [...currentData.notificaciones];
                currentData.notificaciones = currentData.notificaciones.filter(n => n.id !== id);
                const saved = await guardarEnSupabase(currentData, 'notification_change');
                if (!saved) {
                    currentData.notificaciones = backup;
                    return;
                }
                renderNotificacionesHistorial();
                if (editNotifId === id) {
                    cancelarEdicionNotif();
                }
            }
        });
    });
}

function cargarNotifParaEditar(notif) {
    editNotifId = notif.id;
    document.getElementById('notif-titulo').value = notif.titulo;
    document.getElementById('notif-mensaje').value = notif.mensaje;
    document.getElementById('notif-link').value = notif.link || '';
    document.getElementById('notif-link-texto').value = notif.linkTexto || '';
    
    document.getElementById('notif-form-title').textContent = 'Editar Notificación';
    document.getElementById('btn-cancelar-notif').style.display = 'inline-flex';
    document.querySelector('#btn-guardar-notif span').textContent = 'Guardar Cambios';
}

function cancelarEdicionNotif() {
    editNotifId = null;
    document.getElementById('form-notificaciones').reset();
    document.getElementById('notif-form-title').textContent = 'Enviar Notificación';
    document.getElementById('btn-cancelar-notif').style.display = 'none';
    document.querySelector('#btn-guardar-notif span').textContent = 'Enviar Notificación';
}

function setupNotificaciones() {
    const form = document.getElementById('form-notificaciones');
    const cancelBtn = document.getElementById('btn-cancelar-notif');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            cancelarEdicionNotif();
        });
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('notif-titulo').value;
        const msg = document.getElementById('notif-mensaje').value;
        const link = document.getElementById('notif-link').value;
        const linkText = document.getElementById('notif-link-texto').value;
        
        let rollbackFn = null;
        
        if (editNotifId) {
            const index = currentData.notificaciones.findIndex(n => n.id === editNotifId);
            const oldNotif = index !== -1 ? { ...currentData.notificaciones[index] } : null;
            if (index !== -1) {
                currentData.notificaciones[index] = {
                    id: editNotifId,
                    titulo: title,
                    mensaje: msg,
                    link: link,
                    linkTexto: linkText,
                    fecha: Date.now() // Actualizar fecha para que se envíe como nueva
                };
            }
            rollbackFn = () => { if (oldNotif && index !== -1) currentData.notificaciones[index] = oldNotif; };
        } else {
            const nuevaNotif = {
                id: `notif-${Date.now()}`,
                titulo: title,
                mensaje: msg,
                link: link,
                linkTexto: linkText,
                fecha: Date.now()
            };
            if (!currentData.notificaciones) currentData.notificaciones = [];
            currentData.notificaciones.unshift(nuevaNotif);
            rollbackFn = () => { currentData.notificaciones.shift(); };
        }
        
        const saved = await guardarEnSupabase(currentData, 'notification_change');
        if (!saved) {
            rollbackFn();
            return;
        }
        
        form.reset();
        if (editNotifId) {
            alert("✅ ¡Notificación actualizada!");
            cancelarEdicionNotif();
        } else {
            alert("✅ ¡Notificación enviada en tiempo real!");
        }
        renderNotificacionesHistorial();
    });
}

let realtimeAdminSubscribed = false;
function setupRealtimeAdmin() {
    if (realtimeAdminSubscribed) return;
    
    const sb = window._supabase;
    if (!sb) return;

    sb.channel('admin-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, async (payload) => {
            console.log('[Realtime Admin] Cambio en productos:', payload);
            const freshData = await CatalogStorage.load();
            if (freshData) {
                currentData.productos = freshData.productos;
                currentData.configuracion = freshData.configuracion;
                updateTipoFilterDropdown();
                renderInventario(true);
                renderStock(true);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, async (payload) => {
            console.log('[Realtime Admin] Cambio en notificaciones:', payload);
            const freshData = await CatalogStorage.load();
            if (freshData) {
                currentData.notificaciones = freshData.notificaciones;
                renderNotificacionesHistorial();
            }
        })
        .subscribe();
        
    realtimeAdminSubscribed = true;
}

// ============================================================
// [BLOQUE PERSONALIZACIÓN - COLOR FONDO MESH]
// ============================================================
const colorOptions = [
    "#DC143C", "#5C88B0", "#8B5CF6", "#10B981", 
    "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", 
    "#14B8A6", "#F97316", "#000000", "#111827", 
    "#4B5563", "#7C3AED", "#DB2777", "#EA580C", 
    "#65A30D", "#0891B2",
    "#FACC15", "#A855F7", "#FF007F", "#00F5FF",
    "#39FF14", "#FF4500"
];

function renderColorPicker() {
    const container = document.getElementById('color-picker');
    container.innerHTML = '';
    const currentColor = currentData.configuracion.colorEstado || "#5C88B0";
    
    colorOptions.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = `color-swatch ${color === currentColor ? 'active' : ''}`;
        swatch.style.backgroundColor = color;
        
        swatch.addEventListener('click', async () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            
            currentData.configuracion.colorEstado = color;
            await guardarEnSupabase(currentData);
            
            const btn = document.createElement('div');
            btn.textContent = "Guardado";
            btn.style.cssText = `position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:var(--z-text-primary); color:var(--z-on-primary); font-size:10px; padding:4px 8px; border-radius:4px; opacity:0; transition:opacity 0.3s; pointer-events:none; z-index: 10;`;
            swatch.style.position = 'relative';
            swatch.appendChild(btn);
            setTimeout(() => btn.style.opacity = '1', 10);
            setTimeout(() => { btn.style.opacity = '0'; setTimeout(()=>btn.remove(),300); }, 1500);
        });
        
        container.appendChild(swatch);
    });
}

// ============================================================
// [BLOQUE MÉTRICAS, ESTADÍSTICAS Y GRÁFICOS]
// ============================================================
let chartViewsInstance = null;
let chartFavoritesInstance = null;
let chartWspClicksInstance = null;

function updateTipoFilterDropdown() {
    const filterSelect = document.getElementById('filter-tipo-inventario');
    const stockSelect = document.getElementById('filter-tipo-stock');
    if (!filterSelect || !stockSelect) return;
    
    const prevValInventario = filterSelect.value;
    const prevValStock = stockSelect.value;
    
    const optHtml = '<option value="todos">Todos los Tipos</option>';
    filterSelect.innerHTML = optHtml;
    stockSelect.innerHTML = optHtml;
    
    const uniqueTypes = new Set();
    currentData.productos.forEach(p => {
        if (p.tipo) uniqueTypes.add(p.tipo);
    });
    
    uniqueTypes.forEach(t => {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        
        const opt1 = document.createElement('option');
        opt1.value = t;
        opt1.textContent = label;
        filterSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = t;
        opt2.textContent = label;
        stockSelect.appendChild(opt2);
    });
    
    if (uniqueTypes.has(prevValInventario)) {
        filterSelect.value = prevValInventario;
    } else {
        filterSelect.value = 'todos';
        activeTypeFilter = 'todos';
    }
    
    if (uniqueTypes.has(prevValStock)) {
        stockSelect.value = prevValStock;
    } else {
        stockSelect.value = 'todos';
        activeStockTypeFilter = 'todos';
    }
}

function setupStockFilters() {
    const searchEl = document.getElementById('search-stock');
    const filterEl = document.getElementById('filter-tipo-stock');
    const sortEl = document.getElementById('sort-stock');
    
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            stockSearchQuery = e.target.value.trim();
            renderStock();
        });
    }
    
    if (filterEl) {
        filterEl.addEventListener('change', (e) => {
            activeStockTypeFilter = e.target.value;
            renderStock();
        });
    }
    
    if (sortEl) {
        sortEl.addEventListener('change', (e) => {
            currentStockSort = e.target.value;
            renderStock();
        });
    }
}

function setupInventarioSearch() {
    const searchEl = document.getElementById('search-inventario');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            inventarioSearchQuery = e.target.value.trim();
            renderInventario();
        });
    }
}

function cleanString(str) {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesSearch(product, query) {
    if (!query) return true;
    const q = cleanString(query);
    
    const nameMatch = cleanString(product.nombre).includes(q);
    const descMatch = cleanString(product.descripcion).includes(q);
    const typeMatch = cleanString(product.tipo).includes(q);
    const tagsMatch = product.tags ? product.tags.some(tag => cleanString(tag).includes(q)) : false;
    
    return nameMatch || descMatch || typeMatch || tagsMatch;
}

function renderMetricas() {
    if (!currentData.stats) {
        currentData.stats = { views: [], favorited: {}, wspClicks: {} };
    }
    const stats = currentData.stats;
    const views = stats.views || [];
    const favorited = stats.favorited || {};
    const wspClicks = stats.wspClicks || {};
    
    // 1. Calculate KPIs
    const totalViews = views.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
    document.getElementById('kpi-views').textContent = totalViews;
    
    const totalFavs = Object.values(favorited).reduce((acc, curr) => acc + curr, 0);
    document.getElementById('kpi-favorites').textContent = totalFavs;
    
    const totalWspClicks = Object.values(wspClicks).reduce((acc, curr) => acc + curr, 0);
    document.getElementById('kpi-wsp-clicks').textContent = totalWspClicks;
    
    const conversionRate = totalViews > 0 ? ((totalWspClicks / totalViews) * 100).toFixed(1) : '0.0';
    document.getElementById('kpi-conversion-rate').textContent = `${conversionRate}%`;
    
    let starProductId = null;
    let maxCount = 0;
    for (const [prodId, count] of Object.entries(favorited)) {
        if (count > maxCount) {
            maxCount = count;
            starProductId = prodId;
        }
    }
    
    let starProductName = 'Ninguno';
    if (starProductId) {
        const prod = currentData.productos.find(p => p.id === starProductId);
        if (prod) {
            starProductName = prod.nombre;
        }
    }
    document.getElementById('kpi-star-product').textContent = starProductName;
    
    // 2. Render Charts
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#B3B3B3' : '#666666';
    const mainColor = '#DC143C';
    
    // View Chart
    const viewsCanvas = document.getElementById('chart-views');
    if (viewsCanvas) {
        const ctx = viewsCanvas.getContext('2d');
        const sortedViews = [...views].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        const labels = sortedViews.map(v => {
            const parts = v.fecha.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : v.fecha;
        });
        const dataValues = sortedViews.map(v => v.cantidad);
        
        if (chartViewsInstance) {
            chartViewsInstance.destroy();
        }
        
        if (typeof Chart !== 'undefined') {
            chartViewsInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Visitas Diarias',
                        data: dataValues,
                        borderColor: mainColor,
                        backgroundColor: 'rgba(220, 20, 60, 0.08)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: mainColor,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } },
                            beginAtZero: true
                        }
                    }
                }
            });
        } else {
            ctx.clearRect(0, 0, viewsCanvas.width, viewsCanvas.height);
            ctx.fillStyle = textColor;
            ctx.font = '14px JetBrains Mono';
            ctx.fillText("No se cargó Chart.js", 20, 40);
        }
    }
    
    // Favorites Chart
    const favsCanvas = document.getElementById('chart-favorites');
    if (favsCanvas) {
        const ctx = favsCanvas.getContext('2d');
        
        const favData = [];
        for (const [prodId, count] of Object.entries(favorited)) {
            const prod = currentData.productos.find(p => p.id === prodId);
            if (prod && count > 0) {
                favData.push({ name: prod.nombre, count: count });
            }
        }
        favData.sort((a, b) => b.count - a.count);
        const top5 = favData.slice(0, 5);
        
        const labels = top5.map(x => x.name.length > 15 ? x.name.slice(0, 12) + '...' : x.name);
        const dataValues = top5.map(x => x.count);
        
        if (chartFavoritesInstance) {
            chartFavoritesInstance.destroy();
        }
        
        if (typeof Chart !== 'undefined') {
            chartFavoritesInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Favoritos',
                        data: dataValues,
                        backgroundColor: isDark ? 'rgba(220, 20, 60, 0.2)' : 'rgba(220, 20, 60, 0.15)',
                        borderColor: mainColor,
                        borderWidth: 1.5,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 }, stepSize: 1 },
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    // WhatsApp Clicks Chart
    const wspCanvas = document.getElementById('chart-wsp-clicks');
    if (wspCanvas) {
        const ctx = wspCanvas.getContext('2d');
        
        const wspData = [];
        for (const [prodId, count] of Object.entries(wspClicks)) {
            const prod = currentData.productos.find(p => p.id === prodId);
            if (prod && count > 0) {
                wspData.push({ name: prod.nombre, count: count });
            }
        }
        wspData.sort((a, b) => b.count - a.count);
        const top5 = wspData.slice(0, 5);
        
        const labels = top5.map(x => x.name.length > 15 ? x.name.slice(0, 12) + '...' : x.name);
        const dataValues = top5.map(x => x.count);
        
        if (chartWspClicksInstance) {
            chartWspClicksInstance.destroy();
        }
        
        if (typeof Chart !== 'undefined') {
            chartWspClicksInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Clics WhatsApp',
                        data: dataValues,
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                        borderColor: '#10B981',
                        borderWidth: 1.5,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 }, stepSize: 1 },
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }
}

// Redefinir observador de cambio de tema para actualizar gráficos responsivamente
const themeObserver = new MutationObserver(() => {
    const activeView = document.querySelector('.admin-view.active');
    if (activeView && activeView.id === 'view-metricas') {
        renderMetricas();
    }
});
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function triggerEntranceLoader() {
    const loader = document.getElementById('entrance-loader');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.transform = 'translateY(0)';
        loader.style.opacity = '1';
        setTimeout(() => {
            loader.style.transform = 'translateY(40px)';
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 1000);
        }, 900);
    }
}

// ============================================================
// VERIFICACIÓN DE SESIÓN AL CARGAR
// ============================================================
async function comprobarSesionActiva() {
    const sb = window._supabase;
    if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            loginScreen.style.display = 'none';
            adminApp.style.display = 'block';
            await initAdmin();
            triggerEntranceLoader();
            return;
        }
    }
    // Sin sesión activa — mostrar pantalla de login
    const loader = document.getElementById('entrance-loader');
    if (loader) loader.style.display = 'none';
}

comprobarSesionActiva();
