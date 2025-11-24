let sucursales = [];
// Variable global para mantener el estado del carrito (sea de BD o Local)
let carritoEstadoActual = [];
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    await cargarSucursales();
    configurarEventosModal();
    configurarEventosCarrito();
    
    // LÓGICA CENTRAL DE CARGA
    if (verificarUsuarioLogueado()) {
        // 1. Si hay items en localStorage, los subimos primero a la nube
        const localItems = obtenerCarritoLocalStorage();
        if (localItems.length > 0) {
            await sincronizarSubida(localItems);
            // Una vez subidos, limpiamos localStorage para evitar conflictos
            localStorage.removeItem('carrito'); 
        }
        // 2. Cargamos la verdad absoluta desde la BD
        await cargarCarritoDesdeBD();
    } else {
        // 3. Usuario anónimo: usa localStorage
        const carritoLocal = obtenerCarritoLocalStorage();
        actualizarVistaCarrito(obtenerCarritoLocalStorage());
    }
}

// Subir localStorage a BD (Solo al iniciar sesión o cargar página logueado por primera vez)
async function sincronizarSubida(itemsLocales) {
    try {
        await fetch('/api/carrito/sincronizar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(itemsLocales)
        });
        console.log("Carrito local sincronizado con la nube.");
    } catch (e) {
        console.error("Error sincronizando:", e);
    }
}

// Obtener la lista real de la BD y pintar la pantalla
async function cargarCarritoDesdeBD() {
    try {
        const res = await fetch('/api/carrito/obtener');
        if (res.ok) {
            const productosBD = await res.json();
            // Guardamos en una variable global o actualizamos la vista directamente
            // OJO: No guardamos esto en localStorage para no duplicar lógicas
            actualizarVistaCarrito(productosBD);
        }
    } catch (e) {
        console.error("Error cargando carrito BD:", e);
    }
}

// ========== CONFIGURACIÓN DE EVENTOS ==========

function configurarEventosModal() {
    const btnPagar = document.getElementById('btnPagar');
    const modal = document.getElementById('modalPago');
    const btnCerrar = document.querySelector('.close-modal');
    const btnCancelar = document.querySelector('.btn-cancelar');
    const formPago = document.getElementById('formPago');

    // Abrir modal al hacer click en Confirmar Pedido
    if (btnPagar) {
        btnPagar.addEventListener('click', abrirModalPago);
    }

    // Cerrar modal con botones
    if (btnCerrar) {
        btnCerrar.addEventListener('click', cerrarModalPago);
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', cerrarModalPago);
    }

    // Enviar formulario
    if (formPago) {
        formPago.addEventListener('submit', confirmarPedido);
    }

    // Cerrar modal al hacer click fuera del contenido
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                cerrarModalPago();
            }
        });
    }

    // Cerrar modal con ESC
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && modal.style.display === 'block') {
            cerrarModalPago();
        }
    });
}

function configurarEventosCarrito() {
    const btnVaciar = document.getElementById('btnVaciarCarrito');
    if (btnVaciar) {
        btnVaciar.addEventListener('click', vaciarCarrito);
    }
}

// ========== FUNCIONES DEL MODAL ==========
let prefijoAsunto = "";
function abrirModalPago() {
    if (carritoEstadoActual.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'error');
        return;
    }
    if (!verificarUsuarioLogueado()) {
        mostrarNotificacion('Debes iniciar sesión para realizar un pedido', 'error');
        setTimeout(() => {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        }, 2000);
        return;
    }
// === LÓGICA NUEVA PARA EL ASUNTO ===
    const body = document.body;
    const nombre = body.getAttribute('data-nombre');
    const correo = body.getAttribute('data-correo');
    const inputAsunto = document.getElementById('asunto');

    // 1. Definimos el formato fijo
    prefijoAsunto = `Pedido para ${nombre} - ${correo} : `;
    // 2. Si el input está vacío o no tiene el prefijo, lo reseteamos
    if (!inputAsunto.value.startsWith(prefijoAsunto)) {
        inputAsunto.value = prefijoAsunto;
    }
    // 3. Actualizamos el contador de caracteres inmediatamente
    actualizarContador(inputAsunto, 'contador-asunto');
    // 4. Agregamos la protección contra borrado
    configurarProteccionInput(inputAsunto);
    // ===================================
    actualizarResumenModal(carritoEstadoActual);
    document.getElementById('modalPago').style.display = 'flex';
}

// Función para proteger que no borren el prefijo
function configurarProteccionInput(input) {
    // Evitar que el usuario borre hacia atrás más allá del prefijo
    input.addEventListener('keydown', function(e) {
        // Si intenta borrar y el cursor está al final del prefijo o antes
        if ((e.key === 'Backspace' || e.key === 'Delete') && this.selectionStart <= prefijoAsunto.length) {
            e.preventDefault(); // Bloquea la tecla
        }
        // Si intenta mover el cursor al inicio
        if (this.selectionStart < prefijoAsunto.length && e.key !== 'ArrowRight') {
            this.setSelectionRange(prefijoAsunto.length, prefijoAsunto.length);
        }
    });

    // Doble seguridad: Si logran borrarlo (seleccionar todo + borrar), lo restauramos
    input.addEventListener('input', function() {
        if (!this.value.startsWith(prefijoAsunto)) {
            // Restauramos el prefijo manteniendo lo que hayan escrito nuevo (si aplica)
            const textoNuevo = this.value.replace(prefijoAsunto, ''); 
            this.value = prefijoAsunto + textoNuevo;
        }
        // Actualizar contador
        actualizarContador(this, 'contador-asunto');
    });
    
    // Al hacer click, si tocan el prefijo, mandamos el cursor al final del prefijo
    input.addEventListener('click', function() {
        if (this.selectionStart < prefijoAsunto.length) {
            this.setSelectionRange(prefijoAsunto.length, prefijoAsunto.length);
        }
    });
}

function cerrarModalPago() {
    document.getElementById('modalPago').style.display = 'none';
}

function actualizarResumenModal(carrito) {
    const container = document.getElementById('resumenFinalItems');
    const totalElement = document.getElementById('totalFinal');
    
    if (!container || !totalElement) return;
    
    container.innerHTML = '';
    let total = 0;

    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        const itemElement = document.createElement('div');
        itemElement.className = 'resumen-item-final';
        itemElement.innerHTML = `
            <div class="item-info-modal">
                <img src="${item.imagen}" alt="${item.nombre}" class="item-imagen-modal" 
                     onerror="this.src='/static/img/errores/error.png'">
                <div class="item-detalles-modal">
                    <span class="item-nombre-modal">${item.nombre}</span>
                    <span class="item-cantidad-modal">${item.cantidad}x</span>
                </div>
            </div>
            <span class="item-subtotal-modal">$${subtotal.toFixed(2)}</span>
        `;
        container.appendChild(itemElement);
    });

    totalElement.textContent = `$${total.toFixed(2)}`;
}

// ========== FUNCIONES DEL CARRITO ==========

function obtenerCarritoLocalStorage() {
    try {
        const carritoJSON = localStorage.getItem('carrito');
        if (!carritoJSON || carritoJSON.trim() === '') {
            return [];
        }
        const carrito = JSON.parse(carritoJSON);
        if (!Array.isArray(carrito)) {
            console.warn('El carrito en localStorage no es un array válido, reiniciando...');
            localStorage.removeItem('carrito');
            return [];
        }
        return carrito;
    } catch (error) {
        console.error('Error al parsear el carrito de localStorage:', error);
        localStorage.removeItem('carrito');
        return [];
    }
}

function actualizarVistaCarrito(datosCarrito = []) {
    // Si nos pasan datos, actualizamos la global. Si no, mantenemos la que hay.
    if (datosCarrito !== undefined) {
        carritoEstadoActual = datosCarrito;
    }    
    const contador = document.getElementById("contadorFlotante");
    if (contador) {
        const totalItems = carritoEstadoActual.reduce((total, item) => total + item.cantidad, 0);
        contador.textContent = totalItems > 99 ? '99+' : totalItems;
        contador.style.display = totalItems > 0 ? 'flex' : 'none';
    }
    const container = document.getElementById('lista-carrito');
    if (!container) return;
    if (carritoEstadoActual.length === 0) {
        container.innerHTML = `
            <tr class="carrito-vacio">
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-shopping-cart"></i>
                        <h3>Tu carrito está vacío</h3>
                        <p>Agrega algunos productos deliciosos</p>
                        <a href="/realizar_pedido" class="btn-seguir-comprando">Seguir Comprando</a>
                    </div>
                </td>
            </tr>
        `;
    } else {
        container.innerHTML = carritoEstadoActual.map(item => {
            const subtotal = item.precio * item.cantidad;
            // Nota: Asegúrate que tu API devuelva 'imagen'. Si no, usa el fallback aquí.
            const imgUrl = item.imagen || `/static/img/productos/${item.categoria}/${item.id}.jpg`;
            return `
                <tr class="producto-fila">
                    <td>
                        <div class="producto-info">
                            <img src="${imgUrl}" alt="${item.nombre}" class="producto-imagen" 
                                onerror="this.src='/static/img/errores/error.png'">
                            <div class="producto-detalles">
                                <div class="producto-nombre">${item.nombre}</div>
                                <span class="producto-categoria">${item.categoria}</span>
                            </div>
                        </div>
                    </td>

                    <td class="precio-unitario">$${item.precio.toFixed(2)}</td>
                    <td>
                        <div class="controles-cantidad">
                            <button class="cantidad-btn" onclick="actualizarCantidadLocal(${item.id}, ${item.cantidad - 1})">-</button>
                            <span class="cantidad-actual">${item.cantidad}</span>
                            <button class="cantidad-btn" onclick="actualizarCantidadLocal(${item.id}, ${item.cantidad + 1})">+</button>
                        </div>
                    </td>

                    <td class="subtotal">$${subtotal.toFixed(2)}</td>
                    <td>
                        <button class="btn-eliminar" onclick="eliminarProductoLocal(${item.id})" title="Eliminar producto">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    actualizarResumenCarrito();
    actualizarEstadoBotonPagar();
}


// --- ACCIONES (Unificadas) ---

async function actualizarCantidad(productoId, nuevaCantidad) {
    if (verificarUsuarioLogueado()) {
        // Lógica Servidor
        if (nuevaCantidad <= 0) {
            await eliminarProductoDeBD(productoId);
        } else {
            await actualizarCantidadEnBD(productoId, nuevaCantidad);
        }
        // Recargamos todo desde el servidor para asegurar sincronía
        await cargarCarritoDesdeBD(); 
    } else {
        // Lógica Local
        let carrito = obtenerCarritoLocalStorage();
        const itemIndex = carrito.findIndex(p => p.id == productoId);

        if (itemIndex !== -1) {
            if (nuevaCantidad <= 0) {
                carrito.splice(itemIndex, 1); // Eliminar
            } else {
                carrito[itemIndex].cantidad = nuevaCantidad; // Actualizar
            }
            localStorage.setItem('carrito', JSON.stringify(carrito));
            actualizarVistaCarrito(carrito);
            window.dispatchEvent(new CustomEvent('carritoActualizado'));
        }
    }
}

async function eliminarProducto(productoId) {
    if (verificarUsuarioLogueado()) {
        await eliminarProductoDeBD(productoId);
        await cargarCarritoDesdeBD();
    } else {
        let carrito = obtenerCarritoLocalStorage();
        carrito = carrito.filter(item => item.id != productoId);
        localStorage.setItem('carrito', JSON.stringify(carrito));
        actualizarVistaCarrito(carrito);
        window.dispatchEvent(new CustomEvent('carritoActualizado'));
    }
}




function actualizarEstadoBotonPagar() {
    const btnPagar = document.getElementById('btnPagar');
    const btnSeguir = document.getElementById('btnSeguirComprandoResumen');
    
    // Usamos la variable global
    const tieneItems = carritoEstadoActual.length > 0;
    
    if (btnPagar) {
        btnPagar.disabled = !tieneItems;
        if (tieneItems) btnPagar.classList.remove('disabled');
        else btnPagar.classList.add('disabled');
    }
    
    if (btnSeguir) {
        btnSeguir.style.display = tieneItems ? 'block' : 'none';
    }
}

async function actualizarCantidadLocal(productoId, nuevaCantidad) {
    if (verificarUsuarioLogueado()) {
        // === LÓGICA SERVIDOR (Usuario Logueado) ===
        if (nuevaCantidad <= 0) {
            await eliminarProductoDeBD(productoId);
        } else {
            await actualizarCantidadEnBD(productoId, nuevaCantidad);
        }
        // Recargamos la vista trayendo la info fresca de la BD
        await cargarCarritoDesdeBD(); 
    } 
    else {
        // === LÓGICA LOCAL (Usuario Invitado) ===
        const carrito = obtenerCarritoLocalStorage();
        const index = carrito.findIndex(item => item.id == productoId);

        if (index !== -1) {
            if (nuevaCantidad <= 0) {
                carrito.splice(index, 1); // Eliminar si llega a 0
            } else {
                carrito[index].cantidad = nuevaCantidad; // Actualizar cantidad
            }
            // Guardar cambios y actualizar vista
            localStorage.setItem('carrito', JSON.stringify(carrito));
            actualizarVistaCarrito(carrito);
            
            // Avisar al botón flotante
            window.dispatchEvent(new CustomEvent('carritoActualizado'));
        }
    }
}

async function eliminarProductoLocal(productoId) {
if (verificarUsuarioLogueado()) {
        await eliminarProductoDeBD(productoId);
        await cargarCarritoDesdeBD();
    } else {
        const carrito = obtenerCarritoLocalStorage();
        const nuevoCarrito = carrito.filter(item => item.id != productoId);
        localStorage.setItem('carrito', JSON.stringify(nuevoCarrito));
        actualizarVistaCarrito(nuevoCarrito);
    }
}

function actualizarResumenCarrito() {
    // Usamos la variable global 'carritoEstadoActual'
    const subtotal = carritoEstadoActual.reduce((total, item) => total + (item.precio * item.cantidad), 0);
    
    const subtotalElement = document.getElementById('subtotal');
    const totalElement = document.getElementById('total');
    
    if (subtotalElement) subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
    if (totalElement) totalElement.textContent = `$${subtotal.toFixed(2)}`;
}

// ========== FUNCIONES DE SUCURSALES ==========

async function cargarSucursales() {
    try {
        const res = await fetch('/api/sucursales');
        if (!res.ok) throw new Error("No se pudieron cargar las sucursales")

        sucursales = await res.json();
        actualizarSelectSucursales();
    } catch (error) {
        console.error('Error cargando sucursales:', error);
        mostrarNotificacion('No se pudieron cargar las sucursales', 'error');
    }
}

function actualizarSelectSucursales() {
    const select = document.getElementById('sucursal');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecciona una sucursal</option>';
    
    sucursales.forEach(sucursal => {
        const option = document.createElement('option');
        option.value = sucursal.suc_id;
        option.textContent = `${sucursal.suc_nombre}`;
        select.appendChild(option);
    });
}

// ========== FUNCIONES DE SINCRONIZACIÓN CON BD ==========

async function sincronizarCarritoBD() {
    if (!verificarUsuarioLogueado()) return;
    
    try {
        const carritoLocal = obtenerCarritoLocalStorage();
        
        // Si hay productos en el carrito local, sincronizar con BD
        if (carritoLocal.length > 0) {
            const response = await fetch('/api/carrito/sincronizar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(carritoLocal)
            });
            
            if (response.ok) {
                console.log('Carrito sincronizado con BD');
            }
        }
        
        // También recuperar carrito de BD si existe
        await recuperarCarritoBD();
        
    } catch (error) {
        console.error('Error sincronizando carrito:', error);
    }
}

async function recuperarCarritoBD() {
    if (!verificarUsuarioLogueado()) return;
    
    try {
        const response = await fetch('/api/carrito/obtener');
        if (!response.ok) return;
        
        const carritoBD = await response.json();
        
        if (carritoBD.length > 0) {
            const carritoLocal = obtenerCarritoLocalStorage();
            
            // Combinar carritos (prioridad al local)
            const carritoCombinado = combinarCarritos(carritoLocal, carritoBD);
            localStorage.setItem('carrito', JSON.stringify(carritoCombinado));
            
            // Actualizar vista
            actualizarVistaCarrito();
        }
        
    } catch (error) {
        console.error('Error recuperando carrito de BD:', error);
    }
}

function combinarCarritos(local, bd) {
    const mapaCombinado = new Map();
    
    // Primero agregar items de BD
    bd.forEach(item => {
        mapaCombinado.set(item.id, { ...item, fuente: 'bd' });
    });
    
    // Sobrescribir con items locales (más recientes)
    local.forEach(item => {
        mapaCombinado.set(item.id, { ...item, fuente: 'local' });
    });
    
    return Array.from(mapaCombinado.values());
}

async function guardarProductoEnBD(productoId, cantidad, categoria) {
    if (!verificarUsuarioLogueado()) return;
    
    try {
        const response = await fetch('/api/carrito/agregar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                producto_id: productoId,
                cantidad: cantidad,
                categoria: categoria
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al guardar producto en BD');
        }
        
    } catch (error) {
        console.error('Error guardando producto en BD:', error);
    }
}
async function eliminarProductoDeBD(productoId) {
    await fetch(`/api/carrito/eliminar/${productoId}`, { method: 'DELETE' });
}

async function actualizarCantidadEnBD(productoId, cantidad) {
    await fetch('/api/carrito/actualizar', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ producto_id: productoId, cantidad: cantidad })
    });
}


// ========== FUNCIONES DE PEDIDOS ==========

async function confirmarPedido(event) {
    event.preventDefault();
    const formData = new FormData(document.getElementById('formPago'));
    
    if (carritoEstadoActual.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'error');
        return;
    }

    const sucursalId = formData.get('sucursal');
    if (!sucursalId) {
        mostrarNotificacion('Por favor selecciona una sucursal', 'error');
        return;
    }
    // Validar que fecha y hora estén seleccionadas
    const fecha = formData.get('fecha_recogida');
    const hora = formData.get('hora_recogida');
    if (!fecha || !hora) {
        mostrarNotificacion('Por favor selecciona fecha y hora de recogida', 'error');
        return;
    }
    try {
        // Mostrar estado de carga
        const btnConfirmar = document.querySelector('.add-to-cart-btn');
        if (btnConfirmar) {
            const originalText = btnConfirmar.innerHTML;
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            btnConfirmar.disabled = true;
        }

        const pedidoData = {
            sucursal_id: parseInt(sucursalId),
            asunto: formData.get('asunto'),
            comentarios: formData.get('comentarios'),
            fecha_entrega: fecha, // Formato YYYY-MM-DD
            hora_entrega: hora,   // Formato HH:MM:SS
            productos: carritoEstadoActual
        };

        const response = await fetch('/api/pedidos/crear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(pedidoData)
        });

        const resultado = await response.json();

        if (resultado.success) {
            mostrarNotificacion('¡Pedido creado exitosamente!', 'success');
            
            // Vaciar carrito local y BD
            await vaciarCarrito();
            
            // Cerrar modal
            cerrarModalPago();
            
            // Redirigir a la página del pedido
            setTimeout(() => {
                window.location.href = `/pedidos/${resultado.pedido_id}`;
            }, 2000);
            
        } else {
            throw new Error(resultado.error || 'Error al crear el pedido');
        }

    } catch (error) {
        console.error('Error creando pedido:', error);
        mostrarNotificacion(error.message, 'error');
        
        // Restaurar botón
        const btnConfirmar = document.querySelector('.add-to-cart-btn');
        if (btnConfirmar) {
            btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Pedido';
            btnConfirmar.disabled = false;
        }
    }
}

// ========== FUNCIONES AUXILIARES ==========

async function vaciarCarrito() {
    if (verificarUsuarioLogueado()) {
        await fetch('/api/carrito/vaciar', { method: 'DELETE' });
        await cargarCarritoDesdeBD();
    } else {
        localStorage.removeItem('carrito');
        actualizarVistaCarrito([]);
    }
}

function verificarUsuarioLogueado() {
    // Verificar si el body tiene el atributo data-user-loggedin
    const body = document.body;
    const isLoggedIn = body.getAttribute('data-user-loggedin') === 'true';
    return isLoggedIn;
}

function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.innerHTML = `
        <i class="fas fa-${tipo === 'success' ? 'check' : 'exclamation-triangle'}"></i>
        <span>${mensaje}</span>
    `;

    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${tipo === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
    `;

    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 300);
    }, 5000);
}

// ========== FUNCIONES PARA AGREGAR PRODUCTOS DESDE OTRAS PÁGINAS ==========

// Función para agregar producto al carrito (desde otras páginas)
function agregarAlCarrito(producto, categoria, cantidad = 1) {
    const carrito = obtenerCarritoLocalStorage();
    
    // Buscar si el producto ya está en el carrito
    const productoExistente = carrito.find(item => item.id === producto.pro_id);
    
    if (productoExistente) {
        // Si ya existe, aumentar la cantidad
        productoExistente.cantidad += cantidad;
    } else {
        // Si no existe, agregar nuevo producto
        carrito.push({
            id: producto.pro_id,
            nombre: producto.pro_nombre,
            precio: parseFloat(producto.pro_precio),
            categoria: categoria,
            cantidad: cantidad,
            imagen: `/static/img/productos/${categoria}/${producto.pro_id}.jpg`,
            agregado: new Date().toISOString()
        });
    }
    
    // Guardar en localStorage
    localStorage.setItem('carrito', JSON.stringify(carrito));
    
    // Sincronizar con BD si está logueado
    if (verificarUsuarioLogueado()) {
        guardarProductoEnBD(producto.pro_id, cantidad, categoria);
    }
    
    // Actualizar vista si estamos en la página del carrito
    if (document.getElementById('lista-carrito')) {
        actualizarVistaCarrito();
    }
    
    // Disparar evento para actualizar el FAB del carrito
    window.dispatchEvent(new CustomEvent('carritoActualizado'));
    
    // Mostrar feedback
    mostrarFeedbackAgregado(producto.pro_nombre, cantidad);
}

function mostrarFeedbackAgregado(nombreProducto, cantidad) {
    const feedback = document.createElement('div');
    feedback.className = 'feedback-agregado';
    feedback.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>¡${cantidad} ${nombreProducto} agregado${cantidad > 1 ? 's' : ''} al carrito!</span>
    `;

    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.remove();
    }, 3000);
}

// ========== FUNCIÓN DE CONTADOR DE CARACTERES ==========

function actualizarContador(input, idContador) {
    const maxLength = input.getAttribute('maxlength');
    const currentLength = input.value.length;
    const contadorElement = document.getElementById(idContador);
    
    if (contadorElement) {
        contadorElement.textContent = `${currentLength}/${maxLength}`;
        
        // Opcional: Cambiar color si llega al límite
        if (currentLength >= maxLength) {
            contadorElement.style.color = '#dc3545'; // Rojo
            contadorElement.style.fontWeight = 'bold';
        } else {
            contadorElement.style.color = '#6c757d'; // Gris original
            contadorElement.style.fontWeight = 'normal';
        }
    }
}