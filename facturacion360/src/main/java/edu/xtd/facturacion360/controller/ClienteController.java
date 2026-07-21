package edu.xtd.facturacion360.controller;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
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

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteRequest;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.service.ClienteService;
import jakarta.validation.Valid;

/**
 * En esta claes, recibimos las peticiones HTTP relativas a los clientes y le
 * devolvemos su correspondiente respuesta
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

	// Logger SLF4J: escribe al log configurado (logback-spring.xml), con niveles (INFO/ERROR).
	private static final Logger log = LoggerFactory.getLogger(ClienteController.class);

	// Límites permitidos para el parámetro 'limite' (evita que pidan una barbaridad).
	private static final int LIMITE_MIN = 1;
	private static final int LIMITE_MAX = 100;

	@Autowired
	ClienteService clienteService;

	@Autowired
	ClienteMapper clienteMapper;

	/**
	 * Devuelve los últimos clientes dados de alta (por defecto 10) como JSON.
	 * El número se puede pedir por la URL: /cliente/listar-ultimos?limite=25
	 */
	@GetMapping("/listar-ultimos")
	public ResponseEntity<List<ClienteResponse>> listarUltimos(
			@RequestParam(defaultValue = "10") int limite) {

		// Declaramos la respuesta al inicio y hacemos UN solo return al final: así la
		// rellenamos en el try (éxito) o en el catch (error) según cómo vaya la operación.
		ResponseEntity<List<ClienteResponse>> respuestaHttp = null;

		// 0) Validación: acotamos el valor pedido a [1, 100] para no saturar la BD
		//    (si no mandan 'limite', llega 10 por el defaultValue).
		int limiteSeguro = Math.max(LIMITE_MIN, Math.min(LIMITE_MAX, limite));
		log.info("GET /cliente/listar-ultimos?limite={} (acotado a {})", limite, limiteSeguro);

		try {
			// 1) Pedimos al service los últimos clientes (objetos de dominio).
			List<Cliente> ultimos = clienteService.listarUltimos(limiteSeguro);

			// 2) Los traducimos a ClienteResponse (lo que viaja al navegador).
			List<ClienteResponse> respuesta = ultimos.stream()
					.map(clienteMapper::toResponse)
					.toList();

			// 3) Todo bien: 200 OK con la lista en el cuerpo.
			log.info("listar-ultimos devuelve {} clientes", respuesta.size());
			respuestaHttp = ResponseEntity.ok(respuesta);
		} catch (DataAccessException e) {
			// 4) Fallo hablando con la BD: lo registramos en el log y devolvemos 500.
			log.error("Error al listar los ultimos clientes", e);
			respuestaHttp = ResponseEntity.internalServerError().build();
		}

		return respuestaHttp;
	}

	@GetMapping("/{id}")
	public ResponseEntity<ClienteResponse> obtenerPorId(@PathVariable int id) {

		ResponseEntity<ClienteResponse> respuesta = null;

		return respuesta;
	}

	@PostMapping
	public ResponseEntity<ClienteResponse> crear(@Valid @RequestBody ClienteRequest clienteRequest,
			BindingResult bindingResult) {
		ResponseEntity<ClienteResponse> respuesta = null;

		return respuesta;
	}

	@PutMapping("/{id}")
	public ResponseEntity<ClienteResponse> actualizar(@PathVariable int id,
			@Valid @RequestBody ClienteRequest clienteRequest, BindingResult bindingResult) {
		ResponseEntity<ClienteResponse> respuesta = null;

		return respuesta;
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> eliminar(@PathVariable int id) {
		ResponseEntity<Void> respuesta = null;

		this.clienteService.eliminar(id);
		respuesta = ResponseEntity.ok(null);

		return respuesta;
	}

}
