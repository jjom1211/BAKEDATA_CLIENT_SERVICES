const categoriasTitulos = {
  panes: 'Conoce nuestros Panes',
  galletas: 'Conoce nuestras Galletas',
  gelatinas: 'Conoce nuestras Gelatinas y nuestros Flanes',
  temporada: 'Conoce nuestro Pan de Temporada',
  pasteles: 'Conoce nuestros Pasteles',
  postres: 'Conoce nuestros Postres',
  pizzas: 'Conoce nuestras Pizzas'
};

function navigateToCategory(categoria) {
	window.location.href = `/categorias/${categoria}`;

}


// Inicializar event listeners del modal
document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.close-modal').addEventListener('click', closeProductModal);
    
    document.getElementById('productModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeProductModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeProductModal();
        }
    });
});



async function cargarProductos(category) {
    const categoryRoutes = {
        'panes': '/api/categorias/panes',
        'galletas': '/api/categorias/galletas',
        'gelatinas': '/api/categorias/gelatinas',
        'temporada': '/api/categorias/temporada',
        'pasteles': '/api/categorias/pasteles',
        'postres': '/api/categorias/postres',
        'pizzas': '/api/categorias/pizzas'
    };

    const route = categoryRoutes[category];
    if (!route) {
        alert(`Próximamente: Página de ${category}`);
        return;
    }

    try {
        const res = await fetch(route);
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        const productos = await res.json();


        const container = document.getElementById('productosContainer');
        if (!container) return;

		window.productosActuales = productos;
        window.categoriaActual = category;


        container.innerHTML = productos.map(p => `
            <div class="productoItem" onclick="openProductModal(${p.pro_id},'${category}')">
                <img src="/static/img/productos/${category}/${p.pro_id}.jpg" alt="${p.pro_nombre}" class="producto-imagen" 
                onerror="this.src='/static/img/errores/error.png'"/>
                <h3>${p.pro_nombre}</h3>
                <p>${p.pro_descr || ''}</p>
                <span class="precio">$${p.pro_precio}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error cargando productos:', error);
        alert('No se pudieron cargar los productos.');
    }
}

// MODAL

function openProductModal(productId, category) {

    const producto = window.productosActuales?.find(p => p.pro_id == productId);
    if (!producto) {
        console.error('Producto no encontrado');
        return;
    }

    // Actualizar contenido del modal
    document.getElementById('modalProductImage').src = `/static/img/productos/${category}/${producto.pro_id}.jpg`;
    document.getElementById('modalProductImage').alt = producto.pro_nombre;
    document.getElementById('modalProductName').textContent = producto.pro_nombre;
    document.getElementById('modalProductPrice').textContent = `Precio: $${parseFloat(producto.pro_precio).toFixed(2)}`;
    document.getElementById('modalProductDescription').textContent = producto.pro_descr || 'Sin descripción disponible';
    document.getElementById('modalQuantity').value = 1;

    // Mostrar modal
    document.getElementById('productModal').style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Configurar el botón de agregar al carrito
    const addToCartBtn = document.getElementById('modalAddToCart');
    // En tu función openProductModal, modifica el botón:
    addToCartBtn.onclick = function() {
        const quantity = parseInt(document.getElementById('modalQuantity').value);
        if (quantity < 1) {
            alert('La cantidad debe ser al menos 1');
            return;
        }

        // Pasar solo el ID, la función buscará el producto completo
        addToCart(producto.pro_id, quantity);
        
        // Mostrar feedback
        mostrarFeedbackAgregado(producto.pro_nombre, quantity);
        closeProductModal();
    };
}

// Función para cerrar el modal
function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Función para mostrar feedback al agregar al carrito
function mostrarFeedbackAgregado(nombreProducto, cantidad) {

    const feedback = document.createElement('div');
    feedback.className = 'feedback-agregado';
    feedback.innerHTML = `
        <i class="fas fa-check"></i>
        <span>¡${cantidad} ${cantidad > 1 ? 'unidades de' : ''} ${nombreProducto} agregado${cantidad > 1 ? 's' : ''} al carrito!</span>
    `;
    feedback.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
    }, 3000);
}

function addToCart(id, cantidad, nombre) {
    // Obtener el producto completo de los productos actuales
    const producto = window.productosActuales?.find(p => p.pro_id == id);
    
    if (!producto) {
        console.error('Producto no encontrado para agregar al carrito');
        return;
    }

    // 1 Leer carrito actual (si no hay, inicializar vacío)
    let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

    // 2 Verificar si el producto ya está en el carrito
    const productoExistente = carrito.find(item => item.id === id);

    if (productoExistente) {
        // 3. Si existe, aumentar la cantidad
        productoExistente.cantidad += cantidad;
    } else {
        // 4. Si no existe, agregar nuevo producto con todos los datos
        carrito.push({
            id: parseInt(id),
            nombre: producto.pro_nombre,
            precio: parseFloat(producto.pro_precio),
            descripcion: producto.pro_descr || '',
            categoria: window.categoriaActual,
            cantidad: cantidad,
            imagen: `/static/img/productos/${window.categoriaActual}/${id}.jpg`,
            agregado: new Date().toISOString()
        });
    }

    // 5 Guardar el carrito actualizado en localStorage
    localStorage.setItem('carrito', JSON.stringify(carrito));

    // 6 Disparar evento para actualizar el FAB
    window.dispatchEvent(new CustomEvent('carritoActualizado'));

    console.log(`${producto.pro_nombre} agregado al carrito (${cantidad} unidades)`);
}
