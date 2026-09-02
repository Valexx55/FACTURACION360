/**
 * @file El estado que comparten varios módulos de la pantalla de clientes.
 *
 * Capa 0: **no importa nada**. Son las tres estructuras que más de un módulo necesita leer o
 * escribir; todo lo demás que es mutable vive en el módulo que lo usa.
 *
 * <p><strong>Por qué son objetos y no variables sueltas.</strong> En módulos ES, lo que se
 * importa es de solo lectura: `criterios = {...}` desde otro fichero lanzaría un `TypeError`.
 * Cambiar una PROPIEDAD sí es legal (`criterios.busqueda = "x"`), así que agrupar el estado
 * compartido en objetos y `Map` es lo que permite escribirlo desde donde toca sin inventarse
 * una capa de *setters*.</p>
 *
 * @author AngelDanielC0des
 * @see main.js — el mapa completo de módulos y la regla de capas
 */

/*
 * ÚNICO estado de los criterios de la pantalla. Que todo viva en un solo objeto es lo que
 * impide que el botón de dirección y las cabeceras de la tabla se contradigan: los dos leen y
 * escriben aquí, y luego se repinta todo desde este objeto.
 */
export const criterios = {
    busqueda: "",
    provincia: "",
    poblacion: "",
    ordenarPor: "fecha_alta",
    direccion: "desc",
};

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
export const filasDesplegadas = new Map();

/*
 * Los clientes de la página que se está viendo: id -> ClienteResponse, tal cual llegó.
 *
 * El listado ya trae TODOS los campos del cliente, los mismos que devuelve GET /cliente/{id},
 * así que al volver a abrir un panel tras repintar la tabla los datos ya están aquí. Sin esto,
 * cada tecla del buscador con tres paneles abiertos lanzaba cuatro peticiones: la del listado
 * y una por panel, todas para pintar lo que la primera acababa de traer.
 *
 * No es una caché: se tira y se rehace en cada repintado, así que nunca contiene nada más
 * viejo que la tabla que se está viendo. Al abrir un panel a mano se pinta desde aquí para no
 * hacer esperar a nadie, pero se pregunta igualmente al servidor y se pone al día si difiere
 * (ver abrirDespliegue).
 */
export const clientesEnPagina = new Map();

/**
 * ¿Hay algún filtro o búsqueda puesto? La ordenación no cuenta: siempre hay una, así que
 * si contase, el botón de limpiar y el contador estarían activos desde que se abre la página.
 *
 * <p>Vive aquí y no con los filtros porque es un predicado sobre `criterios` y nada más.
 * Tenerlo en la capa de filtros creaba un ciclo: el pintado de la tabla lo necesita para
 * decidir qué mensaje enseña cuando no hay resultados.</p>
 *
 * @return {boolean} true si hay búsqueda, provincia o población
 */
export function hayCriteriosActivos() {
    return contarCriteriosActivos() > 0;
}

/**
 * Cuántos filtros hay puestos ahora mismo. Lo enseña el contador de la barra, y de aquí sale
 * también {@link hayCriteriosActivos}, para que **la lista de qué cuenta como filtro esté en un
 * solo sitio**: escrita dos veces, añadir un cuarto obligaría a acordarse de los dos.
 *
 * @return {number} entre 0 y 3
 */
export function contarCriteriosActivos() {
    return [criterios.busqueda, criterios.provincia, criterios.poblacion].filter(Boolean).length;
}
