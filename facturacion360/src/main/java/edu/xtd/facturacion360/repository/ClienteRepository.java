package edu.xtd.facturacion360.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataAccessException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;

/**
 * Contrato de acceso a datos para la entidad Cliente.
 *
 * Esta interfaz define todas las operaciones de persistencia disponibles
 * sobre la tabla clientes.
 *
 * La implementación se realiza mediante JdbcTemplate en
 * {@link ClienteRepositoryJdbcImpl}.
 */
public interface ClienteRepository {

    /**
     * Devuelve los últimos clientes registrados.
     */
    List<Cliente> findUltimos(int limite);

    /**
     * Devuelve una página de clientes aplicando filtros y ordenación.
     */
    List<Cliente> findPagina(CriteriosCliente criterios);

    /**
     * Cuenta el total de clientes que cumplen unos criterios.
     */
    long contarTotal(CriteriosCliente criterios);

    /**
     * Devuelve todas las provincias existentes.
     */
    List<String> findProvincias();

    /**
     * Devuelve las poblaciones pertenecientes a una provincia.
     */
    List<String> findPoblaciones(String provincia);

    /**
     * Busca un cliente por su identificador.
     *
     * @param id Identificador del cliente.
     * @return Optional con el cliente encontrado o vacío si no existe.
     * @throws DataAccessException si ocurre un error al acceder a la base de datos.
     */
    Optional<Cliente> findById(int id);

    /**
     * Inserta un nuevo cliente.
     *
     * @param cliente Cliente a insertar.
     * @return Cliente insertado con su identificador generado.
     * @throws DataAccessException si ocurre un error al acceder a la base de datos.
     */
    Cliente insert(Cliente cliente);

    /**
     * Actualiza un cliente existente.
     *
     * @param cliente Cliente con la información actualizada.
     * @return true si se actualizó correctamente.
     */
    boolean update(Cliente cliente);

    /**
     * Elimina un cliente por su identificador.
     *
     * @param id Identificador del cliente.
     * @return true si el cliente se eliminó correctamente;
     *         false si no existía.
     */
    boolean deleteById(int id);

}


