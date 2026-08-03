/**
 * @file El contenido de un panel desplegado: el detalle, el formulario, el "cargando" y el
 * error.
 *
 * Capa 2. Aquí solo se **pinta**: la mecánica de abrir y cerrar está en `despliegue.js` y la
 * lógica del formulario en `formulario.js`. Separarlo así es lo que evita el ciclo entre el
 * despliegue y la edición, porque los dos necesitan pintar.
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa de módulos y la regla de capas
 */
import { anunciar } from "./avisos.js";
import { CAMPOS_EDITABLES } from "./config.js";
import { plantillaPanelDetalle, plantillaPanelEdicion } from "./dom.js";
import { mensajeDe, textoOGuion, valoresDe } from "./formulario.js";
/** Pinta el panel de solo lectura con los campos que la tabla no muestra. */
export function pintarPanelDetalle(contenido, cliente) {
    const panel = plantillaPanelDetalle.content.cloneNode(true);

    // textContent, igual que en la tabla: un dato con < o & se ve tal cual y no puede
    // inyectar HTML.
    panel.querySelector(".detalle-id").textContent = cliente.idCliente;
    panel.querySelector(".detalle-direccion").textContent = textoOGuion(cliente.direccion);
    panel.querySelector(".detalle-cp").textContent = textoOGuion(cliente.codigoPostal);
    panel.querySelector(".detalle-poblacion").textContent = textoOGuion(cliente.poblacion);
    panel.querySelector(".detalle-provincia").textContent = textoOGuion(cliente.provincia);

    nombrarPanel(panel.querySelector(".panel-cliente"), "Viendo detalles de", cliente);

    contenido.replaceChildren(panel);
}

/**
 * Pinta el formulario de edición con los datos del cliente.
 * @param {Element} contenido el hueco del panel donde va el formulario
 * @param {Object} cliente lo que hay ahora mismo en la base de datos
 * @param {Object|null} borrador lo que el usuario tenía escrito antes de un repintado
 * @param {boolean} enfocar si se lleva el cursor al primer campo
 */
export function pintarPanelEdicion(contenido, cliente, borrador, enfocar) {
    const panel = plantillaPanelEdicion.content.cloneNode(true);
    const formulario = panel.querySelector(".formulario-edicion");
    const valoresBd = valoresDe(cliente);

    // Se rellena con el borrador si lo hay, para no perder lo tecleado.
    const valores = borrador ?? valoresBd;

    for (const campo of CAMPOS_EDITABLES) {
        const control = formulario.elements[campo];

        // Cada campo necesita su propio id para que el <label for> lo apunte, y con varios
        // formularios abiertos a la vez no pueden repetirse: se le pega el id del cliente. El
        // template los trae con el sufijo PLANTILLA, que además hace que cante a la vista en
        // el inspector si alguno se quedara sin sustituir.
        const idControl = `campo-${campo}-${cliente.idCliente}`;
        formulario.querySelector(`label[for="campo-${campo}-PLANTILLA"]`).htmlFor = idControl;
        control.id = idControl;

        control.value = valores[campo];
    }

    nombrarPanel(formulario, "Editando", cliente);

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
 * Hace que el panel se anuncie con el nombre del cliente al que pertenece.
 *
 * Con varios paneles abiertos a la vez, y con la fila del cliente ya por encima, quien no ve
 * la pantalla oía "Editando" sin saber de quién. Ahora oye "Editando García S.L.".
 *
 * El nombre se escribe en la etiqueta de estado, que es texto que YA se ve, y el panel la
 * apunta con aria-labelledby en vez de repetir la cadena en un aria-label: dos textos que
 * dicen lo mismo acaban diciendo cosas distintas en cuanto alguien cambia uno.
 *
 * @param {Element} panel el contenedor del panel (el div del detalle o el form de edición)
 * @param {string} accion con qué empieza la frase ("Viendo detalles de", "Editando")
 * @param {Object} cliente el cliente que se está mostrando
 */
export function nombrarPanel(panel, accion, cliente) {
    const etiquetaEstado = panel.querySelector(".etiqueta-estado");

    etiquetaEstado.querySelector(".texto-estado").textContent = `${accion} ${cliente.nombre}`;

    // El id lleva dentro el del cliente porque puede haber varios paneles en la página y dos
    // elementos no pueden compartir id.
    etiquetaEstado.id = `estado-panel-${cliente.idCliente}`;
    panel.setAttribute("aria-labelledby", etiquetaEstado.id);
}

/**
 * Aviso de "cargando" mientras llega la respuesta del backend.
 *
 * No lleva role: un elemento que nace con el texto dentro no se anuncia, y tampoco se manda a
 * la región de anuncios a propósito. Es un mensaje de paso, que se sustituye en cuanto llega
 * la respuesta, y anunciarlo dejaría al lector de pantalla leyendo algo que ya no está. Que el
 * panel se ha abierto ya lo dice el aria-expanded del botón que se acaba de pulsar.
 *
 * @param {HTMLElement} contenido el hueco del panel, cuyo contenido se sustituye entero
 */
export function pintarCargando(contenido) {
    const aviso = document.createElement("p");
    aviso.className = "panel-aviso";
    aviso.textContent = "Cargando los datos del cliente…";
    contenido.replaceChildren(aviso);
}

/**
 * Aviso de error con un botón para volver a intentarlo, sin cerrar el panel: cerrarlo
 * obligaría a buscar otra vez la fila para reabrirla.
 *
 * @param {HTMLElement} contenido el hueco del panel, cuyo contenido se sustituye entero
 * @param {Error} error el fallo que se va a explicar
 */
export function pintarErrorPanel(contenido, error) {
    console.error("No se pudieron cargar los datos del cliente:", error);

    const aviso = document.createElement("p");
    aviso.className = "panel-aviso panel-aviso-error";
    aviso.textContent = "No se pudieron cargar los datos del cliente. ";

    // Este sí se anuncia: es el final del camino, y sin avisar el panel se queda en silencio
    // como si siguiera cargando. El texto se ve aquí dentro, así que va solo a la región
    // invisible y no a la franja de avisos.
    anunciar("No se pudieron cargar los datos del cliente.");

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "btn btn-sm btn-link btn-reintentar";
    boton.textContent = "Reintentar";
    aviso.appendChild(boton);

    contenido.replaceChildren(aviso);
}

/**
 * Mete en el panel lo que toca según el modo. Está aparte porque los dos caminos de
 * abrirDespliegue (con los datos ya en la mano y esperando al backend) terminan aquí.
 *
 * @param {Element} contenido el hueco del panel
 * @param {string} modo "detalle" o "edicion"
 * @param {Object} cliente los datos del cliente
 * @param {Object|null} borrador lo que hubiera escrito sin guardar
 * @param {boolean} enfocar si se lleva el cursor al primer campo del formulario
 */
export function pintarContenidoPanel(contenido, modo, cliente, borrador, enfocar) {
    if (modo === "edicion") {
        pintarPanelEdicion(contenido, cliente, borrador, enfocar);
    } else {
        pintarPanelDetalle(contenido, cliente);
    }
}
