package edu.xtd.facturacion360.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
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
import org.springframework.web.bind.annotation.RestController;

import edu.xtd.facturacion360.dto.ClienteRequest;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.service.ClienteService;
import jakarta.validation.Valid;

/**
 * En esta claes, recibimos las peticiones HTTP relativas a los clientes
 * y le devolvemos su correspondiente respuesta
 * 
 * MÉTODO HTTP - OPERACIÓN LÓGICA - OPERACIÓN SQL
 * 
 * GET - LEER - SELECT 
 * POST - CREAR - INSERT 
 * PUT - MODIFICAR - UPDATE 
 * DELETE - BORRAR - DELETE
 * 
 * 
 */

@RestController
@RequestMapping("/cliente")
public class ClienteController {

	@Autowired
	ClienteService clienteService;

	@GetMapping("/listar-ultimos")
	public ResponseEntity<List<ClienteResponse>> listarUltimos() {

		ResponseEntity<List<ClienteResponse>> respuesta = null;

		return respuesta;
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

		return respuesta;
	}
	
	
	
	
	
	
	
	
	
	
	

}
