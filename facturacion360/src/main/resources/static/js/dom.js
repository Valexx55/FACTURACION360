/**
 * @file Las referencias a los elementos de `clientes.html` que usa la pantalla, resueltas una
 * sola vez al arrancar.
 *
 * Capa 0: **no importa nada de la aplicación**. Que todas las búsquedas del documento vivan
 * aquí es lo que permite saber de un vistazo de qué HTML depende el JavaScript; si alguien
 * renombra un `id`, esto es lo único que hay que tocar.
 *
 * <p>Se resuelven en el momento en que se evalúa el módulo, y eso es seguro porque
 * `type="module"` es diferido: el documento ya está entero cuando esto se ejecuta.</p>
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa completo de módulos y la regla de capas
 */

export const cuerpoTabla = document.getElementById("tabla-clientes");
export const plantillaFila = document.getElementById("fila-cliente-template");
export const plantillaDespliegue = document.getElementById("fila-despliegue-template");
export const plantillaPanelDetalle = document.getElementById("panel-detalle-template");
export const plantillaPanelEdicion = document.getElementById("panel-edicion-template");
export const btnAnterior = document.getElementById("btn-anterior");
export const btnSiguiente = document.getElementById("btn-siguiente");
export const infoPagina = document.getElementById("info-pagina");

export const inputBuscador = document.getElementById("buscador-clientes");
export const contenedorBuscador = document.querySelector(".buscador-clientes");
export const barraFiltros = document.querySelector(".barra-filtros");
export const contadorFiltros = document.getElementById("contador-filtros");
export const selectProvincia = document.getElementById("filtro-provincia");
export const selectPoblacion = document.getElementById("filtro-poblacion");
export const selectOrdenarPor = document.getElementById("filtro-ordenar-por");
export const btnDireccion = document.getElementById("btn-direccion");
export const iconoDireccion = document.getElementById("icono-direccion");
export const etiquetaDireccion = document.getElementById("etiqueta-direccion");
export const btnLimpiar = document.getElementById("btn-limpiar");
export const cabecerasOrdenables = document.querySelectorAll(".cabecera-ordenable");
export const regionAnuncios = document.getElementById("anuncios");
export const avisoClientes = document.getElementById("aviso-clientes");
export const contenedorTabla = cuerpoTabla.closest(".table-responsive");
export const dialogoDescartar = document.getElementById("modal-descartar");
export const btnDescartar = document.getElementById("btn-descartar");
export const pantallaCarga = document.getElementById("pantalla-carga");

// Las cabeceras de la tabla. Se cuentan para saber cuántas columnas tiene que ocupar la fila
// de mensajes y la del despliegue, en vez de escribir un 6 que habría que acordarse de cambiar
// aquí y en el HTML al añadir una columna. El ":scope >" deja fuera las cabeceras de las
// tablas de los paneles, que se insertan dentro de esta.
const CABECERAS_TABLA = cuerpoTabla.closest("table")
    .querySelectorAll(":scope > thead > tr > th");

// El texto por defecto del error del NIF/CIF, sacado del propio <template> donde está escrito.
// Se guarda al arrancar porque al mostrar el error del servidor se pisa, y al cerrar hay que
// devolverlo: copiarlo aquí a mano serían dos textos que acabarían diciendo cosas distintas.
export const MENSAJE_NIF_BASE = plantillaPanelEdicion.content
    .querySelector('[name="nifCif"] ~ .invalid-feedback').textContent;

/**
 * Cuántas columnas ocupa hoy la tabla, contando solo las cabeceras VISIBLES.
 *
 * En móvil hay dos ocultas con la clase d-none de Bootstrap: con el número entero, la fila de
 * mensajes y la del panel se extienden sobre dos columnas que no existen y su contenido se
 * centra respecto a un ancho mayor que el de la tabla, saliéndose por la derecha.
 *
 * <p>Vive con las referencias del DOM y no con el pintado porque es una consulta al documento,
 * no dibuja nada. Ponerla en la capa de pintado creaba un ciclo con la de avisos, que también
 * la necesita para su `colspan`.</p>
 *
 * @return {number} el número de cabeceras visibles; el total si no hubiera ninguna, que es lo
 *         que pasa si la tabla entera está oculta y un colspan de 0 no es válido
 */
export function columnasVisibles() {
    // offsetParent es null en un elemento con display:none (y en toda su descendencia), que es
    // justo lo que hace la clase d-none.
    const visibles = [...CABECERAS_TABLA].filter((cabecera) => cabecera.offsetParent !== null);
    return visibles.length || CABECERAS_TABLA.length;
}
