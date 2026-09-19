package edu.xtd.facturacion360.dto;


import org.springframework.stereotype.Component;

/**
 * Traduce entre los distintos objetos de Cliente.
 * Con @Component Spring lo crea y lo inyecta donde haga falta (p. ej. en el controller).
 */
@Component
public class ClienteMapper {

	// OJO al construir el Cliente: el id queda a 0 y la fecha de alta a null, porque el
	// ClienteRequest no trae ninguno de los dos (el id viaja en la URL y la fecha es un dato
	// histórico que no se edita). Quien llame a este método tiene que poner los dos por su
	// cuenta: en actualizar(), propagar ese 0 lanzaría el UPDATE con "WHERE idcliente = 0" y
	// copiar ese null borraría la fecha de la respuesta.
	//
	// Esto estuvo fijado con pruebas en ClienteServiceImplTest, que se perdió en el merge
	// f706594 del 14/09 junto con las otras tres clases de prueba de clientes. Hoy no hay
	// nada que lo sujete: si alguien cambia este método, la única defensa es este aviso.
	public Cliente toDomain(ClienteRequest clienteRequest) {
		Cliente cliente = null;
			
			cliente =  new Cliente(
					0,
					clienteRequest.nombre(),
					normalizar(clienteRequest.nifCif()),
					clienteRequest.direccion(),
					clienteRequest.codigoPostal(),
					limpiarTexto(clienteRequest.poblacion()),
					limpiarTexto(clienteRequest.provincia()),
					clienteRequest.telefono(),
					clienteRequest.email(),
					null);
		
			System.out.println("ClienteRequest2Cliente "+ cliente);
		
		return cliente;
	}


	
	/**
	 * Convierte el {@link Cliente} de dominio (lo que sale de la BD) en un {@link ClienteResponse}
	 * (lo que viaja al navegador como JSON). Tener un DTO de salida separado desacopla la entidad
	 * interna del contrato con el frontend: podemos cambiar el modelo por dentro sin romper la API.
	 *
	 * @param cliente el cliente de dominio a convertir; puede ser {@code null}
	 * @return el {@link ClienteResponse} equivalente, o {@code null} si {@code cliente} es null
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

		return clienteResponse;
	}

	/**
	 * Deja el documento en mayúsculas y sin espacios de los lados.
	 *
	 * El validador acepta "12345678z" porque obligar a pulsar mayúsculas para teclear un NIF
	 * es una molestia sin motivo, pero guardarlo así haría que la ficha lo enseñara en
	 * minúscula y que dos altas del mismo cliente se vieran distintas. El índice UNIQUE de
	 * nif_cif no se ve afectado —su collation ya ignora mayúsculas—, o sea que esto es
	 * cuestión de lo que se ve, no de integridad.
	 *
	 * @param documento lo que vino en la petición
	 * @return el mismo documento listo para guardar, o null si no venía
	 */
	/**
	 * Deja un nombre de lugar sin espacios sobrantes, respetando como se escribio.
	 *
	 * Se aplica a poblacion y provincia porque son las dos que alimentan los desplegables
	 * del filtro, que salen de un SELECT DISTINCT: un espacio de mas convierte «Madrid » en
	 * una provincia distinta de «Madrid», y las dos aparecen en la lista.
	 *
	 * <p>De las mayusculas NO se encarga esto, y es a proposito: la collation de la tabla es
	 * utf8mb4_0900_ai_ci, que ya compara ignorando mayusculas y acentos, asi que «madrid» y
	 * «Madrid» ya se agrupan solos. Lo que esas collations <b>no</b> ignoran es el espacio
	 * final —son NO PAD, al reves que las antiguas—, y por eso el trim si hace falta.</p>
	 *
	 * <p>Tampoco se pasa a mayusculas como en {@link #normalizar(String)}: ahi tiene sentido
	 * porque un NIF se escribe asi, pero una provincia en mayusculas quedaria gritando en la
	 * ficha y en el desplegable.</p>
	 *
	 * <p>No se aplica a nombre ni direccion aunque tambien podrian traer espacios: esos dos
	 * no se usan como clave de agrupacion ni de filtro, asi que un espacio de mas se ve feo
	 * pero no duplica nada. Si algun dia se filtra por ellos, tendran que pasar por aqui.</p>
	 *
	 * @param valor lo que vino en la peticion
	 * @return el mismo texto sin espacios en los extremos y sin repetirlos dentro, o null
	 */
	private static String limpiarTexto(String valor) {
		return valor == null ? null : valor.trim().replaceAll("\s+", " ");
	}

	private static String normalizar(String documento) {
		return documento == null ? null : documento.trim().toUpperCase();
	}

}
