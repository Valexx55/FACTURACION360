package edu.xtd.facturacion360.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Datos que puede enviar un cliente HTTP para crear o actualizar un cliente.
 */
public record ClienteRequest(
	// nombre
		@NotBlank(message = "El nombre es obligatorio")
		@Size(max = 60, message = "El nombre no puede superar 60 caracteres")
		String nombre,
	// NIF/CIF
		@NotBlank(message = "El NIF/CIF es obligatorio")
		@Size(max = 10, message = "El NIF/CIF no puede superar 10 caracteres")
		String nifCif,
	// dirección
		@NotBlank(message = "La dirección es obligatoria")
		@Size(max = 90, message = "La dirección no puede superar 90 caracteres")
		String direccion,
	// código postal
		@Size(max = 6, message = "El código postal no puede superar 6 caracteres")
		String codigoPostal,
	// población
		@NotBlank(message = "La población es obligatoria")
		@Size(max = 30, message = "La población no puede superar 30 caracteres")
		String poblacion,
	// provincia
		@NotBlank(message = "La provincia es obligatoria")
		@Size(max = 15, message = "La provincia no puede superar 15 caracteres")
		String provincia,
	// teléfono
		@Size(max = 15, message = "El teléfono no puede superar 15 caracteres")
		String telefono,
	// email
		@Email(message = "El email debe tener un formato válido")
		@Size(max = 30, message = "El email no puede superar 30 caracteres")
		String email) {

}
