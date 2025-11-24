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

