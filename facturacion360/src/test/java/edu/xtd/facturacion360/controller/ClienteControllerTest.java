package edu.xtd.facturacion360.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.ClienteMapper;
import edu.xtd.facturacion360.dto.CriteriosCliente;
import edu.xtd.facturacion360.dto.PaginaClienteResponse;
import edu.xtd.facturacion360.service.ClienteService;

/**
 * Pruebas de los códigos HTTP que devuelve {@link ClienteController} en el detalle, la edición
 * y el listado paginado.
 *
 * <p>El controller no calcula nada: lo suyo es traducir lo que responde el service (un
 * {@link Optional} vacío, una excepción de clave duplicada) al código que le toca. Esa
 * traducción es justo lo que el frontend da por supuesto para decidir si enseña el formulario
 * en rojo, si avisa de que el cliente ya no existe o si refresca la tabla, así que cambiarla
 * sin darse cuenta rompe la pantalla sin romper ninguna compilación.</p>
 *
 * <p>Con el service simulado: no hace falta base de datos, y así cada caso se puede provocar a
 * voluntad, incluidos los que a mano son casi imposibles de reproducir.</p>
 *
 * @author AngelDanielC0des
 * @see ClienteController
 */
@WebMvcTest(ClienteController.class)
@Import(ClienteMapper.class)   // el mapper de verdad: es una traducción sin dependencias
class ClienteControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private ClienteService clienteService;

	/** Un cliente completo, el que devolvería la base de datos. */
	private static Cliente cliente(int id) {
		return new Cliente(id, "García S.L.", "B12345678", "Calle Mayor 1", "46001",
				"Valencia", "Valencia", "600123456", "info@garcia.es", LocalDate.of(2026, 1, 10));
	}

	/** El JSON que manda el formulario de edición. */
	private static String cuerpoValido() {
		return """
				{
				  "nombre": "García S.L.",
				  "nifCif": "B12345678",
				  "direccion": "Calle Mayor 1",
				  "codigoPostal": "46001",
				  "poblacion": "Valencia",
				  "provincia": "Valencia",
				  "telefono": "600123456",
				  "email": "info@garcia.es"
				}
				""";
	}

	// --- GET /cliente/{id} ---

	@Test
	@DisplayName("El detalle de un cliente que existe responde 200 con todos sus campos")
	void detalleDeClienteExistente() throws Exception {
		when(clienteService.obtenerPorId(7)).thenReturn(Optional.of(cliente(7)));

		mockMvc.perform(get("/cliente/7"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.idCliente").value(7))
				.andExpect(jsonPath("$.nombre").value("García S.L."))
				// Los cuatro que la tabla no enseña y que son la razón de ser del panel.
				.andExpect(jsonPath("$.direccion").value("Calle Mayor 1"))
				.andExpect(jsonPath("$.codigoPostal").value("46001"))
				.andExpect(jsonPath("$.poblacion").value("Valencia"))
				.andExpect(jsonPath("$.provincia").value("Valencia"))
				.andExpect(jsonPath("$.fechaAlta").value("2026-01-10"));
	}

	@Test
	@DisplayName("El detalle de un cliente que no existe responde 404 sin cuerpo")
	void detalleDeClienteInexistente() throws Exception {
		when(clienteService.obtenerPorId(99)).thenReturn(Optional.empty());

		// Sin cuerpo a propósito: un 404 con la página de error de Spring dentro le llegaría al
		// navegador como un JSON que no sabe leer, y en desarrollo con la traza incluida.
		mockMvc.perform(get("/cliente/99"))
				.andExpect(status().isNotFound())
				.andExpect(content().string(""));
	}

	// --- PUT /cliente/{id} ---

	@Test
	@DisplayName("Guardar unos datos correctos responde 200 con el cliente actualizado")
	void guardarClienteCorrecto() throws Exception {
		when(clienteService.actualizar(eq(7), any(Cliente.class))).thenReturn(Optional.of(cliente(7)));

		mockMvc.perform(put("/cliente/7")
				.contentType(MediaType.APPLICATION_JSON)
				.content(cuerpoValido()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.idCliente").value(7))
				// La fecha de alta no se edita y tiene que volver tal cual: si viajara a null,
				// el frontend repintaría la fila con la columna "Alta" vacía.
				.andExpect(jsonPath("$.fechaAlta").value("2026-01-10"));
	}

	@Test
	@DisplayName("Guardar con el nombre vacío responde 400 y no llega al service")
	void guardarConDatosNoValidos() throws Exception {
		String sinNombre = cuerpoValido().replace("\"nombre\": \"García S.L.\"", "\"nombre\": \"\"");

		mockMvc.perform(put("/cliente/7")
				.contentType(MediaType.APPLICATION_JSON)
				.content(sinNombre))
				.andExpect(status().isBadRequest())
				.andExpect(content().string(""));

		// Lo importante no es solo el código: es que un dato inválido no llegue a la BD.
		verify(clienteService, never()).actualizar(anyInt(), any(Cliente.class));
	}

	@Test
	@DisplayName("Guardar un cliente que ya no existe responde 404")
	void guardarClienteInexistente() throws Exception {
		when(clienteService.actualizar(eq(99), any(Cliente.class))).thenReturn(Optional.empty());

		mockMvc.perform(put("/cliente/99")
				.contentType(MediaType.APPLICATION_JSON)
				.content(cuerpoValido()))
				.andExpect(status().isNotFound())
				.andExpect(content().string(""));
	}

	@Test
	@DisplayName("Guardar con el NIF de otro cliente responde 409")
	void guardarConNifDuplicado() throws Exception {
		// nif_cif tiene un índice UNIQUE: es la propia BD la que rechaza el UPDATE. Sin el
		// catch del controller, esta excepción salía al navegador con la traza de Spring.
		when(clienteService.actualizar(eq(7), any(Cliente.class)))
				.thenThrow(new DuplicateKeyException("Duplicate entry 'B12345678' for key 'nif_cif'"));

		mockMvc.perform(put("/cliente/7")
				.contentType(MediaType.APPLICATION_JSON)
				.content(cuerpoValido()))
				.andExpect(status().isConflict())
				.andExpect(content().string(""));
	}

	// --- GET /cliente/listar-pagina ---

	@Test
	@DisplayName("El listado llega al service con los criterios ya normalizados")
	void listadoConCriteriosNormalizados() throws Exception {
		when(clienteService.listarPagina(any(CriteriosCliente.class)))
				.thenReturn(new PaginaClienteResponse(List.of(), 0, 1, 1, false, false));

		mockMvc.perform(get("/cliente/listar-pagina")
				.param("pagina", "-4")
				.param("tamano", "5000")
				.param("busqueda", "  garcia  "))
				.andExpect(status().isOk());

		ArgumentCaptor<CriteriosCliente> criterios = ArgumentCaptor.forClass(CriteriosCliente.class);
		verify(clienteService).listarPagina(criterios.capture());

		assertThat(criterios.getValue().pagina()).isZero();
		assertThat(criterios.getValue().tamano()).isEqualTo(CriteriosCliente.TAMANO_MAX);
		assertThat(criterios.getValue().busqueda()).isEqualTo("garcia");
	}

	@Test
	@DisplayName("Una búsqueda demasiado larga responde 400 sin cuerpo y no llega al service")
	void listadoConBusquedaDemasiadoLarga() throws Exception {
		String demasiado = "a".repeat(CriteriosCliente.LONGITUD_MAX_BUSQUEDA + 1);

		// Con el BindingResult, este 400 lo devuelve el propio método y sale igual que los
		// demás: vacío. Sin él, Spring lanzaba la excepción antes de entrar y el cuerpo era la
		// página de error, con la traza dentro mientras devtools está en el classpath.
		mockMvc.perform(get("/cliente/listar-pagina").param("busqueda", demasiado))
				.andExpect(status().isBadRequest())
				.andExpect(content().string(""));

		verify(clienteService, never()).listarPagina(any(CriteriosCliente.class));
	}

	@Test
	@DisplayName("Una página que no es un número responde 400 sin cuerpo y no llega al service")
	void listadoConPaginaNoNumerica() throws Exception {
		// El caso hermano del anterior, pero por otro camino: aquí no falla una restricción de
		// tamaño, falla la CONVERSIÓN del texto a Integer. Se comprueba porque el sitio donde
		// se resuelve no es evidente: como los criterios se enlazan por el constructor del
		// record, el fallo de conversión acaba en el BindingResult y lo atiende el método,
		// igual que el resto. Si algún día se tocara ese enlazado, este 400 pasaría a salir
		// con la página de error de Spring sin que nada más se rompiera.
		mockMvc.perform(get("/cliente/listar-pagina").param("pagina", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(content().string(""));

		verify(clienteService, never()).listarPagina(any(CriteriosCliente.class));
	}

	// --- GET /cliente/listar-ultimos ---

	@Test
	@DisplayName("Un límite exagerado se acota al máximo antes de llegar al service")
	void listarUltimosAcotaElLimite() throws Exception {
		when(clienteService.listarUltimos(anyInt())).thenReturn(List.of(cliente(1)));

		mockMvc.perform(get("/cliente/listar-ultimos").param("limite", "5000"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));

		// El acotado protege a la base de datos de una petición que pida la tabla entera, y
		// hasta ahora solo estaba comprobado a mano. 0 o negativo cae en el otro extremo.
		verify(clienteService).listarUltimos(100);
	}

	@Test
	@DisplayName("Un límite de cero se sube al mínimo, que es uno")
	void listarUltimosAcotaElLimiteMinimo() throws Exception {
		when(clienteService.listarUltimos(anyInt())).thenReturn(List.of(cliente(1)));

		mockMvc.perform(get("/cliente/listar-ultimos").param("limite", "0"))
				.andExpect(status().isOk());

		verify(clienteService).listarUltimos(1);
	}

	// --- Fallos de base de datos ---

	@Test
	@DisplayName("Si la base de datos falla, el detalle responde 500 sin soltar la traza")
	void detalleConLaBaseDeDatosCaida() throws Exception {
		when(clienteService.obtenerPorId(7))
				.thenThrow(new DataAccessResourceFailureException("La BD no responde"));

		// El cuerpo vacío es la mitad importante de la prueba: sin el try/catch del controller
		// la excepción se escaparía y el navegador recibiría la página de error de Spring, que
		// con devtools en el classpath lleva la traza entera dentro.
		mockMvc.perform(get("/cliente/7"))
				.andExpect(status().isInternalServerError())
				.andExpect(content().string(""));
	}

	@Test
	@DisplayName("Si la base de datos falla al guardar, el PUT responde 500 sin soltar la traza")
	void guardarConLaBaseDeDatosCaida() throws Exception {
		when(clienteService.actualizar(eq(7), any(Cliente.class)))
				.thenThrow(new DataAccessResourceFailureException("La BD no responde"));

		mockMvc.perform(put("/cliente/7")
				.contentType(MediaType.APPLICATION_JSON)
				.content(cuerpoValido()))
				.andExpect(status().isInternalServerError())
				.andExpect(content().string(""));
	}

	@Test
	@DisplayName("Si la base de datos falla al listar, la página responde 500 sin soltar la traza")
	void listadoConLaBaseDeDatosCaida() throws Exception {
		when(clienteService.listarPagina(any(CriteriosCliente.class)))
				.thenThrow(new DataAccessResourceFailureException("La BD no responde"));

		mockMvc.perform(get("/cliente/listar-pagina"))
				.andExpect(status().isInternalServerError())
				.andExpect(content().string(""));
	}
}
