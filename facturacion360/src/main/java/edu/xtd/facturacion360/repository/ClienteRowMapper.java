package edu.xtd.facturacion360.repository;

import java.sql.ResultSet;
import java.sql.SQLException;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import edu.xtd.facturacion360.dto.Cliente;

/**
 * Esta clase, convierte un registro de la base de datos en un Cliente
 */
@Component
public class ClienteRowMapper implements RowMapper<Cliente>{

	/**
     * Construye un cliente con los valores de la fila actual.
     *
     * @param rs resultado de la consulta posicionado en la fila actual
     * @param rowNum número de la fila procesada
     * @return cliente construido con los valores obtenidos
     * @throws SQLException si no se puede leer alguna columna
     */
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
