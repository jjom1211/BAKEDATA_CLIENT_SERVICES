document.addEventListener('DOMContentLoaded', cargarPedidos);

async function cargarPedidos() {
    const loading = document.getElementById('loadingState');
    const grid = document.getElementById('ordersGrid');
    const empty = document.getElementById('emptyState');

    try {
        const res = await fetch('/api/pedidos_usuario/obtener');
        if (!res.ok) throw new Error('Error al cargar pedidos');
        
        const pedidos = await res.json();

        loading.style.display = 'none';

        if (pedidos.length === 0) {
            empty.style.display = 'block';
            return;
        }

        // Generar HTML para cada tarjeta
        grid.innerHTML = pedidos.map(pedido => {
            const fecha = new Date(pedido.ped_fecha_pedido).toLocaleDateString();
            const estadoInfo = obtenerInfoEstado(pedido.ped_estado_pedido);
            
            return `
                <div class="order-card">
                    <div class="card-header">
                        <span class="order-id">Pedido #${pedido.ped_id}</span>
                        <span class="status-badge ${estadoInfo.clase}">
                            ${estadoInfo.texto}
                        </span>
                    </div>
                    <div class="card-body">
                        <div class="info-row">
                            <i class="far fa-calendar-alt"></i>
                            <span>${fecha}</span>
                        </div>
                        <div class="info-row">
                            <i class="fas fa-store"></i>
                            <span>${pedido.suc_nombre}</span>
                        </div>
                        <span class="total-price">$${pedido.ped_monto_total.toFixed(2)}</span>
                    </div>
                    <div class="card-footer">
                        <a href="/pedidos/${pedido.ped_id}" class="btn-details">
                            Ver Detalles <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        loading.innerHTML = '<p style="color:red">Error al cargar el historial.</p>';
    }
}

// Función auxiliar para dar color y texto según la letra de la BD
function obtenerInfoEstado(estado) {
    switch(estado) {
        case 'P': return { texto: 'Pendiente', clase: 'status-pending' };
        case 'X': return { texto: 'Cancelado', clase: 'status-canceled' };
        case 'C': return { texto: 'En tienda', clase: 'status-completed' };
        case 'R': return { texto: 'En reparto', clase: 'status-arrived' };
        case 'E': return { texto: 'Entregado', clase: 'status-solved' };
        default:  return { texto: estado, clase: '' };
    }
}