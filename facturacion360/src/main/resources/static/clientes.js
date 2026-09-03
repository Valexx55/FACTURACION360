/*
 * clientes.js
 * -----------
 * Gestión de clientes:
 * - Listado paginado
 * - Búsqueda
 * - Filtros por provincia y población
 * - Ordenación
 * - Ver
 * - Editar
 * - Eliminar
 */


// ============================================================
// CONFIGURACIÓN
// ============================================================


// --- Gestión de la Pantalla de Carga ---
const pantallaCarga = document.getElementById("pantalla-carga");
let peticionesActivas = 0;

// Rutas relativas: el HTML lo sirve el propio Spring Boot, mismo origen (sin CORS).

const API_LISTAR_PAGINA = "/cliente/listar-pagina";
const API_PROVINCIAS = "/cliente/provincias";
const API_POBLACIONES = "/cliente/poblaciones";

const TAMANO_PAGINA = 10;
const ESPERA_TECLEO_MS = 300;


// ============================================================
// REFERENCIAS DEL DOM
// ============================================================

const cuerpoTabla = document.getElementById("tabla-clientes");
const plantillaFila = document.getElementById("fila-cliente-template");

const btnAnterior = document.getElementById("btn-anterior");
const btnSiguiente = document.getElementById("btn-siguiente");
const infoPagina = document.getElementById("info-pagina");

const inputBuscador = document.getElementById("buscador-clientes");
const selectProvincia = document.getElementById("filtro-provincia");
const selectPoblacion = document.getElementById("filtro-poblacion");

const selectOrdenarPor = document.getElementById("filtro-ordenar-por");
const btnDireccion = document.getElementById("btn-direccion");
const iconoDireccion = document.getElementById("icono-direccion");
const etiquetaDireccion = document.getElementById("etiqueta-direccion");

const btnLimpiar = document.getElementById("btn-limpiar");

const cabecerasOrdenables =
    document.querySelectorAll(".th-ordenable");


// ============================================================
// ESTADO
// ============================================================

const criterios = {
    busqueda: "",
    provincia: "",
    poblacion: "",
    ordenarPor: "fecha_alta",
    direccion: "desc"
};

let paginaActual = 0;


// Cliente que está pendiente de confirmación de eliminación
let clientePendienteEliminar = null;


// ============================================================
// ORDENACIÓN
// ============================================================

const ETIQUETAS_ORDEN = {

    "fecha_alta|desc": {
        texto: "Más recientes",
        icono: "fa-arrow-down-wide-short"
    },

    "fecha_alta|asc": {
        texto: "Más antiguos",
        icono: "fa-arrow-up-short-wide"
    },

    "nombre|asc": {
        texto: "A → Z",
        icono: "fa-arrow-down-a-z"
    },

    "nombre|desc": {
        texto: "Z → A",
        icono: "fa-arrow-up-z-a"
    }
};


const DIRECCION_POR_DEFECTO = {

    fecha_alta: "desc",
    nombre: "asc"

};


// ============================================================
// PETICIONES EN VUELO
// ============================================================

const peticionesEnVuelo = {};


/**
 * Realiza una petición GET y cancela la anterior del mismo canal.
 */
async function pedirJson(canal, url) {

    peticionesEnVuelo[canal]?.abort();

    const controlador = new AbortController();

    peticionesEnVuelo[canal] = controlador;


    // Dibuja la imagen de espera
    mostrarCarga();
    
    try {
        const respuesta = await fetch(url, { signal: controlador.signal });
        
        // fetch NO lanza error con códigos 4xx/5xx: hay que comprobarlo a mano.
        if (!respuesta.ok) {
            throw new Error(`El servidor respondió ${respuesta.status}`);
        }
        return await respuesta.json();
    } finally {
        // Elimina la imagen de espera siempre, falle o no
       ocultarCarga();
    }

}


/**
 * Comprueba si el error se produjo porque cancelamos
 * intencionadamente una petición anterior.
 */
function esCancelacion(error) {

    return error.name === "AbortError";

}


// ============================================================
// CARGAR CLIENTES
// ============================================================

async function cargarClientes(pagina) {

    try {

        const parametros = new URLSearchParams({

            pagina: pagina,
            tamano: TAMANO_PAGINA,
            ordenarPor: criterios.ordenarPor,
            direccion: criterios.direccion

        });


        if (criterios.busqueda) {

            parametros.set(
                "busqueda",
                criterios.busqueda
            );

        }


        if (criterios.provincia) {

            parametros.set(
                "provincia",
                criterios.provincia
            );

        }


        if (criterios.poblacion) {

            parametros.set(
                "poblacion",
                criterios.poblacion
            );

        }


        const datos = await pedirJson(
            "listado",
            `${API_LISTAR_PAGINA}?${parametros}`
        );


        paginaActual = datos.paginaActual;


        pintarFilas(datos.contenido);

        pintarPaginacion(datos);


    } catch (error) {

        if (esCancelacion(error)) {
            return;
        }

        mostrarError(error);

    }

}


// ============================================================
// PINTAR FILAS
// ============================================================

function pintarFilas(clientes) {

    cuerpoTabla.replaceChildren();


    if (!Array.isArray(clientes) || clientes.length === 0) {

        mostrarMensaje(

            hayCriteriosActivos()
                ? "No hay clientes que coincidan con la búsqueda."
                : "No hay clientes que mostrar."

        );

        return;

    }


    for (const cliente of clientes) {

        const fila =
            plantillaFila.content.cloneNode(true);


        fila.querySelector(".cliente-nombre")
            .textContent = cliente.nombre ?? "";


        fila.querySelector(".cliente-cif")
            .textContent = cliente.nifCif ?? "";


        fila.querySelector(".cliente-email")
            .textContent = cliente.email ?? "";


        fila.querySelector(".cliente-telefono")
            .textContent = cliente.telefono ?? "";


        fila.querySelector(".cliente-alta")
            .textContent =
            formatearFecha(cliente.fechaAlta);


        const tr = fila.querySelector("tr");


        // Guardamos el ID en la fila
        tr.dataset.clienteId = cliente.idCliente;


        // También lo guardamos en los botones
        fila.querySelector(".btn-ver")
            .dataset.id = cliente.idCliente;


        fila.querySelector(".btn-editar")
            .dataset.id = cliente.idCliente;


        fila.querySelector(".btn-eliminar")
            .dataset.id = cliente.idCliente;


        cuerpoTabla.appendChild(fila);

    }

}


// ============================================================
// FORMATEAR FECHA
// ============================================================

function formatearFecha(fechaIso) {

    if (!fechaIso) {

        return "—";

    }


    return new Date(fechaIso)
        .toLocaleDateString("es-ES");

}


// ============================================================
// PAGINACIÓN
// ============================================================

function pintarPaginacion(datos) {

    btnAnterior.disabled =
        !datos.hayAnterior;


    btnSiguiente.disabled =
        !datos.haySiguiente;


    infoPagina.textContent =
        datos.totalElementos === 0

            ? "Sin resultados"

            : `Página ${datos.paginaActual + 1} de ${datos.totalPaginas} · ${datos.totalElementos} clientes`;

}


// ============================================================
// CONTROLES DE ORDENACIÓN
// ============================================================

function pintarControlesOrden() {

    const {
        ordenarPor,
        direccion
    } = criterios;


    const etiqueta =
        ETIQUETAS_ORDEN[
            `${ordenarPor}|${direccion}`
        ];


    selectOrdenarPor.value =
        ordenarPor;


    etiquetaDireccion.textContent =
        etiqueta.texto;


    iconoDireccion.className =
        `fa-solid ${etiqueta.icono}`;


    btnDireccion.title =
        "Pulsa para invertir el orden";


    cabecerasOrdenables.forEach(
        (cabecera) => {

            const esColumnaActiva =
                cabecera.dataset.columna === ordenarPor;


            const caret =
                cabecera.querySelector(
                    ".caret-orden"
                );


            cabecera.classList.toggle(
                "activa",
                esColumnaActiva
            );


            if (esColumnaActiva) {

                caret.className =
                    `fa-solid caret-orden ${
                        direccion === "asc"
                            ? "fa-arrow-up-long"
                            : "fa-arrow-down-long"
                    }`;

            } else {

                caret.className =
                    "fa-solid fa-sort caret-orden";

            }


            cabecera
                .closest("th")
                .setAttribute(
                    "aria-sort",

                    esColumnaActiva

                        ? (
                            direccion === "asc"
                                ? "ascending"
                                : "descending"
                        )

                        : "none"
                );

        }
    );

}


// ============================================================
// CRITERIOS
// ============================================================

function hayCriteriosActivos() {

    return Boolean(

        criterios.busqueda ||
        criterios.provincia ||
        criterios.poblacion

    );

}


function aplicarCriterios() {

    pintarControlesOrden();

    cargarClientes(0);

}


// ============================================================
// MENSAJES EN MODAL
// ============================================================

function mostrarMensaje(texto) {

    const mensaje =
        document.getElementById(
            "mensaje-modal-texto"
        );

    mensaje.textContent = texto;


    const modalElemento =
        document.getElementById(
            "mensajeModal"
        );


    const modal =
        new bootstrap.Modal(
            modalElemento
        );


    modal.show();

}


// ============================================================
// ERROR
// ============================================================

function mostrarError(error) {

    console.error(
        "No se pudieron cargar los clientes:",
        error
    );


    mostrarMensaje(
        "No se pudieron cargar los clientes. Inténtalo de nuevo."
    );


    btnAnterior.disabled = true;

    btnSiguiente.disabled = true;

}


// ============================================================
// PROVINCIAS
// ============================================================

async function cargarProvincias() {

    try {

        const provincias =
            await pedirJson(
                "provincias",
                API_PROVINCIAS
            );


        rellenarSelect(
            selectProvincia,
            provincias
        );


    } catch (error) {

        if (esCancelacion(error)) {
            return;
        }


        console.error(
            "No se pudieron cargar las provincias:",
            error
        );

    }

}


// ============================================================
// POBLACIONES
// ============================================================

async function cargarPoblaciones(provincia) {

    try {

        const url = provincia

            ? `${API_POBLACIONES}?${new URLSearchParams({
                provincia: provincia
            })}`

            : API_POBLACIONES;


        const poblaciones =
            await pedirJson(
                "poblaciones",
                url
            );


        rellenarSelect(
            selectPoblacion,
            poblaciones
        );


    } catch (error) {

        if (esCancelacion(error)) {
            return;
        }


        console.error(
            "No se pudieron cargar las poblaciones:",
            error
        );

    }

}


// ============================================================
// RELLENAR SELECT
// ============================================================

function rellenarSelect(select, valores) {

    while (select.options.length > 1) {

        select.remove(1);

    }


    for (const valor of valores) {

        const opcion =
            document.createElement("option");


        opcion.value = valor;

        opcion.textContent = valor;


        select.appendChild(opcion);

    }

}


// ============================================================
// BUSCADOR
// ============================================================

let temporizadorBusqueda = null;


inputBuscador.addEventListener(
    "input",
    () => {

        clearTimeout(
            temporizadorBusqueda
        );


        temporizadorBusqueda =
            setTimeout(() => {

                criterios.busqueda =
                    inputBuscador.value.trim();


                aplicarCriterios();

            }, ESPERA_TECLEO_MS);

    }
);


// ============================================================
// FILTRO PROVINCIA
// ============================================================

selectProvincia.addEventListener(
    "change",
    async () => {

        criterios.provincia =
            selectProvincia.value;


        criterios.poblacion = "";

        selectPoblacion.value = "";


        await cargarPoblaciones(
            criterios.provincia
        );


        aplicarCriterios();

    }
);


// ============================================================
// FILTRO POBLACIÓN
// ============================================================

selectPoblacion.addEventListener(
    "change",
    () => {

        criterios.poblacion =
            selectPoblacion.value;


        aplicarCriterios();

    }
);


// ============================================================
// CAMBIAR ORDEN
// ============================================================

selectOrdenarPor.addEventListener(
    "change",
    () => {

        criterios.ordenarPor =
            selectOrdenarPor.value;


        criterios.direccion =
            DIRECCION_POR_DEFECTO[
                criterios.ordenarPor
            ];


        aplicarCriterios();

    }
);


// ============================================================
// CAMBIAR DIRECCIÓN
// ============================================================

btnDireccion.addEventListener(
    "click",
    () => {

        criterios.direccion =
            criterios.direccion === "asc"
                ? "desc"
                : "asc";


        aplicarCriterios();

    }
);


// ============================================================
// CABECERAS ORDENABLES
// ============================================================

cabecerasOrdenables.forEach(
    (cabecera) => {

        cabecera.addEventListener(
            "click",
            () => {

                const columna =
                    cabecera.dataset.columna;


                if (
                    criterios.ordenarPor ===
                    columna
                ) {

                    criterios.direccion =
                        criterios.direccion === "asc"
                            ? "desc"
                            : "asc";

                } else {

                    criterios.ordenarPor =
                        columna;


                    criterios.direccion =
                        DIRECCION_POR_DEFECTO[
                            columna
                        ];

                }


                aplicarCriterios();

            }
        );

    }
);


// ============================================================
// LIMPIAR FILTROS
// ============================================================

btnLimpiar.addEventListener(
    "click",
    async () => {

        criterios.busqueda = "";

        criterios.provincia = "";

        criterios.poblacion = "";

        criterios.ordenarPor =
            "fecha_alta";

        criterios.direccion =
            "desc";


        inputBuscador.value = "";

        selectProvincia.value = "";

        selectPoblacion.value = "";


        await cargarPoblaciones("");


        aplicarCriterios();

    }
);


// ============================================================
// PAGINACIÓN
// ============================================================

btnAnterior.addEventListener(
    "click",
    () => {

        cargarClientes(
            paginaActual - 1
        );

    }
);


btnSiguiente.addEventListener(
    "click",
    () => {

        cargarClientes(
            paginaActual + 1
        );

    }
);


// ============================================================
// BOTÓN VER
// ============================================================

document.addEventListener(
    "click",
    (evento) => {

        const boton =
            evento.target.closest(
                ".btn-ver"
            );


        if (!boton) {
            return;
        }


        const idCliente =
            boton.dataset.id;


        console.log(
            "Ver cliente:",
            idCliente
        );


        // Aquí puedes conectar tu modal de VER
        mostrarMensaje(
            `Has seleccionado el cliente ${idCliente}.`
        );

    }
);


// ============================================================
// BOTÓN EDITAR
// ============================================================

document.addEventListener(
    "click",
    (evento) => {

        const boton =
            evento.target.closest(
                ".btn-editar"
            );


        if (!boton) {
            return;
        }


        const idCliente =
            boton.dataset.id;


        console.log(
            "Editar cliente:",
            idCliente
        );


        // Aquí puedes conectar tu función de editar
        mostrarMensaje(
            `Editar cliente ${idCliente}.`
        );

    }
);


// ============================================================
// BOTÓN ELIMINAR
// ============================================================

document.addEventListener(
    "click",
    (evento) => {

        const boton =
            evento.target.closest(
                ".btn-eliminar"
            );


        if (!boton) {
            return;
        }


        const idCliente =
            boton.dataset.id;


        clientePendienteEliminar =
            idCliente;


        const modalElemento =
            document.getElementById(
                "confirmarEliminarModal"
            );


        const modal =
            new bootstrap.Modal(
                modalElemento
            );


        modal.show();

    }
);


// ============================================================
// CONFIRMAR ELIMINACIÓN
// ============================================================

document
    .getElementById(
        "btn-confirmar-eliminar"
    )
    .addEventListener(
        "click",
        async () => {

            if (!clientePendienteEliminar) {
                return;
            }


            const idCliente =
                clientePendienteEliminar;


            try {

                const respuesta =
                    await fetch(
                        `/cliente/${idCliente}`,
                        {
                            method: "DELETE"
                        }
                    );


                let datos = null;


                try {

                    datos =
                        await respuesta.json();

                } catch {

                    datos = null;

                }


                // Error HTTP
                if (!respuesta.ok) {

                    throw new Error(
                        datos?.message ||
                        "No se pudo eliminar el cliente."
                    );

                }


                // Cerramos modal de confirmación
                cerrarModal(
                    "confirmarEliminarModal"
                );


                clientePendienteEliminar =
                    null;


                // Mensaje de éxito
				mostrarMensaje(
				    datos?.message ||
				    "Cliente eliminado correctamente"
				);

                // Recargamos tabla
                cargarClientes(
                    paginaActual
                );


                // Avisamos al resto
                document.dispatchEvent(
                    new CustomEvent(
                        "clientes:cambiaron"
                    )
                );


            } catch (error) {

                console.error(
                    "Error al eliminar cliente:",
                    error
                );


                cerrarModal(
                    "confirmarEliminarModal"
                );


                clientePendienteEliminar =
                    null;


                mostrarMensaje(
                    error.message ||
                    "No se pudo eliminar el cliente."
                );

            }

        }
    );


// ============================================================
// CERRAR MODAL
// ============================================================

function cerrarModal(idModal) {

    const elemento =
        document.getElementById(
            idModal
        );


    if (!elemento) {
        return;
    }


    const instancia =
        bootstrap.Modal.getInstance(
            elemento
        );


    if (instancia) {

        instancia.hide();

    }

}


// ============================================================
// REFRESCO EXTERNO
// ============================================================

document.addEventListener(
    "clientes:cambiaron",
    () => {

        cargarClientes(
            paginaActual
        );

    }
);


// ============================================================
// BOTÓN AÑADIR CLIENTE
// ============================================================
/*
const botonAnadirCliente =
    document.querySelector(
        '[data-bs-target="#clienteModal"]'
    );


if (botonAnadirCliente) {

    botonAnadirCliente.addEventListener(
        "click",
        () => {

            const formularioCliente =
                document.querySelector(
                    "#clienteModal form"
                );


            if (formularioCliente) {

                formularioCliente.reset();

            }

        }
    );

}*/


// ============================================================
// BUSCADOR EXPANDIBLE
// ============================================================
/*
const contenedorBuscador =
    document.querySelector(
        ".buscador-clientes"
    );


if (contenedorBuscador) {

    document.addEventListener(
        "click",
        (evento) => {

            if (
                contenedorBuscador.contains(
                    evento.target
                )
            ) {

                contenedorBuscador.classList.add(
                    "expandido"
                );


                inputBuscador.focus();

            } else {

                if (
                    inputBuscador.value.trim() === ""
                ) {

                    contenedorBuscador.classList.remove(
                        "expandido"
                    );

                }

            }

        }
    );

}
*/

// ============================================================
// CARGA INICIAL
// ============================================================

pintarControlesOrden();

cargarProvincias();

cargarPoblaciones("");


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


// Buscador: se despliega al pulsar en él y se recoge al salir, si está vacío.
const contenedorBuscador = document.querySelector('.buscador-clientes');

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



function mostrarCarga() {
    peticionesActivas++;
    if (pantallaCarga) {
        pantallaCarga.classList.remove("d-none");
    }
}

function ocultarCarga() {
    peticionesActivas--;
    if (peticionesActivas <= 0) {
        peticionesActivas = 0; // Prevenir números negativos
        if (pantallaCarga) {
            pantallaCarga.classList.add("d-none");
        }
    }
}

