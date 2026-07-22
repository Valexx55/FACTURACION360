package edu.xtd.facturacion360.controller;

import java.sql.SQLIntegrityConstraintViolationException;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteRequest;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.service.ClienteService;
import jakarta.validation.Valid;

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

@RestController
@RequestMapping("/cliente")
public class ClienteController {


	private static final Logger log = LoggerFactory.getLogger(ClienteController.class);

	
	private static final int LIMITE_MIN = 1;
	private static final int LIMITE_MAX = 100;

	@Autowired
	ClienteService clienteService;

	Logger logger = LoggerFactory.getLogger(ClienteController.class);

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
	 */
	@GetMapping("/listar-ultimos")
	public ResponseEntity<List<ClienteResponse>> listarUltimos(@RequestParam(defaultValue = "10") int limite) {

		// Declaramos la respuesta al inicio y hacemos UN solo return al final: así la
		// rellenamos en el try (éxito) o en el catch (error) según cómo vaya la
		// operación.
		ResponseEntity<List<ClienteResponse>> respuestaHttp = null;

		// 0) Validación: acotamos el valor pedido a [1, 100] para no saturar la BD
		// (si no mandan 'limite', llega 10 por el defaultValue).
		int limiteSeguro = Math.max(LIMITE_MIN, Math.min(LIMITE_MAX, limite));
		log.info("GET /cliente/listar-ultimos?limite={} (acotado a {})", limite, limiteSeguro);

		try {
			List<Cliente> ultimos = clienteService.listarUltimos(limiteSeguro);

			List<ClienteResponse> respuesta = ultimos.stream().map(clienteMapper::toResponse).toList();

			log.info("listar-ultimos devuelve {} clientes", respuesta.size());
			respuestaHttp = ResponseEntity.ok(respuesta);
		} catch (DataAccessException e) {

			log.error("Error al listar los ultimos clientes", e);
			respuestaHttp = ResponseEntity.internalServerError().build();
		}

		return respuestaHttp;
	}

	/**
	 * Devuelve una PÁGINA de clientes (para la paginación de la tabla). No toca a
	 * {@link #listarUltimos(int)}; es un endpoint aparte. Ejemplo de uso:
	 * {@code GET /cliente/listar-pagina?pagina=0&tamano=10}
	 *
	 * @param pagina índice de la página empezando en 0; llega por la URL
	 *               (?pagina=). Por defecto 0. Se fuerza a no ser negativo.
	 * @param tamano cuántos clientes por página; llega por la URL (?tamano=). Por
	 *               defecto 10. Se acota al rango [1, 100].
	 * @return {@code 200 OK} con un {@link PaginaClienteResponse} (los clientes de
	 *         la página + metadatos de paginación); o {@code 500} si falla la BD.
	 */
	@GetMapping("/listar-pagina")
	public ResponseEntity<PaginaClienteResponse> listarPagina(@RequestParam(defaultValue = "0") int pagina,
			@RequestParam(defaultValue = "10") int tamano) {

		ResponseEntity<PaginaClienteResponse> respuestaHttp = null;

		// Validación: la página no puede ser negativa y el tamaño lo acotamos a [1,
		// 100]
		// (evita OFFSET raros o pedir demasiadas filas de golpe).
		int paginaSegura = Math.max(0, pagina);
		int tamanoSeguro = Math.max(LIMITE_MIN, Math.min(LIMITE_MAX, tamano));
		log.info("GET /cliente/listar-pagina?pagina={}&tamano={}", paginaSegura, tamanoSeguro);

		try {
			// El service trae la página y ya calcula los metadatos (total, hayAnterior,
			// etc.).
			PaginaClienteResponse pagina2 = clienteService.listarPagina(paginaSegura, tamanoSeguro);
			respuestaHttp = ResponseEntity.ok(pagina2);
		} catch (DataAccessException e) {
			log.error("Error al listar la pagina de clientes", e);
			respuestaHttp = ResponseEntity.internalServerError().build();
		}

		return respuestaHttp;
	}

	@GetMapping("/{id}")
	public ResponseEntity<ClienteResponse> obtenerPorId(@PathVariable int id) {

		ResponseEntity<ClienteResponse> respuesta = null;

		return respuesta;
	}

	/**
	 * Crea un cliente a partir de los datos recibidos. ClienteResponse contiene los
	 * datos que se devuelven en la respuesta HTTP.
	 *
	 * @Valid indica que se debe validar el objeto recibido según las anotaciones de
	 *        validación definidas en la clase ClienteRequest.
	 * @RequestBody indica que el objeto ClienteRequest se debe obtener del cuerpo
	 *              de la petición HTTP. ClienteRequest contiene los datos recibidos
	 *              en la petición HTTP. BindingResult contiene el resultado de la
	 *              validación, incluyendo errores si los hubiera.
	 *
	 *              Devuelve 201 si se crea el cliente, 400 si hay errores de
	 *              validación y 500 si no se consigue guardar.
	 */
	@PostMapping
	public ResponseEntity<ClienteResponse> crear(@Valid @RequestBody ClienteRequest clienteRequest,
			BindingResult bindingResult) {
		ResponseEntity<ClienteResponse> respuesta;
		ClienteResponse clienteResponse = null;

		if (bindingResult.hasErrors()) {
			logger.error("Cliente recibido con errores");
			respuesta = ResponseEntity.badRequest().build();
		} else {
			try {
				logger.debug("Cliente sin errores de validación");
				Cliente cliente = clienteMapper.toDomain(clienteRequest);
				Cliente clienteNuevo = clienteService.crear(cliente);

				logger.debug("Cliente creado correctamente " + clienteNuevo);
				clienteResponse = clienteMapper.toResponse(clienteNuevo);
				respuesta = ResponseEntity.status(HttpStatus.CREATED).body(clienteResponse);

			} catch (DuplicateKeyException e) {
				logger.error("NIF duplicado", e);
				respuesta = ResponseEntity.status(HttpStatus.CONFLICT).build();
			} catch (Exception e) {
				logger.error("Excepción creando cliente", e);
				respuesta = ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
			}
		}

		return respuesta;
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

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> eliminar(@PathVariable int id) {
		ResponseEntity<Void> respuesta = null;
		try {
			this.clienteService.eliminar(id);
			respuesta = ResponseEntity.ok(null);
		} catch (DataIntegrityViolationException e) {
			e.printStackTrace();
			System.err.println("Cliente con Facturas, no se puede borrar");
			respuesta = ResponseEntity.status(HttpStatus.CONFLICT).body(null);

		} catch (ResponseStatusException e) {
			
			e.printStackTrace();
			System.err.println("No se ha econtrado cliente con ese id, no se puede borrar");
			respuesta = ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);

		}

		return respuesta;
		
		/**
	     * Endpoint para manejar las peticiones HTTP DELETE (ej: DELETE /clientes/5).
	     * Se encarga de capturar las posibles excepciones de las capas inferiores 
	     * y traducirlas a códigos de estado HTTP (200 OK, 404 Not Found, 409 Conflict).
	     *
	     * @param id El ID que viene en la URL de la petición.
	     * @return Una respuesta HTTP (ResponseEntity) indicando el éxito o el tipo de error.
	     */
	}

}
