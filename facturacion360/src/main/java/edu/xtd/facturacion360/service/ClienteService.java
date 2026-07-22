package edu.xtd.facturacion360.service;

import java.util.List;
import edu.xtd.facturacion360.dto.Cliente;


/**
 * Definimos las operaciones que se pueden realizar con Clientes
 * en nuestra app
 */
public interface ClienteService {

	public List<Cliente> listarUltimos(int limite);

	public Cliente obtenerPorId(int id);

	/**
	 * Crea un cliente nuevo en el sistema.
	 *
	 * @param cliente datos del cliente que se va a crear
	 * @return true si el cliente se crea correctamente; false en caso contrario
	 */
	public Cliente crear(Cliente cliente);

	public Cliente actualizar(int id, Cliente cliente);

	public void eliminar(int id);

}
