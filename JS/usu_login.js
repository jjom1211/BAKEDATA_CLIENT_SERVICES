document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginDataRequest = {
        username: document.getElementById("username").value,
        password: document.getElementById("contraseña").value,
    };
    
    // Referencias a elementos DOM
    const mensajeDiv = document.getElementById("mensaje-bienvenida");
    const btnSubmit = document.querySelector("#loginForm button[type='submit']");

    try {
        // Desactivar botón para evitar doble click
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Verificando...";

        const response = await fetch('/login', {
            method: "POST",
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(loginDataRequest) 
        });

        const data = await response.json();

        if (!response.ok) {
            // Restaurar botón si falló
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Iniciar Sesión";
            throw new Error(`${data.error}`);
        }

        // === ÉXITO ===
        
        // 1. Mostrar el mensaje en el HTML
        mensajeDiv.textContent = data.message;
        mensajeDiv.style.display = "block"; // Hacemos visible el div
        
        // 2. (Opcional) Ocultar el formulario para enfocar la atención en el saludo
        document.getElementById("loginForm").style.display = "none";
        document.querySelector(".register-text").style.display = "none";
        document.getElementById("registerButton").style.display = "none";

        // 3. Esperar 2 segundos antes de redirigir para que lean el saludo
        setTimeout(() => {
            window.location.href = "/";
        }, 1200); // 1200 milisegundos = 1.2 segundos
    }
    catch (e) {
        // Mostrar error en tu párrafo de error existente en lugar de alert
        const errorP = document.getElementById("error-message");
        if(errorP) {
            errorP.textContent = e.message;
            errorP.style.color = "red";
        } else {
            alert(e);
        }
    }
});
//Funcion para observar la contraseña 
function togglePassword(inputId) { 
    const input = document.getElementById(inputId); 
    input.type = input.type === "password" ? "text" : "password"; 
}
