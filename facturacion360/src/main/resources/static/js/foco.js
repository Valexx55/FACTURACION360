/**
 * @file A quién hay que devolverle el foco después de repintar la tabla.
 *
 * Capa 1, y es un módulo diminuto por un motivo concreto: es **el único estado que se escribe
 * desde un módulo y se lee desde otro**. Lo apunta el guardado (`edicion.js`) y lo consume el
 * repintado (`tabla.js`).
 *
 * <p>En módulos ES lo que se importa es de solo lectura, así que `focoPendiente = x` desde
 * fuera lanzaría un `TypeError`. Teniendo la variable y sus dos operaciones aquí dentro, nadie
 * necesita asignarla desde fuera y no hace falta ni un objeto de estado ni una capa de
 * <em>setters</em>.</p>
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa de módulos y la regla de capas
 */
import { cuerpoTabla } from "./dom.js";

// Id del cliente al que hay que devolver el foco en cuanto se repinte la tabla, o null.
// Guardar destruye la fila que contenía el botón pulsado y, sin esto, el foco se iría al
// <body> y quien navegue con teclado volvería al principio de la página.
let focoPendiente = null;

/**
 * Apunta a qué cliente hay que devolverle el foco cuando la tabla se vuelva a pintar.
 *
 * Existe porque `focoPendiente` no se puede asignar desde otro módulo: lo importado es de solo
 * lectura. Es la única adaptación que ha necesitado el reparto en módulos.
 *
 * @param {number} idCliente el cliente cuyo botón de editar recuperará el foco
 */
export function anotarFoco(idCliente) {
    focoPendiente = idCliente;
}

/**
 * Devuelve el foco al botón de editar del cliente que se acaba de guardar.
 *
 * Al repintar, la fila que tenía el foco deja de existir y el navegador lo manda al <body>:
 * quien navegue con teclado se encontraría de vuelta al principio de la página después de
 * cada guardado. Se llama tras repintar porque hasta ese momento el botón nuevo no existe.
 */
export function devolverFoco() {
    if (focoPendiente === null) return;

    const fila = cuerpoTabla.querySelector(`tr[data-cliente-id="${focoPendiente}"]`);
    focoPendiente = null;

    // Puede no estar: el cliente se ha quedado en otra página, o ya no cumple el filtro. En
    // ese caso no forzamos el foco a ningún sitio raro; el aviso de "Cliente guardado" ya se
    // ha anunciado por su cuenta.
    fila?.querySelector(".btn-editar")?.focus();
}
