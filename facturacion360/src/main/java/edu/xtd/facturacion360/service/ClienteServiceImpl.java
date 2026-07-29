package edu.xtd.facturacion360.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
	public PaginaClienteResponse listarPagina(int pagina, int tamano, String busqueda, String provincia,
			String poblacion, String ordenarPor, String direccion) {
		// El término se normaliza UNA vez, aquí: quitamos espacios sobrantes y dejamos
		// null si no hay nada que buscar. Así el repositorio recibe un único convenio
		// ("null = sin filtro") en lugar de tener que distinguir null, "" y "   ".
		String termino = (busqueda == null || busqueda.isBlank()) ? null : busqueda.trim();

		// (long) en el PRIMER operando: si se multiplicara en int y luego se ampliara,
		// una página muy alta desbordaría el int ANTES de convertirse, daría un offset
		// negativo y MySQL fallaría con un error de sintaxis.
		long offset = (long) pagina * tamano;                // cuántas filas saltar
		List<Cliente> clientes = clienteRepository.findPagina(tamano, offset, termino, provincia, poblacion,
				ordenarPor, direccion);
		// El total se cuenta CON los mismos criterios: si no, el nº de páginas no
		// cuadraría con lo que se ve en pantalla.
		long total = clienteRepository.contarTotal(termino, provincia, poblacion);

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
		log.info("listarPagina(pagina={}, tamano={}, busqueda={}, provincia={}, poblacion={}, ordenarPor={}, direccion={}) -> pagina {}/{}, {} elementos",
				pagina, tamano, termino, provincia, poblacion, ordenarPor, direccion, pagina + 1, totalPaginas, total);
		return respuesta;
	}

	@Override
	public List<String> listarProvincias() {
		List<String> provincias = clienteRepository.findProvincias();
		log.info("listarProvincias() -> {} provincias", provincias.size());
		return provincias;
	}

	@Override
	public List<String> listarPoblaciones(String provincia) {
		List<String> poblaciones = clienteRepository.findPoblaciones(provincia);
		log.info("listarPoblaciones(provincia={}) -> {} poblaciones", provincia, poblaciones.size());
		return poblaciones;
	}

	@Override
	public Cliente obtenerPorId(int id) {
		// TODO Auto-generated method stub
		return null;
	}

	/**
	 * Crea un cliente delegando la persistencia en el repositorio.
	 *
	 * @param cliente datos del cliente que se va a crear
	 * @return true si el repositorio confirma la inserción; false en caso contrario
	 */
	@Override
	public Cliente crear(Cliente cliente) {
		Cliente clienteNuevo = null;

		clienteNuevo = clienteRepository.insert(cliente);
		if (clienteNuevo == null) {
			throw new RuntimeException("Error al insertar cliente " + cliente);
		}

		return clienteNuevo;
	}

	@Override
	public Cliente actualizar(int id, Cliente cliente) {

		// Creamos un nuevo objeto Cliente con el id recibido en la URL
		Cliente clienteActualizado = new Cliente(id, cliente.nombre(), cliente.nifCif(), cliente.direccion(),
				cliente.codigoPostal(), cliente.poblacion(), cliente.provincia(), cliente.telefono(), cliente.email(),
				cliente.fechaAlta());

		// Llamamos al repositorio para actualizar el cliente en la base de datos
		boolean updateOK = clienteRepository.update(clienteActualizado);

		if (!updateOK) {
			clienteActualizado = null;
		}

		// Devolvemos el cliente actualizado
		return clienteActualizado;
	}
	
	
	@Override
	public void eliminar(int id) {


		boolean borrado = this.clienteRepository.deleteById(id);
		if (!borrado) {
			System.err.println("El cliente con ese ID no existe");
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Error, No se encontró el cliente");

		}

	}

	// TODO: valorar la programación del método privado validarCifUnico mirar el
	// Diagrama de Clases
}
