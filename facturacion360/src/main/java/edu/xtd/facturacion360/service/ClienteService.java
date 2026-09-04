package edu.xtd.facturacion360.service;

import java.util.List;

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
	 * Devuelve los últimos clientes dados de alta.
	 *
	 * @param limite número máximo de clientes a devolver.
	 * @return lista de clientes.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	List<Cliente> listarUltimos(int limite);

	/**
	 * Devuelve una página de clientes aplicando búsqueda, filtros y ordenación.
	 *
	 * @param criterios criterios de búsqueda y paginación.
	 * @return página de clientes con metadatos.
	 * @throws DataAccessException si ocurre un error al acceder a la base de datos.
	 */
	PaginaClienteResponse listarPagina(CriteriosCliente criterios);

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
