package edu.xtd.facturacion360.repository;

import java.util.List;
import java.util.Optional;

import edu.xtd.facturacion360.dto.Cliente;

/**
 * Este interfaz recoge las operaciones sobre base de datos
 * que podemos hacer con los clientes
 * 
 */
public interface ClienteRepository {
	
	public List<Cliente> findUltimos (int limite);
	
	public Optional<Cliente> findById (int id);
	
	public Cliente insert (Cliente cliente);
	
	public boolean update (Cliente cliente);
	
	public boolean deleteById (int id);

}
