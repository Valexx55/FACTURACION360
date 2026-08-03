/**
 * @file Punto de entrada de la pantalla de clientes: enlaza todos los controles y arranca.
 *
 * Es el único fichero que carga el HTML (`<script type="module" src="js/main.js">`); el resto
 * se traen solos por sus `import`.
 *
 * <h2>El mapa de módulos</h2>
 *
 * Están organizados en <strong>capas</strong>, y la regla que los mantiene ordenados es una
 * sola: <strong>un módulo solo importa de capas estrictamente inferiores</strong>. Sin ella
 * vuelven las dependencias circulares, que es justo lo que había que resolver para poder
 * partir el fichero.
 *
 * <pre>
 * 0  config    constantes: rutas, tiempos, listas de campos
 *    dom       las referencias a los elementos del HTML
 *    estado    criterios, filas desplegadas y clientes de la página
 *
 * 1  api       hablar con el backend y cancelar lo que ya no interesa
 *    avisos    anuncios para lectores de pantalla y avisos emergentes
 *    foco      a quién devolverle el foco tras repintar
 *    fila      pintar las celdas de una fila y encontrarla en el documento
 *    formulario  leer, comparar y validar el formulario de edición
 *
 * 2  paneles   el contenido de un panel: detalle, formulario, cargando, error
 *    dialogo   la pregunta de "¿descartas los cambios?"
 *
 * 3  despliegue  abrir, cerrar y cambiar de modo; conciliar con el servidor
 *    edicion     guardar y contar lo que responda
 *
 * 4  tabla     pintar el listado y los mensajes que ocupan la tabla
 *    listado   pedir los datos y mandarlos a pintar
 *
 * 5  filtros   buscar, filtrar, ordenar y limpiar
 *    main      esto: los listeners y el arranque
 * </pre>
 *
 * <p><strong>Dos sitios rompen la línea recta a propósito</strong>, y los dos con un evento en
 * vez de con un `import`, porque un módulo de abajo necesita provocar algo de arriba:</p>
 *
 * <ul>
 * <li>`clientes:cambiaron` — lo dispara quien crea, edita o elimina un cliente (también los
 *     compañeros desde su propio código) y recarga la tabla.</li>
 * <li>`clientes:limpiar-filtros` — lo dispara el botón "Quitar los filtros" que `tabla.js`
 *     pinta cuando no hay resultados. La tabla no puede importar a los filtros: los filtros ya
 *     dependen de ella.</li>
 * </ul>
 *
 * @author AngelDanielC0des
 * @see clientes.html — los &lt;template&gt; que se clonan y los elementos que se enlazan aquí
 * @see edu.xtd.facturacion360.controller.ClienteController — el otro extremo de cada fetch
 */
import { ESPERA_TECLEO_MS, DIRECCION_POR_DEFECTO } from "./config.js";
import {
    btnAnterior, btnSiguiente, btnDireccion, btnLimpiar, cabecerasOrdenables,
    columnasVisibles, contenedorBuscador, contenedorTabla, cuerpoTabla, inputBuscador,
    selectOrdenarPor, selectPoblacion, selectProvincia,
} from "./dom.js";
import { criterios } from "./estado.js";
import { filaViva, modoDe } from "./fila.js";
import { confirmarDescarte } from "./dialogo.js";
import { abrirDespliegue, alternarDespliegue, cerrarDespliegue } from "./despliegue.js";
import { guardarEdicion } from "./edicion.js";
import { cargarClientes, cargarPoblaciones, cargarProvincias, paginaActual } from "./listado.js";
import {
    aplicarCriterios, buscar, limpiarCriterios, pintarControlesOrden, pintarEstadoFiltros,
} from "./filtros.js";

// --- Enlazado de los controles ---

// Buscador con espera: reiniciamos el temporizador en cada tecla y solo consultamos
// cuando el usuario lleva ESPERA_TECLEO_MS sin escribir.
let temporizadorBusqueda = null;
inputBuscador.addEventListener("input", () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(buscar, ESPERA_TECLEO_MS);
});

// Enter es "ya he terminado de escribir": esperar los 300 ms de rigor después de eso se siente
// como que la tecla no ha hecho nada. No hay submit que evitar, el buscador no está en un
// <form>, pero sí hay que cancelar la espera o la búsqueda se lanzaría dos veces.
inputBuscador.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
        clearTimeout(temporizadorBusqueda);
        buscar();
    }
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

btnLimpiar.addEventListener("click", limpiarCriterios);

// El mismo limpiado, pedido desde el botón que la tabla pinta cuando una búsqueda no encuentra
// nada. Va por evento porque tabla.js está por DEBAJO de los filtros y no puede importarlos.
document.addEventListener("clientes:limpiar-filtros", limpiarCriterios);

// --- Paginación ---
btnAnterior.addEventListener("click", () => cargarClientes(paginaActual - 1));
btnSiguiente.addEventListener("click", () => cargarClientes(paginaActual + 1));

// --- Refresco automático tras crear/editar/eliminar ---
// Cuando otro compañero cambie un cliente, avisa disparando este evento y recargamos la
// página actual (así la tabla siempre refleja la BD, sin que su código conozca el nuestro).
// Ellos solo hacen: document.dispatchEvent(new CustomEvent('clientes:cambiaron'));
document.addEventListener("clientes:cambiaron", () => cargarClientes(paginaActual));

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
async function manejarClicPanel(evento, panel) {
    // Por el id que el propio panel lleva, y no por previousElementSibling: fiarse de la
    // posición en el documento obliga a que el panel esté siempre justo debajo de su fila, y
    // eso es una suposición que nadie ve al leer el código de al lado.
    const fila = filaViva(Number(panel.dataset.clienteId));
    if (!fila) return;

    if (evento.target.closest(".btn-cancelar")) {
        if (!await confirmarDescarte(fila)) return;

        // Igual que al alternar: mientras se preguntaba, la tabla ha podido repintarse y esta
        // fila ya no ser la que está en pantalla. Se cierra la que lo esté ahora.
        const filaActual = filaViva(Number(fila.dataset.clienteId));
        if (!filaActual) return;

        cerrarDespliegue(filaActual);
        // El foco vuelve al lápiz que abrió el formulario: si no, se quedaría en un botón que
        // acaba de desaparecer y saltaría al principio de la página.
        filaActual.querySelector(".btn-editar").focus();
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

// --- Ajustes al cambiar el tamaño de la ventana ---

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

/**
 * Reajusta las filas que ocupan la tabla a lo ancho (los paneles y los mensajes) cuando el
 * número de columnas visibles cambia, que es lo que pasa al estrechar la ventana hasta el
 * ancho de móvil con un panel ya abierto.
 */
function ajustarColumnas() {
    const columnas = columnasVisibles();

    // El ":scope >" es importante: dentro de los paneles hay más tablas, y sus celdas no
    // tienen nada que ver con las columnas de esta.
    for (const celda of cuerpoTabla.querySelectorAll(":scope > tr > td[colspan]")) {
        celda.colSpan = columnas;
    }
}

// Se vigilan los dos: la ventana al cambiar de tamaño encoge el contenedor, y un nombre muy
// largo o un panel abierto ensanchan la tabla. Cualquiera de las dos cosas hace aparecer o
// desaparecer el desplazamiento.
//
// El requestAnimationFrame no es adorno: arrastrar el borde de la ventana dispara el
// observador decenas de veces por segundo, y cada medida de scrollWidth obliga al navegador a
// recalcular la disposición de la página. Así se mide una vez por fotograma como mucho.
let ajustePedido = false;
const observadorTabla = new ResizeObserver(() => {
    if (ajustePedido) return;
    ajustePedido = true;

    requestAnimationFrame(() => {
        ajustePedido = false;
        ajustarFocoTabla();
        ajustarColumnas();
    });
});
observadorTabla.observe(contenedorTabla);
observadorTabla.observe(cuerpoTabla.closest("table"));

// --- Enlazado del modal de "Añadir Cliente" ---

// Los botones de la fila NO se enlazan aquí: van por delegación en el <tbody>, arriba. Las
// filas se clonan de un <template> y no existen todavía cuando esto se ejecuta, así que un
// querySelectorAll de '.btn-eliminar' aquí no encuentra ningún botón y no engancha nada (había
// uno y por eso no hacía nada). El borrado es de otra feature: cuando se implemente, su sitio
// es un caso más en ese manejador, junto a los de ver y editar.

/*
 * El modal de "Añadir Cliente" se vacía cada vez que se abre. Bootstrap no lo hace solo, así
 * que quien escriba medio cliente, cierre sin guardar y vuelva a abrirlo se encontraría lo de
 * antes dentro y podría creer que son los datos de un cliente que ya existe. Al ABRIR y no al
 * cerrar, porque cerrar se puede de cuatro maneras (botón, X, Escape y fondo).
 *
 * Si el alta acaba haciéndose en la tabla y no aquí, esto sobra: ver el comentario del botón
 * "Guardar Cambios" en clientes.html.
 */
const botonAnadirCliente = document.querySelector('[data-bs-target="#clienteModal"]');

botonAnadirCliente.addEventListener("click", () => {
    document.querySelector("#clienteModal form")?.reset();
});

// --- Enlazado del buscador ---

/*
 * Se despliega al ENFOCARLO y se recoge al salir, si está vacío.
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

// --- Carga inicial ---
//
// Va al FINAL del archivo a propósito: cuando estas cinco llamadas se ejecutan, todo lo que
// necesitan —las referencias del DOM, los manejadores de eventos y los avisos emergentes— ya
// está declarado y enlazado. Si se añade algo nuevo, va ANTES de este bloque.
pintarControlesOrden();
pintarEstadoFiltros();
cargarProvincias();
cargarPoblaciones("");
cargarClientes(0);
