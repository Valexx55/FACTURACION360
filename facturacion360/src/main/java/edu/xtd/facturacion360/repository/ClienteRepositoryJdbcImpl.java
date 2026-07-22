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

	ClienteRowMapper clienteRowMapper = new ClienteRowMapper();

	private static final String INSERTAR_CLIENTE = """
			INSERT INTO clientes (nombre, nif_cif, direccion, codigopostal, poblacion, provincia, telefono, email, fecha_alta)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
			""";

	@Override
	public List<Cliente> findUltimos(int limite) {
		// TODO Auto-generated method stub
		return null;
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
		// TODO Auto-generated method stub
		return false;
	}

	@Override
	public boolean deleteById(int id) {
		// TODO Auto-generated method stub
		return false;
	}

}
