package edu.xtd.facturacion360.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.repository.ClienteRepository;
import java.util.Optional;

@Service
public class ClienteServiceImpl implements ClienteService {

	@Autowired
	ClienteRepository clienteRepository;

	@Override
	public List<Cliente> listarUltimos(int limite) {
		// La regla de negocio ("los últimos N") delega en el repositorio.
		return clienteRepository.findUltimos(limite);
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

		this.clienteRepository.deleteById(id);
	}

	// TODO: valorar la programación del método privado validarCifUnico mirar el
	// Diagrama de Clases

}
