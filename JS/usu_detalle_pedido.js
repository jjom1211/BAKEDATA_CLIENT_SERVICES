document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener el ID del pedido desde la URL
    const pathParts = window.location.pathname.split('/');
    const pedidoId = pathParts[pathParts.length - 1];

    if (!pedidoId) {
        alert("No se especificó un ID de pedido");
        return;
    }

    try {
        // 2. Consumir tu API
        const response = await fetch(`/api/pedidos/${pedidoId}`);
        
        if (!response.ok) {
            throw new Error('No se pudo cargar el pedido');
        }

        const data = await response.json();
        const pedido = data.pedido;
        const productos = data.productos;

        // --- DATOS GENERALES ---
        document.getElementById('orderId').textContent = `#${pedido.ped_id}`;
        
        // Fecha de Solicitud (Cuando se creó el pedido)
        const fechaCreacion = new Date(pedido.ped_fecha_pedido.replace(/-/g, '\/')).toLocaleDateString();
        document.getElementById('orderDate').textContent = fechaCreacion;
        
        document.getElementById('orderBranch').textContent = pedido.suc_nombre;

        // --- NUEVO: FECHA Y HORA DE RECOGIDA ---
        const pickupElement = document.getElementById('orderPickup');
        
        if (pedido.ped_fecha_entrega && pedido.ped_hora_entrega) {
            // 1. Formatear Fecha
            const fechaEntrega = new Date(pedido.ped_fecha_entrega.replace(/-/g, '\/')).toLocaleDateString('es-ES', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            });

            // 2. Formatear Hora (de 14:30:00 a 02:30 PM)
            let horaBonita = pedido.ped_hora_entrega;
            if (horaBonita.includes(':')) {
                const [h, m] = horaBonita.split(':');
                const horaNum = parseInt(h);
                const ampm = horaNum >= 12 ? 'PM' : 'AM';
                const hora12 = horaNum % 12 || 12;
                horaBonita = `${hora12}:${m} ${ampm}`;
            }

            pickupElement.textContent = `${fechaEntrega} - ${horaBonita}`;
        } else {
            pickupElement.textContent = "Por definir en sucursal";
        }
        // --- ESTADOS Y COLORES (Tu lógica existente) ---
        const estados = { 'P': 'Pendiente', 'C': 'Completado', 'X': 'Cancelado', 'R': 'En Reparto' };
        const estadoTexto = estados[pedido.ped_estado_pedido] || pedido.ped_estado_pedido;
        const estadoElement = document.getElementById('orderStatus');
        estadoElement.textContent = estadoTexto;

        const labelTotal = document.querySelector('.total-label');
        const amountTotal = document.getElementById('orderTotal');
        const totalSection = document.querySelector('.total-section'); // Opcional: para cambiar el fondo
        let avisoHTML = '';
// Estilo base para la cajita de aviso (Centrada y compacta)
        // max-width: 500px hace que no se estire tanto
        // margin: 0 auto 20px auto centra la caja y le da espacio abajo
        const estiloBaseAviso = "max-width: 550px; margin: 0 auto 25px auto; padding: 15px 20px; border-radius: 12px; display: flex; gap: 15px; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.05);";

        // CASO 1: COMPLETADO ('C') -> VERDE
        if (pedido.ped_estado_pedido === 'C') {
            labelTotal.textContent = 'Total Pagado';
            labelTotal.style.color = '#28a745';
            amountTotal.style.color = '#28a745';
            estadoElement.style.color = '#28a745';
            
            avisoHTML = `
                <div style="${estiloBaseAviso} background-color: #d4edda; color: #155724; border-left: 6px solid #28a745;">
                    <i class="fas fa-check-circle" style="font-size: 24px;"></i>
                    <div>
                        <strong style="font-size:1.1em;">¡Pedido Completado!</strong><br>
                        <span style="font-size:0.9em;">Gracias por tu compra. Esperamos que disfrutes tus productos.</span>
                    </div>
                </div>
            `;

        // CASO 2: CANCELADO ('X') -> ROJO
        } else if (pedido.ped_estado_pedido === 'X') {
            labelTotal.textContent = 'Total (Cancelado)';
            labelTotal.style.color = '#dc3545';
            amountTotal.style.color = '#dc3545';
            estadoElement.style.color = '#dc3545';

        // CASO 3: EN REPARTO ('R') -> AZUL
        } else if (pedido.ped_estado_pedido === 'R') {
            labelTotal.textContent = 'Total a Pagar'; 
            estadoElement.style.color = '#17a2b8'; 
            
            avisoHTML = `
                <div style="${estiloBaseAviso} background-color: #d1ecf1; color: #0c5460; border-left: 6px solid #17a2b8;">
                    <i class="fas fa-shipping-fast" style="font-size: 24px;"></i>
                    <div>
                        <strong style="font-size:1.1em;">¡Va en camino!</strong><br>
                        <span style="font-size:0.9em;">Tu pedido está en reparto. Mantente atento.</span>
                    </div>
                </div>
            `;

        // CASO 4: PENDIENTE ('P') -> AMARILLO (Default)
        } else {
            labelTotal.textContent = 'Total a Pagar';
            estadoElement.style.color = '#e67e22'; 
            
            let horaEntrega = pedido.ped_hora_entrega || "Horario de tienda";
            if(horaEntrega.includes(':')) {
                const [h, m] = horaEntrega.split(':');
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                horaEntrega = `${h12}:${m} ${ampm}`;
            }
            
            const fechaEntrega = pedido.ped_fecha_entrega 
                ? new Date(pedido.ped_fecha_entrega.replace(/-/g, '\/')).toLocaleDateString() 
                : "la fecha acordada";

            avisoHTML = `
                <div style="${estiloBaseAviso} background-color: #fff3cd; color: #856404; border-left: 6px solid #ffc107;">
                    <i class="fas fa-clock" style="font-size: 24px;"></i>
                    <div>
                        <strong style="font-size:1.1em;">¡No lo olvides!</strong><br>
                        <span style="font-size:0.9em;">Recogida el <b>${fechaEntrega}</b> a las <b>${horaEntrega}</b>.</span>
                    </div>
                </div>
            `;
        }
        // Inyectar el aviso si existe
        if (avisoHTML) {
            // Limpiamos avisos previos si los hubiera (opcional, por seguridad)
            const prevAlert = totalSection.previousElementSibling;
            if(prevAlert && prevAlert.tagName === 'DIV' && prevAlert.style.maxWidth === '550px') {
                prevAlert.remove();
            }
            
            totalSection.insertAdjacentHTML('beforebegin', avisoHTML);
        }
        // ===============================================================

        // 5. Llenar la tabla de productos
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = productos.map(prod => `
            <tr>
                <td>
                    <div class="prod-name">${prod.pro_nombre}</div>
                    <small style="color:#999;">${prod.pro_categoria}</small>
                </td>
                <td style="text-align: center;">${parseInt(prod.cantidad)}</td>
                <td style="text-align: right;">$${parseFloat(prod.precio_unitario).toFixed(2)}</td>
                <td class="prod-price">$${parseFloat(prod.subtotal).toFixed(2)}</td>
            </tr>
        `).join('');

        // 6. Poner el monto total
        amountTotal.textContent = `$${parseFloat(pedido.ped_monto_total).toFixed(2)}`;

        // 7. Mostrar la tarjeta y ocultar loading
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('orderContent').style.display = 'block';

    } catch (error) {
        console.error(error);
        document.getElementById('loadingState').innerHTML = `
            <div style="padding: 50px; text-align: center; color: #dc3545;">
                <i class="fas fa-exclamation-circle" style="font-size: 30px;"></i>
                <p>Error al cargar el pedido. Intenta recargar.</p>
            </div>
        `;
    }
});