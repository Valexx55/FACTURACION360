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
// Cuando otro compañero cambie un cliente, avisa disparando este evento y recargamos la
// página actual (así la tabla siempre refleja la BD, sin que su código conozca el nuestro).
// Ellos solo hacen: document.dispatchEvent(new CustomEvent('clientes:cambiaron'));
document.addEventListener("clientes:cambiaron", () => cargarClientes(paginaActual));

// Carga inicial: la primera página (los 10 más recientes).
cargarClientes(0);


// 1. Botón VER
document.querySelectorAll('.btn-ver').forEach(boton => {
  boton.addEventListener('click', (e) => {
    const idCliente = e.currentTarget.dataset.id; 
    
    console.log('Ver cliente:', idCliente);
    // Aquí ejecutas tu función, p. ej.: abrirModalVer(idCliente);
  });
});

// 2. Botón EDITAR
document.querySelectorAll('.btn-editar').forEach(boton => {
  boton.addEventListener('click', (e) => {
    const idCliente = e.currentTarget.dataset.id;
    
    console.log('Editar cliente:', idCliente);
    // Aquí ejecutas tu función, p. ej.: abrirModalEditar(idCliente);
  });
});

// 3. Botón ELIMINAR
document.querySelectorAll('.btn-eliminar').forEach(boton => {
  boton.addEventListener('click', (e) => {
    const idCliente = e.currentTarget.dataset.id;
    
    if (confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
      console.log('Eliminar cliente:', idCliente);
      // Aquí ejecutas tu llamada API o función: eliminarCliente(idCliente);
    }
  });
});

// Buscamos el botón "Añadir Cliente"
const botonAnadirCliente = document.querySelector('[data-bs-target="#clienteModal"]');

botonAnadirCliente.addEventListener('click', () => {
  console.log('Hiciste clic en Añadir Cliente');
  
  // Limpiamos el formulario dentro del modal
  const formularioCliente = document.querySelector('#clienteModal form');
  if (formularioCliente) {
    formularioCliente.reset();
  }
});


// Buscador
const contenedorBuscador = document.querySelector('.buscador-clientes');
const inputBuscador = document.getElementById('buscador-clientes');

document.addEventListener('click', (evento) => {
    // Verificamos si el clic ocurrió DENTRO del contenedor del buscador
    if (contenedorBuscador.contains(evento.target)) {
        // Expandimos y ponemos el cursor dentro
        contenedorBuscador.classList.add('expandido');
        inputBuscador.focus();
    } else {
        // Si hizo clic FUERA, verificamos si el input está vacío antes de cerrarlo
        if (inputBuscador.value.trim() === '') {
            contenedorBuscador.classList.remove('expandido');
        }
    }
});


