package edu.xtd.facturacion360.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.repository.ClienteRepository;

@Service
public class ClienteServiceImpl implements ClienteService{

	private static final Logger log = LoggerFactory.getLogger(ClienteServiceImpl.class);

	@Autowired
	ClienteRepository clienteRepository;

	// Lo usamos para traducir Cliente (dominio) -> ClienteResponse dentro de la página.
	@Autowired
	ClienteMapper clienteMapper;

	@Override
	public List<Cliente> listarUltimos(int limite) {
		// Regla de negocio ("los últimos N"): de momento solo delega en el repositorio.
		// Guardamos el resultado en una variable para poder loguearlo antes del return.
		List<Cliente> clientes = clienteRepository.findUltimos(limite);
		log.info("listarUltimos({}) -> {} clientes", limite, clientes.size());
		return clientes;
	}

	@Override
	public PaginaClienteResponse listarPagina(int pagina, int tamano) {
		int offset = pagina * tamano;                        // cuántas filas saltar
		List<Cliente> clientes = clienteRepository.findPagina(tamano, offset);
		long total = clienteRepository.contarTotal();

		// Math.ceil redondea HACIA ARRIBA: 28/10 = 2,8 -> 3 páginas (la última con 8). El (double)
		// es clave: sin él la división entera daría 2 y perderías la última página.
		int totalPaginas = (int) Math.ceil((double) total / tamano);

		// Traducimos cada Cliente (dominio) a ClienteResponse con la API de Streams: stream() abre
		// el flujo, map(clienteMapper::toResponse) transforma cada elemento (clienteMapper::toResponse
		// es una referencia a método = la lambda c -> clienteMapper.toResponse(c)) y toList() recoge
		// el resultado en una List nueva.
		// Sin '::' sería map(c -> clienteMapper.toResponse(c)); y sin streams, un bucle for con add().
		// Usamos '::'+streams por ser más corto y legible (a cambio de que hay que conocer streams).
		List<ClienteResponse> contenido = clientes.stream().map(clienteMapper::toResponse).toList();

		boolean hayAnterior  = pagina > 0;                   // hay anterior salvo en la página 0
		boolean haySiguiente = pagina < totalPaginas - 1;    // hay siguiente salvo en la última

		PaginaClienteResponse respuesta = new PaginaClienteResponse(
				contenido, pagina, totalPaginas, total, hayAnterior, haySiguiente);
		log.info("listarPagina(pagina={}, tamano={}) -> pagina {}/{}, {} elementos",
				pagina, tamano, pagina + 1, totalPaginas, total);
		return respuesta;
	}

	@Override
	public Cliente obtenerPorId(int id) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public Cliente crear(Cliente cliente) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public Cliente actualizar(int id, Cliente cliente) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public void eliminar(int id) {
		
		this.clienteRepository.deleteById(id);
	}
	
	//TODO: valorar la programación del método privado validarCifUnico mirar el Diagrama de Clases

}
