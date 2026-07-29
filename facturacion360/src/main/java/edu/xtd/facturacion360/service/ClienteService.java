package edu.xtd.facturacion360.service;

import java.util.List;
import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;
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
	 * Devuelve una página de clientes junto con sus metadatos de paginación,
	 * aplicando la búsqueda, los filtros y la ordenación pedidos.
	 *
	 * Es el único punto de entrada del listado: buscar es "listar con un filtro de
	 * texto más", así que la búsqueda hereda gratis la paginación y los metadatos.
	 *
	 * @param criterios qué página, de qué tamaño, qué buscar, por qué filtrar y cómo
	 *                  ordenar; llegan ya normalizados por el propio record
	 * @return un {@link PaginaClienteResponse} con el contenido de la página y los metadatos
	 *         (total de páginas, si hay anterior/siguiente, etc.)
	 */
	public PaginaClienteResponse listarPagina(CriteriosCliente criterios);

	/**
	 * Las provincias distintas de la tabla (para el desplegable de filtro).
	 *
	 * @return la lista de provincias; vacía si no hay, nunca {@code null}
	 */
	public List<String> listarProvincias();

	/**
	 * Las poblaciones distintas de la tabla (para el desplegable en cascada).
	 *
	 * @param provincia si llega informada, solo las de esa provincia; null o vacío = todas
	 * @return la lista de poblaciones; vacía si no hay, nunca {@code null}
	 */
	public List<String> listarPoblaciones(String provincia);

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
