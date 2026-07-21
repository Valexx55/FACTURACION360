package edu.xtd.facturacion360.dto;

import org.springframework.stereotype.Component;

/**
 * Traduce entre los distintos objetos de Cliente.
 * Con @Component Spring lo crea y lo inyecta donde haga falta (p. ej. en el controller).
 */
@Component
public class ClienteMapper {

	// toDomain (Request -> Cliente) lo necesitan crear/actualizar: lo dejará el compañero.
	public Cliente toDomain (ClienteRequest clienteRequest)
	{
		return null;
	}

	
	// Convierte el Cliente de dominio (lo que sale de la BD) en un ClienteResponse (lo que viaja
	// al navegador como JSON). Tener un DTO de salida separado desacopla la entidad interna del
	// contrato con el frontend: podemos cambiar el modelo por dentro sin romper la API.
	// Si 'cliente' es null (p. ej. no encontrado), devolvemos null en vez de reventar.
	public ClienteResponse toResponse (Cliente cliente)
	{
		ClienteResponse clienteResponse = null;

			if (cliente!=null)
			{
				clienteResponse = new ClienteResponse(
						cliente.idCliente(),
						cliente.nombre(),
						cliente.nifCif(),
						cliente.direccion(),
						cliente.codigoPostal(),
						cliente.poblacion(),
						cliente.provincia(),
						cliente.telefono(),
						cliente.email(),
						cliente.fechaAlta());
			}

		return clienteResponse;
	}
}
