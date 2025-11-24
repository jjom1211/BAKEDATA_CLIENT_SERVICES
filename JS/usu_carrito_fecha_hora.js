/**
 * Módulo para gestionar la lógica de Fecha y Hora en el carrito
 * Requiere la librería Flatpickr cargada en el HTML
 */

const DatePickerLogic = {
    init: function() {
        this.inicializarCalendario();
        this.generarOpcionesHora();
        // Nota: Ya no necesitamos 'agregarValidaciones' manuales porque Flatpickr
        // bloquea los días pasados automáticamente con 'minDate'.
    },

    inicializarCalendario: function() {
        // 1. Calcular fecha mínima (Mañana)
        const hoy = new Date();
        const manana = new Date(hoy);
        manana.setDate(hoy.getDate() + 1);

        // 2. Inicializar Flatpickr en el input #fecha_recogida
        flatpickr("#fecha_recogida", {
            locale: "es",             // Idioma español
            minDate: manana,          // Bloquea días anteriores a mañana
            dateFormat: "Y-m-d",      // Formato interno para la BD
            altInput: true,           // Muestra una fecha legible al usuario
            altFormat: "F j, Y",      // Ejemplo: "Noviembre 25, 2025"
            disableMobile: "true",    // Fuerza el diseño estilizado incluso en celular
            theme: "light",           // Tema base
            
            // Callback opcional al cambiar la fecha
            onChange: function(selectedDates, dateStr, instance) {
                const helperText = document.querySelector('.input-helper');
                if(helperText) {
                    helperText.style.color = "#28a745"; // Verde éxito
                    helperText.textContent = "Fecha válida seleccionada";
                    // Restaurar texto original después de 2 segundos
                    setTimeout(() => {
                        helperText.style.color = "#b35340"; 
                        helperText.textContent = "Mínimo 1 día de anticipación";
                    }, 2000);
                }
            }
        });
    },

    generarOpcionesHora: function() {
        const horaSelect = document.getElementById('hora_recogida');
        if (!horaSelect) return;
        
        // Limpiar y poner opción por defecto
        horaSelect.innerHTML = '<option value="">Hora</option>';

        const horaInicio = 8;  // 8:00 AM
        const horaFin = 20;    // 8:00 PM

        for (let i = horaInicio; i <= horaFin; i++) {
            // Formato visual 12 horas
            const ampm = i >= 12 ? 'PM' : 'AM';
            const horaMostrar = i % 12 || 12; 
            
            // Opción en punto (8:00)
            const opt = document.createElement('option');
            opt.value = `${String(i).padStart(2, '0')}:00:00`; // Valor BD (24h)
            opt.textContent = `${horaMostrar}:00 ${ampm}`;
            horaSelect.appendChild(opt);

            // Opción y media (8:30) - Solo si no es la hora final exacta
            if (i < horaFin) {
                const optMedia = document.createElement('option');
                optMedia.value = `${String(i).padStart(2, '0')}:30:00`;
                optMedia.textContent = `${horaMostrar}:30 ${ampm}`;
                horaSelect.appendChild(optMedia);
            }
        }
    }
};

// Iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    DatePickerLogic.init();
});