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

	// con este objeto, accedemos a base de datos
	@Autowired
	JdbcTemplate jdbcTemplate;

	@Autowired
	ClienteRowMapper clienteRowMapper;

	@Override
	public List<Cliente> findUltimos(int limite) {
		// SQL: los 'limite' clientes con idcliente más alto (= dados de alta más
		// recientemente). El ORDER BY y el LIMIT los resuelve la BASE DE DATOS, no Java,
		// así que es eficiente aunque haya miles de filas. El '?' es un parámetro que
		// Spring sustituye por 'limite' de forma segura (evita inyección SQL).
		String sql = "SELECT idcliente, nombre, nif_cif, direccion, codigopostal, "
				+ "poblacion, provincia, telefono, email, fecha_alta "
				+ "FROM clientes ORDER BY idcliente DESC LIMIT ?";

		// jdbcTemplate.query ejecuta el SELECT y usa clienteRowMapper para convertir
		// cada fila del ResultSet en un objeto Cliente. Guardamos la lista en una
		// variable para poder loguearla antes de devolverla.
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
