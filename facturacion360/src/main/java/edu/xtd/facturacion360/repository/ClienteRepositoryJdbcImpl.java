package edu.xtd.facturacion360.repository;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import edu.xtd.facturacion360.dto.Cliente;

@Repository
public class ClienteRepositoryJdbcImpl implements ClienteRepository {

	// con este objeto, accedemos a base de datos
	@Autowired
	JdbcTemplate jdbcTemplate;



	private static final String INSERTAR_CLIENTE = """
			INSERT INTO clientes (nombre, nif_cif, direccion, codigopostal, poblacion, provincia, telefono, email, fecha_alta)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
			""";


	@Autowired
	ClienteRowMapper clienteRowMapper;


	@Override
	public List<Cliente> findUltimos(int limite) {
		// Los 'limite' clientes dados de alta más recientemente: id más alto primero.
		// El troceado (LIMIT) lo hace MySQL, no Java. El '?' evita inyección SQL.
		String sql = "SELECT idcliente, nombre, nif_cif, direccion, codigopostal, "
				+ "poblacion, provincia, telefono, email, fecha_alta "
				+ "FROM clientes ORDER BY idcliente DESC LIMIT ?";
		return jdbcTemplate.query(sql, clienteRowMapper, limite);
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
