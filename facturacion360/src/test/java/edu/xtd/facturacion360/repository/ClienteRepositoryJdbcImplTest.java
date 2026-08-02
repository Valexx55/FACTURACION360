package edu.xtd.facturacion360.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import edu.xtd.facturacion360.dto.Cliente;
import edu.xtd.facturacion360.dto.CriteriosCliente;

/**
 * Pruebas del SQL que construye {@link ClienteRepositoryJdbcImpl} para el listado paginado.
 *
 * <p>Lo que se comprueba aquí son las dos defensas del buscador, que son invisibles mirando la
 * pantalla y solo se notan cuando fallan: que los comodines de {@code LIKE} llegan escapados
 * (buscar "%" devolvía la tabla entera) y que la ordenación pasa por la lista blanca (el
 * {@code ORDER BY} no admite parámetros, así que lo que el usuario mande no puede acabar
 * concatenado en la consulta). Y que el recuento del total lleva los mismos filtros que la
 * página, o el número de páginas dejaría de cuadrar con lo que se ve.</p>
 *
 * <p>Con un {@code JdbcTemplate} simulado: no hace falta MySQL levantado, porque lo que se
 * mira es la consulta que se le entrega, no lo que devolvería.</p>
 *
 * @author AngelDanielC0des
 * @see ClienteRepositoryJdbcImpl
 */
@ExtendWith(MockitoExtension.class)
class ClienteRepositoryJdbcImplTest {

	@Mock
	private JdbcTemplate jdbcTemplate;

	@Mock
	private ClienteRowMapper clienteRowMapper;

	@InjectMocks
	private ClienteRepositoryJdbcImpl repositorio;

	/** La consulta que ha recibido el JdbcTemplate y los valores de sus '?', en orden. */
	private String sql;
	private List<Object> parametros;

	/**
	 * Se queda con la consulta y con sus parámetros.
	 *
	 * <p>Se anotan desde la propia respuesta simulada y no con un {@code ArgumentCaptor}
	 * porque el último parámetro de {@code query} es variable: un captor ahí dentro solo
	 * recoge un valor, y estas consultas llevan hasta seis.</p>
	 *
	 * @param invocacion la llamada al JdbcTemplate; sus dos primeros argumentos son la
	 *                   consulta y el traductor de filas, y del tercero en adelante van los
	 *                   valores de los '?'
	 */
	private void registrar(InvocationOnMock invocacion) {
		Object[] argumentos = invocacion.getArguments();

		sql = (String) argumentos[0];
		parametros = Arrays.asList(Arrays.copyOfRange(argumentos, 2, argumentos.length));
	}

	/** Pide una página con esos criterios y deja anotado el SQL que se ha ejecutado. */
	private void pedirPagina(CriteriosCliente criterios) {
		// La lista vacía no es un capricho: el método cuenta las filas devueltas para el log.
		doAnswer(invocacion -> {
			registrar(invocacion);
			return List.<Cliente>of();
		}).when(jdbcTemplate).query(anyString(), any(RowMapper.class), any(Object[].class));

		repositorio.findPagina(criterios);
	}

	/** Cuenta el total con esos criterios, con la BD respondiendo lo que se le indique. */
	private long contarTotal(CriteriosCliente criterios, Long respuestaBd) {
		doAnswer(invocacion -> {
			registrar(invocacion);
			return respuestaBd;
		}).when(jdbcTemplate).queryForObject(anyString(), eq(Long.class), any(Object[].class));

		return repositorio.contarTotal(criterios);
	}

	@Test
	@DisplayName("Sin criterios no hay WHERE, y el LIMIT y el OFFSET viajan como parámetros")
	void sinCriteriosNoHayWhere() {
		pedirPagina(new CriteriosCliente(2, 10, null, null, null, null, null));

		assertThat(sql).doesNotContain("WHERE");
		assertThat(sql).contains("LIMIT ? OFFSET ?");

		// Solo el tamaño y el desplazamiento: 2 páginas de 10 son 20 filas saltadas.
		assertThat(parametros).containsExactly(10, 20L);
	}

	@Test
	@DisplayName("La búsqueda escapa los comodines de LIKE y el propio carácter de escape")
	void laBusquedaEscapaLosComodines() {
		// Lo que escribe el usuario:  50%_a\b!c
		pedirPagina(new CriteriosCliente(0, 10, "50%_a\\b!c", null, null, null, null));

		// Lo que debe llegar a la BD:  %50!%!_a\b!!c%
		// El patrón va dos veces, una por columna (nombre y nif_cif). Se comprueban las tres
		// cosas de golpe: que '%' y '_' quedan neutralizados (sin esto, buscar "%" genera
		// '%%%' y casa con TODAS las filas, así que el buscador dejaría de filtrar sin dar
		// ningún síntoma), que el propio '!' se dobla, y que la barra invertida viaja tal
		// cual, porque desde que el escape es '!' ha dejado de ser un carácter especial.
		String patronEsperado = "%50!%!_a\\b!!c%";

		assertThat(parametros).containsExactly(patronEsperado, patronEsperado, 10, 0L);
	}

	@Test
	@DisplayName("Buscar mira el nombre y el NIF, con el OR entre paréntesis")
	void laBusquedaMiraNombreYNif() {
		pedirPagina(new CriteriosCliente(0, 10, "garcia", null, null, null, null));

		// Dos cosas en una línea. Los paréntesis no son decorativos: sin ellos, AND tiene
		// prioridad sobre OR y los filtros de provincia y población solo se aplicarían a la
		// mitad de la condición. Y el ESCAPE se compara entero, porque el carácter elegido
		// ('!' en vez de la barra invertida) es lo que hace que la consulta siga funcionando
		// con el sql_mode NO_BACKSLASH_ESCAPES; cambiarlo aquí sin querer se nota en la BD y
		// no al compilar.
		assertThat(sql).contains("WHERE (nombre LIKE ? ESCAPE '!' OR nif_cif LIKE ? ESCAPE '!')");
	}

	@Test
	@DisplayName("Los filtros se acumulan con AND y en el orden de sus parámetros")
	void losFiltrosSeAcumulan() {
		pedirPagina(new CriteriosCliente(0, 10, "garcia", "Valencia", "Gandia", null, null));

		assertThat(sql).contains("AND provincia = ?").contains("AND poblacion = ?");
		assertThat(parametros).containsExactly("%garcia%", "%garcia%", "Valencia", "Gandia", 10, 0L);
	}

	@Test
	@DisplayName("Una columna que no está en la lista blanca cae en la de por defecto")
	void laColumnaInventadaCaeEnLaDeDefecto() {
		pedirPagina(new CriteriosCliente(0, 10, null, null, null, "nombre; DROP TABLE clientes", "asc"));

		// Lo que manda el usuario se usa como CLAVE del mapa, nunca se concatena: si no está,
		// se ordena por la columna de siempre y su texto no aparece por ninguna parte.
		assertThat(sql).doesNotContain("DROP");
		assertThat(sql).contains("ORDER BY fecha_alta IS NULL, fecha_alta ASC, idcliente ASC");
	}

	@Test
	@DisplayName("La dirección solo puede acabar en ASC o DESC")
	void laDireccionSoloPuedeSerAscODesc() {
		pedirPagina(new CriteriosCliente(0, 10, null, null, null, "nombre", "asc"));

		assertThat(sql).contains("ORDER BY nombre IS NULL, nombre ASC, idcliente ASC");
	}

	@Test
	@DisplayName("Una dirección que no se reconoce se trata como descendente")
	void laDireccionDesconocidaEsDescendente() {
		pedirPagina(new CriteriosCliente(0, 10, null, null, null, "nombre", "hacia arriba"));

		assertThat(sql).contains("ORDER BY nombre IS NULL, nombre DESC, idcliente DESC");
	}

	@Test
	@DisplayName("El total se cuenta con los mismos filtros que la página")
	void elTotalUsaLosMismosFiltros() {
		// Si el WHERE del recuento y el del listado se separasen, el número de páginas dejaría
		// de cuadrar con lo que se ve en la tabla.
		long total = contarTotal(new CriteriosCliente(0, 10, "garcia", "Valencia", null, null, null), 7L);

		assertThat(total).isEqualTo(7L);
		assertThat(sql).startsWith("SELECT COUNT(*) FROM clientes WHERE");

		// Ni LIMIT ni OFFSET ni ORDER BY: no cambian CUÁNTOS hay, solo cuáles se ven.
		assertThat(sql).doesNotContain("LIMIT").doesNotContain("ORDER BY");
		assertThat(parametros).containsExactly("%garcia%", "%garcia%", "Valencia");
	}

	@Test
	@DisplayName("Si el recuento devolviera null, el total es 0 y no una excepción")
	void elTotalNuloSeTraduceACero() {
		assertThat(contarTotal(new CriteriosCliente(0, 10, null, null, null, null, null), null)).isZero();
	}
}
