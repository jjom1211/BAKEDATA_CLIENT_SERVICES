// Función para navegar a las categorías
function navigateToCategory(category) {
    // Aquí puedes definir a dónde redirige cada categoría
    const categoryRoutes = {
        'panes': '/categorias/panes',
        'galletas': '/categorias/galletas',
        'gelatinas': '/categorias/gelatinas',
        'temporada': '/categorias/temporada',
        'pasteles': '/categorias/pasteles',
        'postres': '/categorias/postres',
        'pizzas': '/categorias/pizzas'
    };
    
    // Redirigir a la ruta correspondiente
    const route = categoryRoutes[category];
    if (route) {
        window.location.href = route;
    } else {
        // Si no hay ruta definida, mostrar alerta
        alert(`Próximamente: Página de ${category}`);
    }
}

// Contador de caracteres para comentarios
document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('order-comments');
    const charCount = document.getElementById('char-count');
    
    if (textarea && charCount) {
        textarea.addEventListener('input', function() {
            charCount.textContent = this.value.length;
        });
    }
});

// Función para enviar pedido
function submitOrder() {
    const comments = document.getElementById('order-comments')?.value || '';
    
    // Aquí puedes agregar la lógica para procesar el pedido
    alert('Pedido enviado correctamente. ¡Gracias por tu compra!');
    
    // Limpiar formulario si existe
    const commentsTextarea = document.getElementById('order-comments');
    const charCount = document.getElementById('char-count');
    
    if (commentsTextarea) {
        commentsTextarea.value = '';
    }
    if (charCount) {
        charCount.textContent = '0';
    }
}