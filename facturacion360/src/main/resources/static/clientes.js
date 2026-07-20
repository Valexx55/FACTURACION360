/*
 * clientes.js
 * -----------
 * Pide al backend los últimos clientes y los pinta en la tabla.
 *
 * Endpoint (arquitectura del profe, con JDBC): GET /cliente/listar-ultimos
 * Devuelve una LISTA simple de ClienteResponse (sin paginación):
 *   { idCliente, nombre, nifCif, direccion, codigoPostal, poblacion,
 *     provincia, telefono, email, fechaAlta }
 *
 * Idea: separar "pedir" (cargarClientes) de "pintar" (pintarFilas). Usamos el
 * <template> del HTML como molde y textContent (no innerHTML) para que un nombre
 * con < o & no pueda inyectar HTML.
 */

// Ruta relativa: el HTML lo sirve el propio Spring Boot, así que apunta al mismo
// origen y no hay problemas de CORS.
const API_LISTAR_ULTIMOS = "/cliente/listar-ultimos";

// Referencias del DOM que usamos.
const cuerpoTabla = document.getElementById("tabla-clientes");
const plantillaFila = document.getElementById("fila-cliente-template");

/** Pide los últimos clientes al backend y dispara el repintado. */
async function cargarClientes() {
    try {
        const respuesta = await fetch(API_LISTAR_ULTIMOS);

        // fetch NO lanza error con códigos 4xx/5xx: hay que comprobarlo a mano.
        if (!respuesta.ok) {
            throw new Error(`El servidor respondió ${respuesta.status}`);
        }

        const clientes = await respuesta.json(); // es una lista (array)
        pintarFilas(clientes);
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
}

// Carga inicial: los últimos clientes.
cargarClientes();


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


