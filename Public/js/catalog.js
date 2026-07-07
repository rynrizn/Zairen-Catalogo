// === Zairen Lab — Catalog Renderer ===
// Reads the new JSON structure (configuracion + productos),
// generates dynamic filters, collapsible sections, and product cards.

let catalogConfig = null;     // configuracion node from JSON
let allProductos = [];        // flat array of productos
let activeFilter = 'todos';   // current active filter
let activeSort = 'none';      // current active sorting
let favorites = [];
let lastSeenNotif = 0;
let catalogSearchQuery = '';  // current search query
let renderTimeout = null;     // timeout for debounced nothing loader rendering

// Global Favorite Helpers
window.isProductFavorite = function(productId) {
    return favorites.includes(productId);
};

window.toggleFavoriteGlobal = function(productId) {
    const idx = favorites.indexOf(productId);
    const isAdded = idx === -1;
    if (isAdded) {
        favorites.push(productId);
    } else {
        favorites = favorites.filter(id => id !== productId);
    }
    localStorage.setItem('zairen-favoritos', JSON.stringify(favorites));
    updateFavNavbarBadge();
    trackFavorite(productId, isAdded);
    
    // Update all matching catalog cards
    document.querySelectorAll(`.fav-btn[data-id="${productId}"]`).forEach(btn => {
        btn.classList.toggle('is-active', isAdded);
        const icon = btn.querySelector('span');
        if (icon) icon.style.fontVariationSettings = `'FILL' ${isAdded ? 1 : 0}`;
    });
    
    if (activeFilter === 'favoritos') {
        setTimeout(() => renderCatalog(), 300);
    }
    
    return isAdded;
};

async function initCatalog() {
    // Load local storage states
    const favStored = localStorage.getItem('zairen-favoritos');
    if (favStored) {
        try { favorites = JSON.parse(favStored); } catch(e) {}
    }
    const notifStored = localStorage.getItem('zairen-last-seen-notif');
    if (notifStored) lastSeenNotif = parseInt(notifStored, 10);

    // Detect preview mode
    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'local';

    if (isPreview) {
        const badge = document.querySelector('.preview-badge');
        if (badge) badge.style.display = 'inline-block';
    }

    // Mostrar loader mientras se cargan los datos de Supabase
    const catalogContainer = document.getElementById('catalog-container');

    let data = null;
    // Siempre intentar cargar desde Supabase primero
    data = await CatalogStorage.load();

    if (!data || !data.productos) {
        try {
            const response = await fetch('./data/products.json');
            data = await response.json();
        } catch (error) {
            console.error("Error loading products.json", error);
            document.getElementById('catalog-container').innerHTML =
                '<p style="text-align:center; padding:60px 20px; color:var(--z-muted); font-size:16px;">Error al cargar el catálogo.</p>';
            return;
        }
    }

    catalogConfig = data.configuracion || { estados: {} };
    allProductos = data.productos || [];

    // Inject configuration into root styles
    if (catalogConfig.colorEstado) {
        document.documentElement.style.setProperty('--z-color-status', catalogConfig.colorEstado);
    }
    if (catalogConfig.blurIntensity) {
        document.documentElement.style.setProperty('--z-glass-blur-val', catalogConfig.blurIntensity);
    } else {
        document.documentElement.style.setProperty('--z-glass-blur-val', '20px');
    }

    // Auto-generar IDs si no existen en el JSON
    allProductos.forEach((p, idx) => {
        if (!p.id) {
            const baseName = (p.seccion || 'cat') + '-' + (p.nombre || `prod-${idx}`);
            p.id = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
    });

    renderFilterBar();
    renderCatalog();
    initHashRouting();
    
    // Notifications init
    setupNotifications(data.notificaciones || []);
    
    // Favorites Navbar Init & Click handlers
    initFavoritesNavbar();
    
    // Search Navbar Init
    initSearchNavbar();
    
    // Track Page View
    trackPageView(data);

    // Realtime & Reload Button Init
    initReloadButton();
    setupRealtimeCatalog();
}

function setupNotifications(notifs, isUpdate = false) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list) return;

    list.innerHTML = '';
    let hasNew = false;
    
    if (notifs.length === 0) {
        list.innerHTML = '<div style="font-size:12px; color:var(--z-text-secondary); text-align:center; padding:10px;">No hay notificaciones nuevas</div>';
    } else {
        notifs.forEach(n => {
            if (n.fecha > lastSeenNotif) hasNew = true;
            
            const item = document.createElement('div');
            item.style.cssText = 'padding:12px; background:var(--z-surface-alt); border-radius:var(--z-radius-sm); border:1px solid var(--z-border);';
            
            const escTitulo = escapeHTML(n.titulo);
            const escMensaje = escapeHTML(n.mensaje);
            const escLink = n.link ? escapeHTML(n.link) : '';
            const escLinkTexto = n.linkTexto ? escapeHTML(n.linkTexto) : 'Ver Enlace';
            
            let linkHtml = n.link ? `<a href="${escLink}" target="_blank" style="display:inline-block; margin-top:6px; font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; text-transform:uppercase; color:var(--z-crimson); text-decoration:none;">${escLinkTexto}</a>` : '';
            
            item.innerHTML = `
                <h5 style="font-family:'Hanken Grotesk',sans-serif; font-size:13px; font-weight:700; color:var(--z-text-primary); margin-bottom:4px;">${escTitulo}</h5>
                <p style="font-size:12px; color:var(--z-text-secondary); line-height:1.4;">${escMensaje}</p>
                ${linkHtml}
            `;
            list.appendChild(item);
        });
    }

    if (hasNew) {
        badge.style.display = 'block';
        if (isUpdate && notifs.length > 0) {
            const latest = notifs[0];
            showToast(latest.titulo, latest.mensaje, latest.link, latest.linkTexto);
        }
    } else {
        badge.style.display = 'none';
    }

    // Toggle dropdown
    const btn = document.getElementById('nav-notif-btn');
    const dropdown = document.getElementById('notif-dropdown');
    
    btn.onclick = (e) => {
        e.stopPropagation();
        const isHidden = dropdown.style.display === 'none';
        dropdown.style.display = isHidden ? 'block' : 'none';
        if (isHidden && hasNew) {
            lastSeenNotif = Date.now();
            localStorage.setItem('zairen-last-seen-notif', lastSeenNotif.toString());
            badge.style.display = 'none';
        }
    };
    
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function showToast(title, message, link, linkText) {
    const toast = document.getElementById('global-toast');
    if(!toast) return;
    
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    
    const linkEl = document.getElementById('toast-link');
    if(link) {
        linkEl.href = link;
        linkEl.textContent = linkText || 'Ver Enlace';
        linkEl.style.display = 'inline-block';
    } else {
        linkEl.style.display = 'none';
    }
    
    toast.style.visibility = 'visible';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    setTimeout(window.closeToast, 8000);
}

window.closeToast = function() {
    const toast = document.getElementById('global-toast');
    if(!toast) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => { toast.style.visibility = 'hidden'; }, 500);
}

// ==============================
// FILTER BAR — Dynamic generation
// ==============================
function renderFilterBar() {
    const container = document.getElementById('filter-bar');
    if (!container) return;
    container.innerHTML = '';

    if (activeFilter === 'todos') {
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'filter-btn';
        collapseBtn.style.padding = '8px 12px';
        collapseBtn.id = 'toggle-all-sections-btn';
        collapseBtn.title = 'Expandir / Contraer todas las secciones';
        collapseBtn.innerHTML = `<span id="toggle-all-sections-icon" class="material-symbols-outlined" style="font-size:20px; vertical-align:middle;">unfold_less</span>`;
        collapseBtn.addEventListener('click', toggleAllSections);
        container.appendChild(collapseBtn);
    }

    const todosBtn = createFilterButton('Todos', 'todos', activeFilter === 'todos');
    const favsBtn = createFilterButton('Favoritos', 'favoritos', activeFilter === 'favoritos');
    container.appendChild(todosBtn);
    container.appendChild(favsBtn);

    const sortAZBtn = createSortButton('A-Z', 'name-asc', 'arrow_downward');
    const sortZABtn = createSortButton('Z-A', 'name-desc', 'arrow_upward');
    const sortPriceAscBtn = createSortButton('$ Min', 'price-asc', 'trending_up');
    const sortPriceDescBtn = createSortButton('$ Max', 'price-desc', 'trending_down');

    container.appendChild(sortAZBtn);
    container.appendChild(sortZABtn);
    container.appendChild(sortPriceAscBtn);
    container.appendChild(sortPriceDescBtn);

    container.appendChild(createFilterSeparator());

    const tipos = new Set();
    const estados = new Set();

    allProductos.forEach(p => {
        if (p.tipo) tipos.add(p.tipo);
        if (p.estado) estados.add(p.estado);
    });

    estados.forEach(estado => {
        const estadoConf = catalogConfig.estados ? catalogConfig.estados[estado] : null;
        const label = estadoConf ? estadoConf.texto : estado;
        const color = estadoConf ? estadoConf.color : null;
        const btn = createFilterButton(label, `estado:${estado}`, activeFilter === `estado:${estado}`, color);
        container.appendChild(btn);
    });

    container.appendChild(createFilterSeparator());

    tipos.forEach(tipo => {
        const label = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const btn = createFilterButton(label, `tipo:${tipo}`, activeFilter === `tipo:${tipo}`);
        container.appendChild(btn);
    });
}

function createFilterButton(label, filterValue, isActive, dotColor) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    btn.setAttribute('data-filter', filterValue);

    let inner = '';
    if (dotColor) {
        inner += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:6px;vertical-align:middle;"></span>`;
    }
    inner += label;
    btn.innerHTML = inner;

    btn.addEventListener('click', () => {
        setActiveFilter(filterValue);
    });

    return btn;
}

function createSortButton(label, sortValue, iconName) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (activeSort === sortValue ? ' active' : '');
    btn.setAttribute('data-sort', sortValue);
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle; margin-right:4px;">${iconName}</span>${label}`;
    btn.addEventListener('click', () => {
        if (activeSort === sortValue) {
            activeSort = 'none';
        } else {
            activeSort = sortValue;
        }
        document.querySelectorAll('[data-sort]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-sort') === activeSort);
        });
        renderCatalog();
    });
    return btn;
}

function createFilterSeparator() {
    const sep = document.createElement('span');
    sep.style.cssText = 'width:1px; height:20px; background:var(--z-border); display:inline-block; flex-shrink:0;';
    return sep;
}

function setActiveFilter(filterValue) {
    activeFilter = filterValue;
    renderFilterBar();
    renderCatalog();
    updateFavNavbarBadge();
}

function toggleAllSections() {
    const headers = Array.from(document.querySelectorAll('.section-header'));
    const contents = document.querySelectorAll('.section-content');

    const anyCollapsed = headers.some(h => !h.classList.contains('open'));
    const targetState = anyCollapsed;

    headers.forEach(h => {
        h.classList.toggle('open', targetState);
    });
    contents.forEach(c => {
        c.classList.toggle('open', targetState);
    });

    const icon = document.getElementById('toggle-all-sections-icon');
    if (icon) {
        icon.textContent = targetState ? 'unfold_less' : 'unfold_more';
    }
}

function getSortedProducts(products) {
    const sorted = [...products];
    if (activeSort === 'name-asc') {
        sorted.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    } else if (activeSort === 'name-desc') {
        sorted.sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' }));
    } else if (activeSort === 'price-asc') {
        sorted.sort((a, b) => {
            const pA = parseFloat(String(a.precio).replace(/\\./g, '').replace(/,/g, '.'));
            const pB = parseFloat(String(b.precio).replace(/\\./g, '').replace(/,/g, '.'));
            return pA - pB;
        });
    } else if (activeSort === 'price-desc') {
        sorted.sort((a, b) => {
            const pA = parseFloat(String(a.precio).replace(/\\./g, '').replace(/,/g, '.'));
            const pB = parseFloat(String(b.precio).replace(/\\./g, '').replace(/,/g, '.'));
            return pB - pA;
        });
    }
    return sorted;
}

// ==============================
// CATALOG RENDER
// ==============================
function renderCatalog() {
    const container = document.getElementById('catalog-container');
    if (!container) return;

    if (renderTimeout) clearTimeout(renderTimeout);

    container.innerHTML = `
        <div class="nothing-loader">
            <div class="nothing-spinner"></div>
            <div class="nothing-text">Cargando<span class="nothing-dots"></span></div>
        </div>
    `;

    renderTimeout = setTimeout(() => {
        container.innerHTML = '';
        if (activeFilter === 'todos' && catalogSearchQuery === '') {
            renderSectionView(container);
        } else {
            renderFilteredView(container);
        }
    }, 250);
}

function renderSectionView(container) {
    const secciones = new Map();
    const sortedProds = getSortedProducts(allProductos);
    sortedProds.forEach(p => {
        const sec = p.seccion || 'general';
        if (!secciones.has(sec)) secciones.set(sec, []);
        secciones.get(sec).push(p);
    });

    // Sort sections
    let orderedKeys = Array.from(secciones.keys());
    const isCustomOrderEnabled = catalogConfig && catalogConfig.ordenSeccionesEnabled || false;
    const customOrder = catalogConfig && catalogConfig.ordenSecciones || [];

    if (isCustomOrderEnabled && customOrder.length > 0) {
        orderedKeys.sort((a, b) => {
            let idxA = customOrder.indexOf(a);
            let idxB = customOrder.indexOf(b);
            if (idxA === -1) idxA = 9999;
            if (idxB === -1) idxB = 9999;
            return idxA - idxB;
        });
    } else {
        // Default: Reverse chronological order of when the section was created (latest created section first)
        const firstOccurrences = {};
        allProductos.forEach((p, idx) => {
            const sec = p.seccion || 'general';
            if (firstOccurrences[sec] === undefined) {
                firstOccurrences[sec] = idx;
            }
        });
        orderedKeys.sort((a, b) => {
            const idxA = firstOccurrences[a] !== undefined ? firstOccurrences[a] : 0;
            const idxB = firstOccurrences[b] !== undefined ? firstOccurrences[b] : 0;
            return idxB - idxA;
        });
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const qrBtnBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const qrBtnBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    let secIndex = 0;
    orderedKeys.forEach(seccionKey => {
        const productos = secciones.get(seccionKey);
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section-collapsible';

        const seccionLabel = escapeHTML(seccionKey.charAt(0).toUpperCase() + seccionKey.slice(1));
        const sectionId = `section-${escapeHTML(seccionKey)}`;

        const header = document.createElement('div');
        header.className = 'section-header open';
        header.id = `${sectionId}-header`;
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <h2>${seccionLabel}</h2>
                <span style="font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--z-muted); letter-spacing:0.1em;">
                    ${productos.length} producto${productos.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
                <button class="section-qr-btn" title="Compartir sección via QR" style="
                    display:flex; align-items:center; justify-content:center;
                    width:36px; height:36px; border-radius:50%;
                    background:transparent; border:none; cursor:pointer;
                    color:var(--z-text-secondary); transition: all 0.3s ease;
                " onmouseover="this.style.color='var(--z-crimson)'; this.style.background='var(--z-surface-alt)'"
                   onmouseout="this.style.color='var(--z-text-secondary)'; this.style.background='transparent'">
                    <span class="material-symbols-outlined" style="font-size:20px;">qr_code_2</span>
                </button>
                <span class="material-symbols-outlined section-toggle-icon" style="font-size:24px;">expand_more</span>
            </div>
        `;

        const content = document.createElement('div');
        content.className = 'section-content open';
        content.id = `${sectionId}-content`;

        const grid = document.createElement('div');
        grid.className = 'products-grid';

        productos.forEach((producto, idx) => {
            const card = createProductCard(producto, idx);
            grid.appendChild(card);
        });

        content.appendChild(grid);

        header.addEventListener('click', () => {
            header.classList.toggle('open');
            content.classList.toggle('open');
        });

        const qrBtn = header.querySelector('.section-qr-btn');
        if (qrBtn) {
            qrBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                shareSectionQr(seccionKey, seccionLabel);
            });
        }

        sectionEl.appendChild(header);
        sectionEl.appendChild(content);
        container.appendChild(sectionEl);
        secIndex++;
    });
}

function renderFilteredView(container) {
    let filtered = [];

    if (activeFilter === 'favoritos') {
        filtered = allProductos.filter(p => favorites.includes(p.id));
    } else if (activeFilter.startsWith('tipo:')) {
        const tipo = activeFilter.replace('tipo:', '');
        filtered = allProductos.filter(p => p.tipo === tipo);
    } else if (activeFilter.startsWith('estado:')) {
        const estado = activeFilter.replace('estado:', '');
        filtered = allProductos.filter(p => p.estado === estado);
    } else {
        filtered = allProductos;
    }

    if (catalogSearchQuery !== '') {
        filtered = filtered.filter(p => matchesSearch(p, catalogSearchQuery));
    }

    filtered = getSortedProducts(filtered);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:80px 20px;">
                <span class="material-symbols-outlined" style="font-size:48px; color:var(--z-muted); margin-bottom:12px;">search_off</span>
                <p style="font-size:16px; color:var(--z-muted);">No se encontraron productos con este filtro.</p>
            </div>
        `;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'products-grid';
    grid.style.paddingTop = '8px';

    filtered.forEach((producto, idx) => {
        const card = createProductCard(producto, idx);
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// ==============================
// PRODUCT CARD
// ==============================
function createProductCard(producto, animIndex) {
    const card = document.createElement('div');
    card.className = 'product-card animate-fade-in';
    card.style.animationDelay = `${animIndex * 0.08}s`;

    const isFav = favorites.includes(producto.id);
    const estadoConf = catalogConfig.estados && catalogConfig.estados[producto.estado] ? catalogConfig.estados[producto.estado] : {};
    
    // Escapar variables de texto para la tarjeta
    const escNombre = escapeHTML(producto.nombre);
    const escPrecio = escapeHTML(producto.precio);
    const escTipo = escapeHTML(producto.tipo || '');
    const escEstadoTexto = escapeHTML(estadoConf.texto || producto.estado || '');
    
    const estadoColor = estadoConf.color || '#3B82F6';
    const isAgotado = producto.estado === 'agotado';

    card.innerHTML = `
        <div class="card-image-wrap">
            <img src="${producto.imagen}" alt="${escNombre}" loading="lazy" class="card-img-element">
            <span class="card-badge" style="background-color:${estadoColor};">${escEstadoTexto}</span>
            <button class="fav-btn ${isFav ? 'is-active' : ''}" data-id="${producto.id}">
                <span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${isFav ? 1 : 0}; font-size:20px;">favorite</span>
            </button>
            <div class="blur-overlay" style="
                position:absolute; inset:0; background:rgba(0,0,0,0.4); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
                z-index:12; opacity:0; visibility:hidden; transition:all 0.4s ease; display:flex; align-items:center; justify-content:center;
            ">
                <span style="color:#fff; font-family:'Hanken Grotesk',sans-serif; font-weight:700; font-size:16px; letter-spacing:0.05em;">Agregado a Favoritos</span>
            </div>
        </div>
        <div class="card-info-overlay">
            <span class="card-name">${escNombre}</span>
            <div class="card-meta">
                <span class="card-price">$${escPrecio}</span>
                <span class="card-type">${escTipo}</span>
            </div>
            <div class="card-actions">
                <button class="card-btn btn-detail" data-action="detail" style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:14px; height:14px;">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M22 12.0002C20.2531 15.5764 15.8775 19 11.9998 19C8.12201 19 3.74646 15.5764 2 11.9998" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M22 12.0002C20.2531 8.42398 15.8782 5 12.0005 5C8.1227 5 3.74646 8.42314 2 11.9998" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    <span>Detalles</span>
                </button>
                <button class="card-btn ${isAgotado ? 'btn-disabled' : 'btn-wsp'}" data-action="wsp" ${isAgotado ? 'disabled' : ''} style="display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                    ${isAgotado ? 'Agotado' : `
                      <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="width:14px; height:14px;">
                        <path d="M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507l0 0zM16.062 28.228h-0.005c-0 0-0.001 0-0.001 0-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353h-0zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l-0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z"></path>
                      </svg>
                      <span>WhatsApp</span>
                    `}
                </button>
            </div>
        </div>
    `;

    const favBtn = card.querySelector('.fav-btn');
    const blurOverlay = card.querySelector('.blur-overlay');

    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isAdded = window.toggleFavoriteGlobal(producto.id);
        if (isAdded) {
            // Show blur overlay animation
            blurOverlay.style.visibility = 'visible';
            blurOverlay.style.opacity = '1';
            setTimeout(() => {
                blurOverlay.style.opacity = '0';
                setTimeout(() => { blurOverlay.style.visibility = 'hidden'; }, 400);
            }, 1500);
        }
    });

    const detailBtn = card.querySelector('[data-action="detail"]');
    detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.hash = `product-${producto.id}`;
    });

    const wspBtn = card.querySelector('[data-action="wsp"]');
    if (!isAgotado) {
        wspBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const talla = producto.tallas && producto.tallas.length > 0 ? producto.tallas[0] : 'N/A';
            const link = generateWhatsAppLink(producto, talla, catalogConfig);
            if (window.trackWspClick) window.trackWspClick(producto.id);
            window.open(link, '_blank');
        });
    }

    card.addEventListener('click', () => {
        window.location.hash = `product-${producto.id}`;
    });

    return card;
}

// ==============================
// HASH ROUTING
// ==============================
function initHashRouting() {
    window.addEventListener('hashchange', handleHash);
    handleHash();
}

function handleHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#product-')) {
        const productId = hash.replace('#product-', '');
        const found = allProductos.find(p => p.id === productId);
        if (found) {
            openProductDetail(found, catalogConfig);
        } else {
            closeProductDetail();
        }
    } else if (hash.startsWith('#section-')) {
        closeProductDetail();
        const sectionKey = hash.replace('#section-', '');
        const header = document.getElementById(`section-${sectionKey}-header`);
        const content = document.getElementById(`section-${sectionKey}-content`);
        if (header && content) {
            header.classList.add('open');
            content.classList.add('open');
            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        closeProductDetail();
    }
}

// ==============================
// SECTION SHARE UTILITIES
// ==============================
function buildSectionUrl(sectionKey) {
    const baseUrl = catalogConfig && catalogConfig.baseUrl ? catalogConfig.baseUrl : '';
    if (!baseUrl || baseUrl.includes('tu-dominio')) {
        const currentUrl = new URL(window.location.href);
        return `${currentUrl.origin}${currentUrl.pathname}#section-${sectionKey}`;
    }
    let base = baseUrl;
    if (base.endsWith('/')) base = base.slice(0, -1);
    return `${base}/#section-${sectionKey}`;
}

function shareSectionQr(sectionKey, sectionLabel) {
    const url = buildSectionUrl(sectionKey);
    if (window.openQrModal) {
        window.openQrModal(url, `Compartir Sección: ${sectionLabel}`);
    }
}

// ==============================
// FAVORITES NAVBAR & STATS HELPERS
// ==============================
function initFavoritesNavbar() {
    const btn = document.getElementById('nav-favs-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (activeFilter === 'favoritos') {
                setActiveFilter('todos');
            } else {
                setActiveFilter('favoritos');
            }
            updateFavNavbarBadge();
        });
    }
    updateFavNavbarBadge();
}

function updateFavNavbarBadge() {
    const btn = document.getElementById('nav-favs-btn');
    const badge = document.getElementById('favs-badge');
    if (!btn || !badge) return;
    
    const count = favorites.length;
    badge.textContent = count;
    
    const icon = btn.querySelector('.material-symbols-outlined');
    if (count > 0) {
        badge.style.display = 'flex';
        icon.style.fontVariationSettings = "'FILL' 1";
        btn.style.color = 'var(--z-crimson)';
    } else {
        badge.style.display = 'none';
        icon.style.fontVariationSettings = "'FILL' 0";
        btn.style.color = 'var(--z-text-secondary)';
    }

    if (activeFilter === 'favoritos') {
        btn.style.color = 'var(--z-crimson)';
        icon.style.fontVariationSettings = "'FILL' 1";
    }
}

async function trackPageView(data) {
    // Incrementar en Supabase de forma segura y directa
    await CatalogStorage.incrementPageView();
}

async function trackFavorite(productId, isAdded) {
    // Incrementar en Supabase de forma segura y directa
    await CatalogStorage.incrementFavorite(productId, isAdded);
}

window.trackWspClick = async function(productId) {
    // Incrementar en Supabase de forma segura y directa
    await CatalogStorage.incrementWspClick(productId);
};

// ==============================
// SEARCH NAVBAR HELPERS
// ==============================
function initSearchNavbar() {
    const container = document.getElementById('nav-search-container');
    const dropdown = document.getElementById('search-dropdown');
    const input = document.getElementById('nav-search-input');
    const btn = document.getElementById('nav-search-btn');
    const clearBtn = document.getElementById('nav-search-clear-btn');
    
    if (!container || !dropdown || !input || !btn || !clearBtn) return;
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';
        dropdown.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            input.focus();
        }
    });
    
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    input.addEventListener('input', (e) => {
        catalogSearchQuery = e.target.value.trim();
        if (catalogSearchQuery !== '') {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
        }
        renderCatalog();
    });
    
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        catalogSearchQuery = '';
        clearBtn.style.display = 'none';
        renderCatalog();
        input.focus();
    });
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
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

function initReloadButton() {
    const reloadBtn = document.getElementById('nav-reload-btn');
    const badge = document.getElementById('reload-badge');
    if (!reloadBtn) return;
    
    reloadBtn.onclick = async () => {
        reloadBtn.classList.remove('pulse-reload');
        if (badge) {
            badge.style.display = 'none';
            badge.classList.remove('blink-badge');
        }
        await initCatalog();
    };
}

let realtimeSubscribed = false;
function setupRealtimeCatalog() {
    if (realtimeSubscribed) return;
    
    const sb = CatalogStorage.getClient();
    if (!sb) return;

    // Listen to changes on 'productos'
    sb.channel('public-productos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, async (payload) => {
            console.log('[Realtime] Cambio detectado en productos:', payload);
            
            const data = await CatalogStorage.load();
            if (data && data.productos) {
                allProductos = data.productos;
                catalogConfig = data.configuracion || { estados: {} };
                
                // Soft update in-place
                renderCatalog();
                notifyUpdateAvailable();
            }
        })
        .subscribe();

    // Listen to changes on 'notificaciones'
    sb.channel('public-notificaciones-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, async (payload) => {
            console.log('[Realtime] Cambio detectado en notificaciones:', payload);
            
            const data = await CatalogStorage.load();
            if (data && data.notificaciones) {
                setupNotifications(data.notificaciones, true);
                notifyUpdateAvailable();
            }
        })
        .subscribe();

    // Listen to broadcast changes (instant client-to-client updates)
    sb.channel('catalog-broadcast')
        .on('broadcast', { event: 'update' }, async (payload) => {
            console.log('[Realtime Broadcast] Cambio recibido:', payload);
            
            const data = await CatalogStorage.load();
            if (data) {
                if (data.productos) {
                    allProductos = data.productos;
                    catalogConfig = data.configuracion || { estados: {} };
                    renderCatalog();
                }
                if (data.notificaciones) {
                    setupNotifications(data.notificaciones, true);
                }
                notifyUpdateAvailable();
            }
        })
        .subscribe();

    realtimeSubscribed = true;
}

function notifyUpdateAvailable() {
    const reloadBtn = document.getElementById('nav-reload-btn');
    const badge = document.getElementById('reload-badge');
    if (reloadBtn && badge) {
        reloadBtn.classList.add('pulse-reload');
        badge.style.display = 'block';
        badge.classList.add('blink-badge');
    }
}
document.addEventListener('DOMContentLoaded', initCatalog);
