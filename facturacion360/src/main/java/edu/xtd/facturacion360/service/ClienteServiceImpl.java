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
		// La regla de negocio ("los últimos N") delega en el repositorio.
		return clienteRepository.findUltimos(limite);
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
