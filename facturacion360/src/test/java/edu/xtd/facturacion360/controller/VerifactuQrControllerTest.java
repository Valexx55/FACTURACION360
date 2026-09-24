package edu.xtd.facturacion360.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.LocalDate;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import edu.xtd.facturacion360.dto.Emisor;
import edu.xtd.facturacion360.dto.Factura;
import edu.xtd.facturacion360.repository.FacturaRepository;
import edu.xtd.facturacion360.service.EmisorService;
import edu.xtd.facturacion360.verifactu.qr.GeneradorQr;
import java.io.ByteArrayInputStream;

@WebMvcTest(VerifactuQrController.class) // levanta sólo este trocito de contexto
@Import(GeneradorQr.class) // Se incorpora el generador REAL al contexto de prueba
class VerifactuQrControllerTest {

	// para hacer las peticiones sin el servidor
	@Autowired
	private MockMvc mockMvc;

	// uso un repository de mentira, pq no quiero testar la bd
	@MockitoBean
	private FacturaRepository facturaRepository;

	// uso un emisor de mentira, pq no quiero testar la parte del emisor
	@MockitoBean
	private EmisorService emisorService;

	private static final String RUTA = "/verifactu/qr/{idFactura}";

	@Test
	@DisplayName(value = "Caso de Test de Factura No Existente. Da 404")
	void facturaInexistente_devuelve404() throws Exception {
		when(facturaRepository.buscarPorId(7)).thenReturn(null);

		mockMvc.perform(get(RUTA, 7)).andExpect(status().isNotFound());

		verify(facturaRepository).buscarPorId(7);
		// verifyNoInteractions(emisorService);
	}

	@Test
	@DisplayName(value = "Caso de Test de Factura en Estado Borrador. Da 404")
	void facturaEnBorrador_devuelve404() throws Exception {
		when(facturaRepository.buscarPorId(7)).thenReturn(facturaConEstado("BORRADOR"));

		mockMvc.perform(get(RUTA, 7)).andExpect(status().isNotFound());

		verifyNoInteractions(emisorService);
	}

	@Test
	@DisplayName("Caso de Emisor Inexistente. Devuelve 404")
	void emisorInexistente_devuelve404() throws Exception {
		when(facturaRepository.buscarPorId(7)).thenReturn(facturaConEstado("EMITIDA"));
		when(emisorService.find()).thenReturn(null);

		mockMvc.perform(get(RUTA, 7)).andExpect(status().isNotFound());
	}
	
	@ParameterizedTest
	@ValueSource(ints = { 0, -1 })
	void idNoPositivo_devuelve400(int idFactura) throws Exception {
		
		mockMvc.perform(get(RUTA, idFactura)).andExpect(status().isBadRequest());

		verifyNoInteractions(facturaRepository, emisorService);
	}
	
	@ParameterizedTest
    @ValueSource(strings = {"EMITIDA", "ANULADA"})
	@DisplayName("Caso de Correcto de Factura Anuada y Emitida. Devuelve 200/PNG")
    void facturaConQr_devuelveUnPngReal(String estado) throws Exception {
        when(facturaRepository.buscarPorId(7))
                .thenReturn(facturaConEstado(estado));
        when(emisorService.find()).thenReturn(emisor());

        MvcResult resultado = mockMvc.perform(get(RUTA, 7))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string(
                        HttpHeaders.CACHE_CONTROL,
                        "max-age=3600, immutable"))
                .andReturn();

        byte[] contenido = resultado.getResponse().getContentAsByteArray();

        // Los ocho primeros bytes identifican inequívocamente un archivo PNG.
        byte[] firmaPng = {
                (byte) 137, 80, 78, 71, 13, 10, 26, 10
        };
        //assertTrue(contenido.length > firmaPng.length);
        assertArrayEquals(
                firmaPng,
                java.util.Arrays.copyOf(contenido, firmaPng.length)
        );
        //TODO prueba: pasar el PNG a URL con la librería y comprobar que coinciden con los datos
        //del emiso y la factura de prueba
    }
	
	@ParameterizedTest
	@ValueSource(strings = {"EMITIDA", "ANULADA"})
	@DisplayName("El QR contiene la URL de verificación con los datos de la factura")
	void facturaEmitidaOAnulada_generaQrConUrlEsperada(String estado)
	        throws Exception {

	    Factura factura = new Factura(
	            7,
	            3,
	            "Cliente de prueba",
	            "F-2026-0001",
	            LocalDate.of(2026, 9, 21),
	            estado,
	            null,
	            new BigDecimal("2.48"),
	            new BigDecimal("0.52"),
	            new BigDecimal("3.00")
	    );

	    Emisor emisor = new Emisor(
	            "Empresa de prueba",
	            "B80468457",
	            "Calle Mayor 1, Madrid",
	            "empresa@ejemplo.es",
	            "912345678",
	            null
	    );

	    when(facturaRepository.buscarPorId(7)).thenReturn(factura);
	    when(emisorService.find()).thenReturn(emisor);

	    byte[] png = mockMvc.perform(get("/verifactu/qr/{idFactura}", 7))
	            .andExpect(status().isOk())
	            .andExpect(content().contentType("image/png"))
	            .andReturn()
	            .getResponse()
	            .getContentAsByteArray();

	    BufferedImage imagen = ImageIO.read(new ByteArrayInputStream(png));
	    assertNotNull(imagen, "La respuesta debe contener una imagen válida");

	    BinaryBitmap bitmap = new BinaryBitmap(
	            new HybridBinarizer(
	                    new BufferedImageLuminanceSource(imagen)
	            )
	    );

	    String contenidoQr = new QRCodeReader().decode(bitmap).getText();

	    assertEquals(
	            "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR"
	                    + "?nif=B80468457"
	                    + "&numserie=F-2026-0001"
	                    + "&fecha=21-09-2026"
	                    + "&importe=3.00",
	            contenidoQr
	    );
	}

	private Factura facturaConEstado(String estado) {
		return new Factura(7, 3, "Cliente de prueba", "F-2026-0007", LocalDate.of(2026, 9, 24), estado, null,
				new BigDecimal("100.00"), new BigDecimal("21.00"), new BigDecimal("121.00"));
	}

	private Emisor emisor() {
		return new Emisor("Empresa de prueba", "B12345674", "Calle Mayor 1, Madrid", "empresa@ejemplo.es", "912345678",
				null);
	}
}
