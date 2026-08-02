package edu.xtd.facturacion360.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataAccessException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;

/**
 * Este interfaz recoge las operaciones sobre base de datos
 * que podemos hacer con los clientes
 * 
 */
public interface ClienteRepository {
	
	/**
	 * Los últimos clientes por id (el más alto primero). Es el listado simple: no admite
	 * búsqueda ni filtros, a diferencia de {@link #findPagina(CriteriosCliente)}.
	 *
	 * @param limite cuántas filas devolver ({@code LIMIT})
	 * @return la lista de clientes; vacía si no hay ninguno, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #findPagina(CriteriosCliente)
	 */
	public List<Cliente> findUltimos (int limite);

	/**
	 * Una página de clientes ({@code LIMIT ? OFFSET ?}), aplicando la búsqueda, los filtros
	 * y la ordenación que traigan los criterios. El offset sale de
	 * {@link CriteriosCliente#offset()}.
	 *
	 * @param criterios qué página, de qué tamaño, qué buscar, por qué filtrar y cómo
	 *                  ordenar; no debe ser {@code null}
	 * @return la lista de clientes de esa página; vacía si no hay, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #contarTotal(CriteriosCliente)
	 */
	public List<Cliente> findPagina (CriteriosCliente criterios);

	/**
	 * Cuenta los clientes que cumplen la búsqueda y los filtros, para saber cuántas páginas
	 * hay. Recibe los mismos criterios que {@link #findPagina(CriteriosCliente)} para que el
	 * total cuadre siempre con lo que se muestra; la paginación y la ordenación se ignoran,
	 * porque no cambian cuántos hay.
	 *
	 * @param criterios los mismos criterios con los que se pidió la página; no debe ser
	 *                  {@code null}
	 * @return el número total de clientes que cumplen los criterios
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #findPagina(CriteriosCliente)
	 */
	public long contarTotal (CriteriosCliente criterios);

	/**
	 * Las provincias distintas de la tabla, ordenadas alfabéticamente y descartando nulos y
	 * cadenas vacías. Sirve para rellenar el desplegable de filtro.
	 *
	 * @return la lista de provincias; vacía si no hay, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #findPoblaciones(String)
	 */
	public List<String> findProvincias ();

	/**
	 * Las poblaciones distintas de la tabla, ordenadas alfabéticamente y descartando nulos y
	 * cadenas vacías. Sirve para el desplegable de filtro en cascada.
	 *
	 * @param provincia si llega informada, solo las poblaciones de esa provincia;
	 *                  {@code null} o vacío = todas
	 * @return la lista de poblaciones; vacía si no hay, nunca {@code null}
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #findProvincias()
	 */
	public List<String> findPoblaciones (String provincia);

	/**
	 * Un cliente concreto por su identificador. Es el detalle completo: trae también los
	 * campos que el listado no muestra (dirección, código postal, población y provincia).
	 *
	 * @param id identificador del cliente que se busca
	 * @return el cliente envuelto en un {@link Optional}, o un {@code Optional} vacío si no
	 *         existe ninguno con ese id
	 * @throws DataAccessException si falla el acceso a la base de datos
	 * @autor AngelDanielC0des
	 * @see #findPagina(CriteriosCliente)
	 */
	public Optional<Cliente> findById (int id);
	
	/**
	 * Inserta un cliente nuevo en el almacenamiento persistente.
	 *
	 * @param cliente datos del cliente que se va a insertar
	 * @return true si se inserta correctamente; false en caso contrario
	 */
	public Cliente insert (Cliente cliente);
	
	/**
	 * Guarda los datos de un cliente que ya existe, identificándolo por su
	 * {@link Cliente#idCliente()}. No toca la fecha de alta: es un dato histórico y no forma
	 * parte de lo editable.
	 *
	 * <p><strong>Ojo con el valor devuelto:</strong> es el número de filas afectadas por el
	 * {@code UPDATE} traducido a booleano, y MySQL cuenta 0 filas cuando la sentencia no
	 * cambia ningún valor. Un {@code false} significa "no se ha modificado nada", que puede
	 * ser tanto que el cliente no exista como que se haya guardado igual que estaba: no sirve
	 * para distinguir esos dos casos. Quien necesite saber si existe debe comprobarlo con
	 * {@link #findById(int)}.</p>
	 *
	 * @param cliente los datos nuevos, con el id del cliente que se modifica
	 * @return {@code true} si la sentencia modificó alguna fila; {@code false} si no modificó
	 *         ninguna (ver la nota de arriba)
	 * @throws DataAccessException si falla el acceso a la base de datos; en particular
	 *                             {@code DuplicateKeyException} si el NIF/CIF ya es de otro
	 *                             cliente, porque la columna tiene un índice único
	 * @see #findById(int)
	 */
	public boolean update (Cliente cliente);
	
	public boolean deleteById (int id);

}
