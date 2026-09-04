package edu.xtd.facturacion360.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import edu.xtd.facturacion360.dto.ClienteFactura;
import edu.xtd.facturacion360.dto.ConceptoFactura;
import edu.xtd.facturacion360.dto.Factura;
import edu.xtd.facturacion360.repository.FacturaRepository;

class FacturaServiceImplTests {

	FacturaServiceImpl facturaService;
	FacturaRepositoryFalso facturaRepository;

	@BeforeEach
	void prepararPrueba() {
		facturaRepository = new FacturaRepositoryFalso();
		facturaService = new FacturaServiceImpl();
		facturaService.facturaRepository = facturaRepository;
	}

	@Test
	void informaCuandoLaFacturaNoExiste() {
		ResponseStatusException excepcion = assertThrows(ResponseStatusException.class,
				() -> facturaService.obtenerDetalle(99));

		assertEquals(HttpStatus.NOT_FOUND, excepcion.getStatusCode());
	}

	private static class FacturaRepositoryFalso implements FacturaRepository {

		@Override
		public Factura insertar(Factura factura) {
			return factura;
		}

		@Override
		public List<Factura> buscar(String busqueda) {
			return List.of();
		}

		@Override
		public Factura buscarPorId(int idFactura) {
			return null;
		}

		@Override
		public ClienteFactura buscarCliente(int idCliente) {
			return null;
		}

		@Override
		public List<ConceptoFactura> buscarConceptos(int idFactura) {
			return List.of();
		}
	}
}
