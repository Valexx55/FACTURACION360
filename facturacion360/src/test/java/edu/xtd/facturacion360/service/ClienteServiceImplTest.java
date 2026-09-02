package edu.xtd.facturacion360.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.repository.ClienteRepository;

/**
 * Pruebas de {@link ClienteServiceImpl#actualizar(int, Cliente)}, que es donde vive la lógica
 * de negocio más delicada del módulo.
 *
 * <p>Ese método toma tres decisiones que no se ven leyéndolo por encima y que, si se rompen, lo
 * hacen <strong>en silencio</strong>: conserva la fecha de alta que hay en la base de datos,
 * distingue "el cliente no existe" de "se ha guardado sin cambiar nada", e ignora a propósito
 * el {@code boolean} que devuelve el {@code update} del repositorio.</p>
 *
 * <p>Hacía falta probarlo <em>aquí</em> y no desde el controller: {@link
 * edu.xtd.facturacion360.controller.ClienteControllerTest} sustituye el service entero por un
 * doble, así que lo que comprueba es el contrato del doble, no el de esta clase. Sin estas
 * pruebas, alguien podía "simplificar" el método usando el booleano del {@code update} y la
 * aplicación empezaba a responder 404 al guardar sin tocar ningún campo, con las demás pruebas
 * en verde.</p>
 *
 * <p>Con el repositorio simulado: no hace falta base de datos.</p>
 *
 * @author AngelDanielC0des
 * @see ClienteServiceImpl
 */
@ExtendWith(MockitoExtension.class)
class ClienteServiceImplTest {

	@Mock
	private ClienteRepository clienteRepository;

	@InjectMocks
	private ClienteServiceImpl clienteService;

	/** La fecha con la que el cliente está dado de alta en la base de datos. */
	private static final LocalDate FECHA_ALTA_EN_BD = LocalDate.of(2026, 1, 10);

	/** El cliente tal y como lo devuelve el repositorio: con su fecha de alta informada. */
	private static Cliente clienteEnBd() {
		return new Cliente(7, "García S.L.", "B12345678", "Calle Mayor 1", "46001",
				"Valencia", "Valencia", "600123456", "info@garcia.es", FECHA_ALTA_EN_BD);
	}

	/**
	 * Lo que llega del controller: el mapper construye el cliente desde el {@code
	 * ClienteRequest}, que no trae ni el id ni la fecha de alta, así que vienen a 0 y a null.
	 */
	private static Cliente clienteRecibido() {
		return new Cliente(0, "García e Hijos S.L.", "B12345678", "Calle Mayor 1", "46001",
				"Valencia", "Valencia", "600999999", "info@garcia.es", null);
	}

	@Test
	@DisplayName("Si el cliente no existe no se toca la base de datos y se devuelve vacío")
	void clienteInexistenteNoLlegaAlUpdate() {
		when(clienteRepository.findById(99)).thenReturn(Optional.empty());

		Optional<Cliente> resultado = clienteService.actualizar(99, clienteRecibido());

		assertThat(resultado).isEmpty();

		// Lo importante no es solo el Optional vacío: es que no se lance un UPDATE contra una
		// fila que no está. El controller traduce ese vacío al 404.
		verify(clienteRepository, never()).update(any(Cliente.class));
	}

	@Test
	@DisplayName("Al guardar se conserva la fecha de alta que hay en la base de datos")
	void laFechaDeAltaSeConserva() {
		when(clienteRepository.findById(7)).thenReturn(Optional.of(clienteEnBd()));
		when(clienteRepository.update(any(Cliente.class))).thenReturn(true);

		Optional<Cliente> resultado = clienteService.actualizar(7, clienteRecibido());

		// La fecha de alta no es editable y el ClienteRequest ni siquiera la trae, así que
		// llega a null. Si se copiara esa null al cliente que se guarda, la respuesta del PUT
		// devolvería la fecha vacía y el frontend repintaría la fila con un guion en "Alta".
		ArgumentCaptor<Cliente> guardado = ArgumentCaptor.forClass(Cliente.class);
		verify(clienteRepository).update(guardado.capture());

		assertThat(guardado.getValue().fechaAlta()).isEqualTo(FECHA_ALTA_EN_BD);
		assertThat(resultado).get().extracting(Cliente::fechaAlta).isEqualTo(FECHA_ALTA_EN_BD);

		// Y el resto de campos sí son los nuevos, que para eso se está editando.
		assertThat(guardado.getValue().nombre()).isEqualTo("García e Hijos S.L.");
		assertThat(guardado.getValue().telefono()).isEqualTo("600999999");
	}

	@Test
	@DisplayName("El id que manda es el de la ruta, no el 0 con el que llega el cliente")
	void seUsaElIdDeLaRutaYNoElDelMapper() {
		when(clienteRepository.findById(7)).thenReturn(Optional.of(clienteEnBd()));
		when(clienteRepository.update(any(Cliente.class))).thenReturn(true);

		Optional<Cliente> resultado = clienteService.actualizar(7, clienteRecibido());

		// ClienteMapper.toDomain deja el id a 0 porque el ClienteRequest no lo lleva: el
		// identificador viaja en la URL. Si se propagara ese 0, el UPDATE se ejecutaría con
		// "WHERE idcliente = 0" y no modificaría a nadie, en silencio.
		ArgumentCaptor<Cliente> guardado = ArgumentCaptor.forClass(Cliente.class);
		verify(clienteRepository).update(guardado.capture());

		assertThat(guardado.getValue().idCliente()).isEqualTo(7);
		assertThat(resultado).get().extracting(Cliente::idCliente).isEqualTo(7);
	}

	@Test
	@DisplayName("Guardar sin cambiar nada sigue siendo un guardado correcto")
	void guardarSinCambiosNoEsUnFallo() {
		when(clienteRepository.findById(7)).thenReturn(Optional.of(clienteEnBd()));

		// MySQL informa de 0 filas afectadas cuando la sentencia no cambia ningún valor, y el
		// repositorio traduce ese 0 a false. Ese false NO significa "no existe": eso ya lo ha
		// resuelto el findById de arriba, en la misma transacción.
		when(clienteRepository.update(any(Cliente.class))).thenReturn(false);

		Optional<Cliente> resultado = clienteService.actualizar(7, clienteEnBd());

		// Este es el test que protege el 200 al pulsar Guardar sin tocar ningún campo. Si
		// alguien "simplifica" el método devolviendo Optional.empty() cuando update da false,
		// la pantalla empieza a decir que el cliente ya no existe.
		assertThat(resultado).isPresent();
	}
}
