// === Zairen Lab — Product Detail Overlay ===
// Bento grid layout matching zen/minimal design philosophy.
// Each info section in its own glass card panel.

const overlay = document.getElementById('product-overlay');
const closeBtn = document.getElementById('close-overlay');
const overlayInner = document.getElementById('overlay-inner');

let currentProducto = null;
let currentConfig = null;
let selectedTalla = null;

function openProductDetail(producto, configuracion) {
    currentProducto = producto;
    currentConfig = configuracion;
    selectedTalla = producto.tallas && producto.tallas.length > 0 ? producto.tallas[0] : null;

    document.body.style.overflow = 'hidden';

    // Estado info
    const estadoConf = configuracion.estados[producto.estado] || {};
    const estadoTexto = estadoConf.texto || producto.estado || 'N/A';
    const estadoColor = estadoConf.color || '#3B82F6';
    const isAgotado = producto.estado === 'agotado';    // Talla buttons
    const tallas = producto.tallas || [];
    let sizeButtonsHTML = '';
    tallas.forEach((talla, idx) => {
        const isSelected = idx === 0;
        const escTalla = escapeHTML(talla);
        sizeButtonsHTML += `
            <button class="talla-btn ${isSelected ? 'talla-selected' : ''}"
                    data-talla="${escTalla}"
                    onclick="selectTalla('${escTalla.replace(/'/g, "\\'")}', this)">
                ${escTalla}
            </button>
        `;
    });

    // Product URL for sharing
    const productUrl = buildProductUrl(producto.id);
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(productUrl)}`;

    // Sección nombre
    const seccionNombre = producto.seccion
        ? producto.seccion.charAt(0).toUpperCase() + producto.seccion.slice(1)
        : 'General';

    // Kanji decorativo
    const kanjiChar = producto.tags && producto.tags.includes('kanji') ? '無' : '造';

    // Escapar variables de texto
    const escNombre = escapeHTML(producto.nombre);
    const escDesc = escapeHTML(producto.descripcion).replace(/\n/g, '<br>');
    const escId = escapeHTML(producto.id);
    const escSeccion = escapeHTML(seccionNombre);
    const escTipo = escapeHTML(producto.tipo || '');
    const escEstado = escapeHTML(estadoTexto);
    const escPrecio = escapeHTML(producto.precio);
    const escMoneda = escapeHTML(producto.moneda || 'CLP');
    const escMaterial = producto.detalles && producto.detalles.material ? escapeHTML(producto.detalles.material) : '';
    const escCuidado = producto.detalles && producto.detalles.cuidado ? escapeHTML(producto.detalles.cuidado) : '';
    const isFav = window.isProductFavorite ? window.isProductFavorite(producto.id) : false;

    overlayInner.innerHTML = `
        <!-- ============================================ -->
        <!-- BENTO GRID — Product Detail                  -->
        <!-- ============================================ -->
        <div class="detail-bento">

            <!-- ===== ROW 1 ===== -->

            <!-- BOX 1: Hero Image (tall, spans 2 rows) -->
            <div class="bento-cell bento-image">
                <img src="${producto.imagen}" alt="${escNombre}" loading="lazy">
                <span class="bento-badge" style="background-color:${estadoColor};">${escEstado}</span>
                <button class="bento-fullscreen-btn" onclick="openFullscreenImage('${producto.imagen}')" title="Ver en pantalla completa">
                    <span class="material-symbols-outlined">fullscreen</span>
                </button>
            </div>

            <!-- BOX 2: Name + Description -->
            <div class="bento-cell bento-description" style="position: relative;">
                <button class="bento-qr-trigger-btn" onclick="openProductQrModal('${escId}', '${escNombre.replace(/'/g, "\\'")}')" title="Compartir producto via QR" style="
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--z-surface-alt);
                    border: 1px solid var(--z-border);
                    color: var(--z-text-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onmouseover="this.style.color='var(--z-crimson)'; this.style.borderColor='var(--z-crimson)'"
                   onmouseout="this.style.color='var(--z-text-primary)'; this.style.borderColor='var(--z-border)'">
                    <span class="material-symbols-outlined" style="font-size: 20px;">qr_code_2</span>
                </button>
                <button class="bento-fav-trigger-btn" onclick="toggleDetailFavorite('${escId}', this)" title="Agregar a favoritos" style="
                    position: absolute;
                    top: 16px;
                    right: 60px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--z-surface-alt);
                    border: 1px solid var(--z-border);
                    color: ${isFav ? 'var(--z-crimson)' : 'var(--z-text-primary)'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onmouseover="this.style.color='var(--z-crimson)'; this.style.borderColor='var(--z-crimson)'"
                   onmouseout="if(!window.isProductFavorite || !window.isProductFavorite('${escId}')) { this.style.color='var(--z-text-primary)'; this.style.borderColor='var(--z-border)' }">
                    <span class="material-symbols-outlined" style="font-size: 20px; font-variation-settings: 'FILL' ${isFav ? 1 : 0};">favorite</span>
                </button>
                <div style="padding-right: 36px;">
                    <div class="bento-section-tag">
                        <span class="tag-crimson">${escSeccion}</span>
                        <span class="tag-sep"></span>
                        <span class="tag-muted">${escTipo}</span>
                    </div>
                    <h2 class="bento-title">${escNombre}</h2>
                </div>
                <div class="bento-footer-row">
                    <span class="bento-id">ID: ${escId}</span>
                </div>
            </div>


            <!-- ===== ROW 2 ===== -->

            <!-- BOX 4: Descripción del Producto -->
            <div class="bento-cell bento-composition">
                <span class="bento-cell-label">DESCRIPCIÓN</span>
                <p style="font-size: 14px; color: var(--z-text-secondary); line-height: 1.6; margin: 0; white-space: pre-line;">${escDesc}</p>
            </div>

            <!-- BOX 5: Size Selector -->
            <div class="bento-cell bento-sizes">
                <div class="bento-sizes-header">
                    <span class="bento-cell-label">TALLA</span>
                    <span id="selected-talla-label" class="bento-talla-active">${escapeHTML(selectedTalla) || '—'}</span>
                </div>
                <div class="bento-talla-grid" id="talla-grid">
                    ${sizeButtonsHTML}
                </div>
            </div>

            <!-- ===== ROW 3: Action Bar (full width) ===== -->
            <div class="bento-cell bento-actions">
                <div class="bento-price-block">
                    <span class="bento-cell-label">PRECIO</span>
                    <span class="bento-price-value">$${escPrecio}</span>
                </div>
                <div class="bento-actions-btns">
                    <button id="btn-wsp-detail" class="bento-btn-wsp" ${isAgotado ? 'disabled' : ''} style="display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                        ${isAgotado ? `
                          <span>Agotado</span>
                          <span class="material-symbols-outlined" style="font-size:18px;">block</span>
                        ` : `
                          <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="width:16px; height:16px;">
                            <path d="M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507l0 0zM16.062 28.228h-0.005c-0 0-0.001 0-0.001 0-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353h-0zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l-0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z"></path>
                          </svg>
                          <span>WhatsApp</span>
                          <span class="material-symbols-outlined" style="font-size:18px;">east</span>
                        `}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Attach WhatsApp click handler
    const wspBtn = document.getElementById('btn-wsp-detail');
    if (wspBtn && !isAgotado) {
        wspBtn.addEventListener('click', () => {
            const link = generateWhatsAppLink(currentProducto, selectedTalla, currentConfig);
            if (window.trackWspClick) window.trackWspClick(currentProducto.id);
            window.open(link, '_blank');
        });
    }

    // Show overlay with animation
    overlay.classList.add('visible');
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.style.opacity = '0';
        requestAnimationFrame(() => {
            overlay.style.transition = 'opacity 0.35s ease';
            overlay.style.opacity = '1';
        });
    });
}

// ==============================
// SIZE SELECTOR
// ==============================
function selectTalla(talla, btnEl) {
    selectedTalla = talla;
    const label = document.getElementById('selected-talla-label');
    if (label) label.textContent = talla;

    document.querySelectorAll('#talla-grid .talla-btn').forEach(btn => {
        btn.classList.toggle('talla-selected', btn.getAttribute('data-talla') === talla);
    });
}

// ==============================
// SHARE UTILITIES
// ==============================
function buildProductUrl(productId) {
    const baseUrl = currentConfig && currentConfig.baseUrl ? currentConfig.baseUrl : '';
    if (!baseUrl || baseUrl.includes('tu-dominio')) {
        const currentUrl = new URL(window.location.href);
        return `${currentUrl.origin}${currentUrl.pathname}#product-${productId}`;
    }
    let base = baseUrl;
    if (base.endsWith('/')) base = base.slice(0, -1);
    return `${base}/#product-${productId}`;
}

function copyProductLink(productId) {
    const url = buildProductUrl(productId);
    navigator.clipboard.writeText(url).then(() => {
        const fb = document.getElementById('copy-product-feedback');
        if (fb) {
            fb.style.opacity = '1';
            setTimeout(() => { fb.style.opacity = '0'; }, 2000);
        }
    });
}

function openProductQrModal(productId, productName) {
    const url = buildProductUrl(productId);
    if (window.openQrModal) {
        window.openQrModal(url, `Compartir ${productName}`);
    }
}

// ==============================
// CLOSE OVERLAY
// ==============================
function closeProductDetail() {
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.classList.remove('visible');
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        if (window.location.hash) {
            history.pushState('', document.title, window.location.pathname + window.location.search);
        }
    }, 300);
}

closeBtn.addEventListener('click', closeProductDetail);
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeProductDetail();
});

// ==============================
// FULLSCREEN IMAGE VIEWER
// ==============================
function openFullscreenImage(imgSrc) {
    const fsModal = document.getElementById('fullscreen-image-modal');
    const fsImg = document.getElementById('fullscreen-image-el');
    if (fsModal && fsImg) {
        fsImg.src = imgSrc;
        fsModal.classList.add('visible');
    }
}

function closeFullscreenImage() {
    const fsModal = document.getElementById('fullscreen-image-modal');
    if (fsModal) {
        fsModal.classList.remove('visible');
    }
}

const fsModal = document.getElementById('fullscreen-image-modal');
if (fsModal) {
    fsModal.addEventListener('click', (e) => {
        if (e.target === fsModal) closeFullscreenImage();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (fsModal && fsModal.classList.contains('visible')) {
            closeFullscreenImage();
        } else if (overlay.classList.contains('visible')) {
            closeProductDetail();
        }
    }
});

window.toggleDetailFavorite = function(productId, btnEl) {
    if (window.toggleFavoriteGlobal) {
        const isAdded = window.toggleFavoriteGlobal(productId);
        const icon = btnEl.querySelector('span');
        if (icon) {
            icon.style.fontVariationSettings = `'FILL' ${isAdded ? 1 : 0}`;
        }
        if (isAdded) {
            btnEl.style.color = 'var(--z-crimson)';
            btnEl.style.borderColor = 'var(--z-crimson)';
        } else {
            btnEl.style.color = 'var(--z-text-primary)';
            btnEl.style.borderColor = 'var(--z-border)';
        }
    }
};
