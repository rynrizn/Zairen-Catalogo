// === Zairen Lab — WhatsApp Deep-Linking ===
// Genera enlaces de WhatsApp con mensaje formateado
// incluyendo nombre, talla, sección, estado, precio y URL del producto.

function generateWhatsAppLink(producto, tallaSeleccionada, configuracion) {
    // ============================================================
    // IMPORTANTE: Cambia este número por tu número de WhatsApp real
    // Formato internacional sin + ni espacios. Ej: 56912345678
    // ============================================================
    const phone = configuracion.whatsappNumber.replace(/\D/g, '');

    // Construir URL del producto
    const currentUrl = new URL(window.location.href);
    const productUrl = `${currentUrl.origin}${currentUrl.pathname}#product-${producto.id}`;

    // Buscar texto del estado desde configuración
    const estadoInfo = configuracion.estados[producto.estado] || {};
    const estadoTexto = estadoInfo.texto || producto.estado || 'N/A';

    // Formatear el nombre de la sección con primera letra mayúscula
    const seccionNombre = producto.seccion
        ? producto.seccion.charAt(0).toUpperCase() + producto.seccion.slice(1)
        : 'General';

    const message = [
        `Hola, me interesa adquirir:`,
        ``,
        `🏷️ *${producto.nombre}*`,
        `📏 Talla: ${tallaSeleccionada || 'No seleccionada'}`,
        `📂 Sección: ${seccionNombre}`,
        `📌 Estado: ${estadoTexto}`,
        `💰 Precio: ${producto.moneda || 'Bs.'} ${producto.precio}`,
        `🔗 Ver producto: ${productUrl}`,
        ``,
        `¿Está disponible?`
    ].join('\n');

    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encoded}`;
}
