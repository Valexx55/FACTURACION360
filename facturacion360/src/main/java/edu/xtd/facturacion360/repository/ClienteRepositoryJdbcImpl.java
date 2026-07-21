package edu.xtd.facturacion360.repository;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import edu.xtd.facturacion360.dto.Cliente;

@Repository
public class ClienteRepositoryJdbcImpl implements ClienteRepository {

	private static final Logger log = LoggerFactory.getLogger(ClienteRepositoryJdbcImpl.class);

	// con este objeto, accedemos a base de datos (ejecuta el SQL contra MySQL)
	@Autowired
	JdbcTemplate jdbcTemplate;

	// convierte cada fila del ResultSet en un objeto Cliente (lo usa jdbcTemplate.query)
	@Autowired
	ClienteRowMapper clienteRowMapper;

	@Override
	public List<Cliente> findUltimos(int limite) {
		// SQL de la consulta, explicado pieza a pieza:
		//  - ORDER BY idcliente DESC: 'idcliente' es AUTOINCREMENTAL, es decir, la BD le asigna
		//    un número mayor a cada cliente nuevo. Por eso ordenar de mayor a menor (DESC) equivale
		//    a ordenar del más reciente al más antiguo, SIN necesitar una columna de fecha.
		//  - LIMIT ?: de esa lista ya ordenada, nos quedamos solo con los primeros 'limite'. El
		//    troceado lo hace MySQL (no Java), así que es eficiente aunque la tabla tenga miles de filas.
		//  - El '?' es un PARÁMETRO (placeholder). JdbcTemplate lo ejecuta con un PreparedStatement:
		//    el valor de 'limite' viaja a la BD APARTE del texto SQL, así que NUNCA se interpreta
		//    como código. Eso evita la INYECCIÓN SQL: si en su lugar concatenáramos el valor dentro
		//    del String (" ... LIMIT " + limite), un valor malicioso podría "colar" SQL extra; con
		//    '?' es imposible porque el dato y la instrucción van por separado.
		String sql = "SELECT idcliente, nombre, nif_cif, direccion, codigopostal, "
				+ "poblacion, provincia, telefono, email, fecha_alta "
				+ "FROM clientes ORDER BY idcliente DESC LIMIT ?";

		// jdbcTemplate.query(sql, rowMapper, args...) es la sobrecarga para SELECT que devuelven
		// VARIAS filas. Lo que hace, en orden:
		//   1) ejecuta el 'sql';
		//   2) sustituye cada '?' por los 'args' que le pasamos, en orden (aquí solo 'limite'),
		//      de forma segura (PreparedStatement);
		//   3) aplica 'clienteRowMapper' a CADA fila del resultado para convertirla en un Cliente;
		//   4) devuelve un List<Cliente> con todos (lista VACÍA si no hay filas, nunca null).
		// (Para una única fila se usaría queryForObject(...); para INSERT/UPDATE/DELETE, update(...).)
		// Guardamos la lista en una variable para poder loguearla (y depurarla) antes del return.
		List<Cliente> clientes = jdbcTemplate.query(sql, clienteRowMapper, limite);
		log.debug("findUltimos({}) -> {} filas", limite, clientes.size());
		return clientes;
	}

	@Override
	public Optional<Cliente> findById(int id) {
		// TODO Auto-generated method stub
		return Optional.empty();
	}

	@Override
	public Cliente insert(Cliente cliente) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public boolean update(Cliente cliente) {
		// TODO Auto-generated method stub
		return false;
	}

	@Override
	public boolean deleteById(int id) {
		boolean borrarOk = false;
		String instruccionBorrar = "DELETE FROM clientes where idcliente = ?;";
		
			int filasborradas = jdbcTemplate.update(instruccionBorrar, id);
			if (filasborradas == 1) {
				borrarOk = true;
			}

		return borrarOk;
	}

}
