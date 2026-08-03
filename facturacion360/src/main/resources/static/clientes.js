/*
 * clientes.js
 * -----------
 * Gestión completa de clientes:
 * - Listado paginado
 * - Buscador
 * - Filtros provincia/población
 * - Ordenación
 * - Eliminación mediante DELETE
 *
 * Backend:
 * GET    /cliente/listar-pagina
 * DELETE /cliente/{idCliente}
 */


// ===============================
// CONSTANTES API
// ===============================

const API_LISTAR_PAGINA = "/cliente/listar-pagina";
const API_PROVINCIAS = "/cliente/provincias";
const API_POBLACIONES = "/cliente/poblaciones";

const TAMANO_PAGINA = 10;

const ESPERA_TECLEO_MS = 300;


// ===============================
// REFERENCIAS DOM
// ===============================

const cuerpoTabla = document.getElementById("tabla-clientes");
const plantillaFila = document.getElementById("fila-cliente-template");

const btnAnterior = document.getElementById("btn-anterior");
const btnSiguiente = document.getElementById("btn-siguiente");

const infoPagina = document.getElementById("info-pagina");


const inputBuscador =
    document.getElementById("buscador-clientes");

const selectProvincia =
    document.getElementById("filtro-provincia");

const selectPoblacion =
    document.getElementById("filtro-poblacion");

const selectOrdenarPor =
    document.getElementById("filtro-ordenar-por");

const btnDireccion =
    document.getElementById("btn-direccion");

const iconoDireccion =
    document.getElementById("icono-direccion");

const etiquetaDireccion =
    document.getElementById("etiqueta-direccion");

const btnLimpiar =
    document.getElementById("btn-limpiar");


const cabecerasOrdenables =
    document.querySelectorAll(".th-ordenable");


// ===============================
// ESTADO DE LA PANTALLA
// ===============================

const criterios = {

    busqueda: "",
    provincia: "",
    poblacion: "",

    ordenarPor: "fecha_alta",
    direccion: "desc"

};


let paginaActual = 0;


// ===============================
// CONFIGURACIÓN ORDENACIÓN
// ===============================

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



// ===============================
// CONTROL PETICIONES
// ===============================

const peticionesEnVuelo = {};



// ===============================
// FETCH GENERAL JSON
// ===============================

async function pedirJson(canal, url) {


    peticionesEnVuelo[canal]?.abort();


    const controlador =
        new AbortController();


    peticionesEnVuelo[canal] =
        controlador;



    const respuesta =
        await fetch(url, {

            signal: controlador.signal

        });



    if (!respuesta.ok) {

        throw new Error(
            `Servidor respondió ${respuesta.status}`
        );

    }


    return respuesta.json();

}



// ===============================
// CONTROL CANCELACIONES
// ===============================

function esCancelacion(error) {

    return error.name === "AbortError";

}



// ===============================
// CARGAR CLIENTES
// ===============================

async function cargarClientes(pagina) {


    try {


        const parametros =
            new URLSearchParams({

                pagina: pagina,

                tamano: TAMANO_PAGINA,

                ordenarPor:
                    criterios.ordenarPor,

                direccion:
                    criterios.direccion

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



        const datos =
            await pedirJson(
                "listado",
                `${API_LISTAR_PAGINA}?${parametros}`
            );



        paginaActual =
            datos.paginaActual;



        pintarFilas(
            datos.contenido
        );


        pintarPaginacion(datos);



    } catch(error) {


        if (esCancelacion(error)) {

            return;

        }


        mostrarError(error);


    }


}

// ========================================
// ELIMINAR CLIENTE
// ========================================

async function eliminarCliente(idCliente) {

    const confirmar = confirm(
        "¿Seguro que deseas eliminar este cliente? Esta acción no se puede deshacer."
    );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta = await fetch(`/cliente/${idCliente}`, {
            method: "DELETE"
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {

			mostrarMensaje(datos.message, "success");

            // Notificamos al resto del sistema
            document.dispatchEvent(
                new CustomEvent("clientes:cambiaron")
            );

        } else {

			mostrarMensaje(datos.message, "danger");

        }

    } catch (error) {

        console.error(
            "Error eliminando cliente:",
            error
        );

        alert(
            "Ha ocurrido un error al eliminar el cliente."
        );

    }

}



// ========================================
// PINTAR FILAS
// ========================================

function pintarFilas(clientes) {

    cuerpoTabla.replaceChildren();


    if (!Array.isArray(clientes) ||
        clientes.length === 0) {

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


        const tr =
            fila.querySelector("tr");


        // Guardamos ID
        tr.dataset.clienteId =
            cliente.idCliente;


        // ==========================
        // DATOS CLIENTE
        // ==========================

        fila.querySelector(".cliente-nombre")
            .textContent = cliente.nombre;

        fila.querySelector(".cliente-cif")
            .textContent = cliente.nifCif;

        fila.querySelector(".cliente-email")
            .textContent = cliente.email;

        fila.querySelector(".cliente-telefono")
            .textContent = cliente.telefono;

        fila.querySelector(".cliente-alta")
            .textContent =
                formatearFecha(cliente.fechaAlta);



        // ==========================
        // BOTÓN VER
        // ==========================

        const botonVer =
            tr.querySelector(".btn-ver");

        if (botonVer) {

            botonVer.dataset.id =
                cliente.idCliente;

            botonVer.addEventListener(
                "click",
                () => {

                    console.log(
                        "Ver cliente:",
                        cliente.idCliente
                    );

                    // abrirModalVer(cliente.idCliente);

                }
            );
        }



        // ==========================
        // BOTÓN EDITAR
        // ==========================

        const botonEditar =
            tr.querySelector(".btn-editar");

        if (botonEditar) {

            botonEditar.dataset.id =
                cliente.idCliente;

            botonEditar.addEventListener(
                "click",
                () => {

                    console.log(
                        "Editar cliente:",
                        cliente.idCliente
                    );

                    // abrirModalEditar(cliente.idCliente);

                }
            );
        }



        // ==========================
        // BOTÓN ELIMINAR
        // ==========================

        const botonEliminar =
            tr.querySelector(".btn-eliminar");


        if (botonEliminar) {

            botonEliminar.dataset.id =
                cliente.idCliente;

            botonEliminar.addEventListener(
                "click",
                () => eliminarCliente(
                    cliente.idCliente
                )
            );
        }



        cuerpoTabla.appendChild(tr);

    }

}



// ========================================
// FORMATEAR FECHA
// ========================================

function formatearFecha(fechaIso) {

    if (!fechaIso) {

        return "—";

    }

    return new Date(fechaIso)
        .toLocaleDateString("es-ES");

}



// ========================================
// PAGINACIÓN
// ========================================

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

// ============================================
// CONTROLES DE ORDENACIÓN
// ============================================

function pintarControlesOrden() {

    const { ordenarPor, direccion } = criterios;

    const etiqueta =
        ETIQUETAS_ORDEN[`${ordenarPor}|${direccion}`];

    selectOrdenarPor.value = ordenarPor;

    etiquetaDireccion.textContent = etiqueta.texto;

    iconoDireccion.className =
        `fa-solid ${etiqueta.icono}`;

    btnDireccion.title =
        "Pulsa para invertir el orden";

    cabecerasOrdenables.forEach((cabecera) => {

        const activa =
            cabecera.dataset.columna === ordenarPor;

        const caret =
            cabecera.querySelector(".caret-orden");

        cabecera.classList.toggle("activa", activa);

        if (activa) {

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
                activa
                    ? (direccion === "asc"
                        ? "ascending"
                        : "descending")
                    : "none"
            );

    });

}


// ============================================
// UTILIDADES
// ============================================

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



// ============================================
// SELECTS
// ============================================

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



async function cargarProvincias() {

    try {

        rellenarSelect(

            selectProvincia,

            await pedirJson(
                "provincias",
                API_PROVINCIAS
            )

        );

    } catch (error) {

        if (esCancelacion(error)) return;

        console.error(error);

    }

}



async function cargarPoblaciones(provincia) {

    try {

        const url = provincia

            ? `${API_POBLACIONES}?${new URLSearchParams({ provincia })}`

            : API_POBLACIONES;


        rellenarSelect(

            selectPoblacion,

            await pedirJson(
                "poblaciones",
                url
            )

        );

    } catch (error) {

        if (esCancelacion(error)) return;

        console.error(error);

    }

}



// ============================================
// EVENTOS
// ============================================

let temporizadorBusqueda = null;


inputBuscador.addEventListener("input", () => {

    clearTimeout(temporizadorBusqueda);

    temporizadorBusqueda = setTimeout(() => {

        criterios.busqueda =
            inputBuscador.value.trim();

        aplicarCriterios();

    }, ESPERA_TECLEO_MS);

});



selectProvincia.addEventListener("change", async () => {

    criterios.provincia =
        selectProvincia.value;

    criterios.poblacion = "";

    selectPoblacion.value = "";

    await cargarPoblaciones(
        criterios.provincia
    );

    aplicarCriterios();

});


selectPoblacion.addEventListener("change", () => {

    criterios.poblacion =
        selectPoblacion.value;

    aplicarCriterios();

});


selectOrdenarPor.addEventListener("change", () => {

    criterios.ordenarPor =
        selectOrdenarPor.value;

    criterios.direccion =
        DIRECCION_POR_DEFECTO[
            criterios.ordenarPor
        ];

    aplicarCriterios();

});


btnDireccion.addEventListener("click", () => {

    criterios.direccion =
        criterios.direccion === "asc"
            ? "desc"
            : "asc";

    aplicarCriterios();

});


cabecerasOrdenables.forEach((cabecera) => {

    cabecera.addEventListener("click", () => {

        const columna =
            cabecera.dataset.columna;

        if (criterios.ordenarPor === columna) {

            criterios.direccion =
                criterios.direccion === "asc"
                    ? "desc"
                    : "asc";

        } else {

            criterios.ordenarPor = columna;

            criterios.direccion =
                DIRECCION_POR_DEFECTO[columna];

        }

        aplicarCriterios();

    });

});



btnLimpiar.addEventListener("click", async () => {

    criterios.busqueda = "";

    criterios.provincia = "";

    criterios.poblacion = "";

    criterios.ordenarPor = "fecha_alta";

    criterios.direccion = "desc";


    inputBuscador.value = "";

    selectProvincia.value = "";

    selectPoblacion.value = "";


    await cargarPoblaciones("");

    aplicarCriterios();

});



// ============================================
// PAGINACIÓN
// ============================================

btnAnterior.addEventListener(
    "click",
    () => cargarClientes(paginaActual - 1)
);

btnSiguiente.addEventListener(
    "click",
    () => cargarClientes(paginaActual + 1)
);



// ============================================
// REFRESCO AUTOMÁTICO
// ============================================

document.addEventListener(
    "clientes:cambiaron",
    () => cargarClientes(paginaActual)
);



// ============================================
// BOTÓN AÑADIR CLIENTE
// ============================================

const botonAnadirCliente =
    document.querySelector(
        '[data-bs-target="#clienteModal"]'
    );

if (botonAnadirCliente) {

    botonAnadirCliente.addEventListener("click", () => {

        const formulario =
            document.querySelector(
                "#clienteModal form"
            );

        if (formulario) {

            formulario.reset();

        }

    });

}



// ============================================
// BUSCADOR EXPANDIBLE
// ============================================

const contenedorBuscador =
    document.querySelector(
        ".buscador-clientes"
    );

if (contenedorBuscador) {

    document.addEventListener("click", (evento) => {

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

    });

}

function mostrarMensaje(texto, tipo = "success") {

    const contenedor = document.getElementById("mensaje");

    contenedor.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${texto}
            <button type="button"
                    class="btn-close"
                    data-bs-dismiss="alert"
                    aria-label="Cerrar">
            </button>
        </div>
    `;

    setTimeout(() => {
        contenedor.innerHTML = "";
    }, 4000);
}




// ============================================
// CARGA INICIAL
// ============================================

pintarControlesOrden();

cargarProvincias();

cargarPoblaciones("");

cargarClientes(0);
