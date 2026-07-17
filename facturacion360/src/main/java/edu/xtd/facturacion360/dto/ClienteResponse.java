package edu.xtd.facturacion360.dto;

import java.time.LocalDate;

public record ClienteResponse(
		int idCliente, 
		String nombre,
		String nifCif,
		String direccion,
		String codigoPostal,
		String poblacion,
		String provincia,
		String telefono,
		String email,
		LocalDate fechaAlta) {

}
