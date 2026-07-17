package edu.xtd.facturacion360.repository;

import java.sql.ResultSet;
import java.sql.SQLException;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import edu.xtd.facturacion360.dto.Cliente;

/**
 * Esta clase, convierte un registro de la base de datos en un Cliente
 * 
 * Con @Component, Spring creará una instancia de esta clase de manera 
 * automática. Hará new ClienteRowMapper (). Inversión de Control IOC
 */
@Component
public class ClienteRowMapper implements RowMapper<Cliente>{

	@Override
	public Cliente mapRow(ResultSet rs, int rowNum) throws SQLException {
		// TODO Auto-generated method stub
		return null;
	}

}
