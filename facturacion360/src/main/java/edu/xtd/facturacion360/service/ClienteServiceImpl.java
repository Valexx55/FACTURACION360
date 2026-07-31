package edu.xtd.facturacion360.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.ClienteResponse;
import edu.xtd.facturacion360.dto.CriteriosCliente;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.repository.ClienteRepository;

/**
 * Implementación de {@link ClienteService}: la lógica de negocio de los clientes.
 *
 * <p>Hace de intermediaria entre el controller y el repositorio. Aquí viven las reglas que no
 * son ni HTTP ni SQL: calcular los metadatos de paginación, decidir qué es un error de negocio
 * y traducir el dominio a los DTO de respuesta con {@link ClienteMapper}.</p>
 *
 * <p>El detalle de cada método está documentado en la interfaz.</p>
 *
 * @see ClienteService
 */
@Service
public class ClienteServiceImpl implements ClienteService {

	private static final Logger log = LoggerFactory.getLogger(ClienteServiceImpl.class);


	@Autowired
	ClienteRepository clienteRepository;

	// Lo usamos para traducir Cliente (dominio) -> ClienteResponse dentro de la página.
	@Autowired
	ClienteMapper clienteMapper;

	/**
	 * {@inheritDoc}
	 *
	 * @autor AngelDanielC0des
	 */
	@Override
	public List<Cliente> listarUltimos(int limite) {
		// Regla de negocio ("los últimos N"): de momento solo delega en el repositorio.
		// Guardamos el resultado en una variable para poder loguearlo antes del return.
		List<Cliente> clientes = clienteRepository.findUltimos(limite);
		log.info("listarUltimos({}) -> {} clientes", limite, clientes.size());
		return clientes;
	}

	/**
	 * {@inheritDoc}
	 *
	 * @autor AngelDanielC0des
	 */
	// Las dos consultas de este método (las filas y el total) tienen que ver la MISMA foto
	// de la tabla. Sin transacción, cada una va por su cuenta: si alguien da de alta o
	// borra un cliente justo entre ambas, el total no cuadraría con las filas devueltas y
	// la paginación mostraría "12 clientes" con 10 filas.
	// readOnly = true además avisa al driver de que no vamos a escribir, y así puede
	// optimizar. Los demás métodos de lectura NO lo llevan a propósito: hacen una sola
	// consulta, así que no hay dos lecturas que puedan discrepar y solo añadiría trabajo.
	@Transactional(readOnly = true)
	@Override
	public PaginaClienteResponse listarPagina(CriteriosCliente criterios) {
		// Los criterios llegan ya acotados y limpios (lo hace el constructor compacto de
		// CriteriosCliente), así que aquí solo queda la lógica de negocio: pedir la
		// página, pedir el total y montar los metadatos de paginación.
		List<Cliente> clientes = clienteRepository.findPagina(criterios);
		// El total se cuenta CON los mismos criterios: si no, el nº de páginas no
		// cuadraría con lo que se ve en pantalla.
		long total = clienteRepository.contarTotal(criterios);

		// Math.ceil redondea HACIA ARRIBA: 28/10 = 2,8 -> 3 páginas (la última con 8). El
		// (double) es clave: sin él la división entera daría 2 y se perdería la última página.
		int totalPaginas = (int) Math.ceil((double) total / criterios.tamano());

		// Cada Cliente (dominio) se traduce a ClienteResponse (JSON). La referencia a método
		// clienteMapper::toResponse equivale a la lambda c -> clienteMapper.toResponse(c).
		List<ClienteResponse> contenido = clientes.stream().map(clienteMapper::toResponse).toList();

		int pagina = criterios.pagina();
		boolean hayAnterior  = pagina > 0;                   // hay anterior salvo en la página 0
		boolean haySiguiente = pagina < totalPaginas - 1;    // hay siguiente salvo en la última

		PaginaClienteResponse respuesta = new PaginaClienteResponse(
				contenido, pagina, totalPaginas, total, hayAnterior, haySiguiente);
		log.info("listarPagina({}) -> pagina {}/{}, {} elementos",
				criterios, pagina + 1, totalPaginas, total);
		return respuesta;
	}

	/**
	 * {@inheritDoc}
	 *
	 * @autor AngelDanielC0des
	 */
	@Override
	public List<String> listarProvincias() {
		List<String> provincias = clienteRepository.findProvincias();
		log.info("listarProvincias() -> {} provincias", provincias.size());
		return provincias;
	}

	/**
	 * {@inheritDoc}
	 *
	 * @autor AngelDanielC0des
	 */
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
