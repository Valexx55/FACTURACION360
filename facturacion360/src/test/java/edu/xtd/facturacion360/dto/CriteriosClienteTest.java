package edu.xtd.facturacion360.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Pruebas del constructor compacto de {@link CriteriosCliente}.
 *
 * <p>Es donde se decide qué es un criterio válido para TODA la aplicación: el controller, el
 * service y el repositorio dan por hecho que lo que reciben ya viene normalizado y no vuelven
 * a comprobarlo. Si esto se rompe, se rompe en silencio y el fallo aparece tres capas más
 * abajo, en forma de consulta con un {@code OFFSET} negativo o de un filtro por la cadena
 * vacía que no encuentra a nadie.</p>
 *
 * <p>No necesita ni base de datos ni Spring: es un record.</p>
 *
 * @author AngelDanielC0des
 * @see CriteriosCliente
 */
class CriteriosClienteTest {

	/** Los criterios que llegan cuando no se manda ningún parámetro en la URL. */
	private static CriteriosCliente vacios() {
		return new CriteriosCliente(null, null, null, null, null, null, null);
	}

	@Test
	@DisplayName("Sin parámetros se usan los valores por defecto")
	void sinParametrosUsaLosValoresPorDefecto() {
		CriteriosCliente criterios = vacios();

		assertThat(criterios.pagina()).isZero();
		assertThat(criterios.tamano()).isEqualTo(CriteriosCliente.TAMANO_DEFECTO);
		assertThat(criterios.busqueda()).isNull();
		assertThat(criterios.provincia()).isNull();
		assertThat(criterios.poblacion()).isNull();
		assertThat(criterios.ordenarPor()).isEqualTo(CriteriosCliente.ORDEN_DEFECTO);
		assertThat(criterios.direccion()).isEqualTo(CriteriosCliente.DIRECCION_DEFECTO);
	}

	@Test
	@DisplayName("Una página negativa se corrige a la primera")
	void laPaginaNegativaSeCorrige() {
		assertThat(new CriteriosCliente(-5, null, null, null, null, null, null).pagina()).isZero();
	}

	@Test
	@DisplayName("El tamaño se acota entre el valor por defecto y el máximo")
	void elTamanoSeAcota() {
		// 0 o menos no es un tamaño de página: se toma el de por defecto.
		assertThat(new CriteriosCliente(0, 0, null, null, null, null, null).tamano())
				.isEqualTo(CriteriosCliente.TAMANO_DEFECTO);
		assertThat(new CriteriosCliente(0, -3, null, null, null, null, null).tamano())
				.isEqualTo(CriteriosCliente.TAMANO_DEFECTO);

		// Pedir la tabla entera de una vez no está permitido.
		assertThat(new CriteriosCliente(0, 5000, null, null, null, null, null).tamano())
				.isEqualTo(CriteriosCliente.TAMANO_MAX);

		// Y un valor razonable se respeta tal cual.
		assertThat(new CriteriosCliente(0, 25, null, null, null, null, null).tamano()).isEqualTo(25);
	}

	@Test
	@DisplayName("Los textos en blanco se quedan en null y al resto se le quitan los espacios")
	void losTextosSeNormalizan() {
		CriteriosCliente enBlanco = new CriteriosCliente(0, 10, "   ", "", "\t", null, null);

		// "null = sin filtro" es el único convenio que entiende el repositorio: si llegara la
		// cadena vacía, montaría un WHERE provincia = '' que no encuentra a nadie.
		assertThat(enBlanco.busqueda()).isNull();
		assertThat(enBlanco.provincia()).isNull();
		assertThat(enBlanco.poblacion()).isNull();

		CriteriosCliente conEspacios = new CriteriosCliente(0, 10, "  garcia  ", " Valencia ",
				" Gandia ", "  nombre  ", "  asc  ");

		assertThat(conEspacios.busqueda()).isEqualTo("garcia");
		assertThat(conEspacios.provincia()).isEqualTo("Valencia");
		assertThat(conEspacios.poblacion()).isEqualTo("Gandia");
		assertThat(conEspacios.ordenarPor()).isEqualTo("nombre");
		assertThat(conEspacios.direccion()).isEqualTo("asc");
	}

	@Test
	@DisplayName("Un criterio con saltos de línea no puede partir una línea del log")
	void losSaltosDeLineaSeNeutralizan() {
		// El controller escribe los criterios en el log. Con el salto de línea dentro, la
		// traza se partiría en dos y la segunda mitad parecería una línea escrita por la
		// propia aplicación (log forging): quien mira el log leería un borrado que no ha
		// ocurrido. Para buscar en la base de datos un \n no aporta nada.
		CriteriosCliente criterios = new CriteriosCliente(0, 10,
				"garcia\n2026-08-02 INFO  Cliente 7 eliminado", "Valencia\r\nfalso", null, null, null);

		assertThat(criterios.busqueda()).doesNotContain("\n").doesNotContain("\r");
		assertThat(criterios.busqueda()).isEqualTo("garcia 2026-08-02 INFO  Cliente 7 eliminado");

		// \r\n es un único salto, no dos: se sustituye por un solo espacio.
		assertThat(criterios.provincia()).isEqualTo("Valencia falso");
	}

	@Test
	@DisplayName("La ordenación nunca queda vacía: siempre se ordena de alguna manera")
	void laOrdenacionNuncaQuedaVacia() {
		CriteriosCliente criterios = new CriteriosCliente(0, 10, null, null, null, "   ", "");

		assertThat(criterios.ordenarPor()).isEqualTo(CriteriosCliente.ORDEN_DEFECTO);
		assertThat(criterios.direccion()).isEqualTo(CriteriosCliente.DIRECCION_DEFECTO);
	}

	@Test
	@DisplayName("Aquí no se decide si la columna existe: de eso va la lista blanca del repositorio")
	void laColumnaInventadaLlegaTalCual() {
		// El record solo limpia; quien traduce a un nombre de columna real (y descarta lo que
		// no está en su lista) es el repositorio. Se comprueba para dejar claro dónde está
		// cada responsabilidad: si algún día esto empezara a filtrar, habría dos sitios
		// decidiendo lo mismo.
		assertThat(new CriteriosCliente(0, 10, null, null, null, "; DROP TABLE clientes", null)
				.ordenarPor()).isEqualTo("; DROP TABLE clientes");
	}

	@Test
	@DisplayName("Una página muy alta no desborda el offset")
	void elOffsetNoDesborda() {
		CriteriosCliente criterios = new CriteriosCliente(Integer.MAX_VALUE, 100, null, null, null, null, null);

		// Multiplicando en int, 2147483647 * 100 da la vuelta y sale negativo; MySQL rechaza
		// un OFFSET negativo y la consulta reventaría en vez de devolver una página vacía.
		assertThat(criterios.offset()).isEqualTo(214748364700L);
	}
}
