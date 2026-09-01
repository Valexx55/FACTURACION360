package edu.xtd.facturacion360.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import edu.xtd.facturacion360.dto.Factura;
import edu.xtd.facturacion360.dto.ResumenTrimestralFactura;
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
	void sumaLosImportesDelTrimestre() {
		Factura primera = factura(1, "F-001", "100.00", "21.00", "121.00");
		Factura segunda = factura(2, "F-002", "50.00", "10.50", "60.50");
		facturaRepository.facturasTrimestre = List.of(primera, segunda);

		ResumenTrimestralFactura resumen = facturaService.listarTrimestre(2026, 1);

		assertEquals(2, resumen.facturas().size());
		assertEquals(new BigDecimal("150.00"), resumen.subtotal());
		assertEquals(new BigDecimal("31.50"), resumen.importeIva());
		assertEquals(new BigDecimal("181.50"), resumen.total());
	}

	@Test
	void rechazaUnTrimestreNoValido() {
		ResponseStatusException excepcion = assertThrows(ResponseStatusException.class,
				() -> facturaService.listarTrimestre(2026, 5));

		assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
	}

	@Test
	void rechazaUnAnioFueraDelIntervaloPermitido() {
		ResponseStatusException excepcion = assertThrows(ResponseStatusException.class,
				() -> facturaService.listarTrimestre(1999, 1));

		assertEquals(HttpStatus.BAD_REQUEST, excepcion.getStatusCode());
	}

	private Factura factura(int idFactura, String numeroFactura, String subtotal,
			String importeIva, String total) {
		return new Factura(idFactura, 1, "Cliente", numeroFactura, LocalDate.of(2026, 1, 10),
				"PENDIENTE", null, new BigDecimal(subtotal), new BigDecimal(importeIva),
				new BigDecimal(total));
	}

	private static class FacturaRepositoryFalso implements FacturaRepository {

		List<Factura> facturasTrimestre = List.of();

		@Override
		public Factura insertar(Factura factura) {
			return factura;
		}

		@Override
		public List<Factura> buscar(String busqueda) {
			return List.of();
		}

		@Override
		public List<Factura> buscarPorTrimestre(LocalDate fechaInicio, LocalDate fechaFin) {
			return facturasTrimestre;
		}

	}
}
