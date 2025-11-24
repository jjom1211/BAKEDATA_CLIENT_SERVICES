const boton = document.getElementById("btnCarritoFlotante");
const contador = document.getElementById("contadorFlotante");

// Función para obtener carrito de localStorage
function obtenerCarritoLocalStorage() {
    try {
        const carritoJSON = localStorage.getItem('carrito');
        return carritoJSON ? JSON.parse(carritoJSON) : [];
    } catch (error) {
        console.error('Error obteniendo carrito:', error);
        return [];
    }
}

// Función para actualizar el contador
function actualizarContadorFab() {
    const carrito = obtenerCarritoLocalStorage();
    const cantidadTotal = carrito.reduce((total, item) => total + item.cantidad, 0);
    
    if (contador) {
        contador.textContent = cantidadTotal > 99 ? '99+' : cantidadTotal;
        contador.style.display = cantidadTotal > 0 ? 'flex' : 'none';
    }
}

// Navegación al carrito
if (boton) {
    boton.addEventListener('click', () => {
        window.location.href = '/carrito';
    });
}

// Escuchar eventos de actualización del carrito
window.addEventListener('carritoActualizado', () => {
    console.log('🔄 Evento carritoActualizado recibido - Actualizando FAB');
    actualizarContadorFab();
});

// Actualizar contador al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    actualizarContadorFab();
});

// También escuchar cambios en localStorage (por si acaso)
window.addEventListener('storage', (e) => {
    if (e.key === 'carrito') {
        actualizarContadorFab();
    }
});