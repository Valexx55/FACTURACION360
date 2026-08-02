package edu.xtd.facturacion360.service;

import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataAccessException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.repository.ClienteRepository;


/**
 * Definimos las operaciones que se pueden realizar con Clientes
 * en nuestra app
 */
public interface ClienteService {

	/**
	 * Los últimos clientes dados de alta (los de id más alto primero). Listado simple, sin
	 * búsqueda ni filtros: para eso está {@link #listarPagina(CriteriosCliente)}.
	 *
	 * @param limite cuántos clientes devolver
	 * @return la lista de clientes (dominio); vacía si no hay ninguno, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #listarPagina(CriteriosCliente)
	 * @see ClienteRepository#findUltimos(int)
	 */
	public List<Cliente> listarUltimos(int limite);

	/**
	 * Una página de clientes junto con sus metadatos de paginación, aplicando la búsqueda,
	 * los filtros y la ordenación pedidos.
	 *
	 * <p>Es el único punto de entrada del listado: buscar es "listar con un filtro de texto
	 * más", así que la búsqueda hereda la paginación y los metadatos.</p>
	 *
	 * <p>Las filas y el total se leen en una <strong>transacción de solo lectura</strong>,
	 * para que no puedan descuadrar si alguien escribe entre ambas consultas.</p>
	 *
	 * @param criterios qué página, de qué tamaño, qué buscar, por qué filtrar y cómo
	 *                  ordenar; llegan ya normalizados por el propio record y no debe ser
	 *                  {@code null}
	 * @return el contenido de la página y sus metadatos (total de páginas, si hay anterior
	 *         o siguiente, etc.)
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see CriteriosCliente
	 * @see PaginaClienteResponse
	 * @see ClienteRepository#findPagina(CriteriosCliente)
	 * @see ClienteRepository#contarTotal(CriteriosCliente)
	 */
	public PaginaClienteResponse listarPagina(CriteriosCliente criterios);

	/**
	 * Las provincias distintas de la tabla, ordenadas alfabéticamente y descartando nulos y
	 * cadenas vacías. Rellena el desplegable de filtro.
	 *
	 * @return la lista de provincias; vacía si no hay, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #listarPoblaciones(String)
	 * @see ClienteRepository#findProvincias()
	 */
	public List<String> listarProvincias();

	/**
	 * Las poblaciones distintas de la tabla, ordenadas alfabéticamente y descartando nulos y
	 * cadenas vacías. Rellena el desplegable en cascada.
	 *
	 * @param provincia si llega informada, solo las de esa provincia; {@code null} o vacío
	 *                  = todas
	 * @return la lista de poblaciones; vacía si no hay, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #listarProvincias()
	 * @see ClienteRepository#findPoblaciones(String)
	 */
	public List<String> listarPoblaciones(String provincia);

	/**
	 * El detalle completo de un cliente. Lo usa la tabla del frontend al desplegar una fila,
	 * para mostrar los campos que no caben en el listado, y la edición, para partir de lo que
	 * hay ahora mismo en la base de datos y no de una copia vieja de la pantalla.
	 *
	 * <p>Devuelve un {@link Optional} y no {@code null} porque "ese cliente no existe" es un
	 * resultado normal (acaba en un 404), no un error: así el controller lo resuelve con un
	 * {@code if} y no hay forma de olvidarse de comprobarlo.</p>
	 *
	 * @param id identificador del cliente que se busca
	 * @return el cliente (dominio), o un {@code Optional} vacío si no existe
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see ClienteRepository#findById(int)
	 */
	public Optional<Cliente> obtenerPorId(int id);

	/**
	 * Crea un cliente nuevo en el sistema.
	 *
	 * @param cliente datos del cliente que se va a crear
	 * @return true si el cliente se crea correctamente; false en caso contrario
	 */
	public Cliente crear(Cliente cliente);

	/**
	 * Modifica los datos de un cliente que ya existe.
	 *
	 * <p>La fecha de alta no forma parte de lo editable: se conserva la que hay en la base de
	 * datos, porque es un dato histórico y el {@code ClienteRequest} ni siquiera la trae.</p>
	 *
	 * <p>La comprobación de existencia y la escritura van en la misma transacción, para que
	 * entre las dos no pueda colarse un borrado de otro usuario.</p>
	 *
	 * @param id      identificador del cliente que se modifica
	 * @param cliente los datos nuevos; su id y su fecha de alta se ignoran
	 * @return el cliente ya actualizado (con su fecha de alta original), o {@code null} si no
	 *         existe ningún cliente con ese id
	 * @throws DataAccessException si falla el acceso a la base de datos, incluida la violación
	 *                             del índice único de {@code nif_cif}
	 *                             ({@code DuplicateKeyException})
	 * @autor AngelDanielC0des
	 * @see ClienteRepository#update(Cliente)
	 */
	public Cliente actualizar(int id, Cliente cliente);

	public void eliminar(int id);

}
