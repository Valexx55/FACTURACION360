package edu.xtd.facturacion360.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import edu.xtd.facturacion360.dto.Cliente;

@Repository
public class ClienteRepositoryJdbcImpl implements ClienteRepository{
	
	//con este objeto, accedemos a base de datos
	@Autowired
	JdbcTemplate jdbcTemplate;
	
	@Autowired
	ClienteRowMapper clienteRowMapper;


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
		// TODO Auto-generated method stub
		return false;
	}

}
