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
	 * Una página de clientes: 'tamano' filas saltando las primeras 'offset' ({@code LIMIT ? OFFSET ?}).
	 *
	 * @param tamano cuántas filas devolver (LIMIT)
	 * @param offset cuántas filas saltar desde el principio (OFFSET)
	 * @return la lista de clientes de esa página; vacía si no hay, nunca {@code null}
	 */
	public List<Cliente> findPagina (int tamano, int offset);

	/**
	 * Cuenta el total de clientes de la tabla (para saber cuántas páginas hay).
	 *
	 * @return el número total de clientes
	 */
	public long contarTotal ();

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
