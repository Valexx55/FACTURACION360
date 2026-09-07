package edu.xtd.facturacion360.service;

import java.util.List;
<<<<<<< HEAD

import org.springframework.dao.DataAccessException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.repository.ClienteRepository;
=======
>>>>>>> origin/master

import org.springframework.dao.DataAccessException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.repository.ClienteRepository;

/**
 * Define las operaciones de negocio disponibles para la gestión de clientes.
 *
 * El Service actúa como intermediario entre el Controller y el Repository,
 * aplicando la lógica de negocio necesaria antes de acceder a la base de datos.
 */
public interface ClienteService {

	/**
<<<<<<< HEAD
	 * Los últimos clientes dados de alta (los de id más alto primero). Listado simple, sin
	 * búsqueda ni filtros: para eso está {@link #listarPagina(CriteriosCliente)}.
	 *
	 * @param limite cuántos clientes devolver
	 * @return la lista de clientes (dominio); vacía si no hay ninguno, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #listarPagina(CriteriosCliente)
	 * @see ClienteRepository#findUltimos(int)
=======
	 * Devuelve los últimos clientes dados de alta.
	 *
	 * @param limite número máximo de clientes a devolver.
	 * @return lista de clientes.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
>>>>>>> origin/master
	 */
	List<Cliente> listarUltimos(int limite);

	/**
<<<<<<< HEAD
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

	public Cliente obtenerPorId(int id);
=======
	 * Devuelve una página de clientes aplicando búsqueda, filtros y ordenación.
	 *
	 * @param criterios criterios de búsqueda y paginación.
	 * @return página de clientes con metadatos.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	PaginaClienteResponse listarPagina(CriteriosCliente criterios);
>>>>>>> origin/master

	/**
	 * Obtiene todas las provincias disponibles.
	 *
	 * @return lista de provincias.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	List<String> listarProvincias();

	/**
	 * Obtiene todas las poblaciones de una provincia.
	 *
	 * @param provincia provincia de la que se desean obtener las poblaciones.
	 * @return lista de poblaciones.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	List<String> listarPoblaciones(String provincia);

	/**
	 * Obtiene un cliente por su identificador.
	 *
	 * @param id identificador del cliente.
	 * @return cliente encontrado.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	Cliente obtenerPorId(int id);

	/**
	 * Crea un nuevo cliente.
	 *
	 * @param cliente cliente a crear.
	 * @return cliente creado.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	Cliente crear(Cliente cliente);

	/**
	 * Actualiza un cliente existente.
	 *
	 * @param id identificador del cliente.
	 * @param cliente datos actualizados.
	 * @return cliente actualizado.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	Cliente actualizar(int id, Cliente cliente);

	/**
	 * Elimina un cliente por su identificador.
	 *
	 * Antes de eliminarlo, la implementación comprobará que el cliente exista.
	 * Si no existe, lanzará la excepción correspondiente para que el Controller
	 * pueda devolver un HTTP 404.
	 *
	 * @param id identificador del cliente.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	void eliminar(int id);

}
