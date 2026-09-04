package edu.xtd.facturacion360.controller;


import java.util.List;
import java.sql.SQLIntegrityConstraintViolationException;
import edu.xtd.facturacion360.dto.ApiResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.TransactionException;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteRequest;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.dto.CriteriosCliente;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.service.ClienteService;
import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.Hidden;

/**
 * 
 * 
 * Recibe las peticiones HTTP relativas a los clientes y devuelve su respuesta.
 * 
 * 
 * MÉTODO HTTP - OPERACIÓN LÓGICA - OPERACIÓN SQL
 * 
 * GET - LEER - SELECT POST - CREAR - INSERT PUT - MODIFICAR - UPDATE DELETE -
 * BORRAR - DELETE
 * 
 * 
 */
@Tag(name = "Clientes", description = "Operaciones para consultar, crear, actualizar y eliminar clientes")

@CrossOrigin(originPatterns = {"marca.com"}, methods = {RequestMethod.PUT, RequestMethod.POST, RequestMethod.GET})
@RestController
@RequestMapping("/cliente")
public class ClienteController {

	private static final Logger log = LoggerFactory.getLogger(ClienteController.class);

	// Los usa listarUltimos para acotar su parámetro 'limite'. El listado paginado ya no
	// los necesita: sus topes viven en CriteriosCliente, junto a los datos que acotan.
	private static final int LIMITE_MIN = 1;
	private static final int LIMITE_MAX = 100;

	@Autowired
	ClienteService clienteService;

	@Autowired
	ClienteMapper clienteMapper;

	/**
	 * Devuelve los últimos clientes dados de alta (por defecto 10) como JSON.
	 * Ejemplo de uso: {@code GET /cliente/listar-ultimos?limite=25}
	 *
	 * @param limite cuántos clientes devolver; llega por la URL (?limite=). Si no
	 *               se manda, vale 10 (defaultValue). Se acota internamente al
	 *               rango [1, 100].
	 * @return {@code 200 OK} con la lista de {@link ClienteResponse}; o {@code 500}
	 *         si falla la BD.
	 * @autor AngelDanielC0des
	 * @see #listarPagina(CriteriosCliente)
	 */
	@Operation(summary = "Lista los últimos clientes", description = "Devuelve los clientes más recientes. El límite se ajusta automáticamente al intervalo entre 1 y 100.")
	@ApiResponse(responseCode = "200", description = "Clientes recuperados correctamente")
	@GetMapping("/listar-ultimos")
	public ResponseEntity<List<ClienteResponse>> listarUltimos(
			@Parameter(description = "Número de clientes listados.", example = "10") @RequestParam(defaultValue = "10") int limite) {

		// 0) Validación: acotamos el valor pedido a [1, 100] para no saturar la BD
		// (si no mandan 'limite', llega 10 por el defaultValue).
		int limiteSeguro = Math.max(LIMITE_MIN, Math.min(LIMITE_MAX, limite));
		log.info("GET /cliente/listar-ultimos?limite={} (acotado a {})", limite, limiteSeguro);

		List<Cliente> ultimos = clienteService.listarUltimos(limiteSeguro);

		List<ClienteResponse> respuesta = ultimos.stream().map(clienteMapper::toResponse).toList();

		log.info("listar-ultimos devuelve {} clientes", respuesta.size());
		ResponseEntity<List<ClienteResponse>> respuestaHttp = ResponseEntity.ok(respuesta);

		return respuestaHttp;
	}

	/**
	 * Devuelve una PÁGINA de clientes (para la paginación de la tabla), con búsqueda,
	 * filtros y ordenación opcionales. No toca a {@link #listarUltimos(int)}; es un
	 * endpoint aparte. Ejemplo de uso:
	 * {@code GET /cliente/listar-pagina?pagina=0&tamano=10&busqueda=garcia&provincia=Valencia&ordenarPor=nombre&direccion=asc}
	 *
	 * Buscar es "listar con un filtro de texto más", por eso comparte endpoint con el
	 * listado: así la búsqueda hereda la paginación y los metadatos, y el frontend usa
	 * un único camino de código tanto si hay término de búsqueda como si no.
	 *
	 * @param criterios los parámetros de la URL (?pagina=, ?tamano=, ?busqueda=,
	 *                  ?provincia=, ?poblacion=, ?ordenarPor=, ?direccion=) que Spring
	 *                  agrupa en un {@link CriteriosCliente}. El propio record se
	 *                  encarga de acotarlos y limpiarlos, así que aquí llegan ya
	 *                  normalizados.
	 * @return {@code 200 OK} con un {@link PaginaClienteResponse} (los clientes de
	 *         la página + metadatos de paginación); {@code 400} si algún criterio
	 *         supera la longitud permitida; o {@code 500} si falla la BD.
	 * @autor AngelDanielC0des
	 * @see CriteriosCliente
	 * @see PaginaClienteResponse
	 */
	@Operation(summary = "Lista una página de clientes", description = "Devuelve una página de clientes con búsqueda por nombre o NIF/CIF, filtros por provincia y población, y ordenación por nombre o fecha de alta en ambos sentidos")
	@ApiResponses({ @ApiResponse(responseCode = "200", description = "Página recuperada correctamente"),
			@ApiResponse(responseCode = "400", description = "Algún criterio supera la longitud permitida"),
			@ApiResponse(responseCode = "500", description = "Error interno al consultar los clientes") })
	@GetMapping("/listar-pagina")
	public ResponseEntity<PaginaClienteResponse> listarPagina(@Valid @ModelAttribute CriteriosCliente criterios) {

		ResponseEntity<PaginaClienteResponse> respuestaHttp = null;

		// Ya no hace falta acotar nada aquí: el constructor compacto de CriteriosCliente
		// deja la página, el tamaño y los textos listos para usar. Por eso el log muestra
		// los valores YA normalizados, que son los que de verdad se van a consultar.
		log.info("GET /cliente/listar-pagina -> {}", criterios);

		try {
			// El service trae la página y ya calcula los metadatos (total, hayAnterior,
			// etc.).
			PaginaClienteResponse pagina = clienteService.listarPagina(criterios);
			respuestaHttp = ResponseEntity.ok(pagina);
		} catch (DataAccessException | TransactionException e) {
			// TransactionException aparte de DataAccessException porque NO son la misma
			// familia: al ser listarPagina transaccional, si la BD no responde el fallo
			// salta al ABRIR la transacción (CannotCreateTransactionException), antes de
			// lanzar ninguna consulta. Sin este segundo tipo, esa excepción se escaparía y
			// el cliente recibiría la página de error de Spring con la traza dentro, en vez
			// del 500 limpio que devuelven los demás endpoints.
			log.error("Error al listar la pagina de clientes", e);
			respuestaHttp = ResponseEntity.internalServerError().build();
		}

		return respuestaHttp;
	}

	/**
	 * Devuelve las provincias distintas que existen en la tabla, para rellenar el
	 * desplegable de filtro del frontend. Ejemplo de uso:
	 * {@code GET /cliente/provincias}
	 *
	 * @return {@code 200 OK} con la lista de provincias; o {@code 500} si falla la BD.
	 * @autor AngelDanielC0des
	 * @see #listarPoblaciones(String)
	 */
	@Operation(summary = "Lista las provincias", description = "Devuelve las provincias distintas de la tabla clientes, ordenadas alfabéticamente")
	@ApiResponse(responseCode = "200", description = "Provincias recuperadas correctamente")
	@GetMapping("/provincias")
	public ResponseEntity<List<String>> listarProvincias() {

		ResponseEntity<List<String>> respuestaHttp = null;
		log.info("GET /cliente/provincias");

		try {
			List<String> provincias = clienteService.listarProvincias();
			respuestaHttp = ResponseEntity.ok(provincias);
		} catch (DataAccessException e) {
			log.error("Error al listar las provincias", e);
			respuestaHttp = ResponseEntity.internalServerError().build();
		}

		return respuestaHttp;
	}

	/**
	 * Devuelve las poblaciones distintas que existen en la tabla, para el desplegable
	 * de filtro en cascada. Ejemplo de uso:
	 * {@code GET /cliente/poblaciones?provincia=Valencia}
	 *
	 * @param provincia si llega informada, solo las poblaciones de esa provincia;
	 *                  si no, todas. Opcional.
	 * @return {@code 200 OK} con la lista de poblaciones; o {@code 500} si falla la BD.
	 * @autor AngelDanielC0des
	 * @see #listarProvincias()
	 */
	@Operation(summary = "Lista las poblaciones", description = "Devuelve las poblaciones distintas de la tabla clientes; si se indica provincia, solo las de esa provincia")
	@ApiResponse(responseCode = "200", description = "Poblaciones recuperadas correctamente")
	@GetMapping("/poblaciones")
	public ResponseEntity<List<String>> listarPoblaciones(
			@Parameter(description = "Provincia por la que filtrar", example = "Valencia") @RequestParam(required = false) String provincia) {

		ResponseEntity<List<String>> respuestaHttp = null;
		log.info("GET /cliente/poblaciones?provincia={}", provincia);

		try {
			List<String> poblaciones = clienteService.listarPoblaciones(provincia);
			respuestaHttp = ResponseEntity.ok(poblaciones);
		} catch (DataAccessException e) {
			log.error("Error al listar las poblaciones", e);
			respuestaHttp = ResponseEntity.internalServerError().build();
		}

		return respuestaHttp;
	}

	@Hidden
	@GetMapping("/{id}")
	public ResponseEntity<ClienteResponse> obtenerPorId(@PathVariable int id) {

		ResponseEntity<ClienteResponse> respuesta = null;

		return respuesta;
	}

	/**
	 * Elimina un cliente identificado por su ID.
	 *
	 * Si el cliente existe y no tiene restricciones de integridad (por ejemplo,
	 * facturas asociadas), se elimina correctamente y se devuelve un HTTP 200.
	 *
	 * Si el cliente no existe se devuelve un HTTP 404.
	 *
	 * Si el cliente tiene registros asociados que impiden su eliminación,
	 * se devuelve un HTTP 409 (Conflict).
	 *
	 * Si ocurre cualquier otro error inesperado,
	 * se devuelve un HTTP 500.
	 *
	 * @param id identificador del cliente a eliminar.
	 * @return respuesta HTTP con el resultado de la operación.
	 */
	@Operation(
	        summary = "Elimina un cliente",
	        description = "Elimina el cliente identificado por su ID."
	)
	@ApiResponses({
	        @ApiResponse(responseCode = "200", description = "Cliente eliminado correctamente"),
	        @ApiResponse(responseCode = "404", description = "Cliente no encontrado"),
	        @ApiResponse(responseCode = "409", description = "El cliente tiene facturas asociadas"),
	        @ApiResponse(responseCode = "500", description = "Error interno del servidor")
	})
	
	@DeleteMapping("/{id}")
	public ResponseEntity<ApiResponseDto> eliminar(
	        @Parameter(description = "Identificador del cliente", example = "1")
	        @PathVariable int id) {


	    log.info("Petición DELETE recibida para eliminar el cliente con ID {}", id);

	    try {

	        // Delegamos la lógica de negocio al Service
	        clienteService.eliminar(id);


	        log.info("Cliente con ID {} eliminado correctamente.", id);

	        return ResponseEntity.ok(
	                new ApiResponseDto(
	                        true,
	                        "Cliente eliminado correctamente"
	                )
	        );

	    } catch (DataIntegrityViolationException e) {

	        log.error("No se puede eliminar el cliente {} porque tiene datos relacionados.", id, e);

	        return ResponseEntity.status(HttpStatus.CONFLICT)
	                .body(
	                        new ApiResponseDto(
	                                false,
	                                "No se puede eliminar el cliente porque tiene facturas asociadas."
	                        )
	                );

	    } catch (ResponseStatusException e) {

	        log.warn("No existe el cliente con ID {}.", id);

	        return ResponseEntity.status(e.getStatusCode())
	                .body(
	                        new ApiResponseDto(
	                                false,
	                                e.getReason()
	                        )
	                );

	    } catch (Exception e) {

	        log.error("Error inesperado eliminando el cliente {}.", id, e);

	        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
	                .body(
	                        new ApiResponseDto(
	                                false,
	                                "No se pudo eliminar el cliente."
	                        )
	                );
	    }
	}

	@PutMapping("/{id}")
	public ResponseEntity<ClienteResponse> actualizar(@PathVariable int id,
			@Valid @RequestBody ClienteRequest clienteRequest, BindingResult bindingResult) {

		ResponseEntity<ClienteResponse> respuesta = null;

		if (bindingResult.hasErrors()) {
			respuesta = ResponseEntity.badRequest().build();
		} else {
			Cliente cliente = clienteMapper.toDomain(clienteRequest);

			Cliente actualizado = clienteService.actualizar(id, cliente);

			if (actualizado == null) {
				respuesta = ResponseEntity.notFound().build();
			} else {
				ClienteResponse response = clienteMapper.toResponse(actualizado);

				respuesta = ResponseEntity.ok(response);
			}

		}

		return respuesta;
	}




}
