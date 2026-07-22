package edu.xtd.facturacion360.repository;

import java.sql.ResultSet;
import java.sql.SQLException;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import edu.xtd.facturacion360.dto.Cliente;

/**
 * Esta clase convierte un registro de la base de datos en un objeto Cliente.
 *
 * Con @Component, Spring crea automáticamente una instancia de esta clase
 * para poder utilizarla desde el repositorio.
 */
@Component
public class ClienteRowMapper implements RowMapper<Cliente> {

	@Override
	public Cliente mapRow(ResultSet rs, int rowNum) throws SQLException {
		// Convertimos cada columna de la fila en un campo del record Cliente.
		
		java.sql.Date fechaAlta = rs.getDate("fecha_alta");
		return new Cliente(
				rs.getInt("idcliente"),
				rs.getString("nombre"),
				rs.getString("nif_cif"),
				rs.getString("direccion"),
				rs.getString("codigopostal"),
				rs.getString("poblacion"),
				rs.getString("provincia"),
				rs.getString("telefono"),
				rs.getString("email"),
				fechaAlta != null ? fechaAlta.toLocalDate() : null);
	}

}