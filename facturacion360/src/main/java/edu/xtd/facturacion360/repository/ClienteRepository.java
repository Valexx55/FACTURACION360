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
	 * ({@code LIMIT ? OFFSET ?}), aplicando los filtros y la ordenación pedidos.
	 *
	 * @param tamano    cuántas filas devolver (LIMIT)
	 * @param offset    cuántas filas saltar desde el principio (OFFSET)
	 * @param provincia filtro por provincia; null o vacío = no filtrar
	 * @param poblacion filtro por población; null o vacío = no filtrar
	 * @param orden     criterio de ordenación (recientes, antiguos, nombre_az,
	 *                  nombre_za); se traduce con una lista blanca
	 * @return la lista de clientes de esa página; vacía si no hay, nunca {@code null}
	 */
	public List<Cliente> findPagina (int tamano, int offset, String provincia, String poblacion, String orden);

	/**
	 * Cuenta el total de clientes que cumplen los filtros (para saber cuántas
	 * páginas hay con ese filtro aplicado).
	 *
	 * @param provincia filtro por provincia; null o vacío = no filtrar
	 * @param poblacion filtro por población; null o vacío = no filtrar
	 * @return el número total de clientes que cumplen los filtros
	 */
	public long contarTotal (String provincia, String poblacion);

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
	
	/**
	 * Busca clientes cuyo nombre o NIF/CIF contengan el término indicado
	 * (coincidencia parcial, sin distinguir mayúsculas de minúsculas), aplicando
	 * los filtros y la ordenación pedidos.
	 *
	 * @param termino   texto a buscar en nombre y nif_cif
	 * @param provincia filtro por provincia; null o vacío = no filtrar
	 * @param poblacion filtro por población; null o vacío = no filtrar
	 * @param orden     criterio de ordenación (recientes, antiguos, nombre_az,
	 *                  nombre_za); se traduce con una lista blanca
	 * @return la lista de clientes que coinciden; vacía si no hay ninguno, nunca {@code null}
	 */
	public List<Cliente> buscar (String termino, String provincia, String poblacion, String orden);

}
