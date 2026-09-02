/**
 * @file La capa de transporte: hablar con el backend y cancelar lo que ya no interesa.
 *
 * Capa 1. **Solo transporta**: no sabe qué es un cliente ni toca el documento. Por eso la
 * orquestación (pedir el listado, rellenar los desplegables) vive en `listado.js` y no aquí:
 * si estuvieran juntas, el despliegue de la fila —que necesita `pedirJson`— acabaría
 * importando a quien pinta la tabla, y eso es un ciclo.
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa de módulos y la regla de capas
 */
import { pantallaCarga } from "./dom.js";

/*
 * Petición en vuelo de cada "canal" (listado, provincias, poblaciones). Al lanzar una
 * nueva petición de un canal se cancela la anterior DEL MISMO canal.
 *
 * Hacen falta canales separados y no un único controlador compartido: al cambiar de
 * provincia se piden a la vez las poblaciones y el listado, y con un solo controlador
 * cada una abortaría a la otra.
 */
export const peticionesEnVuelo = {};

/*
 * Peticiones que hay ahora mismo en el aire, para el velo de carga. Es un contador y no un
 * booleano porque se solapan: la que termina apagaría el velo de las que siguen vivas.
 *
 * El velo vive en esta capa y no en avisos.js, aunque sea cosa de la interfaz, porque lo que
 * cuenta son PETICIONES y aquí es donde empiezan y acaban todas. Ponerlo en avisos.js
 * obligaría a que api importara de su misma capa, y la regla es importar solo de capas
 * estrictamente inferiores (dom, que es la capa 0, sí vale).
 */
let peticionesActivas = 0;

/** Suma una petición en vuelo y destapa el velo si es la primera. */
function mostrarCarga() {
    peticionesActivas++;
    if (pantallaCarga) {
        pantallaCarga.classList.remove("d-none");
    }
}

/** Resta una petición y tapa el velo cuando ya no queda ninguna. */
function ocultarCarga() {
    peticionesActivas--;
    if (peticionesActivas <= 0) {
        peticionesActivas = 0; // Prevenir números negativos
        if (pantallaCarga) {
            pantallaCarga.classList.add("d-none");
        }
    }
}

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
 * @throws {Error} si el servidor responde con un código que no es 2xx; el error lleva ese
 *         código en la propiedad `estado`
 */
export async function pedirJson(canal, url) {
    peticionesEnVuelo[canal]?.abort();
    const controlador = new AbortController();
    peticionesEnVuelo[canal] = controlador;

    mostrarCarga();

    try {
        const respuesta = await fetch(url, { signal: controlador.signal });

        // fetch NO lanza error con códigos 4xx/5xx: hay que comprobarlo a mano.
        if (!respuesta.ok) {
            const error = new Error(`El servidor respondió ${respuesta.status}`);

            // El código va aparte del mensaje porque hay quien necesita distinguirlos: un 404
            // al comprobar un detalle significa "lo han borrado" y se trata distinto del
            // resto. Leerlo del texto del mensaje sería frágil.
            error.estado = respuesta.status;
            throw error;
        }
        return await respuesta.json();
    } finally {
        cerrarCanal(canal, controlador);
        ocultarCarga();
    }
}

/**
 * ¿Este error es de una petición que hemos cancelado nosotros?
 *
 * Cancelar es algo que provocamos a propósito, no un fallo: si lo tratáramos como tal,
 * el usuario vería el mensaje de error justo mientras escribe en el buscador.
 *
 * @param {Error} error el error capturado
 * @return {boolean} true si lo canceló el AbortController de su canal, no el servidor
 */
export function esCancelacion(error) {
    return error.name === "AbortError";
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
export async function enviarJson(canal, metodo, url, cuerpo) {
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
