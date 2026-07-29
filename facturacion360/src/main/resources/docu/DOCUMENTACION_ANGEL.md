# Clientes — Listado, buscador, filtros y ordenación

Muestra en la tabla de `clientes.html` **los clientes** dados de alta, con **buscador**,
**filtros** por provincia y población y **ordenación**, pidiéndolos al backend por `fetch`.
Está hecha con **JDBC Template + MySQL**,
siguiendo la arquitectura por capas que subió Val a `master`.

## Qué hace

- **Listar paginado, buscar, filtrar y ordenar** — todo en el mismo endpoint:
  `GET /cliente/listar-pagina?pagina=0&tamano=10&busqueda=&provincia=&poblacion=&ordenarPor=&direccion=`
  → devuelve una **página** de clientes + metadatos de paginación, como JSON.
- **Desplegables de filtro**: `GET /cliente/provincias` y `GET /cliente/poblaciones?provincia=`
  → las provincias y poblaciones que existen en la tabla, para rellenarlos.
- **Listar últimos** (endpoint del profe, se mantiene): `GET /cliente/listar-ultimos` → los **10
  más recientes** en una lista simple.
- **Frontend**: `clientes.js` pide una página y pinta la tabla; arriba hay una barra con el
  buscador, los dos desplegables y el control de orden, y debajo los botones
  **"Anterior" / "Siguiente"** para moverse entre páginas.

**¿Por qué buscar NO tiene endpoint propio?** Porque buscar es "listar con un filtro de texto
más". Si `/cliente/buscar` fuera aparte, habría que darle su propia paginación, sus propios
metadatos y su propio manejo de errores —y el frontend tendría dos caminos distintos según
hubiera texto escrito o no—. Compartiendo endpoint, la búsqueda hereda todo eso gratis.

## Arquitectura por capas

Cada capa tiene una única responsabilidad. El flujo de una petición es:

```
Navegador ─GET /cliente/listar-ultimos→ Controller → Service → Repository(JDBC) → MySQL
Navegador ←──────── JSON ─── ClienteResponse ←(Mapper)─ Cliente ←(RowMapper)─ fila
```

| Capa | Fichero | Responsabilidad |
|------|---------|-----------------|
| **Controller** | `controller/ClienteController.java` | Recibe la petición HTTP, valida el `limite`, orquesta la llamada y devuelve `200 OK` (o `500` si algo falla). |
| **Service** | `service/ClienteService` (interfaz) + `ClienteServiceImpl` | La lógica de negocio ("los últimos N"). Separa el controller del acceso a datos. |
| **Repository** | `repository/ClienteRepository` (interfaz) + `ClienteRepositoryJdbcImpl` | Habla con la BD: ejecuta el SQL con `JdbcTemplate`. |
| **RowMapper** | `repository/ClienteRowMapper.java` | Convierte cada fila del `ResultSet` en un objeto `Cliente`. |
| **DTOs** | `dto/Cliente` (dominio) · `dto/ClienteResponse` (salida JSON) | Los datos: lo que se maneja dentro vs. lo que se envía al navegador. |
| **Mapper** | `dto/ClienteMapper.java` | Traduce `Cliente` (dominio) → `ClienteResponse` (JSON). |

## Cómo lo hemos hecho 

1. **`ClienteRepositoryJdbcImpl.findUltimos(limite)`** — ejecuta con `JdbcTemplate`:
   ```sql
   SELECT idcliente, nombre, nif_cif, direccion, codigopostal,
          poblacion, provincia, telefono, email, fecha_alta
   FROM clientes ORDER BY idcliente DESC LIMIT ?
   ```
   - **`ORDER BY idcliente DESC`**: `idcliente` es **autoincremental** (la BD asigna un número
     mayor a cada alta nueva), así que ordenar de mayor a menor equivale a ir **del más reciente
     al más antiguo**, sin necesitar una columna de fecha.
   - **`LIMIT ?`**: de esa lista ya ordenada, nos quedamos solo con los primeros `limite`. El
     troceado lo hace **MySQL, no Java**, así que es eficiente aunque la tabla tenga miles de filas.
   - **El `?` evita la inyección SQL**: `JdbcTemplate` usa un *PreparedStatement*, donde el valor
     de `limite` viaja a la BD **aparte** del texto SQL y **nunca se interpreta como código**. Si
     en cambio pegáramos el valor dentro del `String` (`... LIMIT " + limite`), un valor malicioso
     podría "colar" instrucciones SQL extra; con `?` el dato y la instrucción van por separado y
     eso es imposible.

   El resultado se guarda en una variable, se **loguea** (SLF4J) y se devuelve.
2. **`ClienteRowMapper.mapRow`** — construye un `Cliente` leyendo cada columna del `ResultSet`.
3. **`ClienteServiceImpl.listarUltimos(limite)`** — delega en el repositorio (aquí viviría la
   regla de negocio si se complicara).
4. **`ClienteMapper.toResponse(cliente)`** — traduce el `Cliente` de dominio al
   `ClienteResponse` que viaja como JSON.
5. **`ClienteController.listarUltimos(limite)`** — valida el `limite` (acotado 1–100), pide al
   service, mapea a `ClienteResponse`, **loguea** el resultado y lo devuelve. Va envuelto en
   `try/catch (DataAccessException)`: si la BD falla, lo registra en el log y devuelve `500`.
6. **`clientes.js`** — pide una página, y por cada cliente clona el `<template>` de la tabla
   rellenándolo con `textContent` (seguro frente a `<`/`&`).

### Paginación (de N en N)

Además de `listar-ultimos`, añadimos un **endpoint nuevo** `GET /cliente/listar-pagina?pagina=&tamano=`
(deja `listar-ultimos` intacto). **Idea**: `LIMIT n` = "dame n filas"; `OFFSET m` = "sáltate m". Con
páginas de 10: página 0 → `OFFSET 0`, página 1 → `OFFSET 10`… (`offset = pagina * tamano`); el
troceado lo hace MySQL. Las piezas:

- **Repositorio**: `findPagina(tamano, offset, busqueda, provincia, poblacion, ordenarPor, direccion)`
  (`... WHERE ... ORDER BY ... LIMIT ? OFFSET ?`) y `contarTotal(busqueda, provincia, poblacion)`
  (`SELECT COUNT(*)` con `queryForObject`, que devuelve un único valor).
- **DTO `PaginaClienteResponse`**: la lista de la página + metadatos (`paginaActual`, `totalPaginas`,
  `totalElementos`, `hayAnterior`, `haySiguiente`) para que el frontend sepa dónde está.
- **Service `listarPagina(...)`**: calcula `offset`, el total de páginas con
  `Math.ceil((double) total / tamano)`, los flags `hayAnterior/haySiguiente`, y mapea a `ClienteResponse`.
- **Controller `listarPagina`**: mismo patrón (validación, logs, `try/catch`); devuelve el `PaginaClienteResponse`.
- **`clientes.js`**: guarda la `paginaActual`, pide `/cliente/listar-pagina?...`, pinta
  `datos.contenido` y **activa/desactiva** los botones "Anterior"/"Siguiente" según los flags.

> **Ojo con el `offset`**: se calcula como `(long) pagina * tamano`, con el `(long)` en el **primer**
> operando. Si se multiplicara en `int` y se ampliara después, una página muy alta (`?pagina=30000000`)
> **desbordaría** el `int` antes de convertirse, daría un offset **negativo** y MySQL fallaría con un
> error de sintaxis. Un `500` que cualquiera puede provocar desde la barra de direcciones.

### Buscador, filtros y ordenación

Los tres se resuelven en la **misma consulta**: se monta un `WHERE` con lo que llegue informado y
se le pega el `ORDER BY` y el `LIMIT/OFFSET`.

#### Un solo constructor de `WHERE` (`anadirFiltros`)

`findPagina` (las filas) y `contarTotal` (cuántas hay) llaman **al mismo método**. Es importante:
si cada uno montara su propio `WHERE`, bastaría con que alguien tocara uno y se olvidara del otro
para que el número de páginas dejara de cuadrar con lo que se ve en pantalla.

Las condiciones se van metiendo en una lista y al final se unen con `AND`. Así no hay que ir
preguntando en cada `if` "¿soy la primera, pongo `WHERE` o `AND`?".

#### Búsqueda: los comodines de `LIKE` hay que escaparlos

La búsqueda usa `LIKE` con comodines alrededor del término:

```sql
WHERE (nombre LIKE ? ESCAPE '\' OR nif_cif LIKE ? ESCAPE '\')
```

- **Los paréntesis del `OR` son obligatorios**: sin ellos, los `AND` de los filtros solo se
  aplicarían a la parte del `nif_cif`, porque `AND` tiene **prioridad** sobre `OR`.
- **`%` y `_` son metacaracteres de `LIKE`** (`%` = "cualquier cosa", `_` = "un carácter
  cualquiera"). Si el término del usuario se mete tal cual, buscar `%` produce el patrón `%%%`,
  que casa con **TODAS** las filas: el buscador deja de filtrar y devuelve la tabla entera. Por eso
  `escaparComodines()` los neutraliza antes de envolver el término. **No es inyección SQL** (el
  valor sigue viajando como `?`), pero sí una forma de saltarse el filtro.
- **El orden de escapado importa**: la barra invertida va **primero**. Si se escapara la última,
  volvería a escapar las barras que acabamos de introducir para `%` y `_`.
- **Sin `LOWER()`**: la tabla es `utf8mb4_0900_ai_ci`, y ese `ai_ci` significa *accent insensitive,
  case insensitive*: ya compara ignorando mayúsculas **y** acentos, así que `garcia` encuentra
  `García`. Envolver la columna en `LOWER()` no cambiaría el resultado y además la volvería
  **no-sargable** (con una función encima, ningún índice puede usarse).

#### Ordenación: por qué hace falta una lista blanca

El `ORDER BY` **no admite `?`**. No es un capricho: un `?` es un *valor*, y el nombre de una
columna es *parte de la instrucción*. Así que, o se traduce, o habría que concatenar el texto del
usuario dentro del SQL — y eso **sí** sería inyección SQL de manual.

La solución son dos parámetros y dos traducciones:

```java
ordenarPor  →  se busca como CLAVE en el mapa COLUMNAS_ORDEN → nombre real de columna
direccion   →  "asc".equalsIgnoreCase(direccion) ? "ASC" : "DESC"
```

Fíjate en que el texto del usuario **nunca se concatena**: solo se usa como clave de búsqueda. Si
pide una columna que no está en el mapa (o intenta colar `nombre; DROP TABLE clientes`), no se
encuentra y cae en el valor por defecto. La dirección solo puede acabar valiendo `ASC` o `DESC`.

Ventaja de tenerlo en dos parámetros en vez de un único string tipo `nombre_az`: **permitir ordenar
por una columna más es añadir una línea al mapa**, y funciona en ambos sentidos automáticamente.
Con el string opaco harían falta dos valores nuevos por cada columna.

El `ORDER BY` que sale es:

```sql
ORDER BY fecha_alta IS NULL, fecha_alta DESC, idcliente DESC
```

- **`columna IS NULL` primero**: `fecha_alta` admite `NULL`, y MySQL coloca los nulos al principio
  en `ASC` y al final en `DESC`. Sin esto, los clientes sin fecha **saltarían de un extremo al otro**
  de la lista al invertir el orden. Con esto quedan siempre al final.
- **`idcliente` de desempate**: sin él, dos clientes con la misma fecha (o el mismo nombre) pueden
  salir en orden distinto en cada consulta y, al paginar, verse **repetidos** en una página y
  **desaparecer** de la siguiente.

**La ordenación se aplica sobre lo ya filtrado sin trabajo extra**: en SQL el `ORDER BY` se evalúa
*después* del `WHERE`. Si filtras por Madrid y ordenas alfabéticamente, ordena los de Madrid.

#### Frontend: un único estado

`clientes.js` guarda **un solo objeto** `{ busqueda, provincia, poblacion, ordenarPor, direccion }`.
Es lo que impide que los controles se contradigan: se puede cambiar el orden desde el selector de
la barra **o** pulsando las cabeceras "Nombre" y "Alta" de la tabla, y como los dos caminos escriben
en el mismo sitio y luego se repinta todo desde ahí, no pueden acabar mostrando cosas distintas.

- **Al cambiar cualquier criterio se vuelve a la página 0.** Si estás en la página 7 y filtras por
  una provincia con 12 clientes, esa página ya no existe y verías una tabla vacía sin saber por qué.
- **Debounce de 300 ms** en el buscador: se reinicia un temporizador en cada tecla y solo se consulta
  cuando el usuario para de escribir. Sin él, teclear "garcia" lanzaría 6 consultas a la BD.
- **`AbortController`**: el debounce reduce las peticiones, pero no evita que **dos respuestas se
  crucen**. Si escribes "gar", sale la petición, sigues hasta "garcia" y la respuesta de "gar" llega
  la última, pintaría la tabla con resultados que no son los del texto del buscador. El helper
  `pedirJson(canal, url)` cancela la petición anterior **del mismo canal** antes de lanzar la nueva.
  Se usan canales separados (`listado`, `provincias`, `poblaciones`) porque al cambiar de provincia
  se piden a la vez las poblaciones y el listado: con un único controlador compartido, cada una
  abortaría a la otra.
- **Cascada de desplegables**: al elegir provincia se recargan sus poblaciones y se limpia la que
  hubiera elegida (si no, quedaría un filtro "Valencia + Madrid" que no devuelve nada).
- **Columna "Alta"** en la tabla: ordenar por fecha de alta sin ver la fecha no hay forma de
  comprobarlo.

### Refresco automático tras cambios

Cuando se crea, edita o elimina un cliente, la tabla debe reflejarlo. Lo resolvemos con un **evento
personalizado**, para **desacoplar** nuestra parte de la de los compañeros: `clientes.js` **escucha**
el evento `clientes:cambiaron` y, al recibirlo, **recarga la página actual** (`cargarClientes(paginaActual)`),
volviendo a pedir los datos a la BD. Así nuestra tabla siempre está al día sin conocer el código de
quien hace el cambio (ellos solo tienen que **disparar** el evento — ver la última sección).

Optamos por **re-fetch** (volver a pedir) en vez de tocar el DOM a mano: es más simple y garantiza que
la tabla coincide con la BD. Y descartamos **caché** a propósito: con datos que cambian, un caché
serviría datos viejos (lo contrario de lo que queremos) y habría que invalidarlo en cada cambio.

## Logs y manejo de errores

Usamos **SLF4J** (`private static final Logger log = LoggerFactory.getLogger(...)`), que escribe
al log configurado en `logback-spring.xml` y permite **niveles**. Ponemos **un log por capa**, con
la granularidad adecuada:

- **Repositorio** (`findUltimos`): `log.debug("findUltimos({}) -> {} filas", ...)` — nivel `DEBUG`
  porque es detalle técnico de la consulta.
- **Servicio** (`listarUltimos`): `log.info("listarUltimos({}) -> {} clientes", ...)`.
- **Controller** (`listarUltimos`): `log.info(...)` al recibir la petición (con el `limite`) y al
  responder (con el nº de clientes).
- **RowMapper**: **sin log a propósito** — se ejecuta una vez por CADA fila y llenaría la consola.

Fíjate que para poder loguear el valor **primero lo guardamos en una variable y luego lo
devolvemos** (ver ["Decisiones de estilo"](#a-decisiones-de-estilo-inyección-de-dependencias-y-forma-del-return)).

**Errores**: el controller envuelve la operación en `try/catch (DataAccessException)`. Si la BD
falla, `log.error("...", e)` deja el fallo (con su traza) **en el log**, y al navegador le
respondemos un **`500`** limpio (cuerpo vacío) en vez de soltarle una traza interna.

## Base de datos

La app se conecta a `jdbc:mysql://localhost:3306/bd_facturacion` (root/root, en
`application.properties`). La tabla real es **`clientes`**, con columnas: `idcliente`,
`nombre`, `nif_cif`, `direccion`, `codigopostal`, `poblacion`, `provincia`, `telefono`,
`email`, `fecha_alta`. Necesitas esa BD arrancada y con datos. *(El script de ejemplo que
tuvimos, `bd_facturacion.sql`, se retiró porque usaba nombres antiguos.)*

## Cómo testear

1. Tener **MySQL** arrancado con la BD `bd_facturacion` y la tabla `clientes` con datos.
2. Desde `facturacion360/`: `./mvnw spring-boot:run`.
3. **Listar últimos**: `GET http://localhost:8080/cliente/listar-ultimos` → `200` + lista JSON.
   Probar los límites: `?limite=3` → 3; `?limite=500` → 100 (acotado); `?limite=0` → 1.
4. **Paginación**: `GET http://localhost:8080/cliente/listar-pagina?pagina=0&tamano=10` → `200` con
   `contenido` + metadatos (`paginaActual`, `totalPaginas`, `hayAnterior`, `haySiguiente`).
5. **Buscador**: `?busqueda=garcia` → encuentra "María López García" y "Juanita Pérez García";
   `?busqueda=GARCIA` → lo mismo (la collation ignora mayúsculas); `?busqueda=12345678` → encuentra
   por NIF; `?busqueda=zzzznoexiste` → `200` con `contenido: []` (**no** un 204: un 204 no lleva
   cuerpo y rompería el `respuesta.json()` del frontend).
6. **Comodines escapados** (la comprobación importante): `?busqueda=%25` (que es `%` codificado) y
   `?busqueda=_` → deben devolver `contenido: []`. Si devolvieran la tabla entera, el escapado
   estaría roto.
7. **Filtros**: `?provincia=Madrid`; `?provincia=Madrid&poblacion=Parla`. Y los desplegables:
   `GET /cliente/provincias`, `GET /cliente/poblaciones?provincia=Madrid` → `["Madrid","Parla"]`.
8. **Ordenación**: `?ordenarPor=nombre&direccion=asc` → alfabético; `...&direccion=desc` → el orden
   exactamente inverso; `?ordenarPor=fecha_alta&direccion=asc` → empieza por la fecha más antigua.
9. **Lista blanca**: `?ordenarPor=;DROP TABLE&direccion=x` → cae al orden por defecto, **sin error**.
10. **Offset desbordado**: `?pagina=30000000&tamano=100` → página vacía, **no** un `500`.
11. **Frontend**: abrir `http://localhost:8080/clientes.html` → la tabla se rellena y los botones
    **"Anterior" / "Siguiente"** cambian de página; el texto muestra "Página X de Y". Escribir en el
    buscador filtra tras la pausa; elegir provincia recarga las poblaciones en cascada; pulsar la
    cabecera "Nombre" ordena alfabéticamente y actualiza también el selector y el botón de la barra.
12. **AbortController**: con la pestaña Network abierta, teclear "garcia" deprisa → las peticiones
    intermedias aparecen como `canceled` y la tabla acaba mostrando lo que pone el input.
13. **Refresco automático**: en la consola del navegador ejecutar
    `document.dispatchEvent(new CustomEvent('clientes:cambiaron'))` → la tabla se recarga sola.
14. **Logs y errores**: mira la consola (`GET /cliente/...`, `listarUltimos(...) -> N`); si paras
    MySQL y repites, la respuesta es `500` y aparece un `log.error`.

## ⚠️ Si en la BD real la tabla o las columnas se llaman distinto

Los nombres de tabla/columnas están escritos "a mano" en el SQL, así que **deben coincidir en
varios sitios a la vez**. Si el esquema cambiara, hay que ajustarlos todos:

1. La constante **`COLUMNAS_CLIENTE`** de `ClienteRepositoryJdbcImpl` (la lista de columnas que
   comparten `findPagina` y las demás consultas; por eso está extraída, para no repetirla).
2. El `SELECT ... FROM clientes ...` de **`findUltimos`**.
3. Las condiciones de **`anadirFiltros`** (`nombre`, `nif_cif`, `provincia`, `poblacion`) y las
   consultas de **`findProvincias`** / **`findPoblaciones`**.
4. El mapa **`COLUMNAS_ORDEN`**, cuyos *valores* son nombres reales de columna (las *claves* son lo
   que manda el frontend y pueden quedarse como están).
5. Los `rs.getXxx("nombre_columna")` de **`ClienteRowMapper.mapRow`**.

Ejemplo: si la columna pasara a llamarse `id` en vez de `idcliente`, habría que ajustar
`COLUMNAS_CLIENTE`, el `ORDER BY ... idcliente` de `sqlOrden` y el `rs.getInt("idcliente")`.

> **Nota:** al principio seguimos el `ESQUEMA ER.png` (que usa `nombre_razon_social` y `pais`),
> pero el profe fijó como buenos los nombres **reales de la BD**: tabla `clientes`, columnas
> `idcliente`, `nombre`, `codigopostal`… El código ya usa esos nombres reales.

---


## TODO — Mejoras de calidad (de la auditoría)

Mejoras para dejar la parte más profesional. Aunque quizá no las implementemos, conviene
**entenderlas**.


### A. Decisiones de estilo: inyección de dependencias y forma del `return`

Dos elecciones de estilo de nuestra parte. **No hay una única "correcta"**: cada una tiene pros y
contras, así que las dejamos razonadas.

**1) Inyección de dependencias: `@Autowired` en el campo (lo que usamos) vs. por constructor.**
La "inyección" es que Spring te da los objetos ya creados en vez de hacer tú `new`. Se puede
recibir en el **atributo** o en el **constructor**:

| | `@Autowired` en campo *(actual, patrón del profe)* | Por constructor *(`private final` + constructor)* |
|---|---|---|
| **Pros** | Menos código, muy directo. | Campos `final` (**inmutables**); dependencias **a la vista**; **testeable sin Spring** (le pasas dobles). |
| **Contras** | El campo **no puede ser `final`** (es mutable); las dependencias quedan "**ocultas**" (hay que leer toda la clase); testear necesita Spring o reflexión. | Un poco **más de código**; **cambia el patrón del profe** (hay que acordarlo). |

```java
// Ejemplo por constructor:
private final ClienteService clienteService;
public ClienteController(ClienteService s) { this.clienteService = s; }
```
> **Decisión**: mantenemos **inyección por campo** para seguir el patrón del profe. Migrar a
> constructor sería trivial si se acuerda con él.


**2) Forma del `return`: guardar en variable vs. `return` directo.**

| | Variable → log → `return` *(actual)* | `return` directo *(como lo teníamos antes)* |
|---|---|---|
| **Pros** | Puedes **inspeccionar y loguear** el valor antes de devolverlo; en el depurador pones un breakpoint en el `return` y **ves la variable**; encaja con logs y `try/catch`. | Más corto y conciso. |
| **Contras** | Un poco **más verboso** (una línea extra). | **No puedes ver ni loguear** el valor sin partir la expresión; **depurar es más incómodo** (no hay variable donde poner el ojo). |

```java
// Ejemplo: 
List<Cliente> c = repo.findUltimos(l);   return repo.findUltimos(l);
log.debug("-> {}", c.size());
return c;
```
> **Decisión**: usamos el patrón variable sobre todo porque **facilita el log y el
> depurado** (poder mirar el valor justo antes de devolverlo).



### B. Manejo de errores centralizado (`@RestControllerAdvice`)
**Concepto**: cuando un endpoint lanza una excepción, Spring puede **desviarla** a una clase
"guardiana" que decide qué responder, en vez de soltar el error por defecto. 
Es como un `catch`
global para todos los controllers.
- **Cómo**: una clase con métodos `@ExceptionHandler`, uno por tipo de error:
  ```java
  @RestControllerAdvice
  public class ManejadorErrores {
      @ExceptionHandler(DataAccessException.class)   // errores de BD
      public ResponseEntity<String> bd(DataAccessException e) {
          return ResponseEntity.status(500).body("Error de base de datos");
      }
  }
  ```
- **Por qué es relevante**: hoy, si MySQL falla, el navegador recibe una **traza interna fea**
  (con detalles que no deberían salir).
  Con esto das respuestas **limpias y uniformes** y no
  repites `try/catch` en cada endpoint.

### C. Tests automáticos (`@JdbcTest` y `@WebMvcTest`)
**Concepto**: un test es código que **comprueba solo** que otro código hace lo que debe. Spring
permite probar **una capa aislada** sin levantar toda la app. Un "mock" (o doble) es un objeto
falso que simula a otro para no depender de él (p. ej. simular el service para probar el
controller sin BD).
- **Cómo**:
  - `@JdbcTest` para el **repositorio**: arranca solo lo justo para la BD y comprueba que
    `findUltimos` devuelve y ordena bien (con una BD de test o Testcontainers).
  - `@WebMvcTest(ClienteController.class)` + `MockMvc`: levanta **solo la capa web** y simula
    peticiones HTTP; con `@MockBean ClienteService` sustituyes el service por un doble, así
    pruebas que `GET /cliente/listar-ultimos` responde `200` y el JSON correcto **sin tocar la BD**.
- **Por qué es relevante**: detectan roturas al cambiar código, **documentan** el comportamiento
  esperado y aíslan cada capa. Dan confianza (y nota).

### D. `limite` como `@RequestParam` (quitar el "número mágico") — ✅ IMPLEMENTADO
**Concepto**: un "número mágico" es un valor fijo escrito en el código (aquí, el `10`) que no se
puede cambiar desde fuera. Con `@RequestParam` ese valor llega por la URL.
- **Cómo (ya hecho en `ClienteController.listarUltimos`)**:
  ```java
  @GetMapping("/listar-ultimos")
  public ResponseEntity<List<ClienteResponse>> listarUltimos(
          @RequestParam(defaultValue = "10") int limite) {
      int limiteSeguro = Math.max(1, Math.min(100, limite)); // acotado a [1, 100]
      // ... clienteService.listarUltimos(limiteSeguro) ...
  }
  ```
- **Por qué es relevante**: **flexibilidad sin romper nada** (`/listar-ultimos` sigue dando 10;
  `?limite=25` da 25). El valor se **acota a 1–100** para que nadie pida `?limite=999999` y sature
  la BD. *(Alternativa más "REST": `@Validated` + `@Min/@Max` devolviendo `400`, pero necesita el
  manejador de errores del TODO B; por eso de momento acotamos.)*

### E. Renombrar la rama a `Angel_listar_ultimos` (pendiente, flujo git)

Cambio de flujo (no afecta al código): renombrar la rama de trabajo a un nombre más descriptivo.
Como la rama ya está en el remoto, son tres pasos (estando en la rama):
```bash
# 1. Renombrar la rama LOCAL
git branch -m Angel_listar_ultimos

# 2. Subir la rama con el nombre nuevo y fijar su seguimiento (upstream)
git push -u origin Angel_listar_ultimos

# 3. Borrar la rama vieja del remoto (solo si no hay una PR abierta sobre ella)
git push origin --delete Angel
```

### F. Índices de base de datos para los filtros y la ordenación (pendiente)

La tabla `clientes` solo tiene `PRIMARY KEY (idcliente)` y `UNIQUE KEY (nif_cif)`. Los filtros que
añadimos comparan por **igualdad** (`WHERE provincia = ?`, `WHERE poblacion = ?`) y la ordenación
usa `nombre` y `fecha_alta`: **ninguna de esas cuatro columnas tiene índice**, así que MySQL recorre
la tabla entera para resolverlas.

Un índice es como el índice alfabético de un libro: permite saltar a lo que buscas sin leer todas
las páginas. Pero solo sirve si la condición se puede "buscar por orden".

**Aquí está el matiz importante**: al **buscador** un índice **no** le serviría. Usa
`LIKE '%texto%'`, y ese `%` **inicial** significa "que contenga", no "que empiece por" — como no
sabes por qué letra empieza, el orden alfabético no te ayuda y hay que mirar fila por fila igual.
Por eso el índice **no** arregla la búsqueda; arregla los **filtros** y la **ordenación**, que sí
son condiciones ordenables.

```sql
ALTER TABLE clientes ADD INDEX idx_provincia_poblacion (provincia, poblacion);
ALTER TABLE clientes ADD INDEX idx_nombre (nombre);
```

El índice compuesto `(provincia, poblacion)` sirve para las dos combinaciones que usa el frontend:
filtrar solo por provincia, y filtrar por provincia + población. El orden de las columnas importa:
un índice compuesto se puede usar "de izquierda a derecha", así que `(provincia, poblacion)` vale
para `WHERE provincia = ?` pero **no** para `WHERE poblacion = ?` a solas.

**Por qué está pendiente y no hecho:** con las 7 filas actuales no se nota absolutamente nada —es
una mejora pensada para cuando la tabla crezca—, y sobre todo **toca `backupFacturacion360.sql`,
que es un script compartido por todo el equipo**. Conviene comentarlo con Val antes de meterlo en
ninguna rama, para no pisar el esquema de los demás.

---

## Para los compañeros: avisar cuando cambie un cliente

**¿Tenéis que tocar vuestro código? Sí, una sola línea.** Nuestra tabla se refresca sola, pero
necesita que le **aviséis** cuando un cliente cambie. **Justo después de que vuestro `fetch` de
crear, editar o eliminar responda con éxito (2xx)**, disparad este evento:

```js
document.dispatchEvent(new CustomEvent('clientes:cambiaron'));
```

Ejemplo (eliminar):
```js
async function eliminarCliente(id) {
    const respuesta = await fetch(`/cliente/${id}`, { method: 'DELETE' });
    if (respuesta.ok) {
        document.dispatchEvent(new CustomEvent('clientes:cambiaron')); // <-- la tabla se recarga sola
    }
}
```

Notas:
- **No hay que pasar datos** en el evento ni conocer nuestras funciones: basta con dispararlo.
- Nosotros recargamos la **página actual**. Si al **crear** queréis que el cliente nuevo se vea al
  instante (aparece el primero, en la página 0), llevad además al usuario a esa primera página.

