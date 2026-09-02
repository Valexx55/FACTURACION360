/**
 * @file Leer, escribir y comparar el formulario de edición. Sin red y sin pintar paneles.
 *
 * Capa 1. Son las operaciones que otros módulos necesitan sobre un `<form>` ya existente:
 * sacar sus valores, compararlos con los de la base de datos y colocar los mensajes de error.
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa de módulos y la regla de capas
 */
import { CAMPOS_EDITABLES, CAMPOS_OPCIONALES } from "./config.js";
import { MENSAJE_NIF_BASE } from "./dom.js";
/**
 * Los datos del cliente en la forma que entiende el formulario: solo los campos editables,
 * sin nulos y sin espacios sobrantes. Un input al que se le asigna null escribe la palabra
 * "null" dentro, así que la conversión no es opcional.
 *
 * @param {Object} cliente el cliente tal cual llega del backend
 * @return {Object.<string, string>} un valor por cada campo de CAMPOS_EDITABLES
 */
export function valoresDe(cliente) {
    const valores = {};
    for (const campo of CAMPOS_EDITABLES) {
        valores[campo] = (cliente[campo] ?? "").trim();
    }
    return valores;
}

/**
 * Lo que hay escrito ahora mismo en el formulario. Devuelve la MISMA forma que
 * {@link valoresDe} para que las dos se puedan comparar campo a campo (ver hayCambios).
 *
 * @param {HTMLFormElement} formulario el formulario de edición
 * @return {Object.<string, string>} un valor por cada campo de CAMPOS_EDITABLES
 */
export function leerFormulario(formulario) {
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
export function mensajeDe(formulario, campo) {
    return formulario.querySelector(`[name="${campo}"] ~ .invalid-feedback`);
}

/** ¿Se ha tocado algo respecto a lo que hay en la base de datos? */
export function hayCambios(formulario) {
    return JSON.stringify(leerFormulario(formulario)) !== formulario.dataset.valoresOriginales;
}

/**
 * El nombre visible de un campo del formulario, para poder nombrarlo en un aviso.
 *
 * Se lee de la etiqueta asociada al propio control (la propiedad `labels` da las que le
 * apuntan con `for`) en vez de tener aquí una lista de nombres: son los mismos textos y una
 * copia acabaría diciendo algo distinto del formulario que describe.
 *
 * Solo el texto, no la etiqueta entera: dentro lleva también el lápiz y el asterisco de
 * obligatorio, que son decorativos y no forman parte del nombre del campo. El `name` queda
 * de red de seguridad por si algún campo se quedara sin etiqueta.
 *
 * @param {HTMLInputElement} control el campo del formulario
 * @return {string} su nombre visible ("Código postal"), o su atributo name si no tiene
 */
export function etiquetaDe(control) {
    const nombreVisible = control.labels?.[0]
        ?.querySelector(".texto-etiqueta")?.textContent.trim();

    return nombreVisible || control.name;
}

/**
 * Los campos vacíos se ven mejor como un guion que como una celda en blanco.
 *
 * @param {string|null|undefined} valor el dato tal cual viene del backend
 * @return {string} el valor, o un guion largo si no había nada que enseñar
 */
export function textoOGuion(valor) {
    return valor && valor.trim() ? valor : "—";
}

/**
 * El cuerpo JSON del PUT, con la forma que espera ClienteRequest. No lleva ni el id (viaja
 * en la URL) ni la fecha de alta (no es editable y el service conserva la que hay en la BD).
 *
 * @param {HTMLFormElement} formulario el formulario de edición
 * @return {string} el JSON listo para el body del fetch
 */
export function cuerpoPeticion(formulario) {
    const valores = leerFormulario(formulario);

    // Los opcionales vacíos viajan como null y no como "": esas columnas admiten NULL y es lo
    // que hay en las filas que nunca se rellenaron. Mandar cadenas vacías dejaría dos formas
    // distintas de decir "no hay dato" conviviendo en la misma tabla.
    for (const campo of CAMPOS_OPCIONALES) {
        if (!valores[campo]) valores[campo] = null;
    }

    return valores;
}

/** Borra las marcas del intento anterior para no mezclar errores viejos con nuevos. */
export function limpiarErrores(formulario) {
    // Vaciarla es esconderla: la hoja de estilos oculta la alerta sin texto, y así el elemento
    // no se va nunca del documento, que es lo que necesita su role="alert" para anunciar.
    formulario.querySelector(".alerta-edicion").textContent = "";

    const campo = formulario.elements.nifCif;
    campo.classList.remove("is-invalid");
    campo.removeAttribute("aria-invalid");
    campo.removeAttribute("aria-describedby");

    // Se devuelve el mensaje que el <template> trae de fábrica (el de "es obligatorio"), que es
    // el que le toca enseñar al navegador si el campo se queda vacío.
    mensajeDe(formulario, "nifCif").textContent = MENSAJE_NIF_BASE;
}
