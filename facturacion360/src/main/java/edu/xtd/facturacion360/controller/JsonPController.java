package edu.xtd.facturacion360.controller;

import java.io.IOException;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.service.ClienteService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Controller //no es RestContorller, porque no devolvemos un JSON
public class JsonPController {
	
	@Autowired
	ClienteService clienteService;
	
	@Autowired
	ClienteMapper clienteMapper;
	
//	@Autowired
//	ObjectMapper objectMapper;
	
	@GetMapping("/jsonp/cliente") //http://localhost:8080/jsonp/cliente
	public void testJsonP (HttpServletRequest httpServletRequest,
			HttpServletResponse httpServletResponse,
			@RequestParam (required = true, value = "callback") String funcionCallback) throws IOException
	{
		List<Cliente> lClientes = clienteService.listarUltimos(10);
		List<ClienteResponse> lClienteResponses =  lClientes.stream().map(clienteMapper::toResponse).toList();
	
		ObjectMapper objectMapper = new ObjectMapper();
		//apaño serialziación de fechas
		objectMapper.registerModule(new JavaTimeModule());
		objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
		
		String clientesJson = objectMapper.writeValueAsString(lClienteResponses);
		String cuerpoRespuesta = funcionCallback + "(" + clientesJson + ");";
		
		httpServletResponse.setContentType("application/javascritp;charset=UTF-8");
		httpServletResponse.getWriter().print(cuerpoRespuesta);
		
	}

}
