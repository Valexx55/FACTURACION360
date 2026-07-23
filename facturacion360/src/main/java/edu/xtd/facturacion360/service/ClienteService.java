package edu.xtd.facturacion360.service;

import java.util.List;
import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;


/**
 * Definimos las operaciones que se pueden realizar con Clientes
 * en nuestra app
 */
public interface ClienteService {

	/**
	 * Devuelve los últimos clientes dados de alta (los de id más alto primero).
	 *
	 * @param limite cuántos clientes devolver
	 * @return la lista de clientes (dominio); vacía si no hay ninguno, nunca {@code null}
	 */
	public List<Cliente> listarUltimos(int limite);

	/**
	 * Devuelve una página de clientes junto con sus metadatos de paginación.
	 *
	 * @param pagina índice de la página empezando en 0
	 * @param tamano cuántos clientes por página
	 * @return un {@link PaginaClienteResponse} con el contenido de la página y los metadatos
	 *         (total de páginas, si hay anterior/siguiente, etc.)
	 */
	public PaginaClienteResponse listarPagina(int pagina, int tamano);

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

	public List<ClienteResponse> buscar(String nif_ocif);

}
