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

// Rutas relativas: el HTML lo sirve el propio Spring Boot, mismo origen (sin CORS).
const API_CLIENTE = "/cliente";
const API_LISTAR_PAGINA = "/cliente/listar-pagina";
const API_PROVINCIAS = "/cliente/provincias";
const API_POBLACIONES = "/cliente/poblaciones";
const TAMANO_PAGINA = 10;

// Cuánto esperamos tras la última tecla antes de consultar. Sin esta pausa,
// escribir "garcia" lanzaría 6 peticiones a la base de datos en vez de 1.
const ESPERA_TECLEO_MS = 300;

// Cuánto tarda en aparecer el aviso de "Ver detalles" al dejar el ratón encima.
const RETARDO_PISTA_MS = 1000;

// Lo que dura el plegado del panel. Tiene que coincidir con la transición de
// .despliegue-envoltorio en style.css: es el tiempo que esperamos para quitarlo del DOM.
const DURACION_PLEGADO_MS = 250;

// Cuánto se queda en pantalla un aviso ("Cliente guardado") antes de borrarse solo.
const DURACION_AVISO_MS = 5000;

// Referencias del DOM que usamos.
const cuerpoTabla = document.getElementById("tabla-clientes");
const plantillaFila = document.getElementById("fila-cliente-template");
const plantillaDespliegue = document.getElementById("fila-despliegue-template");
const plantillaPanelDetalle = document.getElementById("panel-detalle-template");
const plantillaPanelEdicion = document.getElementById("panel-edicion-template");
const btnAnterior = document.getElementById("btn-anterior");
const btnSiguiente = document.getElementById("btn-siguiente");
const infoPagina = document.getElementById("info-pagina");

const inputBuscador = document.getElementById("buscador-clientes");
const contenedorBuscador = document.querySelector(".buscador-clientes");
const contadorFiltros = document.getElementById("contador-filtros");
const selectProvincia = document.getElementById("filtro-provincia");
const selectPoblacion = document.getElementById("filtro-poblacion");
const selectOrdenarPor = document.getElementById("filtro-ordenar-por");
const btnDireccion = document.getElementById("btn-direccion");
const iconoDireccion = document.getElementById("icono-direccion");
const etiquetaDireccion = document.getElementById("etiqueta-direccion");
const btnLimpiar = document.getElementById("btn-limpiar");
const cabecerasOrdenables = document.querySelectorAll(".th-ordenable");
const avisoClientes = document.getElementById("aviso-clientes");
const contenedorTabla = cuerpoTabla.closest(".table-responsive");

// Columnas de la tabla, contadas de sus propias cabeceras. Lo usan la fila de mensajes y la
// del despliegue, que tienen que ocuparlas todas. Se cuentan en vez de escribir un 6 porque
// añadir una columna obligaría, si no, a acordarse de cambiar el número aquí y en el HTML.
// El ":scope >" deja fuera las cabeceras de las tablas de los paneles, que se insertan dentro.
const COLUMNAS_TABLA = cuerpoTabla.closest("table")
    .querySelectorAll(":scope > thead > tr > th").length;

// El texto por defecto del error del NIF/CIF, sacado del propio <template> donde está escrito.
// Se guarda al arrancar porque al mostrar el error del servidor se pisa, y al cerrar hay que
// devolverlo: copiarlo aquí a mano serían dos textos que acabarían diciendo cosas distintas.
const MENSAJE_NIF_BASE = plantillaPanelEdicion.content
    .querySelector('[name="nifCif"] ~ .invalid-feedback').textContent;

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

// Peticiones de listado que hay ahora mismo en el aire. Es un contador y no un booleano
// porque una petición cancelada termina DESPUÉS de que arranque la que la sustituye: con un
// booleano, la que muere apagaría el "cargando" de la que sigue viva.
let listadosEnVuelo = 0;

// Temporizador que borra el aviso de la zona de estado pasado un rato.
let temporizadorAviso = null;

// Id del cliente al que hay que devolver el foco en cuanto se repinte la tabla, o null.
// Guardar destruye la fila que contenía el botón pulsado y, sin esto, el foco se iría al
// <body> y quien navegue con teclado volvería al principio de la página.
let focoPendiente = null;

/*
 * Filas con el panel desplegado: id del cliente -> { modo, borrador }.
 *
 * Es un Map y no un id suelto porque se pueden tener varias abiertas a la vez, y vive fuera
 * del DOM porque la tabla se repinta entera cada vez que se pagina, se busca o se refresca:
 * de aquí se saca qué paneles hay que volver a abrir después.
 *
 *   modo     -> "detalle" (solo lectura) o "edicion" (formulario)
 *   borrador -> lo que el usuario tuviera escrito sin guardar cuando se repintó la tabla,
 *               o null. Sin esto, buscar algo con un formulario abierto le borraría lo
 *               tecleado sin avisar.
 */
const filasDesplegadas = new Map();

// Los campos que se pueden editar, en un orden fijo. Se usa para leer el formulario, para
// rellenarlo y para comparar si algo ha cambiado: al recorrer siempre esta misma lista, los
// dos objetos que se comparan salen con las claves en el mismo orden.
const CAMPOS_EDITABLES = ["nombre", "nifCif", "email", "telefono",
    "direccion", "codigoPostal", "poblacion", "provincia"];

// Los que la BD admite a NULL (el resto son NOT NULL y el formulario los exige).
const CAMPOS_OPCIONALES = ["email", "telefono", "codigoPostal"];

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

    try {
        const respuesta = await fetch(url, { signal: controlador.signal });

        // fetch NO lanza error con códigos 4xx/5xx: hay que comprobarlo a mano.
        if (!respuesta.ok) {
            throw new Error(`El servidor respondió ${respuesta.status}`);
        }
        return await respuesta.json();
    } finally {
        cerrarCanal(canal, controlador);
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
    // Atenúa la tabla y avisa a los lectores de pantalla de que lo que hay no es definitivo:
    // sin esto se siguen viendo los datos de la página anterior como si fueran los nuevos.
    listadosEnVuelo++;
    cuerpoTabla.setAttribute("aria-busy", "true");

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

        // Página que ya no existe: se pedía la 4 y entre medias han borrado clientes hasta
        // dejar 3. El backend responde con la página vacía y el total real (no reencamina
        // solo, porque el paginado no puede adivinar si eso es un error o no), así que la
        // corrección la hacemos aquí: se pide la última que sí existe. Sin esto, la tabla se
        // queda vacía diciendo "Página 4 de 3" y sin manera obvia de salir de ahí.
        const hayQueRetroceder = !datos.contenido?.length
            && datos.totalPaginas > 0
            && pagina > datos.totalPaginas - 1;

        if (hayQueRetroceder) {
            await cargarClientes(datos.totalPaginas - 1);
            return;
        }

        paginaActual = datos.paginaActual;
        pintarFilas(datos.contenido);
        pintarPaginacion(datos);
    } catch (error) {
        // Si la hemos cancelado nosotros, ya viene otra petición en camino: salimos sin
        // tocar la tabla para no borrar lo que hay mientras llega la respuesta buena.
        if (esCancelacion(error)) return;
        mostrarError(error);
    } finally {
        listadosEnVuelo--;
        if (listadosEnVuelo === 0) {
            cuerpoTabla.setAttribute("aria-busy", "false");
        }
    }
}

/**
 * Vacía el <tbody> y lo rellena clonando el <template> por cada cliente.
 * @param {Array<Object>} clientes lista de ClienteResponse
 */
function pintarFilas(clientes) {
    // Antes de vaciar la tabla: guardar lo que hubiera a medio escribir en un formulario
    // abierto y destruir los avisos emergentes de las filas que van a desaparecer (si no,
    // se quedan flotando sobre la pantalla y además Bootstrap sigue guardando una
    // referencia a cada fila borrada).
    guardarBorradores();
    limpiarPistas();

    cuerpoTabla.replaceChildren(); // limpia la tabla sin usar innerHTML

    if (!Array.isArray(clientes) || clientes.length === 0) {
        // El mensaje cambia según el motivo: "no hay clientes" y "tu búsqueda no
        // encuentra nada" son cosas distintas y el usuario reacciona distinto a cada una.
        // En el segundo caso, la salida se ofrece ahí mismo.
        const filtrando = hayCriteriosActivos();
        mostrarMensaje(filtrando
            ? "No hay clientes que coincidan con la búsqueda."
            : "No hay clientes que mostrar.", { conLimpiar: filtrando });

        // Aunque no haya a quién devolvérselo, hay que descartar la marca: si no, el foco
        // daría un salto inesperado en el siguiente repintado, que no tiene nada que ver.
        devolverFoco();
        return;
    }

    for (const [indice, cliente] of clientes.entries()) {
        // Clonamos el contenido del template (un <tr> completo con sus celdas).
        const fila = plantillaFila.content.cloneNode(true);

        // textContent escapa el texto: seguro frente a nombres con < o &.
        fila.querySelector(".cliente-nombre").textContent = cliente.nombre;
        fila.querySelector(".cliente-cif").textContent = cliente.nifCif;
        pintarEnlace(fila.querySelector(".cliente-email"), cliente.email,
            (valor) => `mailto:${valor}`, "Escribir a este correo");
        pintarEnlace(fila.querySelector(".cliente-telefono"), cliente.telefono,
            (valor) => `tel:${valor.replace(/\s+/g, "")}`, "Llamar a este número");
        fila.querySelector(".cliente-alta").textContent = formatearFecha(cliente.fechaAlta);

        // Guardamos el id en la fila por si los botones de acción lo necesitan.
        const filaCliente = fila.querySelector("tr");
        filaCliente.dataset.clienteId = cliente.idCliente;

        // El rayado lo marcamos aquí, por CLIENTE. Con el table-striped de Bootstrap
        // (nth-of-type) cada panel de detalle insertado invierte la alternancia de todo lo
        // que viene detrás, y la tabla acaba con dos filas blancas seguidas.
        filaCliente.classList.toggle("fila-par", indice % 2 === 1);

        // Deja la fila en estado "cerrada": aria-expanded a false, y el nombre y el aviso de
        // cada botón con el cliente dentro ("Editar cliente García S.L.").
        marcarFila(filaCliente, null);

        cuerpoTabla.appendChild(fila);
    }

    reabrirDespliegues();
    devolverFoco();
}

/**
 * Devuelve el foco al botón de editar del cliente que se acaba de guardar.
 *
 * Al repintar, la fila que tenía el foco deja de existir y el navegador lo manda al <body>:
 * quien navegue con teclado se encontraría de vuelta al principio de la página después de
 * cada guardado. Se llama tras repintar porque hasta ese momento el botón nuevo no existe.
 */
function devolverFoco() {
    if (focoPendiente === null) return;

    const fila = cuerpoTabla.querySelector(`tr[data-cliente-id="${focoPendiente}"]`);
    focoPendiente = null;

    // Puede no estar: el cliente se ha quedado en otra página, o ya no cumple el filtro. En
    // ese caso no forzamos el foco a ningún sitio raro; el aviso de "Cliente guardado" ya se
    // ha anunciado por su cuenta.
    fila?.querySelector(".btn-editar")?.focus();
}

/**
 * Cuenta en la zona de avisos lo que acaba de pasar.
 *
 * Vive fuera de la tabla porque el guardado la repinta entera: dentro del panel, el mensaje
 * desaparecería en el mismo instante en que se escribe. El orden de las dos líneas importa:
 * primero se muestra y luego se escribe, porque una región oculta no está en el árbol de
 * accesibilidad y el lector de pantalla no llegaría a anunciar el texto.
 *
 * @param {string} texto lo que se cuenta
 * @param {boolean} [esError=false] si es un problema y no una confirmación
 */
function anunciar(texto, esError = false) {
    clearTimeout(temporizadorAviso);

    avisoClientes.hidden = false;
    avisoClientes.classList.toggle("aviso-error", esError);
    avisoClientes.textContent = texto;

    // Se borra solo: es información de "ha pasado esto ahora", y dejarla fija acaba
    // confundiendo (un "Cliente guardado" de hace diez minutos parece de la última acción).
    temporizadorAviso = setTimeout(() => {
        avisoClientes.textContent = "";
        avisoClientes.hidden = true;
    }, DURACION_AVISO_MS);
}

/**
 * Pinta una celda como enlace útil (escribir un correo, llamar por teléfono), o con un guion
 * si no hay dato.
 *
 * El esquema (mailto:, tel:) lo construye SIEMPRE el código, nunca el valor que llega del
 * servidor: así un dato manipulado no puede colar un href de tipo javascript:.
 *
 * @param {Element} celda la celda de la tabla
 * @param {string|null} valor el dato del cliente
 * @param {Function} construirHref función que arma el href a partir del valor
 * @param {string} pista qué dice el aviso emergente al pasar el ratón. El enlace lleva el
 *        suyo porque, si no, heredaría el de la celda ("Ver detalles") y estaría anunciando
 *        algo distinto de lo que hace al pulsarlo
 */
function pintarEnlace(celda, valor, construirHref, pista) {
    const texto = (valor ?? "").trim();
    if (!texto) {
        celda.textContent = "—";
        return;
    }

    const enlace = document.createElement("a");
    enlace.className = "enlace-celda";
    enlace.href = construirHref(texto);
    enlace.textContent = texto;
    enlace.dataset.bsTitle = pista;
    celda.replaceChildren(enlace);
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
    pintarEstadoFiltros();
    cargarClientes(0);
}

/**
 * Marca qué controles tienen un filtro puesto y cuántos son en total.
 *
 * Es la única parte de la barra donde el color dice algo en vez de decorar: con tres
 * controles que por fuera son idénticos estén o no usados, la pregunta "¿por qué solo salen
 * 4 clientes?" obligaba a abrir los desplegables uno a uno.
 */
function pintarEstadoFiltros() {
    const activos = [criterios.busqueda, criterios.provincia, criterios.poblacion]
        .filter(Boolean).length;

    contenedorBuscador.classList.toggle("activo", Boolean(criterios.busqueda));
    selectProvincia.closest(".control-filtro")
        .classList.toggle("activo", Boolean(criterios.provincia));
    selectPoblacion.closest(".control-filtro")
        .classList.toggle("activo", Boolean(criterios.poblacion));

    // La cuenta se ve en un globo junto a "Limpiar"; para quien no lo ve, va en el nombre
    // accesible del botón, porque el globo es aria-hidden y diría un número suelto.
    //
    // El nombre EMPIEZA por "Limpiar", que es lo que pone en el botón: si se sustituyera por
    // otra frase, quien maneja el ordenador por voz diría "pulsa Limpiar" y no pasaría nada
    // (criterio 2.5.3 de WCAG, el nombre tiene que contener el texto visible).
    contadorFiltros.textContent = String(activos);
    contadorFiltros.hidden = activos === 0;
    btnLimpiar.setAttribute("aria-label", activos === 0
        ? "Limpiar los filtros y la ordenación"
        : `Limpiar los ${activos} filtros activos y la ordenación`);
}

/**
 * Pinta una fila que ocupa toda la tabla con un mensaje informativo.
 * @param {string} texto el mensaje
 * @param {Object} opciones
 * @param {boolean} opciones.conLimpiar añade el botón de quitar filtros: cuando la tabla
 *        sale vacía por un filtro, la salida tiene que estar donde se ve el problema
 */
function mostrarMensaje(texto, { conLimpiar = false } = {}) {
    cuerpoTabla.replaceChildren();
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = COLUMNAS_TABLA;
    celda.className = "text-center text-muted py-4";
    celda.textContent = texto;

    if (conLimpiar) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "btn btn-sm btn-link";
        boton.textContent = "Quitar los filtros";
        boton.addEventListener("click", limpiarCriterios);
        celda.append(" ", boton);
    }

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

/**
 * Deja la pantalla como recién cargada: sin búsqueda, sin filtros y con la ordenación por
 * defecto. Está aparte del botón porque también se ofrece desde la tabla vacía.
 */
async function limpiarCriterios() {
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
}

btnLimpiar.addEventListener("click", limpiarCriterios);

// --- Paginación ---
btnAnterior.addEventListener("click", () => cargarClientes(paginaActual - 1));
btnSiguiente.addEventListener("click", () => cargarClientes(paginaActual + 1));

// --- Refresco automático tras crear/editar/eliminar ---
// Cuando otro compañero cambie un cliente, avisa disparando este evento y recargamos la
// página actual (así la tabla siempre refleja la BD, sin que su código conozca el nuestro).
// Ellos solo hacen: document.dispatchEvent(new CustomEvent('clientes:cambiaron'));
document.addEventListener("clientes:cambiaron", () => cargarClientes(paginaActual));

/* ============================================================================
 * DESPLIEGUE DE LA FILA: ver detalle y editar
 * ============================================================================
 *
 * Al pulsar una fila (o el botón del ojo) se inserta DEBAJO una fila hermana que ocupa todas
 * las columnas y enseña los campos que no caben en la tabla. Con el lápiz se abre la misma
 * fila, pero con los campos editables.
 *
 * Un solo panel por cliente y con un modo, en vez de dos filas independientes: así es
 * imposible tener a la vez el detalle y el formulario del mismo cliente enseñando cosas
 * distintas, y pasar de uno a otro es cambiar el contenido, no cerrar y abrir.
 *
 * Los datos se piden SIEMPRE al backend (GET /cliente/{id}), también al cambiar de modo. Es
 * la misma decisión que ya tomó el listado —recargar en vez de guardar copias—: un detalle
 * guardado de antes puede enseñar algo que otro usuario ya cambió, y en el formulario sería
 * peor todavía, porque se guardaría encima sin haberlo visto.
 */

/** ¿Qué panel tiene abierto esta fila? "detalle", "edicion" o null si está cerrada. */
function modoDe(fila) {
    return filasDesplegadas.get(Number(fila.dataset.clienteId))?.modo ?? null;
}

/** El panel desplegado de una fila, o null si no lo tiene. */
function panelDe(fila) {
    const hermana = fila.nextElementSibling;
    return hermana?.classList.contains("fila-despliegue") ? hermana : null;
}

/**
 * Abre el panel de una fila en el modo indicado (o le cambia el modo si ya estaba abierto),
 * pide los datos al backend y lo pinta.
 *
 * @param {HTMLTableRowElement} fila la fila del cliente
 * @param {string} modo "detalle" o "edicion"
 * @param {Object} opciones
 * @param {boolean} opciones.animar false al reabrir tras repintar la tabla: el panel ya
 *        estaba desplegado y volver a animarlo se vería como un parpadeo
 * @param {boolean} opciones.enfocar false al reabrir por lo mismo: llevarse el foco mientras
 *        el usuario escribe en el buscador le sacaría el cursor de donde está
 */
async function abrirDespliegue(fila, modo, { animar = true, enfocar = true } = {}) {
    const idCliente = Number(fila.dataset.clienteId);

    // El borrador se conserva al cambiar de modo: si vuelves de detalle a edición, sigue lo
    // que habías escrito.
    const borrador = filasDesplegadas.get(idCliente)?.borrador ?? null;
    filasDesplegadas.set(idCliente, { modo, borrador });

    const panel = obtenerPanel(fila, animar);
    const contenido = panel.querySelector(".despliegue-contenido");
    marcarFila(fila, modo);

    // Al abrir no hay nada que enseñar todavía; al cambiar de modo sí, y sustituirlo por un
    // "cargando" encogería el panel para volver a estirarlo un instante después. En ese caso
    // se deja lo que hay puesto, atenuado, hasta que llega el contenido nuevo.
    if (contenido.childElementCount === 0) {
        pintarCargando(contenido);
    } else {
        contenido.classList.add("cargando");
    }

    try {
        const cliente = await pedirJson(`detalle-${idCliente}`, `${API_CLIENTE}/${idCliente}`);

        // Mientras llegaba la respuesta la fila ha podido cerrarse, o la tabla repintarse.
        const estado = filasDesplegadas.get(idCliente);
        if (!estado || !panel.isConnected) return;

        if (estado.modo === "edicion") {
            pintarPanelEdicion(contenido, cliente, estado.borrador, enfocar);
        } else {
            pintarPanelDetalle(contenido, cliente);
        }
    } catch (error) {
        // Cancelada por nosotros (se cerró o se cambió de modo deprisa): ya viene otra.
        if (esCancelacion(error)) return;
        pintarErrorPanel(contenido, error);
    } finally {
        contenido.classList.remove("cargando");
    }
}

/** Cierra el panel de una fila y olvida su estado. */
function cerrarDespliegue(fila) {
    const idCliente = Number(fila.dataset.clienteId);

    filasDesplegadas.delete(idCliente);
    marcarFila(fila, null);

    // Si quedaba una petición de detalle en el aire, su respuesta ya no interesa.
    peticionesEnVuelo[`detalle-${idCliente}`]?.abort();

    const panel = panelDe(fila);
    if (!panel) return;

    panel.classList.remove("abierto");

    // Se quita del DOM cuando termina de plegarse. Se hace con un temporizador y no
    // escuchando 'transitionend' porque ese evento burbujea desde los hijos (un input del
    // formulario con su propia transición lo dispararía antes de tiempo) y porque con las
    // animaciones desactivadas en el sistema no llegaría a dispararse nunca.
    panel.dataset.temporizadorCierre = setTimeout(() => panel.remove(), DURACION_PLEGADO_MS);
}

/**
 * Traduce un clic en la acción que toca: abrir, cerrar o cambiar de modo.
 * @param {HTMLTableRowElement} fila la fila del cliente
 * @param {string} modo el modo que pide el control que se ha pulsado
 */
function alternarDespliegue(fila, modo) {
    const modoActual = modoDe(fila);

    // El aviso emergente se queda flotando con el texto de antes si no se esconde al pulsar.
    ocultarPistas(fila);

    if (modoActual === null) {
        abrirDespliegue(fila, modo);
        return;
    }

    if (modoActual === "edicion" && !confirmarDescarte(fila)) return;

    if (modoActual === modo) {
        cerrarDespliegue(fila);
    } else {
        // Ya está desplegado: solo cambia lo de dentro, sin volver a animar la apertura.
        abrirDespliegue(fila, modo, { animar: false });
    }
}

/**
 * Devuelve el panel de la fila, creándolo si aún no existe.
 * @param {HTMLTableRowElement} fila la fila del cliente
 * @param {boolean} animar si se despliega con transición
 */
function obtenerPanel(fila, animar) {
    const existente = panelDe(fila);
    if (existente) {
        // Puede estar plegándose de un cierre reciente: se cancela su borrado o desaparecería
        // a media apertura.
        clearTimeout(Number(existente.dataset.temporizadorCierre));
        existente.classList.add("abierto");
        return existente;
    }

    const panel = plantillaDespliegue.content.firstElementChild.cloneNode(true);
    panel.id = `despliegue-${fila.dataset.clienteId}`;
    panel.dataset.clienteId = fila.dataset.clienteId;

    // La celda del panel ocupa el ancho entero de la tabla, sean las columnas que sean.
    panel.querySelector("td").colSpan = COLUMNAS_TABLA;

    fila.after(panel);

    // La clase que lo abre se pone en el frame siguiente: puesta a la vez que se inserta, el
    // navegador no llega a ver dos estados distintos y no habría transición que animar.
    if (animar) {
        requestAnimationFrame(() => panel.classList.add("abierto"));
    } else {
        panel.classList.add("abierto");
    }

    return panel;
}

/**
 * Deja la fila coherente con su estado: resaltado, aria-expanded de cada botón, y el nombre y
 * el aviso emergente de cada acción.
 *
 * El nombre accesible y el aviso se escriben en el mismo sitio a propósito. Son dos textos que
 * tienen que decir lo mismo (criterio 2.5.3: quien dicta "editar cliente" a un control por voz
 * necesita que ese sea de verdad el nombre del botón), y repartidos en dos funciones acabarían
 * desincronizados en cuanto uno de los dos cambiase.
 *
 * @param {HTMLTableRowElement} fila la fila del cliente
 * @param {string|null} modo el modo abierto, o null si está cerrada
 */
function marcarFila(fila, modo) {
    const botonVer = fila.querySelector(".btn-ver");
    const botonEditar = fila.querySelector(".btn-editar");

    fila.classList.toggle("desplegada", modo !== null);

    // El color del recuadro que envuelve al bloque: verde para mirar, ámbar para editar. Va
    // en la fila Y en el panel porque cada uno pinta la mitad del recuadro, y se quita de los
    // dos a la vez al cerrar para que no quede medio borde dibujado mientras se pliega.
    for (const elemento of [fila, panelDe(fila)]) {
        if (!elemento) continue;
        elemento.classList.toggle("modo-detalle", modo === "detalle");
        elemento.classList.toggle("modo-edicion", modo === "edicion");
    }

    // aria-expanded es lo que hace que un lector de pantalla anuncie que ese botón despliega
    // algo y si está abierto o cerrado. Va en el botón, que es el control de verdad.
    botonVer.setAttribute("aria-expanded", String(modo === "detalle"));
    botonEditar.setAttribute("aria-expanded", String(modo === "edicion"));

    if (modo === null) {
        botonVer.removeAttribute("aria-controls");
        botonEditar.removeAttribute("aria-controls");
    } else {
        const idPanel = `despliegue-${fila.dataset.clienteId}`;
        botonVer.setAttribute("aria-controls", idPanel);
        botonEditar.setAttribute("aria-controls", idPanel);
    }

    // Pulsar la fila o el ojo lleva SIEMPRE al detalle, así que en modo edición el aviso no
    // puede decir "Ocultar": lo que va a pasar es que se cambie al detalle.
    const accionDetalle = modo === "detalle" ? "Ocultar detalles" : "Ver detalles";
    const accionEditar = modo === "edicion" ? "Cancelar la edición" : "Editar cliente";

    escribirPista(fila.querySelectorAll("th, td:not(.celda-acciones)"), accionDetalle);
    nombrarAccion(botonVer, accionDetalle, `${accionDetalle} de`);
    nombrarAccion(botonEditar, accionEditar,
        modo === "edicion" ? "Cancelar la edición de" : "Editar cliente");

    // El de eliminar no cambia nunca, pero pasa por aquí para que use el mismo aviso que los
    // demás: con el title del navegador salía con otro aspecto y con otro retardo.
    nombrarAccion(fila.querySelector(".btn-eliminar"), "Eliminar cliente", "Eliminar cliente");
}

/**
 * Pone a un botón de icono su aviso emergente y su nombre accesible, con el cliente dentro.
 *
 * Sin el nombre del cliente, quien navega con lector de pantalla y pide la lista de botones de
 * la página oye diez veces "Editar cliente" sin saber a cuál pertenece cada uno. El nombre
 * empieza por el mismo texto que se ve en el aviso porque es lo que dicta quien usa control
 * por voz, y así lo que dice y lo que el navegador busca coinciden.
 *
 * @param {HTMLElement} boton el botón de la acción
 * @param {string} accion el texto del aviso emergente ("Editar cliente")
 * @param {string} comienzoNombre con qué empieza el nombre accesible, antes del cliente
 */
function nombrarAccion(boton, accion, comienzoNombre) {
    const nombreCliente = boton.closest("tr").querySelector(".cliente-nombre").textContent;

    escribirPista([boton], accion);
    boton.setAttribute("aria-label", `${comienzoNombre} ${nombreCliente}`);
}

/** Vuelve a abrir los paneles que siguieran desplegados antes de repintar la tabla. */
function reabrirDespliegues() {
    for (const fila of cuerpoTabla.querySelectorAll("tr.fila-cliente")) {
        const estado = filasDesplegadas.get(Number(fila.dataset.clienteId));
        if (estado) {
            abrirDespliegue(fila, estado.modo, { animar: false, enfocar: false });
        }
    }
}

// --- Contenido del panel ---

/** Pinta el panel de solo lectura con los campos que la tabla no muestra. */
function pintarPanelDetalle(contenido, cliente) {
    const panel = plantillaPanelDetalle.content.cloneNode(true);

    // textContent, igual que en la tabla: un dato con < o & se ve tal cual y no puede
    // inyectar HTML.
    panel.querySelector(".detalle-id").textContent = cliente.idCliente;
    panel.querySelector(".detalle-direccion").textContent = textoOGuion(cliente.direccion);
    panel.querySelector(".detalle-cp").textContent = textoOGuion(cliente.codigoPostal);
    panel.querySelector(".detalle-poblacion").textContent = textoOGuion(cliente.poblacion);
    panel.querySelector(".detalle-provincia").textContent = textoOGuion(cliente.provincia);

    contenido.replaceChildren(panel);
}

/**
 * Pinta el formulario de edición con los datos del cliente.
 * @param {Element} contenido el hueco del panel donde va el formulario
 * @param {Object} cliente lo que hay ahora mismo en la base de datos
 * @param {Object|null} borrador lo que el usuario tenía escrito antes de un repintado
 * @param {boolean} enfocar si se lleva el cursor al primer campo
 */
function pintarPanelEdicion(contenido, cliente, borrador, enfocar) {
    const panel = plantillaPanelEdicion.content.cloneNode(true);
    const formulario = panel.querySelector(".formulario-edicion");
    const valoresBd = valoresDe(cliente);

    // Se rellena con el borrador si lo hay, para no perder lo tecleado.
    const valores = borrador ?? valoresBd;
    for (const campo of CAMPOS_EDITABLES) {
        formulario.elements[campo].value = valores[campo];
    }

    formulario.dataset.clienteId = cliente.idCliente;
    // Cómo está el cliente en la BD, para saber al cerrar si hay algo sin guardar. Se compara
    // contra la BD y no contra el borrador: si el usuario lo deja como estaba, no hay nada
    // que descartar y no tiene sentido preguntarle.
    formulario.dataset.valoresOriginales = JSON.stringify(valoresBd);

    // El hueco del error del NIF/CIF necesita id propio para que el campo pueda apuntarle con
    // aria-describedby cuando el servidor rechace el guardado. Lleva el id del cliente porque
    // puede haber varios formularios abiertos y dos elementos no pueden compartir id.
    mensajeDe(formulario, "nifCif").id = `error-nifcif-${cliente.idCliente}`;

    contenido.replaceChildren(panel);

    if (enfocar) {
        formulario.elements.nombre.focus();
    }
}

/**
 * Aviso de "cargando" mientras llega la respuesta del backend.
 *
 * role="status" para que el lector de pantalla lo anuncie: el panel se acaba de abrir y, si no,
 * quien no ve la pantalla se encuentra con una zona vacía sin saber que hay algo en camino.
 */
function pintarCargando(contenido) {
    const aviso = document.createElement("p");
    aviso.className = "panel-aviso";
    aviso.setAttribute("role", "status");
    aviso.textContent = "Cargando los datos del cliente…";
    contenido.replaceChildren(aviso);
}

/** Aviso de error con un botón para volver a intentarlo, sin cerrar el panel. */
function pintarErrorPanel(contenido, error) {
    console.error("No se pudieron cargar los datos del cliente:", error);

    const aviso = document.createElement("p");
    aviso.className = "panel-aviso panel-aviso-error";
    aviso.setAttribute("role", "status");
    aviso.textContent = "No se pudieron cargar los datos del cliente. ";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-sm btn-link btn-reintentar";
    boton.textContent = "Reintentar";
    aviso.appendChild(boton);

    contenido.replaceChildren(aviso);
}

/** Los campos vacíos se ven mejor como un guion que como una celda en blanco. */
function textoOGuion(valor) {
    return valor && valor.trim() ? valor : "—";
}

/** Los datos del cliente en la forma que entiende el formulario (sin nulos). */
function valoresDe(cliente) {
    const valores = {};
    for (const campo of CAMPOS_EDITABLES) {
        valores[campo] = (cliente[campo] ?? "").trim();
    }
    return valores;
}

/** Lo que hay escrito ahora mismo en el formulario. */
function leerFormulario(formulario) {
    const valores = {};
    for (const campo of CAMPOS_EDITABLES) {
        valores[campo] = formulario.elements[campo].value.trim();
    }
    return valores;
}

/**
 * El hueco donde va el mensaje de error de un campo del formulario.
 *
 * Se busca por el nombre del campo y no con nextElementSibling: así el mensaje se puede mover
 * dentro de la celda sin que esto deje de encontrarlo.
 *
 * @param {HTMLFormElement} formulario el formulario de edición
 * @param {string} campo el atributo name del campo
 * @return {Element} el div del mensaje
 */
function mensajeDe(formulario, campo) {
    return formulario.querySelector(`[name="${campo}"] ~ .invalid-feedback`);
}

/** ¿Se ha tocado algo respecto a lo que hay en la base de datos? */
function hayCambios(formulario) {
    return JSON.stringify(leerFormulario(formulario)) !== formulario.dataset.valoresOriginales;
}

/** Pregunta antes de tirar unos cambios sin guardar. Devuelve si se puede seguir. */
function confirmarDescarte(fila) {
    const formulario = panelDe(fila)?.querySelector(".formulario-edicion");
    if (!formulario || !hayCambios(formulario)) return true;

    return confirm("Hay cambios sin guardar en este cliente. ¿Quieres descartarlos?");
}

/** Guarda lo escrito en los formularios abiertos antes de que la tabla se repinte. */
function guardarBorradores() {
    for (const formulario of cuerpoTabla.querySelectorAll(".formulario-edicion")) {
        const estado = filasDesplegadas.get(Number(formulario.dataset.clienteId));
        if (estado) {
            estado.borrador = leerFormulario(formulario);
        }
    }
}

// --- Avisos emergentes (el "Ver detalles" tras un segundo de ratón encima) ---

/** Escribe el texto del aviso en cada elemento y descarta el globo que ya tuviera. */
function escribirPista(elementos, texto) {
    for (const elemento of elementos) {
        elemento.dataset.bsTitle = texto;

        // El globo se crea en el primer hover y se queda con el texto que hubiera entonces.
        // Al destruirlo, el siguiente hover lo vuelve a crear ya con el texto nuevo.
        window.bootstrap?.Tooltip.getInstance(elemento)?.dispose();
    }
}

/** Esconde los globos de una fila (al pulsarla diría lo contrario de lo que va a pasar). */
function ocultarPistas(fila) {
    for (const elemento of fila.querySelectorAll("[data-bs-title]")) {
        window.bootstrap?.Tooltip.getInstance(elemento)?.hide();
    }
}

/** Destruye los globos de la tabla actual, antes de tirar sus filas. */
function limpiarPistas() {
    for (const elemento of cuerpoTabla.querySelectorAll("[data-bs-title]")) {
        window.bootstrap?.Tooltip.getInstance(elemento)?.dispose();
    }
}

// Un único aviso delegado en el <tbody>, no uno por celda: así vale también para las filas
// que todavía no se han pintado y no hay que crearlos y destruirlos en cada repintado.
// container: 'body' porque la tabla va dentro de .table-responsive, que tiene overflow y
// recortaría el globo por arriba.
if (window.bootstrap) {
    new bootstrap.Tooltip(cuerpoTabla, {
        // El del enlace va el primero por claridad, pero el orden da igual: Bootstrap se
        // queda con el elemento coincidente MÁS INTERNO, así que el aviso del correo gana al
        // de su celda.
        selector: ".enlace-celda, .fila-cliente th, .fila-cliente td:not(.celda-acciones), .celda-acciones .btn[data-bs-title]",
        delay: { show: RETARDO_PISTA_MS, hide: 0 },
        container: "body",
        placement: "top",
        trigger: "hover focus",
    });
}

// --- Enlazado de los clics de la tabla ---

// Un solo listener en el <tbody>, y no uno por botón: los botones se crean y se destruyen en
// cada repintado, así que los suyos habría que volver a enlazarlos cada vez (y los que había
// antes en este archivo ni siquiera llegaban a enlazarse, porque se registraban al cargar la
// página, cuando los botones aún vivían dentro del <template>).
cuerpoTabla.addEventListener("click", (evento) => {
    // Primero los controles del panel: viven en la fila hermana, no en la del cliente.
    const panel = evento.target.closest("tr.fila-despliegue");
    if (panel) {
        manejarClicPanel(evento, panel);
        return;
    }

    const fila = evento.target.closest("tr.fila-cliente");
    if (!fila) return;

    const boton = evento.target.closest(".celda-acciones .btn");
    if (boton) {
        if (boton.classList.contains("btn-ver")) alternarDespliegue(fila, "detalle");
        else if (boton.classList.contains("btn-editar")) alternarDespliegue(fila, "edicion");
        // El de eliminar es de otra feature: aquí no se toca.
        return;
    }

    // Un enlace de email o de teléfono hace lo suyo y nada más: desplegar además la fila
    // sería un segundo efecto que nadie ha pedido al pulsarlo.
    if (evento.target.closest("a")) return;

    // Si estaba seleccionando texto de la fila, no quería desplegar nada.
    if (window.getSelection()?.toString()) return;

    alternarDespliegue(fila, "detalle");
});

/** Clic dentro de un panel abierto: cancelar la edición o reintentar la carga. */
function manejarClicPanel(evento, panel) {
    const fila = panel.previousElementSibling;

    if (evento.target.closest(".btn-cancelar")) {
        if (!confirmarDescarte(fila)) return;
        cerrarDespliegue(fila);
        // El foco vuelve al lápiz que abrió el formulario: si no, se quedaría en un botón que
        // acaba de desaparecer y saltaría al principio de la página.
        fila.querySelector(".btn-editar").focus();
        return;
    }

    if (evento.target.closest(".btn-reintentar")) {
        abrirDespliegue(fila, modoDe(fila) ?? "detalle", { animar: false });
    }
}

// El aviso de NIF repetido lo pone el servidor: en cuanto se toca ese campo deja de tener
// sentido seguir viéndolo en rojo.
cuerpoTabla.addEventListener("input", (evento) => {
    if (evento.target.name === "nifCif") {
        evento.target.classList.remove("is-invalid");
        evento.target.removeAttribute("aria-invalid");
        evento.target.removeAttribute("aria-describedby");
    }
});

// --- Guardado de la edición ---

// El envío se atiende también aquí arriba, por lo mismo: el formulario aparece y desaparece.
cuerpoTabla.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const formulario = evento.target.closest(".formulario-edicion");
    if (formulario) {
        guardarEdicion(formulario);
    }
});

/**
 * Manda los cambios al backend y actúa según lo que responda.
 *
 * No se llama guardarCliente a propósito: ese nombre lo usa el onclick del modal de "Añadir
 * Cliente" (de otra feature, y hoy sin definir), y si lo ocupáramos su botón acabaría
 * llamando a esta función con los argumentos vacíos.
 *
 * @param {HTMLFormElement} formulario el formulario de la fila que se está editando
 */
async function guardarEdicion(formulario) {
    const idCliente = Number(formulario.dataset.clienteId);
    const fila = cuerpoTabla.querySelector(`tr.fila-cliente[data-cliente-id="${idCliente}"]`);

    limpiarErrores(formulario);

    // Las restricciones del HTML (required, maxlength, type=email) son las mismas que valida
    // el backend, así que el navegador corta aquí lo que el servidor rechazaría con un 400 y
    // nos ahorramos la petición. was-validated es lo que hace que Bootstrap pinte en rojo el
    // campo que falla y enseñe su mensaje.
    formulario.classList.add("was-validated");
    if (!formulario.checkValidity()) {
        formulario.querySelector(":invalid")?.focus();
        return;
    }

    const boton = formulario.querySelector(".btn-guardar");
    boton.disabled = true;   // sin esto, dos clics seguidos mandan dos PUT

    try {
        const estado = await enviarJson(`guardar-${idCliente}`, "PUT",
            `${API_CLIENTE}/${idCliente}`, cuerpoPeticion(formulario));

        if (estado === 200) {
            // Se cierra por el id y no por la fila: si la tabla se ha repintado mientras
            // viajaba la petición, "fila" apunta a un <tr> que ya no está en el documento y
            // cerrarDespliegue no llegaría a borrar la entrada del Map. Quedaría un panel
            // abierto de un cliente que el usuario ya había terminado de editar.
            filasDesplegadas.delete(idCliente);
            if (fila?.isConnected) cerrarDespliegue(fila);

            // Y que la tabla, al repintarse, devuelva el foco al botón de editar de esta fila:
            // el que estaba pulsado deja de existir y el foco se iría al principio de la página.
            focoPendiente = idCliente;
            anunciar("Cliente guardado.");

            // El contrato del proyecto para avisar de un cambio. La tabla se recarga sola, así
            // que la fila enseña lo guardado y se recoloca si el orden la ha movido de sitio.
            document.dispatchEvent(new CustomEvent("clientes:cambiaron"));
            return;
        }

        mostrarErrorGuardado(formulario, estado);
    } catch (error) {
        if (esCancelacion(error)) return;
        console.error("No se pudo guardar el cliente:", error);
        mostrarErrorGuardado(formulario, 0);
    } finally {
        boton.disabled = false;
    }
}

/** El cuerpo JSON del PUT, con la forma que espera ClienteRequest. */
function cuerpoPeticion(formulario) {
    const valores = leerFormulario(formulario);

    // Los opcionales vacíos viajan como null y no como "": esas columnas admiten NULL y es lo
    // que hay en las filas que nunca se rellenaron. Mandar cadenas vacías dejaría dos formas
    // distintas de decir "no hay dato" conviviendo en la misma tabla.
    for (const campo of CAMPOS_OPCIONALES) {
        if (!valores[campo]) valores[campo] = null;
    }

    return valores;
}

/**
 * Cuenta qué ha pasado según el código que devolvió el servidor.
 * @param {HTMLFormElement} formulario el formulario que se intentó guardar
 * @param {number} estado el código HTTP (0 si ni siquiera hubo respuesta)
 */
function mostrarErrorGuardado(formulario, estado) {
    // El NIF/CIF tiene un índice UNIQUE en la base de datos: es el único dato que puede chocar
    // con otro cliente, así que el 409 se señala en SU campo. Un aviso general obligaría al
    // usuario a adivinar cuál de los ocho campos es el del problema.
    if (estado === 409) {
        const campo = formulario.elements.nifCif;
        const mensaje = mensajeDe(formulario, "nifCif");

        mensaje.textContent = "Ya existe otro cliente con este NIF/CIF.";
        campo.classList.add("is-invalid");

        // El rojo de Bootstrap es solo color. aria-invalid es lo que hace que un lector de
        // pantalla diga "no válido" al llegar al campo, y describedby es lo que le hace leer
        // el motivo: sin ellos, quien no ve la pantalla se queda con el foco en un campo que
        // aparentemente no tiene nada.
        campo.setAttribute("aria-invalid", "true");
        campo.setAttribute("aria-describedby", mensaje.id);
        campo.focus();
        return;
    }

    const alerta = formulario.querySelector(".alerta-edicion");

    if (estado === 404) {
        // Alguien lo ha borrado mientras se editaba: no hay nada que guardar y la tabla que se
        // está viendo ya no es la que hay en la base de datos. El aviso va también a la zona
        // de estado, fuera de la tabla, porque el refresco que viene a continuación se lleva
        // por delante esta fila y con ella la alerta del formulario.
        alerta.textContent = "Este cliente ya no existe: alguien lo ha eliminado mientras lo editabas.";
        anunciar("Este cliente ya no existe: alguien lo ha eliminado mientras lo editabas.", true);
        filasDesplegadas.delete(Number(formulario.dataset.clienteId));
        document.dispatchEvent(new CustomEvent("clientes:cambiaron"));
    } else if (estado === 400) {
        alerta.textContent = "El servidor ha rechazado los datos. Revisa los campos marcados.";
    } else {
        alerta.textContent = "No se pudo guardar. Inténtalo de nuevo en unos segundos.";
    }

    alerta.hidden = false;
}

/** Borra las marcas del intento anterior para no mezclar errores viejos con nuevos. */
function limpiarErrores(formulario) {
    const alerta = formulario.querySelector(".alerta-edicion");
    alerta.hidden = true;
    alerta.textContent = "";

    const campo = formulario.elements.nifCif;
    campo.classList.remove("is-invalid");
    campo.removeAttribute("aria-invalid");
    campo.removeAttribute("aria-describedby");

    // Se devuelve el mensaje que el <template> trae de fábrica (el de "es obligatorio"), que es
    // el que le toca enseñar al navegador si el campo se queda vacío.
    mensajeDe(formulario, "nifCif").textContent = MENSAJE_NIF_BASE;
}

/**
 * Manda un JSON al backend y devuelve el código de la respuesta.
 *
 * Es la hermana de pedirJson para las peticiones que escriben, con dos diferencias. Aquí un
 * 4xx NO se trata como excepción: el 404 y el 409 son respuestas útiles que la pantalla tiene
 * que saber contar, cada una con su mensaje. Y del 200 solo interesa que haya ido bien, porque
 * los datos guardados se vuelven a leer al refrescar la tabla; el cuerpo ni se lee.
 *
 * @param {string} canal nombre del flujo de peticiones (una por fila que se guarda)
 * @param {string} metodo el método HTTP ("PUT")
 * @param {string} url la URL a la que se manda
 * @param {Object} cuerpo el objeto que viaja como JSON
 * @return {Promise<number>} el código HTTP de la respuesta
 */
async function enviarJson(canal, metodo, url, cuerpo) {
    peticionesEnVuelo[canal]?.abort();
    const controlador = new AbortController();
    peticionesEnVuelo[canal] = controlador;

    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cuerpo),
            signal: controlador.signal,
        });

        return respuesta.status;
    } finally {
        cerrarCanal(canal, controlador);
    }
}

/**
 * Da por terminado un canal de peticiones.
 *
 * Los canales de guardado y de detalle llevan el id del cliente dentro del nombre, así que se
 * crea uno nuevo por cada fila que se abre o se guarda y se quedarían ahí para siempre. Se
 * comprueba que el controlador siga siendo el mismo antes de borrarlo: si mientras tanto ha
 * arrancado otra petición del canal, la entrada es SUYA y borrarla dejaría sin cancelar a la
 * que viene después.
 *
 * @param {string} canal nombre del flujo de peticiones
 * @param {AbortController} controlador el de la petición que acaba de terminar
 */
function cerrarCanal(canal, controlador) {
    if (peticionesEnVuelo[canal] === controlador) {
        delete peticionesEnVuelo[canal];
    }
}

/**
 * Deja el contenedor de la tabla en el recorrido del tabulador solo si de verdad hay algo que
 * desplazar.
 *
 * Una zona con scroll tiene que poder recorrerse con el teclado, pero una parada del tabulador
 * en un sitio donde no hay nada que hacer es una molestia para quien navega así, y en un
 * escritorio normal la tabla cabe entera y nunca se desplaza.
 */
function ajustarFocoTabla() {
    // 1px de margen: los anchos son decimales y un redondeo hace que scrollWidth salga un
    // pelín mayor que clientWidth en tablas que en realidad caben.
    const desborda = contenedorTabla.scrollWidth - contenedorTabla.clientWidth > 1;

    if (desborda) {
        contenedorTabla.setAttribute("tabindex", "0");
    } else {
        contenedorTabla.removeAttribute("tabindex");
    }
}

// Se vigilan los dos: la ventana al cambiar de tamaño encoge el contenedor, y un nombre muy
// largo o un panel abierto ensanchan la tabla. Cualquiera de las dos cosas hace aparecer o
// desaparecer el desplazamiento.
const observadorTabla = new ResizeObserver(ajustarFocoTabla);
observadorTabla.observe(contenedorTabla);
observadorTabla.observe(cuerpoTabla.closest("table"));

// --- Carga inicial ---
pintarControlesOrden();
pintarEstadoFiltros();
cargarProvincias();
cargarPoblaciones("");
cargarClientes(0);


// Los botones de la fila se atienden con delegación en el <tbody>, arriba, en la sección del
// despliegue: las filas se clonan de un <template> y no existen todavía cuando este archivo se
// ejecuta, así que un querySelectorAll de '.btn-eliminar' aquí no encuentra ningún botón y no
// engancha nada (había uno y por eso no hacía nada). El borrado es de otra feature: cuando se
// implemente, su sitio es un caso más en ese manejador, junto a los de ver y editar.

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


/*
 * Buscador: se despliega al ENFOCARLO y se recoge al salir, si está vacío.
 *
 * Antes esto era un listener de clic en todo el documento, y ahí estaba el fallo: quien
 * llegaba al buscador con el tabulador se quedaba dentro de una píldora de 9rem sin ver el
 * campo ni lo que escribía, porque nada lo abría. focusin/focusout cubren el ratón y el
 * teclado con el mismo código (el clic acaba enfocando el input igual), y de paso ya no hace
 * falta vigilar cada clic de la página para saber cuándo cerrarlo.
 */
contenedorBuscador.addEventListener("focusin", () => {
    contenedorBuscador.classList.add("expandido");
});

contenedorBuscador.addEventListener("focusout", () => {
    // Con texto escrito se queda abierto: es un filtro activo, y plegarlo escondería la
    // razón por la que la tabla enseña lo que enseña.
    if (!inputBuscador.value.trim()) {
        contenedorBuscador.classList.remove("expandido");
    }
});
