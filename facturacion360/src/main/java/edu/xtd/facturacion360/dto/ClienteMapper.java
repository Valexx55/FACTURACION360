package edu.xtd.facturacion360.dto;

/**
 * Traduce entre los DTOs web de cliente y el modelo interno de la aplicación.
 */
public class ClienteMapper {

	/**
	 * Convierte una petición HTTP en un cliente de dominio pendiente de persistir.
	 */
	public Cliente toDomain(ClienteRequest clienteRequest) {
		Cliente cliente = null;
			
			cliente =  new Cliente(
					0,
					clienteRequest.nombre(),
					clienteRequest.nifCif(),
					clienteRequest.direccion(),
					clienteRequest.codigoPostal(),
					clienteRequest.poblacion(),
					clienteRequest.provincia(),
					clienteRequest.telefono(),
					clienteRequest.email(),
					null);
		
			System.out.println("ClienteRequest2Cliente "+ cliente);
		
		return cliente;
	}

	/**
	 * Convierte un cliente de dominio en el DTO expuesto por la API REST.
	 */
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
			System.out.println("Cliente2ClienteResponse " + clienteResponse);
		
		return clienteResponse;
	}
}
