document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. Obtención de valores y limpieza de espacios (trim)
    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    
    // CORRECCIÓN 1: Agregamos .trim() aquí también para evitar que "Sandi " sea diferente de "Sandi"
    const password = document.getElementById("contraseña").value.trim();
    
    const confirmPasswordInput = document.getElementById("confirmacion_de_contraseña");
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";

    // Para depuración (puedes borrar esto después): 
    // Te mostrará en la consola del navegador qué está leyendo exactamente
    console.log(`Pass 1: "${password}" (Largo: ${password.length})`);
    console.log(`Pass 2: "${confirmPassword}" (Largo: ${confirmPassword.length})`);

    // ============================================================
    // 2. BLOQUE DE VALIDACIONES
    // ============================================================

    // A. Validar Campos Vacíos
    if (!nombre || !apellido || !correo || !telefono || !password) {
        return alert("Por favor, completa todos los campos obligatorios.");
    }

    // B. Validar Longitud de Nombre y Apellido
    if (nombre.length > 50) {
        return alert("El nombre es demasiado largo (máximo 50 caracteres).");
    }
    if (apellido.length > 50) {
        return alert("El apellido es demasiado largo (máximo 50 caracteres).");
    }

    // C. Validar Correo
    if (correo.length > 45) {
        return alert("El correo es demasiado largo (máximo 45 caracteres).");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
        return alert("Por favor, introduce un correo electrónico válido.");
    }

    // D. Validar Teléfono
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(telefono)) {
        return alert("El teléfono debe contener exactamente 10 dígitos numéricos.");
    }

    // E. Validar Contraseñas - CORRECCIÓN 2: CAMBIO DE ORDEN
    
    // Primero: Validamos que la contraseña cumpla con los requisitos mínimos
    // Si usas "Sandi" (5 letras), entrará aquí primero.
    if (password.length < 6) {
        return alert("La contraseña es muy débil (mínimo 6 caracteres).");
    }

    // Segundo: Validamos que coincidan
    // Si llegamos aquí, sabemos que "password" tiene al menos 6 caracteres.
    if (password !== confirmPassword) {
        return alert("Las contraseñas no coinciden. Por favor, verifícalo.");
    }

    // ============================================================
    // FIN VALIDACIONES
    // ============================================================

    const userData = {
        nombre: nombre,
        apellido: apellido,
        correo: correo,
        telefono: telefono,
        password: password,
    };

try {
        const response = await fetch('/register', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        // 1. IMPORTANTE: Esperamos y convertimos la respuesta a JSON
        // Esto lee lo que enviaste con jsonify({'message': '...'}) desde Python
        const data = await response.json(); 

        // 2. Verificamos si el estatus NO es exitoso (ej. 409 o 500)
        if (!response.ok) {
            // Lanzamos el error usando EL MENSAJE que viene del backend (data.message)
            // Si por algo no viene mensaje, usamos un texto genérico.
            throw new Error(data.message || `Error desconocido del servidor (${response.status})`);
        }
        
        // 3. Si todo salió bien (Código 201)
        // Usamos el mensaje de éxito del backend o uno por defecto
        alert(data.message || "Usuario registrado con éxito");
        
        window.history.replaceState({}, document.title, window.location.pathname);

        // Resetear formulario
        document.getElementById("registerForm").reset();

        window.location.href = "/login";
    }
    catch(error){
        // 4. Aquí mostramos SOLO el mensaje de error limpio
        // error.message contendrá: "El correo electrónico ya está registrado."
        alert(error.message); 
        console.error(error);
    }
});

function togglePassword(inputId) { 
    const input = document.getElementById(inputId); 
    input.type = input.type === "password" ? "text" : "password"; 
}
