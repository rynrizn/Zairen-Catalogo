// === Zairen Lab — WhatsApp & Instagram Deep-Linking ===
// Genera enlaces y acciones para enviar mensajes estructurados de pedido.

function buildProductMessage(producto, tallaSeleccionada, configuracion, channel) {
    const cc = configuracion.canalesContacto || {
        whatsapp: { saludo: "Hola, me interesa adquirir:", despedida: "¿Está disponible?" },
        instagram: { saludo: "Hola, me interesa adquirir:", despedida: "¿Está disponible?" }
    };
    
    const channelConfig = cc[channel] || { saludo: "Hola, me interesa adquirir:", despedida: "¿Está disponible?" };
    const saludo = channelConfig.saludo || "Hola, me interesa adquirir:";
    const despedida = channelConfig.despedida || "¿Está disponible?";
    
    // Construir URL del producto
    const currentUrl = new URL(window.location.href);
    const productUrl = `${currentUrl.origin}${currentUrl.pathname}#product-${producto.id}`;
    
    // Buscar texto del estado desde configuración
    const estadoInfo = (configuracion.estados && configuracion.estados[producto.estado]) || {};
    const estadoTexto = estadoInfo.texto || producto.estado || 'N/A';
    
    // Formatear el nombre de la sección con primera letra mayúscula
    const seccionNombre = producto.seccion
        ? producto.seccion.charAt(0).toUpperCase() + producto.seccion.slice(1)
        : 'General';
        
    return [
        saludo,
        ``,
        `🏷️ *${producto.nombre}*`,
        `✅ Tipo: ${producto.tipo || 'N/A'}`,
        `📏 Talla: ${tallaSeleccionada || 'No seleccionada'}`,
        `📂 Sección: ${seccionNombre}`,
        `📌 Estado: ${estadoTexto}`,
        `💰 Precio: Bs. ${producto.precio}`,
        `🔗 Ver producto: ${productUrl}`,
        ``,
        despedida
    ].join('\n');
}

function generateWhatsAppLink(producto, tallaSeleccionada, configuracion) {
    const cc = configuracion.canalesContacto || {};
    const phone = (cc.whatsapp && cc.whatsapp.phone ? cc.whatsapp.phone : (configuracion.whatsappNumber || '')).replace(/\D/g, '');
    const message = buildProductMessage(producto, tallaSeleccionada, configuracion, 'whatsapp');
    const encoded = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encoded}`;
}

function handleInstagramAction(producto, tallaSeleccionada, configuracion) {
    const cc = configuracion.canalesContacto || {};
    const username = (cc.instagram && cc.instagram.username ? cc.instagram.username : '').replace('@', '').trim();
    const message = buildProductMessage(producto, tallaSeleccionada, configuracion, 'instagram');
    
    navigator.clipboard.writeText(message).then(() => {
        alert("📋 El mensaje de pedido ha sido copiado al portapapeles.\n\nAhora te redirigiremos a Instagram para que lo pegues en el Mensaje Directo.");
        window.open(`https://instagram.com/${username}`, '_blank');
    }).catch(err => {
        console.error("No se pudo copiar", err);
        // Fallback
        alert("Mensaje del pedido:\n\n" + message + "\n\n(Copia este texto y pégalo en el chat de Instagram)");
        window.open(`https://instagram.com/${username}`, '_blank');
    });
}
window.handleInstagramAction = handleInstagramAction;
