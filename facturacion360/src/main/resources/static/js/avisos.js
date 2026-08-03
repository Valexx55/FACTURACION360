/**
 * @file Lo que se le cuenta al usuario: los anuncios para lectores de pantalla y los avisos
 * emergentes de las filas.
 *
 * Capa 1. Lo que se pinta DENTRO de la tabla (el mensaje de "no hay clientes", el de error de
 * carga) no está aquí sino en `tabla.js`: eso es contenido de la tabla, aunque también sea un
 * mensaje.
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa de módulos y la regla de capas
 */
import { DURACION_AVISO_MS, RETARDO_PISTA_MS } from "./config.js";
import { avisoClientes, barraFiltros, cuerpoTabla, regionAnuncios } from "./dom.js";

// Temporizador que borra el aviso de la zona de estado pasado un rato.
let temporizadorAviso = null;

/**
 * Cuenta lo que acaba de pasar: siempre a quien no ve la pantalla, y además en la franja de
 * avisos cuando no haya otro sitio donde se vea.
 *
 * Son dos elementos y no uno porque resuelven cosas distintas. #anuncios está siempre en el
 * documento, vacío e invisible, y es lo único que lee el lector de pantalla: una región que
 * aparece con el mensaje ya dentro no se anuncia, porque lo que se vigila es el cambio de
 * contenido de algo que ya estaba. Y al ser invisible puede repetir un texto que ya se ve en
 * su sitio (el mensaje de la tabla vacía, el del panel) sin que salga escrito dos veces.
 *
 * @param {string} texto lo que se cuenta
 * @param {Object} [opciones]
 * @param {boolean} [opciones.visible=false] si además se escribe en la franja de avisos.
 *        Para lo que no tiene otro sitio donde verse, como el "Cliente guardado" de una fila
 *        que el refresco se lleva por delante
 * @param {boolean} [opciones.esError=false] si es un problema y no una confirmación
 */
export function anunciar(texto, { visible = false, esError = false } = {}) {
    // Se vacía y se reescribe en el fotograma siguiente, en vez de asignar el texto sin más.
    // Lo que el lector de pantalla vigila es el CAMBIO de contenido, así que un mensaje
    // idéntico al anterior no se leería: guardar dos clientes seguidos anunciaba el primero y
    // callaba el segundo, que es justo cuando hace falta la confirmación.
    regionAnuncios.textContent = "";
    requestAnimationFrame(() => {
        regionAnuncios.textContent = texto;
    });

    if (!visible) return;

    clearTimeout(temporizadorAviso);
    avisoClientes.classList.toggle("aviso-error", esError);
    avisoClientes.textContent = texto;

    // Se borra solo: es información de "ha pasado esto ahora", y dejarla fija acaba
    // confundiendo (un "Cliente guardado" de hace diez minutos parece de la última acción).
    // Se vacía en vez de esconderse: la hoja de estilos ya oculta la franja vacía.
    temporizadorAviso = setTimeout(() => {
        avisoClientes.textContent = "";
    }, DURACION_AVISO_MS);
}

/** Escribe el texto del aviso en cada elemento y descarta el globo que ya tuviera. */
export function escribirPista(elementos, texto) {
    for (const elemento of elementos) {
        elemento.dataset.bsTitle = texto;

        // El globo se crea en el primer hover y se queda con el texto que hubiera entonces.
        // Al destruirlo, el siguiente hover lo vuelve a crear ya con el texto nuevo.
        window.bootstrap?.Tooltip.getInstance(elemento)?.dispose();
    }
}

/** Esconde los globos de una fila (al pulsarla diría lo contrario de lo que va a pasar). */
export function ocultarPistas(fila) {
    for (const elemento of fila.querySelectorAll("[data-bs-title]")) {
        window.bootstrap?.Tooltip.getInstance(elemento)?.hide();
    }
}

/**
 * Destruye los globos de una zona antes de tirar los elementos que los tienen.
 *
 * @param {Element} raiz la tabla entera al repintarla, o una sola fila si solo se rehacen sus
 *        celdas
 */
export function limpiarPistas(raiz = cuerpoTabla) {
    for (const elemento of raiz.querySelectorAll("[data-bs-title]")) {
        window.bootstrap?.Tooltip.getInstance(elemento)?.dispose();
    }
}

/*
 * Los dos avisos emergentes de la pantalla se crean AQUÍ, al cargar el módulo, y no en main.js:
 * este fichero es el dueño de su ciclo de vida entero —escribirPista los escribe, ocultarPistas
 * los oculta y limpiarPistas los destruye—, y crearlos en otro sitio dejaría a limpiarPistas
 * destruyendo instancias que no ha creado nadie de por aquí.
 *
 * Un único aviso delegado en el <tbody>, no uno por celda: así vale también para las filas
 * que todavía no se han pintado y no hay que crearlos y destruirlos en cada repintado.
 * container: 'body' porque la tabla va dentro de .table-responsive, que tiene overflow y
 * recortaría el globo por arriba.
 */
/*
 * Los ajustes van en una constante y no repetidos en los dos, y no es por ahorrar cuatro
 * líneas: un aviso que se abriera distinto o con otro retardo según la zona de la pantalla se
 * nota enseguida. Compartiendo el objeto, esa invariante la garantiza el código; escritos dos
 * veces, la garantizaba un comentario y bastaba con tocar uno para romperla.
 */
const OPCIONES_PISTA = {
    delay: { show: RETARDO_PISTA_MS, hide: 0 },
    container: "body",
    placement: "top",
    trigger: "hover focus",
};

if (window.bootstrap) {
    new bootstrap.Tooltip(cuerpoTabla, {
        ...OPCIONES_PISTA,

        // El del enlace va el primero por claridad, pero el orden da igual: Bootstrap se
        // queda con el elemento coincidente MÁS INTERNO, así que el aviso del correo gana al
        // de su celda.
        selector: ".enlace-celda, .fila-cliente th, .fila-cliente td:not(.celda-acciones), .celda-acciones .btn[data-bs-title]",
    });

    // Y otro para la barra de filtros, que es donde estaba el title del navegador que ponía el
    // botón de dirección.
    new bootstrap.Tooltip(barraFiltros, {
        ...OPCIONES_PISTA,
        selector: "[data-bs-title]",
    });
}
