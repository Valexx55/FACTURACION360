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
		// Convertimos cada columna de la fila en un campo del record Cliente.
		// OJO: en la tabla la columna se llama 'nombre_razon_social' (según el
		// ESQUEMA ER) y aquí la volcamos en el campo 'nombre' del record.
		// La columna 'pais' de la tabla no existe en el record, así que no se mapea.
		java.sql.Date fechaAlta = rs.getDate("fecha_alta");
		return new Cliente(
				rs.getInt("id_cliente"),
				rs.getString("nombre_razon_social"),
				rs.getString("nif_cif"),
				rs.getString("direccion"),
				rs.getString("codigo_postal"),
				rs.getString("poblacion"),
				rs.getString("provincia"),
				rs.getString("telefono"),
				rs.getString("email"),
				fechaAlta != null ? fechaAlta.toLocalDate() : null);
	}

}
