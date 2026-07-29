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
	 * Devuelve una página de clientes junto con sus metadatos de paginación,
	 * aplicando los filtros y la ordenación pedidos.
	 *
	 * @param pagina    índice de la página empezando en 0
	 * @param tamano    cuántos clientes por página
	 * @param provincia filtro por provincia; null o vacío = no filtrar
	 * @param poblacion filtro por población; null o vacío = no filtrar
	 * @param orden     criterio de ordenación (recientes, antiguos, nombre_az, nombre_za)
	 * @return un {@link PaginaClienteResponse} con el contenido de la página y los metadatos
	 *         (total de páginas, si hay anterior/siguiente, etc.)
	 */
	public PaginaClienteResponse listarPagina(int pagina, int tamano, String provincia, String poblacion, String orden);

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

	/**
	 * Busca clientes por nombre o NIF/CIF (coincidencia parcial), aplicando los
	 * filtros y la ordenación pedidos.
	 *
	 * @param busqueda  término a buscar en nombre y nif_cif
	 * @param provincia filtro por provincia; null o vacío = no filtrar
	 * @param poblacion filtro por población; null o vacío = no filtrar
	 * @param orden     criterio de ordenación (recientes, antiguos, nombre_az, nombre_za)
	 * @return la lista de clientes que coinciden; vacía si no hay ninguno
	 */
	public List<ClienteResponse> buscar(String busqueda, String provincia, String poblacion, String orden);

}
