package edu.xtd.facturacion360.controller;

import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import edu.xtd.facturacion360.dto.Emisor;

@RestController
@RequestMapping("/emisor")
public class EmisorController {

	@PutMapping("/actualizarEmisor")
	public void actualizarEmisor(@RequestBody Emisor emisor) {
		System.out.println(emisor);
//TODO crear el sevicio y el repositorio para hacer UPDATE en la base de datos
		//devolver la respuesta con ResponseEntity
	}
}