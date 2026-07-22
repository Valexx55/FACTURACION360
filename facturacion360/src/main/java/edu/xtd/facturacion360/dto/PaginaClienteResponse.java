package edu.xtd.facturacion360.dto;

import java.util.List;

/**
 * Lo que devuelve el endpoint de paginación (GET /cliente/listar-pagina) como JSON.
 * Además de los clientes de ESTA página, incluye "metadatos" para que el frontend sepa
 * en qué página está y pueda activar/desactivar los botones sin recalcular nada.
 *
 * <p>Es un {@code record}: Java genera solo el constructor, los accesores ({@code contenido()},
 * {@code paginaActual()}…) y {@code equals}/{@code hashCode}/{@code toString}. Es inmutable.</p>
 *
 * @param contenido      los clientes de esta página
 * @param paginaActual   índice de la página (empieza en 0)
 * @param totalPaginas   cuántas páginas hay en total
 * @param totalElementos cuántos clientes hay en total (en toda la tabla)
 * @param hayAnterior    {@code true} si existe una página anterior
 * @param haySiguiente   {@code true} si existe una página siguiente
 */
public record PaginaClienteResponse(
		List<ClienteResponse> contenido,
		int paginaActual,
		int totalPaginas,
		long totalElementos,
		boolean hayAnterior,
		boolean haySiguiente) {
}
