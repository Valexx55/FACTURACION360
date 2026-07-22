package edu.xtd.facturacion360.controller;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
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

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteRequest;
import edu.xtd.facturacion360.dto.ClienteResponse;
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

	// Límites permitidos para el parámetro 'limite' (evita que pidan una
	// barbaridad).
	private static final int LIMITE_MIN = 1;
	private static final int LIMITE_MAX = 100;

	@Autowired
	ClienteService clienteService;

	Logger logger = LoggerFactory.getLogger(ClienteController.class);

	@Autowired
	ClienteMapper clienteMapper;

	@GetMapping("/listar-ultimos")
	public ResponseEntity<List<ClienteResponse>> listarUltimos(@RequestParam(defaultValue = "10") int limite) {

		// 0) Validación: acotamos el valor pedido a [1, 100] para no saturar la BD
		// (si no mandan 'limite', llega 10 por el defaultValue).
		int limiteSeguro = Math.max(LIMITE_MIN, Math.min(LIMITE_MAX, limite));

		// 1) Pedimos al service los últimos clientes (objetos de dominio).
		List<Cliente> ultimos = clienteService.listarUltimos(limiteSeguro);

		// 2) Los traducimos a ClienteResponse (lo que ve el navegador).
		List<ClienteResponse> respuesta = ultimos.stream().map(clienteMapper::toResponse).toList();

		// 3) 200 OK con la lista en el cuerpo.
		return ResponseEntity.ok(respuesta);
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

		this.clienteService.eliminar(id);
		respuesta = ResponseEntity.ok(null);

		return respuesta;
	}

}
