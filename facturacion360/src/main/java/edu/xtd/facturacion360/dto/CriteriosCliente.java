package edu.xtd.facturacion360.dto;

import jakarta.validation.constraints.Size;

/**
 * Los criterios con los que se pide una página de clientes: qué página, de qué tamaño,
 * qué buscar, por qué filtrar y cómo ordenar.
 *
 * <p>Va todo junto en un objeto en vez de como siete parámetros sueltos porque esa firma
 * se repetía en cinco sitios (controller, interfaz e implementación del service, e interfaz
 * e implementación del repository): añadir un filtro nuevo obligaba a tocar los cinco. Con
 * el record, se añade un componente aquí y ya está.</p>
 *
 * <p>Además, TODA la normalización vive en su constructor compacto. Antes estaba repartida:
 * el acotado de la página en el controller y la limpieza del término en el service. Al
 * juntarla, solo hay un sitio donde se decide qué es un valor válido, y da igual si el
 * record lo construye Spring desde la URL o alguien a mano.</p>
 *
 * <p>Spring lo rellena desde los parámetros de la URL con {@code @ModelAttribute},
 * emparejándolos por nombre con los componentes.</p>
 *
 * @param pagina     índice de la página empezando en 0; se fuerza a no ser negativo
 * @param tamano     cuántos clientes por página; se acota a un máximo de
 *                   {@value #TAMANO_MAX} y toma {@value #TAMANO_DEFECTO} si no llega
 * @param busqueda   texto a buscar en nombre y nif_cif (coincidencia parcial);
 *                   {@code null} = no buscar
 * @param provincia  filtro por provincia; {@code null} = no filtrar
 * @param poblacion  filtro por población; {@code null} = no filtrar
 * @param ordenarPor columna por la que ordenar: nombre o fecha_alta
 * @param direccion  sentido de la ordenación: asc o desc
 */
public record CriteriosCliente(

		// Integer y no int, a propósito: cuando un parámetro no viene en la URL, Spring
		// intenta enlazar null, y null NO se puede convertir a un primitivo (falla con
		// "Failed to convert value of type 'null' to required type 'int'" y devuelve 400
		// hasta en las peticiones correctas). Con Integer el null llega bien y es el
		// constructor compacto el que decide el valor por defecto. Después de él, estos
		// dos NUNCA son null, así que se pueden usar como si fueran int.
		Integer pagina,

		Integer tamano,

		// Las longitudes máximas son las de las columnas reales de la tabla: un término
		// más largo no puede coincidir con nada, así que se rechaza antes de ir a la BD.
		@Size(max = LONGITUD_MAX_BUSQUEDA, message = "La búsqueda no puede superar los 60 caracteres")
		String busqueda,

		@Size(max = LONGITUD_MAX_PROVINCIA, message = "La provincia no puede superar los 15 caracteres")
		String provincia,

		@Size(max = LONGITUD_MAX_POBLACION, message = "La población no puede superar los 30 caracteres")
		String poblacion,

		String ordenarPor,

		String direccion) {

	/** Clientes por página si no se pide otra cosa. */
	public static final int TAMANO_DEFECTO = 10;

	/** Tope de clientes por página, para que nadie pida la tabla entera de una vez. */
	public static final int TAMANO_MAX = 100;

	/** Longitud de la columna {@code nombre} en la tabla clientes. */
	public static final int LONGITUD_MAX_BUSQUEDA = 60;

	/** Longitud de la columna {@code provincia} en la tabla clientes. */
	public static final int LONGITUD_MAX_PROVINCIA = 15;

	/** Longitud de la columna {@code poblacion} en la tabla clientes. */
	public static final int LONGITUD_MAX_POBLACION = 30;

	/** Columna por la que se ordena si no se pide otra cosa. */
	public static final String ORDEN_DEFECTO = "fecha_alta";

	/** Sentido de ordenación por defecto: lo más reciente primero. */
	public static final String DIRECCION_DEFECTO = "desc";

	/**
	 * Constructor compacto: deja todos los componentes ya normalizados, de modo que
	 * quien reciba un {@code CriteriosCliente} no tiene que volver a comprobar nada.
	 */
	public CriteriosCliente {
		// null = no lo han mandado; negativo = no tiene sentido. En ambos casos, la 0.
		pagina = (pagina == null || pagina < 0) ? 0 : pagina;

		// null = no lo han mandado; 0 o negativo = no tiene sentido. En los dos casos lo
		// razonable es el tamaño por defecto, no un 1.
		tamano = (tamano == null || tamano <= 0) ? TAMANO_DEFECTO : Math.min(TAMANO_MAX, tamano);

		busqueda = normalizar(busqueda);
		provincia = normalizar(provincia);
		poblacion = normalizar(poblacion);

		// Estos dos SÍ tienen valor por defecto: siempre se ordena de alguna manera.
		ordenarPor = (normalizar(ordenarPor) == null) ? ORDEN_DEFECTO : ordenarPor.trim();
		direccion = (normalizar(direccion) == null) ? DIRECCION_DEFECTO : direccion.trim();
	}

	/**
	 * Cuántas filas hay que saltar para llegar a esta página (el OFFSET del SQL).
	 *
	 * El {@code (long)} va en el PRIMER operando a propósito: si se multiplicara en
	 * {@code int} y se ampliara después, una página muy alta desbordaría antes de
	 * convertirse, daría un offset negativo y MySQL fallaría con un error de sintaxis.
	 *
	 * @return el número de filas a saltar; nunca negativo
	 */
	public long offset() {
		return (long) pagina.intValue() * tamano.intValue();
	}

	/**
	 * Deja en {@code null} lo que no aporta ningún filtro, y quita los espacios sobrantes
	 * del resto. Así el repositorio maneja un único convenio ("null = sin filtro") en vez
	 * de tener que distinguir entre {@code null}, {@code ""} y {@code "   "}.
	 *
	 * @param valor el texto tal cual llega de la URL
	 * @return el texto sin espacios alrededor, o {@code null} si no había contenido
	 */
	private static String normalizar(String valor) {
		return (valor == null || valor.isBlank()) ? null : valor.trim();
	}
}
