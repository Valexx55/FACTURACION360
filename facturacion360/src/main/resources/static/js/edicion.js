/**
 * @file Guardar lo editado y contar lo que responda el servidor.
 *
 * Capa 3. Solo el guardado: pintar el formulario es de `paneles.js` y leerlo de
 * `formulario.js`.
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa de módulos y la regla de capas
 */
import { enviarJson, esCancelacion } from "./api.js";
import { anunciar } from "./avisos.js";
import { API_CLIENTE } from "./config.js";
import { cerrarDespliegue } from "./despliegue.js";
import { cuerpoTabla } from "./dom.js";
import { filasDesplegadas } from "./estado.js";
import { filaViva, formularioVivo } from "./fila.js";
import { anotarFoco } from "./foco.js";
import { cuerpoPeticion, leerFormulario, limpiarErrores, mensajeDe } from "./formulario.js";
/**
 * Manda los cambios al backend y actúa según lo que responda.
 *
 * No se llama guardarCliente a propósito: ese es el nombre que le corresponde al alta de
 * clientes, que es otra feature. Ocupándolo, el día que alguien la implemente se encontraría
 * el nombre cogido por una función que espera un formulario de edición.
 *
 * @param {HTMLFormElement} formulario el formulario de la fila que se está editando
 */
export async function guardarEdicion(formulario) {
    const idCliente = Number(formulario.dataset.clienteId);

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
            // Se olvida el panel por el id y no por la fila: si la tabla se ha repintado
            // mientras viajaba la petición, el <tr> que teníamos ya no está en el documento y
            // cerrarDespliegue no llegaría a borrar la entrada del Map. Quedaría un panel
            // abierto de un cliente que el usuario ya había terminado de editar.
            filasDesplegadas.delete(idCliente);

            const fila = filaViva(idCliente);
            if (fila) cerrarDespliegue(fila);

            // Y que la tabla, al repintarse, devuelva el foco al botón de editar de esta fila:
            // el que estaba pulsado deja de existir y el foco se iría al principio de la página.
            // Se apunta con una función y no asignando la variable porque vive en otro módulo,
            // y lo que se importa es de solo lectura.
            anotarFoco(idCliente);

            // Visible: la fila que se estaba editando desaparece con el refresco y no quedaría
            // ninguna señal de que el guardado ha ido bien.
            anunciar("Cliente guardado.", { visible: true });

            // El contrato del proyecto para avisar de un cambio. La tabla se recarga sola, así
            // que la fila enseña lo guardado y se recoloca si el orden la ha movido de sitio.
            document.dispatchEvent(new CustomEvent("clientes:cambiaron"));
            return;
        }

        contarErrorGuardado(idCliente, estado);
    } catch (error) {
        if (esCancelacion(error)) return;
        console.error("No se pudo guardar el cliente:", error);
        contarErrorGuardado(idCliente, 0);
    } finally {
        // El botón, el vivo: si la tabla se repintó, el que teníamos ya no está y el nuevo nace
        // habilitado de todos modos, así que sin esta búsqueda no pasaría nada malo. Se hace
        // igual para que no parezca un olvido y para que la regla de arriba no tenga excepciones.
        const botonVivo = formularioVivo(idCliente)?.querySelector(".btn-guardar");
        if (botonVivo) botonVivo.disabled = false;
    }
}

/**
 * Cuenta un guardado que no ha salido bien, en el formulario que esté en pantalla AHORA.
 *
 * Es la parte que faltaba de la regla del `await`: el formulario desde el que se pulsó Guardar
 * puede haber desaparecido mientras viajaba la petición (basta con teclear en el buscador, o
 * con que otra parte de la aplicación dispare `clientes:cambiaron`). Escribir el error en él no
 * falla, simplemente no lo lee nadie, y el usuario se queda creyendo que ha guardado.
 *
 * Si el panel ya no está abierto no hay dónde poner el detalle del error, así que el aviso va a
 * la franja de fuera, que es lo único que sobrevive a un repintado.
 *
 * @param {number} idCliente el cliente que se intentaba guardar
 * @param {number} estado el código HTTP (0 si ni siquiera hubo respuesta)
 */
function contarErrorGuardado(idCliente, estado) {
    const formulario = formularioVivo(idCliente);

    if (formulario) {
        mostrarErrorGuardado(formulario, estado);
        return;
    }

    anunciar("No se pudo guardar el cliente. Vuelve a abrirlo e inténtalo de nuevo.",
        { visible: true, esError: true });
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
        // está viendo ya no es la que hay en la base de datos. Este es el único error que NO
        // se escribe en la alerta del formulario: el refresco que viene a continuación se
        // lleva por delante la fila y con ella la alerta, así que el aviso va a la franja de
        // fuera, que es la que sobrevive.
        anunciar("Este cliente ya no existe: alguien lo ha eliminado mientras lo editabas.",
            { visible: true, esError: true });
        filasDesplegadas.delete(Number(formulario.dataset.clienteId));
        document.dispatchEvent(new CustomEvent("clientes:cambiaron"));
        return;
    }

    // Los demás dejan el panel abierto para poder corregir, así que se cuentan ahí mismo. La
    // alerta es role="alert" y estaba en el documento desde que se pintó el formulario: basta
    // con escribirle el texto para que se anuncie.
    if (estado === 400) {
        alerta.textContent = "El servidor ha rechazado los datos. Revisa los campos marcados.";
    } else {
        alerta.textContent = "No se pudo guardar. Inténtalo de nuevo en unos segundos.";
    }
}

/** Guarda lo escrito en los formularios abiertos antes de que la tabla se repinte. */
export function guardarBorradores() {
    for (const formulario of cuerpoTabla.querySelectorAll(".formulario-edicion")) {
        const estado = filasDesplegadas.get(Number(formulario.dataset.clienteId));
        if (estado) {
            estado.borrador = leerFormulario(formulario);
        }
    }
}
