/*
 * clientes.js
 * -----------
 * Pide al backend una PÁGINA de clientes y la pinta en la tabla, con paginación
 * (botones "Más recientes" / "Más antiguos").
 *
 * Endpoint: GET /cliente/listar-pagina?pagina=0&tamano=10
 * Devuelve un PaginaClienteResponse:
 *   { contenido: [ {idCliente, nombre, nifCif, ...}, ... ],
 *     paginaActual, totalPaginas, totalElementos, hayAnterior, haySiguiente }
 *
 * Idea: separar "pedir" (cargarClientes) de "pintar" (pintarFilas / pintarPaginacion).
 * Usamos el <template> del HTML como molde y textContent (no innerHTML) para que un
 * nombre con < o & no pueda inyectar HTML.
 */

// Ruta relativa: el HTML lo sirve el propio Spring Boot, mismo origen (sin CORS).
const API_LISTAR_PAGINA = "/cliente/listar-pagina";
const TAMANO_PAGINA = 10;

// Referencias del DOM que usamos.
const cuerpoTabla = document.getElementById("tabla-clientes");
const plantillaFila = document.getElementById("fila-cliente-template");
const btnRecientes = document.getElementById("btn-recientes");   // ir a la página anterior
const btnAntiguos = document.getElementById("btn-antiguos");     // ir a la página siguiente
const infoPagina = document.getElementById("info-pagina");

// Único estado que guardamos entre clics: en qué página estamos.
let paginaActual = 0;

/**
 * Pide una página de clientes al backend y repinta la tabla y los botones.
 * @param {number} pagina índice de la página a cargar (empieza en 0)
 */
async function cargarClientes(pagina) {
    try {
        const respuesta = await fetch(`${API_LISTAR_PAGINA}?pagina=${pagina}&tamano=${TAMANO_PAGINA}`);

        // fetch NO lanza error con códigos 4xx/5xx: hay que comprobarlo a mano.
        if (!respuesta.ok) {
            throw new Error(`El servidor respondió ${respuesta.status}`);
        }

        const datos = await respuesta.json();   // PaginaClienteResponse
        paginaActual = datos.paginaActual;
        pintarFilas(datos.contenido);
        pintarPaginacion(datos);
    } catch (error) {
        mostrarError(error);
    }
}

/**
 * Vacía el <tbody> y lo rellena clonando el <template> por cada cliente.
 * @param {Array<Object>} clientes lista de ClienteResponse
 */
function pintarFilas(clientes) {
    cuerpoTabla.replaceChildren(); // limpia la tabla sin usar innerHTML

    if (!Array.isArray(clientes) || clientes.length === 0) {
        mostrarMensaje("No hay clientes que mostrar.");
        return;
    }
	
    for (const cliente of clientes) {
        // Clonamos el contenido del template (un <tr> completo con sus <td>).
        const fila = plantillaFila.content.cloneNode(true);

        // textContent escapa el texto: seguro frente a nombres con < o &.
        fila.querySelector(".cliente-nombre").textContent = cliente.nombre;
        fila.querySelector(".cliente-cif").textContent = cliente.nifCif;
        fila.querySelector(".cliente-email").textContent = cliente.email;
        fila.querySelector(".cliente-telefono").textContent = cliente.telefono;

        // Guardamos el id en la fila por si los botones de acción lo necesitan.
        fila.querySelector("tr").dataset.clienteId = cliente.idCliente;

        cuerpoTabla.appendChild(fila);
    }
}

/**
 * Activa/desactiva los botones y actualiza el texto según los metadatos de la página.
 * @param {Object} datos PaginaClienteResponse
 */
function pintarPaginacion(datos) {
    // "Más recientes" = página anterior; "Más antiguos" = página siguiente. El backend
    // nos dice si cada una existe, así el usuario no se sale del rango.
    btnRecientes.disabled = !datos.hayAnterior;
    btnAntiguos.disabled = !datos.haySiguiente;

    infoPagina.textContent =
        `Página ${datos.paginaActual + 1} de ${datos.totalPaginas} · ${datos.totalElementos} clientes`;
}

/** Pinta una fila que ocupa toda la tabla con un mensaje informativo. */
function mostrarMensaje(texto) {
    cuerpoTabla.replaceChildren();
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = 5; // la tabla tiene 5 columnas
    celda.className = "text-center text-muted py-4";
    celda.textContent = texto;
    fila.appendChild(celda);
    cuerpoTabla.appendChild(fila);
}

/** Muestra el error al usuario y lo deja en consola para depurar. */
function mostrarError(error) {
    console.error("No se pudieron cargar los clientes:", error);
    mostrarMensaje("No se pudieron cargar los clientes. Inténtalo de nuevo.");
    btnRecientes.disabled = true;
    btnAntiguos.disabled = true;
}

// --- Enlazado de los botones de paginación ---
btnRecientes.addEventListener("click", () => cargarClientes(paginaActual - 1));
btnAntiguos.addEventListener("click", () => cargarClientes(paginaActual + 1));

// --- Refresco automático tras crear/editar/eliminar ---
document.addEventListener("clientes:cambiaron", () => cargarClientes(paginaActual));

// Carga inicial: la primera página (los 10 más recientes).
cargarClientes(0);


// =========================================================================
// INTEGRACIÓN DE ACCIONES (VER, EDITAR, ELIMINAR Y GUARDAR)
// Utilizando delegación de eventos para que funcionen en elementos dinámicos
// =========================================================================

// 1. Botón VER
document.addEventListener('click', async (e) => {
    const btnVer = e.target.closest('.btn-ver');
    if (!btnVer) return;

    const fila = btnVer.closest('tr');
    const idCliente = fila.dataset.clienteId;
    
    try {
        const respuesta = await fetch(`/cliente/buscar/${idCliente}`);
        if (!respuesta.ok) throw new Error("Error al obtener el cliente");
        const cliente = await respuesta.json();
        
        alert(`Detalles del cliente:\nNombre: ${cliente.nombre}\nCIF: ${cliente.nifCif}\nEmail: ${cliente.email}\nTeléfono: ${cliente.telefono}`);
    } catch (error) {
        console.error("Error al ver cliente:", error);
    }
});

// 2. Botón EDITAR
document.addEventListener('click', async (e) => {
    const btnEditar = e.target.closest('.btn-editar');
    if (!btnEditar) return;

    const fila = btnEditar.closest('tr');
    const idCliente = fila.dataset.clienteId;
    
    try {
        const respuesta = await fetch(`/cliente/buscar/${idCliente}`);
        if (!respuesta.ok) throw new Error("Error al obtener el cliente para editar");
        const cliente = await respuesta.json();
        
        // Rellenamos el formulario del modal con los datos actuales
        document.getElementById("nombreCliente").value = cliente.nombre;
        document.getElementById("cifCliente").value = cliente.nifCif;
        document.getElementById("emailCliente").value = cliente.email;
        document.getElementById("telefonoCliente").value = cliente.telefono;
        
        // Guardamos temporalmente el ID en el dataset del formulario para saber que es una edición
        const formulario = document.getElementById("formCliente");
        formulario.dataset.idClientEdit = idCliente;
        
        // Mostramos el modal usando Bootstrap
        const modalElement = document.getElementById('clienteModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error("Error al cargar cliente para editar:", error);
    }
});

// 3. Botón ELIMINAR
document.addEventListener('click', async (e) => {
    const btnEliminar = e.target.closest('.btn-eliminar');
    if (!btnEliminar) return;

    const fila = btnEliminar.closest('tr');
    const idCliente = fila.dataset.clienteId;
    
    if (confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
        try {
            const respuesta = await fetch(`/cliente/eliminar/${idCliente}`, {
                method: 'DELETE'
            });
            
            if (!respuesta.ok) throw new Error("No se pudo eliminar el cliente");
            
            // Disparamos el evento para refrescar la tabla automáticamente
            document.dispatchEvent(new CustomEvent('clientes:cambiaron'));
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("No se pudo eliminar el cliente.");
        }
    }
});

/**
 * Función global llamada desde el botón "Guardar Cambios" del Modal en HTML.
 * Gestiona de forma inteligente si se trata de una creación (POST) o actualización (PUT).
 */
async function guardarCliente() {
    const formulario = document.getElementById("formCliente");
    const idClienteEdit = formulario.dataset.idClientEdit;

    const cliente = {
        nombre: document.getElementById("nombreCliente").value,
        nifCif: document.getElementById("cifCliente").value,
        email: document.getElementById("emailCliente").value,
        telefono: document.getElementById("telefonoCliente").value
    };

    // Validamos brevemente los campos nativos del form si es necesario
    if (!formulario.checkValidity()) {
        formulario.reportValidity();
        return;
    }

	const metodo = idClienteEdit ? "PUT" : "POST";
	    // Debe apuntar a "/cliente" en lugar de "/cliente/crear" para que coincida con tu @PostMapping
	    const url = idClienteEdit ? `/cliente/${idClienteEdit}` : "/cliente";
    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cliente)
        });

        if (!respuesta.ok) throw new Error("El servidor no pudo guardar los cambios.");

        // Cerramos el modal de Bootstrap
        const modalElement = document.getElementById('clienteModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();

        // Limpiamos el formulario y el identificador de edición
        formulario.reset();
        delete formulario.dataset.idClientEdit;

        // Disparamos el evento para recargar la tabla con los datos frescos
        document.dispatchEvent(new CustomEvent('clientes:cambiaron'));

    } catch (error) {
        console.error("Error al guardar el cliente:", error);
        alert("Hubo un error al procesar la solicitud.");
    }
}

// Limpieza del formulario al hacer clic en "Añadir Cliente" (para que no arrastre datos o IDs de ediciones previas)
const botonAnadirCliente = document.querySelector('[data-bs-target="#clienteModal"]');
if (botonAnadirCliente) {
    botonAnadirCliente.addEventListener('click', () => {
        const formularioCliente = document.getElementById('formCliente');
        if (formularioCliente) {
            formularioCliente.reset();
            delete formularioCliente.dataset.idClientEdit; // Nos aseguramos de limpiar el ID de edición
        }
    });
}


// =========================================================================
// BUSCADOR ANIMADO
// =========================================================================
const contenedorBuscador = document.querySelector('.buscador-clientes');
const inputBuscador = document.getElementById('buscador-clientes');

if (contenedorBuscador && inputBuscador) {
    document.addEventListener('click', (evento) => {
        if (contenedorBuscador.contains(evento.target)) {
            contenedorBuscador.classList.add('expandido');
            inputBuscador.focus();
        } else {
            if (inputBuscador.value.trim() === '') {
                contenedorBuscador.classList.remove('expandido');
            }
        }
    });
}