package edu.xtd.facturacion360.repository;

import java.util.List;
import java.util.Optional;

import edu.xtd.facturacion360.dto.Cliente;

/**
 * Este interfaz recoge las operaciones sobre base de datos
 * que podemos hacer con los clientes
 * 
 */
public interface ClienteRepository {
	
	/**
	 * Los últimos clientes por id (el más alto primero).
	 *
	 * @param limite cuántas filas devolver (LIMIT)
	 * @return la lista de clientes; vacía si no hay ninguno, nunca {@code null}
	 */
	public List<Cliente> findUltimos (int limite);

	/**
	 * Una página de clientes: 'tamano' filas saltando las primeras 'offset'
	 * ({@code LIMIT ? OFFSET ?}), aplicando la búsqueda, los filtros y la
	 * ordenación pedidos.
	 *
	 * @param tamano     cuántas filas devolver (LIMIT)
	 * @param offset     cuántas filas saltar desde el principio (OFFSET)
	 * @param busqueda   texto a buscar en nombre y nif_cif (coincidencia parcial);
	 *                   null o vacío = no buscar
	 * @param provincia  filtro por provincia; null o vacío = no filtrar
	 * @param poblacion  filtro por población; null o vacío = no filtrar
	 * @param ordenarPor columna por la que ordenar (nombre o fecha_alta); se traduce
	 *                   con una lista blanca
	 * @param direccion  sentido de la ordenación: asc o desc
	 * @return la lista de clientes de esa página; vacía si no hay, nunca {@code null}
	 */
	public List<Cliente> findPagina (int tamano, long offset, String busqueda, String provincia, String poblacion,
			String ordenarPor, String direccion);

	/**
	 * Cuenta el total de clientes que cumplen la búsqueda y los filtros (para saber
	 * cuántas páginas hay con esos criterios aplicados). Recibe los mismos criterios
	 * que {@link #findPagina} para que el total cuadre siempre con lo que se muestra.
	 *
	 * @param busqueda  texto a buscar en nombre y nif_cif; null o vacío = no buscar
	 * @param provincia filtro por provincia; null o vacío = no filtrar
	 * @param poblacion filtro por población; null o vacío = no filtrar
	 * @return el número total de clientes que cumplen los criterios
	 */
	public long contarTotal (String busqueda, String provincia, String poblacion);

	/**
	 * Las provincias distintas que existen en la tabla (para rellenar el
	 * desplegable de filtro), ordenadas alfabéticamente.
	 *
	 * @return la lista de provincias; vacía si no hay, nunca {@code null}
	 */
	public List<String> findProvincias ();

	/**
	 * Las poblaciones distintas que existen en la tabla (para el desplegable de
	 * filtro en cascada), ordenadas alfabéticamente.
	 *
	 * @param provincia si llega informada, solo las poblaciones de esa provincia;
	 *                  null o vacío = todas
	 * @return la lista de poblaciones; vacía si no hay, nunca {@code null}
	 */
	public List<String> findPoblaciones (String provincia);

	public Optional<Cliente> findById (int id);
	
	/**
	 * Inserta un cliente nuevo en el almacenamiento persistente.
	 *
	 * @param cliente datos del cliente que se va a insertar
	 * @return true si se inserta correctamente; false en caso contrario
	 */
	public Cliente insert (Cliente cliente);
	
	public boolean update (Cliente cliente);
	
	public boolean deleteById (int id);

}
