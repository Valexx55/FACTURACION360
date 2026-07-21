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
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
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
	 * Ejemplo de uso: {@code GET /cliente/listar-ultimos?limite=25}
	 *
	 * @param limite cuántos clientes devolver; llega por la URL (?limite=). Si no se manda, vale 10
	 *               (defaultValue). Se acota internamente al rango [1, 100].
	 * @return {@code 200 OK} con la lista de {@link ClienteResponse}; o {@code 500} si falla la BD.
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

			// 2) Traducimos la List<Cliente> (dominio) a List<ClienteResponse> (lo que viaja al
			//    navegador) usando la API de Streams de Java:
			//      - stream():  abre un "flujo" para recorrer la lista de forma declarativa.
			//      - map(fn):   aplica la función 'fn' a CADA elemento y produce uno nuevo.
			//      - clienteMapper::toResponse es una REFERENCIA A MÉTODO: atajo de la lambda
			//        (cliente) -> clienteMapper.toResponse(cliente).
			//      - toList():  recoge los resultados en una List<ClienteResponse> nueva.
			//
			//    Lo mismo SIN la referencia a método (::), con una lambda explícita:
			//        ultimos.stream().map(cliente -> clienteMapper.toResponse(cliente)).toList();
			//    Y SIN streams, con un bucle for de toda la vida:
			//        List<ClienteResponse> respuesta = new ArrayList<>();
			//        for (Cliente c : ultimos) { respuesta.add(clienteMapper.toResponse(c)); }
			//
			//    ¿Por qué preferimos '::' + streams?
			//      + Más corto y legible: se lee casi como una frase ("convierte cada cliente a response").
			//      + Menos código repetitivo: no hay que crear la lista ni llamar a add() en cada vuelta,
			//        así que hay menos sitios donde equivocarse.
			//      - Contras: si no conoces streams/lambdas cuesta más leerlo al principio, y depurar
			//        "dentro" del map es algo menos directo que poner un breakpoint en un for.
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

	/**
	 * Devuelve una PÁGINA de clientes (para la paginación de la tabla). No toca a
	 * {@link #listarUltimos(int)}; es un endpoint aparte.
	 * Ejemplo de uso: {@code GET /cliente/listar-pagina?pagina=0&tamano=10}
	 *
	 * @param pagina índice de la página empezando en 0; llega por la URL (?pagina=). Por defecto 0.
	 *               Se fuerza a no ser negativo.
	 * @param tamano cuántos clientes por página; llega por la URL (?tamano=). Por defecto 10. Se
	 *               acota al rango [1, 100].
	 * @return {@code 200 OK} con un {@link PaginaClienteResponse} (los clientes de la página +
	 *         metadatos de paginación); o {@code 500} si falla la BD.
	 */
	@GetMapping("/listar-pagina")
	public ResponseEntity<PaginaClienteResponse> listarPagina(
			@RequestParam(defaultValue = "0")  int pagina,
			@RequestParam(defaultValue = "10") int tamano) {

		ResponseEntity<PaginaClienteResponse> respuestaHttp = null;

		// Validación: la página no puede ser negativa y el tamaño lo acotamos a [1, 100]
		// (evita OFFSET raros o pedir demasiadas filas de golpe).
		int paginaSegura = Math.max(0, pagina);
		int tamanoSeguro = Math.max(LIMITE_MIN, Math.min(LIMITE_MAX, tamano));
		log.info("GET /cliente/listar-pagina?pagina={}&tamano={}", paginaSegura, tamanoSeguro);

		try {
			// El service trae la página y ya calcula los metadatos (total, hayAnterior, etc.).
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
