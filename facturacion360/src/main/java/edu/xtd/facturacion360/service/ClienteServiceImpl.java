package edu.xtd.facturacion360.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.repository.ClienteRepository;

@Service
public class ClienteServiceImpl implements ClienteService{

	@Autowired
	ClienteRepository clienteRepository;

	@Override
	public List<Cliente> listarUltimos(int limite) {
		// TODO Auto-generated method stub
		return null;
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
			if (clienteNuevo==null)
			{
				throw new RuntimeException("Error al insertar cliente " + cliente);
			}
		
		return clienteNuevo;
	}

	@Override
	public Cliente actualizar(int id, Cliente cliente) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public void eliminar(int id) {
		// TODO Auto-generated method stub
		
	}
	
	//TODO: valorar la programación del método privado validarCifUnico mirar el Diagrama de Clases

}
