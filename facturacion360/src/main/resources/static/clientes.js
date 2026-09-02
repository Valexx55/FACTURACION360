/*
 * clientes.js
 * -----------
 * Pide al backend una PÁGINA de clientes y la pinta en la tabla, con buscador,
 * filtros por provincia/población, ordenación y paginación.
 *
 * Endpoint: GET /cliente/listar-pagina?pagina=0&tamano=10&busqueda=&provincia=
 *                                     &poblacion=&ordenarPor=&direccion=
 * Devuelve un PaginaClienteResponse:
 *   { contenido: [ {idCliente, nombre, nifCif, ..., fechaAlta}, ... ],
 *     paginaActual, totalPaginas, totalElementos, hayAnterior, haySiguiente }
 *
 * Buscar, filtrar y ordenar son el MISMO endpoint: para el backend, buscar es
 * "listar con un filtro de texto más". Por eso aquí hay una sola función que pide
 * datos (cargarClientes) en vez de una por cada modo.
 *
 * Idea: separar "pedir" (cargarClientes) de "pintar" (pintarFilas / pintarPaginacion).
 * Usamos el <template> del HTML como molde y textContent (no innerHTML) para que un
 * nombre con < o & no pueda inyectar HTML.
 */

// --- Gestión de la Pantalla de Carga ---
const pantallaCarga = document.getElementById("pantalla-carga");
let peticionesActivas = 0;

// Rutas relativas: el HTML lo sirve el propio Spring Boot, mismo origen (sin CORS).
const API_LISTAR_PAGINA = "/cliente/listar-pagina";
const API_PROVINCIAS = "/cliente/provincias";
const API_POBLACIONES = "/cliente/poblaciones";
const TAMANO_PAGINA = 10;

// Cuánto esperamos tras la última tecla antes de consultar. Sin esta pausa,
// escribir "garcia" lanzaría 6 peticiones a la base de datos en vez de 1.
const ESPERA_TECLEO_MS = 300;

// Referencias del DOM que usamos.
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
const cabecerasOrdenables = document.querySelectorAll(".th-ordenable");

/*
 * ÚNICO estado de la pantalla. Que todo viva en un solo objeto es lo que impide que
 * el botón de dirección y las cabeceras de la tabla se contradigan: los dos leen y
 * escriben aquí, y luego se repinta todo desde este objeto.
 */
const criterios = {
    busqueda: "",
    provincia: "",
    poblacion: "",
    ordenarPor: "fecha_alta",
    direccion: "desc",
};

let paginaActual = 0;

/*
 * Etiqueta e icono del botón según lo que se esté viendo AHORA. Decir "Más recientes"
 * o "A → Z" es mucho más claro que un "asc/desc" genérico, porque nombra el resultado
 * y no el mecanismo.
 */
const ETIQUETAS_ORDEN = {
    "fecha_alta|desc": { texto: "Más recientes", icono: "fa-arrow-down-wide-short" },
    "fecha_alta|asc": { texto: "Más antiguos", icono: "fa-arrow-up-short-wide" },
    "nombre|asc": { texto: "A → Z", icono: "fa-arrow-down-a-z" },
    "nombre|desc": { texto: "Z → A", icono: "fa-arrow-up-z-a" },
};

// Sentido natural de cada columna al empezar a ordenar por ella: las fechas se miran
// de la más nueva a la más vieja, y los nombres de la A a la Z.
const DIRECCION_POR_DEFECTO = {
    fecha_alta: "desc",
    nombre: "asc",
};

/*
 * Petición en vuelo de cada "canal" (listado, provincias, poblaciones). Al lanzar una
 * nueva petición de un canal se cancela la anterior DEL MISMO canal.
 *
 * Hacen falta canales separados y no un único controlador compartido: al cambiar de
 * provincia se piden a la vez las poblaciones y el listado, y con un solo controlador
 * cada una abortaría a la otra.
 */
const peticionesEnVuelo = {};

/**
 * Pide un JSON al backend cancelando la petición anterior del mismo canal.
 *
 * El debounce reduce las peticiones, pero no evita que dos respuestas se crucen: si
 * escribes "gar", sale la petición, sigues hasta "garcia" y la respuesta de "gar" llega
 * la última, pintaría la tabla con resultados que no son los del texto del buscador.
 * Cancelando la anterior, esa respuesta tardía nunca llega a usarse.
 *
 * @param {string} canal nombre del flujo de peticiones ("listado", "provincias"...)
 * @param {string} url la URL a pedir
 * @return {Promise<Object>} el JSON de la respuesta
 * @throws {Error} si el servidor responde con un código que no es 2xx
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
 * ¿Este error es de una petición que hemos cancelado nosotros?
 *
 * Cancelar es algo que provocamos a propósito, no un fallo: si lo tratáramos como tal,
 * el usuario vería el mensaje de error justo mientras escribe en el buscador.
 * @param {Error} error el error capturado
 */
function esCancelacion(error) {
    return error.name === "AbortError";
}

/**
 * Pide una página de clientes al backend (con los criterios actuales) y repinta todo.
 * @param {number} pagina índice de la página a cargar (empieza en 0)
 */
async function cargarClientes(pagina) {
    try {
        // URLSearchParams se encarga de codificar los valores: un término con '&',
        // '%' o tildes viaja entero y no rompe la URL.
        const parametros = new URLSearchParams({
            pagina: pagina,
            tamano: TAMANO_PAGINA,
            ordenarPor: criterios.ordenarPor,
            direccion: criterios.direccion,
        });

        // Los criterios vacíos NO se mandan: el backend entiende "parámetro ausente"
        // como "no filtres por esto".
        if (criterios.busqueda) parametros.set("busqueda", criterios.busqueda);
        if (criterios.provincia) parametros.set("provincia", criterios.provincia);
        if (criterios.poblacion) parametros.set("poblacion", criterios.poblacion);

        const datos = await pedirJson("listado", `${API_LISTAR_PAGINA}?${parametros}`);
        paginaActual = datos.paginaActual;
        pintarFilas(datos.contenido);
        pintarPaginacion(datos);
    } catch (error) {
        // Si la hemos cancelado nosotros, ya viene otra petición en camino: salimos sin
        // tocar la tabla para no borrar lo que hay mientras llega la respuesta buena.
        if (esCancelacion(error)) return;
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
        // El mensaje cambia según el motivo: "no hay clientes" y "tu búsqueda no
        // encuentra nada" son cosas distintas y el usuario reacciona distinto a cada una.
        mostrarMensaje(hayCriteriosActivos()
            ? "No hay clientes que coincidan con la búsqueda."
            : "No hay clientes que mostrar.");
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
        fila.querySelector(".cliente-alta").textContent = formatearFecha(cliente.fechaAlta);

        // Guardamos el id en la fila por si los botones de acción lo necesitan.
        fila.querySelector("tr").dataset.clienteId = cliente.idCliente;

        cuerpoTabla.appendChild(fila);
    }
}

/**
 * Pasa la fecha ISO que manda el backend (2026-01-10) al formato español (10/1/2026).
 * @param {string|null} fechaIso fecha en formato ISO, o null si el cliente no la tiene
 * @return {string} la fecha formateada, o un guion si no hay fecha
 */
function formatearFecha(fechaIso) {
    if (!fechaIso) {
        return "—";   // fecha_alta admite NULL en base de datos
    }
    return new Date(fechaIso).toLocaleDateString("es-ES");
}

/**
 * Activa/desactiva los botones y actualiza el texto según los metadatos de la página.
 * @param {Object} datos PaginaClienteResponse
 */
function pintarPaginacion(datos) {
    // El backend nos dice si cada página existe, así el usuario no se sale del rango.
    btnAnterior.disabled = !datos.hayAnterior;
    btnSiguiente.disabled = !datos.haySiguiente;

    infoPagina.textContent = datos.totalElementos === 0
        ? "Sin resultados"
        : `Página ${datos.paginaActual + 1} de ${datos.totalPaginas} · ${datos.totalElementos} clientes`;
}

/**
 * Repinta TODOS los controles de ordenación (el selector, el botón y los carets de las
 * cabeceras) leyendo del estado.
 *
 * Es una sola función a propósito: el usuario puede cambiar el orden desde el botón o
 * desde la cabecera de la tabla, y si cada camino actualizara su propio control, uno de
 * los dos acabaría mostrando algo distinto de lo que realmente se está viendo.
 */
function pintarControlesOrden() {
    const { ordenarPor, direccion } = criterios;
    const etiqueta = ETIQUETAS_ORDEN[`${ordenarPor}|${direccion}`];

    selectOrdenarPor.value = ordenarPor;
    etiquetaDireccion.textContent = etiqueta.texto;
    iconoDireccion.className = `fa-solid ${etiqueta.icono}`;
    btnDireccion.title = "Pulsa para invertir el orden";

    // Cada cabecera muestra si es la columna activa y en qué sentido.
    cabecerasOrdenables.forEach((cabecera) => {
        const esColumnaActiva = cabecera.dataset.columna === ordenarPor;
        const caret = cabecera.querySelector(".caret-orden");

        cabecera.classList.toggle("activa", esColumnaActiva);

        if (esColumnaActiva) {
            caret.className = `fa-solid caret-orden ${direccion === "asc" ? "fa-arrow-up-long" : "fa-arrow-down-long"}`;
        } else {
            caret.className = "fa-solid fa-sort caret-orden";
        }

        // aria-sort es lo que hace que un lector de pantalla anuncie por qué columna
        // está ordenada la tabla; va en el <th>, no en el botón.
        cabecera.closest("th").setAttribute("aria-sort",
            esColumnaActiva ? (direccion === "asc" ? "ascending" : "descending") : "none");
    });
}

/** ¿Hay algún filtro o búsqueda puesto? (la ordenación no cuenta: siempre hay una) */
function hayCriteriosActivos() {
    return Boolean(criterios.busqueda || criterios.provincia || criterios.poblacion);
}

/**
 * Aplica un cambio de criterios: repinta los controles y VUELVE A LA PÁGINA 1.
 *
 * El reinicio de página es imprescindible: si estás en la página 7 y filtras por una
 * provincia con 12 clientes, esa página ya no existe y verías una tabla vacía sin
 * entender por qué.
 */
function aplicarCriterios() {
    pintarControlesOrden();
    cargarClientes(0);
}

/** Pinta una fila que ocupa toda la tabla con un mensaje informativo. */
function mostrarMensaje(texto) {
    cuerpoTabla.replaceChildren();
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = 6; // la tabla tiene 6 columnas
    celda.className = "text-center text-muted py-4";
    celda.textContent = texto;
    fila.appendChild(celda);
    cuerpoTabla.appendChild(fila);
}

/** Muestra el error al usuario y lo deja en consola para depurar. */
function mostrarError(error) {
    console.error("No se pudieron cargar los clientes:", error);
    mostrarMensaje("No se pudieron cargar los clientes. Inténtalo de nuevo.");
    btnAnterior.disabled = true;
    btnSiguiente.disabled = true;
}

// --- Desplegables de provincia y población (en cascada) ---

/**
 * Rellena un <select> con las opciones recibidas, conservando la primera (el "Todas...").
 * @param {HTMLSelectElement} select el desplegable a rellenar
 * @param {Array<string>} valores las opciones a añadir
 */
function rellenarSelect(select, valores) {
    // Quitamos todo menos la primera opción, que es la de "sin filtro".
    while (select.options.length > 1) {
        select.remove(1);
    }
    for (const valor of valores) {
        const opcion = document.createElement("option");
        opcion.value = valor;
        opcion.textContent = valor;   // textContent: nunca innerHTML
        select.appendChild(opcion);
    }
}

/** Carga las provincias del backend en su desplegable. */
async function cargarProvincias() {
    try {
        rellenarSelect(selectProvincia, await pedirJson("provincias", API_PROVINCIAS));
    } catch (error) {
        if (esCancelacion(error)) return;
        console.error("No se pudieron cargar las provincias:", error);
    }
}

/**
 * Carga las poblaciones en su desplegable. Si hay provincia elegida, solo las de esa
 * provincia (por eso es "en cascada"): ofrecer poblaciones de otras provincias daría
 * combinaciones que no devuelven ningún cliente.
 * @param {string} provincia provincia elegida, o cadena vacía para todas
 */
async function cargarPoblaciones(provincia) {
    try {
        const url = provincia
            ? `${API_POBLACIONES}?${new URLSearchParams({ provincia })}`
            : API_POBLACIONES;
        rellenarSelect(selectPoblacion, await pedirJson("poblaciones", url));
    } catch (error) {
        // Si el usuario cambia de provincia deprisa, la petición anterior se cancela:
        // sin esto, el desplegable podría quedarse con las poblaciones de la provincia
        // que ya no está seleccionada.
        if (esCancelacion(error)) return;
        console.error("No se pudieron cargar las poblaciones:", error);
    }
}

// --- Enlazado de los controles ---

// Buscador con espera: reiniciamos el temporizador en cada tecla y solo consultamos
// cuando el usuario lleva ESPERA_TECLEO_MS sin escribir.
let temporizadorBusqueda = null;
inputBuscador.addEventListener("input", () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
        criterios.busqueda = inputBuscador.value.trim();
        aplicarCriterios();
    }, ESPERA_TECLEO_MS);
});

selectProvincia.addEventListener("change", async () => {
    criterios.provincia = selectProvincia.value;

    // Al cambiar de provincia, la población elegida deja de tener sentido: se limpia
    // (si no, quedaría un filtro "Valencia + Madrid" que no devuelve nada).
    criterios.poblacion = "";
    selectPoblacion.value = "";
    await cargarPoblaciones(criterios.provincia);

    aplicarCriterios();
});

selectPoblacion.addEventListener("change", () => {
    criterios.poblacion = selectPoblacion.value;
    aplicarCriterios();
});

selectOrdenarPor.addEventListener("change", () => {
    criterios.ordenarPor = selectOrdenarPor.value;
    // Al cambiar de columna estrenamos su sentido natural (fechas: nuevas primero;
    // nombres: A → Z), que es lo que se espera la primera vez.
    criterios.direccion = DIRECCION_POR_DEFECTO[criterios.ordenarPor];
    aplicarCriterios();
});

// El botón invierte el sentido sin tocar la columna.
btnDireccion.addEventListener("click", () => {
    criterios.direccion = criterios.direccion === "asc" ? "desc" : "asc";
    aplicarCriterios();
});

// Cabeceras de la tabla: mismo comportamiento que en cualquier tabla ordenable.
cabecerasOrdenables.forEach((cabecera) => {
    cabecera.addEventListener("click", () => {
        const columna = cabecera.dataset.columna;

        if (criterios.ordenarPor === columna) {
            // Ya ordenamos por ella: el segundo clic invierte el sentido.
            criterios.direccion = criterios.direccion === "asc" ? "desc" : "asc";
        } else {
            criterios.ordenarPor = columna;
            criterios.direccion = DIRECCION_POR_DEFECTO[columna];
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

// --- Paginación ---
btnAnterior.addEventListener("click", () => cargarClientes(paginaActual - 1));
btnSiguiente.addEventListener("click", () => cargarClientes(paginaActual + 1));

// --- Refresco automático tras crear/editar/eliminar ---
// Cuando otro compañero cambie un cliente, avisa disparando este evento y recargamos la
// página actual (así la tabla siempre refleja la BD, sin que su código conozca el nuestro).
// Ellos solo hacen: document.dispatchEvent(new CustomEvent('clientes:cambiaron'));
document.addEventListener("clientes:cambiaron", () => cargarClientes(paginaActual));

// --- Carga inicial ---
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