package edu.xtd.facturacion360.repository;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import edu.xtd.facturacion360.dto.Cliente;

@Repository
public class ClienteRepositoryJdbcImpl implements ClienteRepository {

	private static final Logger log = LoggerFactory.getLogger(ClienteRepositoryJdbcImpl.class);

	// con este objeto, accedemos a base de datos (ejecuta el SQL contra MySQL)
	@Autowired
	JdbcTemplate jdbcTemplate;


	// convierte cada fila del ResultSet en un objeto Cliente (lo usa jdbcTemplate.query)



	private static final String INSERTAR_CLIENTE = """
			INSERT INTO clientes (nombre, nif_cif, direccion, codigopostal, poblacion, provincia, telefono, email, fecha_alta)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
			""";

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
	public List<Cliente> findPagina(int tamano, int offset) {
		// Igual que findUltimos pero con dos '?': LIMIT ? (cuántas filas) y OFFSET ? (cuántas
		// saltar). Se sustituyen en orden -> primero 'tamano', luego 'offset'. Así traemos solo
		// la página pedida, no todos los clientes.
		String sql = "SELECT idcliente, nombre, nif_cif, direccion, codigopostal, poblacion, "
				+ "provincia, telefono, email, fecha_alta "
				+ "FROM clientes ORDER BY idcliente DESC LIMIT ? OFFSET ?";
		List<Cliente> clientes = jdbcTemplate.query(sql, clienteRowMapper, tamano, offset);
		log.debug("findPagina(tamano={}, offset={}) -> {} filas", tamano, offset, clientes.size());
		return clientes;
	}

	@Override
	public long contarTotal() {
		// queryForObject: para un SELECT que devuelve UN SOLO valor (aquí el nº total de filas).
		// Le decimos el tipo esperado (Long.class) para que lo convierta por nosotros.
		Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM clientes", Long.class);
		return total != null ? total : 0L;
	}

	@Override
	public Optional<Cliente> findById(int id) {
		// TODO Auto-generated method stub
		return Optional.empty();
	}

	/**
	 * Inserta un cliente en base de datos.
	 * @throws SQLException 
	 */
	@Override
	public Cliente insert(Cliente cliente)  {
		
		Cliente clienteInsertado = null;

	    KeyHolder keyHolder = new GeneratedKeyHolder();
	    LocalDate fechaAlta = LocalDate.now();

	    int numFilasAfectadas = jdbcTemplate.update(connection -> {

	       PreparedStatement ps = connection.prepareStatement(
	                INSERTAR_CLIENTE,
	                Statement.RETURN_GENERATED_KEYS
	        );

	        ps.setString(1, cliente.nombre());
	        ps.setString(2, cliente.nifCif());
	        ps.setString(3, cliente.direccion());
	        ps.setString(4, cliente.codigoPostal());
	        ps.setString(5, cliente.poblacion());
	        ps.setString(6, cliente.provincia());
	        ps.setString(7, cliente.telefono());
	        ps.setString(8, cliente.email());
	        ps.setDate(9, Date.valueOf(fechaAlta));

	        return ps;

	    }, keyHolder);

	    
	    if (numFilasAfectadas == 1) 
	    {
	    		
	    	int idCliente = keyHolder.getKey().intValue();
		    clienteInsertado = new Cliente(
		            idCliente,
		            cliente.nombre(),
		            cliente.nifCif(),
		            cliente.direccion(),
		            cliente.codigoPostal(),
		            cliente.poblacion(),
		            cliente.provincia(),
		            cliente.telefono(),
		            cliente.email(),
		            fechaAlta
		    );
	    }

	    
	    return clienteInsertado;
	}

	@Override
	public boolean update(Cliente cliente) {

	    // Sentencia SQL que actualiza los datos de un cliente.
	    // Solo se modifican los campos editables; la fecha de alta se mantiene.
	    String sql = """
	        UPDATE clientes
	        SET nombre = ?,
	            nif_cif = ?,
	            direccion = ?,
	            codigopostal = ?,
	            poblacion = ?,
	            provincia = ?,
	            telefono = ?,
	            email = ?
	        WHERE idcliente = ?
	        """;

	    // Ejecutamos la sentencia SQL utilizando JdbcTemplate.
	    // Cada '?' de la consulta se sustituye por el valor correspondiente
	    // del objeto Cliente.
	    int filas = jdbcTemplate.update(
	            sql,
	            cliente.nombre(),
	            cliente.nifCif(),
	            cliente.direccion(),
	            cliente.codigoPostal(),
	            cliente.poblacion(),
	            cliente.provincia(),
	            cliente.telefono(),
	            cliente.email(),
	            cliente.idCliente()
	    );

	    // Si se ha modificado al menos una fila, devolvemos true.
	    // Si no se ha modificado ninguna, devolvemos false.
	    return filas > 0;
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
