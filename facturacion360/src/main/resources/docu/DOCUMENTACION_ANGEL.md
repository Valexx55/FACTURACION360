# Clientes — Listado, buscador, filtros, ordenación, detalle y edición

Muestra en la tabla de `clientes.html` **los clientes** dados de alta, con **buscador**,
**filtros** por provincia y población y **ordenación**, pidiéndolos al backend por `fetch`.
Cada fila se **despliega** para ver el detalle completo o para **editarlo** allí mismo.
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
- **Ver el detalle**: `GET /cliente/{id}` → todos los datos de un cliente, incluidos los que la
  tabla no enseña (dirección, código postal, población y provincia).
- **Editar**: `PUT /cliente/{id}` → guarda los cambios del formulario que se abre en la fila.
- **Frontend**: `clientes.js` pide una página y pinta la tabla; arriba hay una barra con el
  buscador, los dos desplegables y el control de orden, y debajo los botones
  **"Anterior" / "Siguiente"** para moverse entre páginas. Al pulsar una fila (o el botón del
  ojo) se despliega **debajo** una fila con el detalle; con el lápiz, con los campos
  editables.

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

#### La página y el total, en la misma transacción

`listarPagina` hace **dos** consultas: una trae las filas de la página y otra cuenta el total para
saber cuántas páginas hay. Si cada una va por su cuenta y alguien da de alta o borra un cliente
justo entre las dos, verían estados distintos de la tabla: el total diría "12 clientes" mientras se
muestran 10 filas, y la paginación no cuadraría.

Por eso el método lleva:

```java
@Transactional(readOnly = true)
```

Con la transacción abierta, MySQL (InnoDB, aislamiento `REPEATABLE READ`) sirve **las dos consultas
desde la misma foto** de la tabla. El `readOnly = true` avisa además al driver de que no vamos a
escribir, con lo que puede optimizar.

**Los demás métodos de lectura NO la llevan, y es intencionado**: `listarUltimos`,
`listarProvincias` y `listarPoblaciones` hacen **una sola** consulta, así que no hay dos lecturas
que puedan discrepar entre sí y una transacción solo añadiría un `BEGIN`/`COMMIT` sin ganar nada.
Anotar por costumbre allí donde no hace falta es ruido.

#### Los criterios viajan juntos: el record `CriteriosCliente`

Los siete datos que definen una consulta (`pagina`, `tamano`, `busqueda`, `provincia`, `poblacion`,
`ordenarPor`, `direccion`) **no se pasan sueltos**, sino agrupados en un `record`.

El motivo: esa firma de siete parámetros aparecía en **cinco sitios** (controller, interfaz e
implementación del service, e interfaz e implementación del repository). Añadir un filtro nuevo
obligaba a tocar los cinco y a no equivocarse de orden en ninguno. Con el record se añade un
componente y ya está. Es el *code smell* clásico de "lista larga de parámetros".

Spring lo rellena solo desde la URL con `@ModelAttribute`, emparejando cada parámetro con el
componente que se llama igual:

```java
@GetMapping("/listar-pagina")
public ResponseEntity<PaginaClienteResponse> listarPagina(
        @Valid @ModelAttribute CriteriosCliente criterios) { ... }
```

**Toda la normalización vive en su constructor compacto**, y eso es lo importante: antes estaba
repartida —el acotado de la página en el controller, la limpieza del término en el service—, así que
había dos sitios donde se decidía qué es un valor válido. Ahora hay uno solo, y da igual si el
record lo construye Spring desde la URL o alguien a mano.

```java
public CriteriosCliente {
    pagina = (pagina == null || pagina < 0) ? 0 : pagina;
    tamano = (tamano == null || tamano <= 0) ? TAMANO_DEFECTO : Math.min(TAMANO_MAX, tamano);
    busqueda = normalizar(busqueda);   // "" y "   " -> null
    ...
}
```

**¿Por qué `Integer` y no `int` en `pagina` y `tamano`?** Es la parte menos evidente y conviene no
tocarla sin saber por qué está. Cuando un parámetro **no viene en la URL**, Spring intenta enlazar
`null` — y `null` no se puede convertir a un primitivo. Con `int` la aplicación respondía `400` a
**todas** las peticiones, incluidas las correctas:

```
Failed to convert value of type 'null' to required type 'int'
```

Con `Integer`, el `null` llega sin problema y es el constructor compacto quien decide el valor por
defecto. A partir de ahí ya nunca son `null`, así que se usan como si fueran `int`.

> Detalle a recordar: esto **compilaba perfectamente**. Solo se ve arrancando la aplicación y
> haciendo una petición. Que un refactor compile no significa que funcione.

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

### Cómo está documentada esta parte (Javadoc)

Los contratos se documentan **en las interfaces**, `ClienteRepository` y `ClienteService`, con
`@param`, `@return` y `@throws`. Las implementaciones no repiten ese Javadoc: duplicarlo obliga a
mantener dos textos que acaban diciendo cosas distintas. Lo que sí llevan las implementaciones son
comentarios `//` que explican **cómo** y **por qué** se hace algo, no **qué** hace.

Se documenta también `@throws DataAccessException`, porque forma parte real del contrato: el
controller la captura para responder un `500` en vez de dejar escapar el error.

#### Las etiquetas `@author` y `@autor`

Conviven dos, y no es una errata:

| Etiqueta | Dónde | Por qué |
|---|---|---|
| `@author` | Clases y records | Es la estándar de Javadoc |
| `@autor` | Métodos sueltos | La estándar **no se admite** en métodos |

El `@author` estándar solo vale en *overview*, *package* y *class/interface*. Ponerlo sobre un
método no es que se ignore: con doclint activo **falla la generación** del Javadoc. Para poder
firmar métodos concretos se declara una etiqueta propia en el `pom.xml`:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-javadoc-plugin</artifactId>
    <configuration>
        <tags>
            <tag>
                <name>autor</name>
                <placement>tm</placement>
                <head>Autor:</head>
            </tag>
        </tags>
    </configuration>
</plugin>
```

`placement` indica dónde vale la etiqueta: `t` tipos, `m` métodos, `f` campos, `c` constructores,
`p` paquetes, `a` todas. Con `tm` se admite en clases y en métodos.

> **Importante:** esa configuración y las etiquetas `@autor` van juntas. Si se quita del `pom.xml`,
> javadoc pasa a considerarlas desconocidas y la generación falla. Para retirarla hay que borrar
> antes las etiquetas del código.

Generar la documentación:

```bash
./mvnw javadoc:javadoc      # sale en target/reports/apidocs/index.html
```

### Refresco automático tras cambios

Cuando se crea, edita o elimina un cliente, la tabla debe reflejarlo. Lo resolvemos con un **evento
personalizado**, para **desacoplar** nuestra parte de la de los compañeros: `clientes.js` **escucha**
el evento `clientes:cambiaron` y, al recibirlo, **recarga la página actual** (`cargarClientes(paginaActual)`),
volviendo a pedir los datos a la BD. Así nuestra tabla siempre está al día sin conocer el código de
quien hace el cambio (ellos solo tienen que **disparar** el evento — ver la última sección).

Optamos por **re-fetch** (volver a pedir) en vez de tocar el DOM a mano: es más simple y garantiza que
la tabla coincide con la BD. Y descartamos **caché** a propósito: con datos que cambian, un caché
serviría datos viejos (lo contrario de lo que queremos) y habría que invalidarlo en cada cambio.

### Ver el detalle y editar en la propia fila

La tabla enseña cinco columnas, pero un cliente tiene diez campos. Al pulsar una fila —o el
botón del ojo— se inserta **debajo una fila hermana** que ocupa todas las columnas
(`colspan`) y muestra el resto de datos con sus propias cabeceras `<th>`. Con el lápiz se
abre esa misma fila, pero con los campos editables. Se pueden tener **varias abiertas a la
vez** y cada una se cierra volviendo a pulsarla.

**Un solo panel por cliente, con un modo** (`detalle` o `edicion`), en vez de dos filas
independientes. Con dos filas se podría acabar viendo a la vez el detalle y el formulario del
mismo cliente diciendo cosas distintas, y habría que sincronizarlos; con una sola, cambiar de
modo es cambiar lo de dentro.

#### El backend: `GET /cliente/{id}`

- **`ClienteRepositoryJdbcImpl.findById(id)`** usa `query(...).stream().findFirst()` y **no**
  `queryForObject`. Este último lanza `EmptyResultDataAccessException` cuando no hay fila, y
  "ese cliente no existe" es una respuesta prevista (acaba en un `404`), no un fallo de acceso
  a datos: montar un `try/catch` para un caso normal es tratar como excepción lo que no lo es.
- **El service devuelve `Optional<Cliente>`** por lo mismo: con `null` es fácil olvidarse de
  comprobarlo, y el `Optional` obliga.
- **El controller** traduce ese `Optional` a `200` o `404`, y captura `DataAccessException`
  para el `500`, igual que el resto de endpoints.
- **No choca con `/cliente/listar-pagina`**: Spring da prioridad a las rutas literales sobre
  las que llevan variable. Y `/cliente/abc` devuelve `400` solo, porque no puede convertir el
  `{id}` a `int`.

#### El frontend: estado fuera del DOM

La tabla **se repinta entera** cada vez que se pagina, se busca o se refresca, así que los
paneles abiertos se perderían. Por eso el estado vive en un `Map` (`filasDesplegadas`):
`id del cliente -> { modo, borrador }`. Después de pintar las filas, `reabrirDespliegues()`
vuelve a abrir los que sigan en la página.

- **Los datos se piden SIEMPRE al backend**, también al cambiar de modo. Es la misma decisión
  que ya tomamos en el listado (*re-fetch* en vez de caché): un detalle guardado de antes
  puede enseñar algo que otro usuario ya cambió, y en el formulario sería peor todavía,
  porque se guardaría encima sin haberlo visto.
- **`borrador`**: si la tabla se repinta mientras hay un formulario abierto (basta con teclear
  en el buscador), lo escrito se guarda antes de vaciar el `<tbody>` y se restaura al
  reabrirlo. Sin eso, se perdería sin avisar.
- **Delegación de eventos**: un único listener de `click` y otro de `submit` en el `<tbody>`.
  Los botones se crean y se destruyen en cada repintado, así que enlazarlos uno a uno
  obligaría a volver a hacerlo cada vez. *(Los `addEventListener` que había sobre `.btn-ver` y
  `.btn-editar` no llegaban a enlazar nada: se registraban al cargar la página, cuando esos
  botones todavía vivían dentro del `<template>`.)*
- **Un canal de `AbortController` por fila** (`detalle-7`, `guardar-7`): abrir dos filas a la
  vez lanza dos peticiones que no deben cancelarse entre ellas, que es justo por lo que ya
  había canales separados para el listado y los desplegables.

#### El aviso de "Ver detalles" al segundo de ratón encima

Es un *tooltip* de Bootstrap con `delay: { show: 1000 }`, **delegado** en el `<tbody>`
(opción `selector`): así vale también para las filas que aún no existen y no hay que crearlo y
destruirlo en cada repintado. Dos detalles que costaron:

- **`container: 'body'`**: la tabla vive dentro de `.table-responsive`, que tiene `overflow`,
  y el globo se veía recortado por arriba.
- El texto cambia según el estado ("Ver detalles" / "Ocultar detalles"), pero el globo se crea
  en el **primer** hover y se queda con el texto que hubiera entonces. Por eso, al alternar, se
  reescribe `data-bs-title` y se **destruye** la instancia: el hover siguiente la vuelve a
  crear ya con el texto nuevo. Y antes de repintar la tabla se destruyen todas, o se quedan
  globos flotando sobre una fila que ya no existe.
- El aviso **no sale sobre la celda de acciones**: cada botón de allí explica lo suyo.

#### Editar: dos arreglos en el `PUT` que ya existía

1. **La fecha de alta se perdía en la respuesta.** El `ClienteMapper.toDomain` deja `fechaAlta`
   a `null` (no viene en el `ClienteRequest`) y el service copiaba ese `null` al objeto que
   devolvía. La BD conservaba el dato —el `UPDATE` no toca esa columna—, pero el JSON de
   respuesta lo traía vacío, así que la fila se repintaba con un guion en la columna "Alta".
   Ahora se lee el cliente antes de actualizar y se conserva su fecha.
2. **No se distinguía "no existe" de "no cambió nada".** El resultado salía del número de filas
   que devuelve el `UPDATE`, y ese número no separa los dos casos: con la configuración por
   defecto del driver funciona de casualidad (MySQL informa de filas *encontradas*), pero basta
   con activar `useAffectedRows=true` para que guardar sin tocar ningún campo empiece a
   responder `404`. Ahora se comprueba antes con `findById`, y la lectura y la escritura van en
   la **misma transacción** para que entre las dos no se cuele un borrado.

Además, el controller no capturaba nada: cambiar el NIF por el de otro cliente viola el índice
`UNIQUE` de `nif_cif`, la `DuplicateKeyException` se escapaba y el navegador recibía la página
de error de Spring **con la traza dentro**. Ahora devuelve `409`, igual que hace `crear`.

#### Validación: la misma en los dos lados

Los `input` del formulario llevan **exactamente** las restricciones de `ClienteRequest`
(`required` donde hay `@NotBlank`, `maxlength` con el mismo número que el `@Size`,
`type="email"`). Así el navegador corta lo que el servidor rechazaría y no se gasta una
petición para recibir un `400`. Del servidor solo puede llegar un error que el navegador no
puede prever: el **`409` del NIF repetido**, y se señala en *su* campo y no en un aviso
general, porque si no el usuario tendría que adivinar cuál de los ocho campos falla.

> El modal de "Añadir Cliente" (de otra feature) solo tiene cuatro campos, y dirección,
> población y provincia son obligatorias en el backend: por eso el formulario de edición los
> lleva **todos**. Y por eso la función de guardar se llama `guardarEdicion` y no
> `guardarCliente`: ese nombre lo ocupa el `onclick` de ese modal.

#### Qué pasa exactamente al pulsar "Guardar"

Un guardado no termina cuando el `PUT` responde `200`: la fila que se estaba editando puede
haber cambiado de sitio (si se ordena por nombre y se le cambia el nombre) o de página, y el
botón que el usuario tenía pulsado deja de existir. Esta es la secuencia y por qué cada paso:

1. **Se olvida el panel abierto por su `id`**, no por la referencia al `<tr>`. Si la tabla se
   ha repintado mientras viajaba la petición, esa referencia apunta a una fila que ya no está
   en el documento y el `Map` de paneles abiertos se quedaría con una entrada fantasma: al
   refrescar volvería a abrirse el formulario de un cliente que el usuario ya había guardado.
2. **Se anota a quién hay que devolverle el foco** (`focoPendiente`) y, cuando `pintarFilas()`
   termina de repintar, `devolverFoco()` lo lleva al botón de editar de esa misma fila. Sin
   eso, el foco se va al `<body>` y quien navega con teclado vuelve al principio de la página
   después de cada guardado. Si el cliente ya no está en la página (se ha ido a otra, o ya no
   cumple el filtro), no se fuerza el foco a ningún sitio raro.
3. **Se anuncia "Cliente guardado"** en la franja `role="status"` que hay entre los filtros y
   la tabla. Está **fuera** de la tabla a propósito: dentro del panel, el refresco del punto
   siguiente la borraría en el mismo instante en que se escribe. Guardar cambia la pantalla sin
   cambiar de contexto y hay que poder enterarse sin verla (criterio **4.1.3**). El mensaje se
   borra solo a los cinco segundos, porque un "Cliente guardado" fijo acaba pareciendo el
   resultado de la última acción aunque sea de hace diez minutos.
4. **Se dispara `clientes:cambiaron`**, el mismo evento que usan los compañeros. La tabla se
   recarga sola con `cargarClientes(paginaActual)` y así enseña lo que hay en la BD, incluido
   lo que haya cambiado otro usuario mientras tanto.

**El `404` de "alguien lo ha borrado mientras lo editabas"** va también a esa franja, además de
a la alerta del formulario, y por lo mismo: ese caso dispara un refresco y el mensaje del panel
duraría lo que tarda en llegar la respuesta del listado.

**Y el `409` del NIF repetido no se marca solo en rojo.** El campo recibe `aria-invalid="true"`
y un `aria-describedby` que apunta al mensaje —que lleva el id del cliente dentro, porque puede
haber varios formularios abiertos y dos elementos no pueden compartir id—. El rojo de Bootstrap
es solo color: sin esos dos atributos, quien no ve la pantalla se encuentra el foco en un campo
que aparentemente no tiene nada. Al volver a teclear en el campo se limpian los tres.

#### Coordinación con `listarPagina`: la página que ya no existe

`listarPagina` **no reencamina** cuando le piden una página fuera de rango: devuelve esa página
vacía con el total real. Es lo correcto para una API —el paginado no puede saber si eso es un
error de quien llama o una tabla que ha encogido—, pero deja un caso feo en pantalla: si se
está en la página 4, se borran clientes hasta que solo quedan tres páginas y se refresca, la
tabla sale vacía diciendo *"Página 4 de 3"* y sin ninguna salida obvia.

La corrección va en el frontend, en `cargarClientes()`: si la respuesta viene vacía **pero hay
páginas**, se pide la última que sí existe. Es una sola llamada más y solo en ese caso. El
contador de peticiones en vuelo aguanta bien la recursión (la de dentro suma y resta antes que
la de fuera, así que el "cargando" no se apaga a medias), y el canal de `AbortController` del
listado tampoco se pisa: la petición anterior ya ha terminado cuando arranca la segunda.

#### `actualizar` también devuelve `Optional`

Igual que `obtenerPorId`, y por lo mismo: "ese cliente no existe" es un resultado normal que
acaba en un `404`, no un error, y con un `null` el controller puede olvidarse de comprobarlo.
Que los dos métodos del service que buscan un cliente concreto respondan igual quita una
excepción que recordar.

Relacionado, el `update` del repositorio quedó **documentado con su trampa**: devuelve si el
`UPDATE` modificó alguna fila, y MySQL cuenta 0 cuando la sentencia no cambia ningún valor. Un
`false` significa "no se ha modificado nada", que puede ser tanto que el cliente no exista como
que se haya guardado igual que estaba, y **no sirve para distinguirlos**. De ahí el `findById`
previo en la misma transacción.

### El buscador se solapaba con el filtro de al lado

Estando cerrado, el círculo de la lupa pisaba el desplegable de provincia. No era el icono: era
el `<input>`. Con `box-sizing: border-box`, **cuando el relleno supera al ancho, el ancho se
ignora**: los `3.2rem` del hueco de la lupa más `1rem` a la derecha más los bordes suman unos
69 px, que no caben en los 50 px del círculo, así que el campo se dibujaba 19 px más ancho que
su contenedor y se metía por debajo del control siguiente (el `gap` de la barra es de 8 px).

El arreglo es que **el ancho cerrado supere al relleno**. Al pasar el círculo a una píldora de
`9rem` (ver abajo) ya caben de sobra los `3.2rem` de la lupa más el `1rem` de la derecha, así
que el problema desaparece por construcción y el relleno puede ser el mismo abierto y cerrado.
La posición de la lupa se calcula desde la misma variable (`--hueco-lupa`) que usa el relleno,
para que no puedan volver a descuadrarse por separado.

**Y abierto tampoco puede partir la barra en dos líneas.** Sumando el buscador abierto
(`20rem`), los tres desplegables (210 + 210 + 290 px), el botón de limpiar y los huecos, no se
cabe en el ancho útil de un escritorio de 1140 px: al pulsar la lupa, "Limpiar" se caía a la
línea de abajo y la barra daba un salto. Dentro de la barra el tamaño lo decide el *flex*, así
que el buscador se dimensiona con **`flex-basis`** (y la transición va sobre él, o abrirse
sería un salto en vez de un crecimiento) y se le deja **encoger** (`flex-shrink: 1`) con un
suelo de `min-width: var(--ancho-cerrado)`: cuando falta sitio cede él, que es el único con
espacio de sobra, pero nunca queda más estrecho que cerrado. Con menos de 768 px la barra pasa
a un control por línea y el `flex-basis` vuelve al `100%`.

### La lupa no parecía pulsable (y no se abría con el teclado)

Dos problemas distintos en el mismo control.

**El de teclado era un fallo, no una mejora**: el buscador solo se abría con un listener de
`click` en todo el documento. Quien llegaba con el tabulador se quedaba dentro de una píldora
sin ver el campo ni lo que escribía (criterio **2.1.1** de WCAG, todo lo que funciona con ratón
tiene que funcionar con teclado). Ahora se abre con **`focusin`** y se recoge con **`focusout`**
si está vacío: el mismo código cubre ratón y teclado, porque un clic acaba enfocando el input
igual, y ya no hace falta vigilar cada clic de la página para saber cuándo cerrarlo.

**El de descubribilidad**: un icono suelto no comunica que se pueda pulsar, y con el campo
plegado tampoco hay placeholder que lo insinúe. Cerrado ya no es un círculo con la lupa, sino
una **píldora con la lupa y la palabra "Buscar"**. El texto es la única señal que nadie tiene
que adivinar; al enfocarla se estira y aparece el placeholder completo. La palabra es
`aria-hidden`, porque el `<input>` ya tiene su `aria-label` y si no se leería dos veces.

### Accesibilidad y semántica de la tabla y la barra de filtros

Lo que se ha corregido, y por qué cada cosa:

- **El nombre del cliente es `<th scope="row">`**, no un `<td>`. Es la cabecera de su fila: con
  eso un lector de pantalla dice *"García S.L., email: ..."* al recorrer las celdas, en vez de
  leer valores sueltos sin saber de quién son.
- **La tabla tiene `<caption>`** (oculto visualmente) y el contenedor con scroll horizontal es
  un `role="region"` con `tabindex="0"`: una zona que se desplaza tiene que poder recorrerse
  con el teclado, o las columnas de la derecha son inalcanzables sin ratón. Ese `tabindex`
  viene puesto en el HTML y lo **quita `clientes.js` cuando la tabla cabe entera**, vigilando
  el tamaño con un `ResizeObserver`: una parada del tabulador donde no hay nada que desplazar
  es una molestia para quien navega así. Se hace en ese sentido —puesto de serie y quitado
  después— para que un fallo del JS deje la versión accesible y no la contraria.
- **Los botones de acción llevan el nombre del cliente** en su `aria-label`. Sin eso, pedir la
  lista de botones de la página devuelve diez veces *"Editar cliente"* sin saber a cuál
  pertenece cada uno. El texto visible no cambia: son botones de icono y ese nombre solo existe
  para la tecnología asistiva.
- **El nombre y el aviso emergente de cada botón se escriben en el mismo sitio**
  (`marcarFila()` → `nombrarAccion()`) y el nombre **empieza por el texto del aviso**. Son dos
  textos que tienen que decir lo mismo —quien maneja el ordenador por voz dicta lo que ve
  (criterio **2.5.3**, *label in name*)— y repartidos en dos funciones se acaban
  desincronizando en cuanto cambia uno.
- **El estado abierto/cerrado lo dice `aria-expanded`**, no el nombre del botón: el nombre se
  mantiene estable ("Ver detalles de X") y es el atributo el que cambia. Es el patrón estándar
  de *disclosure*.
- **La barra de filtros es un `<search>`** (con `role="search"` explícito para los navegadores
  anteriores a 2023), el título de la página es un `<h1>` —antes empezaba en `<h2>`— y el enlace
  activo del menú lleva `aria-current="page"`, que es lo que hace que se anuncie como la página
  actual; la clase `active` solo pinta.
- **La etiqueta del botón de orden es `aria-live="polite"`**: cambia sola al pulsarlo ("Más
  recientes" → "A → Z") y sin eso quien no ve la pantalla pulsa y no se entera del resultado.
- **Los iconos decorativos llevan `aria-hidden="true"`** y el botón de eliminar ha dejado el
  `title` nativo (que además duplicaba su `aria-label`) para usar el mismo aviso emergente que
  los demás.
- **El nombre accesible del botón "Limpiar" empieza por "Limpiar"**, aunque siga con la cuenta
  de filtros. Si se sustituyera por otra frase, quien maneja el ordenador por voz diría *"pulsa
  Limpiar"* y no pasaría nada (criterio **2.5.3**, *label in name*).

### Estilo: lo que se ve y por qué

- **Rayado alterno azul/blanco, pintado por cliente y no por fila del DOM.** El
  `table-striped` de Bootstrap alterna con `nth-of-type`, así que **cada panel de detalle
  insertado invierte el rayado de todo lo que viene detrás** y la tabla acaba con dos filas
  blancas seguidas. Como las filas las pinta `pintarFilas()`, la paridad la marca él con la
  clase `fila-par` y los paneles ya no cuentan. El azul de la raya es muy tenue (`#f6f9ff`)
  para que el resaltado de la fila abierta (`#e7efff`) siga distinguiéndose de él.
- **Recuadro de color en el bloque abierto**: verde si se está viendo, ámbar si se está
  editando. La fila pone el borde de arriba y los laterales, el panel el de abajo, y el color
  viaja en una variable (`--color-modo`) declarada en las dos filas. Son las versiones
  **oscuras** del verde y el ámbar: el `#ffc107` de Bootstrap da 1.6:1 sobre blanco y un borde
  que transmite información necesita 3:1 (criterio **1.4.11**). Y como el color por sí solo no
  vale (criterio **1.4.1**), el panel lo dice además con letras: "Viendo detalles" / "Editando".
- **Esquinas redondeadas**: van en el contenedor, no en la `<table>`. Con
  `border-collapse: collapse` el radio de la tabla no recorta el fondo de las celdas y la
  cabecera azul seguiría saliendo en pico; el `.table-responsive` ya tiene `overflow-x: auto`,
  así que recorta sin tocar el scroll.
- **Iconos de los filtros en azul de marca** sobre un fondo apenas teñido, y **el control se
  marca cuando tiene filtro puesto** (icono en sólido, borde azul, texto en negrita), con un
  contador junto a "Limpiar". Es el único sitio de la barra donde el color aporta información
  en vez de decorar: con tres controles idénticos estén o no usados, la pregunta "¿por qué solo
  salen 4 clientes?" obligaba a abrir los desplegables uno a uno. Cambian dos iconos: `fa-map`
  para provincia (`fa-map-location-dot` es una mancha a 14 px) y `fa-filter-circle-xmark` para
  Limpiar, que dice "quitar filtros" y no "borrar".
- **Todos los controles de la barra miden lo mismo** (`--alto-control`): el buscador medía 50 px
  y los desplegables `input-group-sm` 31 px, y la fila se veía escalonada.

### Otros detalles de uso

- **Email y teléfono son enlaces** `mailto:` y `tel:`. El esquema lo construye siempre el
  código y nunca el dato del servidor, así que un valor manipulado no puede colar un `href`
  de tipo `javascript:`. Pulsar el enlace **no** despliega además la fila, y su aviso emergente
  dice lo que hace ("Escribir a este correo") en vez de heredar el "Ver detalles" de la celda.
- **En móvil se ocultan email y teléfono** (`d-none d-md-table-cell`): seis columnas obligan a
  desplazar en horizontal y esos dos datos siguen estando a un clic, en el detalle.
- **Mientras carga una página, la tabla se atenúa** y lleva `aria-busy="true"`; si no, se ven
  los datos de la página anterior como si fueran los nuevos. El "cargando" se apaga con un
  **contador** de peticiones en vuelo, no con un booleano: una petición cancelada termina
  *después* de que arranque la que la sustituye y apagaría el estado de la que sigue viva.
- **Si la tabla sale vacía por un filtro, el botón de quitarlo está ahí mismo**, en el propio
  mensaje: la salida tiene que estar donde se ve el problema.
- En el formulario de edición, `autocomplete="off"` (son datos de otra persona, no de quien
  rellena) e `inputmode` numérico/telefónico para que en móvil salga el teclado correcto.
- **Los asteriscos de campo obligatorio son `aria-hidden`**: se leerían como "asterisco", que no
  dice nada, y los campos ya llevan `required`, que el lector anuncia como "obligatorio".
- **Ningún número de columnas escrito a mano.** El `colspan` de la fila desplegada y el de la
  fila de mensajes salen de contar los `<th>` de la tabla (`COLUMNAS_TABLA`), y el texto por
  defecto del error del NIF se lee del propio `<template>` al arrancar. Son los dos sitios
  donde una copia a mano se queda vieja sin que nadie se entere.
- **Se ha quitado el `querySelectorAll('.btn-eliminar')` del final de `clientes.js`**: no
  enganchaba nada, porque al ejecutarse ese código los botones todavía viven dentro del
  `<template>`. En su sitio queda un comentario que explica que las acciones de la fila van por
  delegación en el `<tbody>`, que es donde quien implemente el borrado tiene que añadir su caso.

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
15. **Detalle (API)**: `GET http://localhost:8080/cliente/1` → `200` con los diez campos;
    `GET /cliente/99999` → `404` **con el cuerpo vacío** (si trae una traza dentro, es que la
    excepción se ha escapado); `GET /cliente/abc` → `400`.
16. **Detalle (pantalla)**: pulsar una fila la despliega y vuelve a pulsarla la cierra; abrir
    **tres a la vez** y cerrar la del medio; con dos abiertas, paginar y volver → siguen
    abiertas; buscar algo que las deje fuera → desaparecen, y al limpiar el buscador vuelven.
17. **Aviso a 1 segundo**: dejar el ratón quieto sobre una fila cerrada → "Ver detalles"; sobre
    una abierta → "Ocultar detalles"; sobre la celda de los botones → no sale el de la fila,
    sale el del botón que se esté señalando.
18. **Teclado**: con `Tab` hasta el botón del ojo y `Enter` se despliega igual, y el botón
    anuncia `aria-expanded="true"`.
19. **Editar**: el lápiz abre el formulario con los datos de la BD. Guardar **sin cambiar
    nada** → `200` y la fila se queda igual (si diera `404`, la comprobación de existencia
    está mal). Cambiar el nombre con la tabla ordenada por nombre → al guardar, la fila se
    recoloca sola.
20. **La fecha de alta sobrevive**: tras guardar, la columna "Alta" sigue con su fecha y no con
    un guion. En Swagger, la respuesta del `PUT` trae `fechaAlta` informada.
21. **Errores del formulario**: dejar el nombre vacío → lo corta el navegador y no sale
    petición; poner el NIF de otro cliente → `409` señalado en ese campo; borrar el cliente
    desde otra pestaña y guardar → `409`/`404` con su aviso y la tabla se refresca.
22. **Cambios sin guardar**: escribir en un campo y pulsar la fila para cerrarla → pregunta
    antes de descartar. Escribir y **teclear en el buscador** (que repinta la tabla) → al
    volver, lo escrito sigue ahí.
23. **Solapamiento del buscador**: el ancho calculado de `#buscador-clientes` cerrado tiene que
    coincidir con el de su contenedor (**144 px**, `9rem`) y no pisar al filtro de provincia.
    Comprobarlo a 1440, 1200, 992, 768 y 360 px de ancho de ventana.
24. **Buscador con teclado**: desde la barra de navegación, pulsar `Tab` hasta el buscador → se
    abre solo, se ve el placeholder y lo que se escribe. Salir con `Tab` estando vacío → se
    recoge; salir con texto escrito → se queda abierto y con el borde azul de "filtro puesto".
25. **Filtros marcados**: elegir provincia y población → los dos iconos pasan a azul sólido y
    junto a "Limpiar" aparece un `2`. Pulsar "Limpiar" → vuelven a su gris y el contador
    desaparece.
26. **Rayado con paneles abiertos**: abrir el detalle de la 1.ª y la 3.ª fila y comprobar que
    las filas de cliente **siguen alternando** color (con `table-striped` no lo hacían).
27. **Colores de estado**: abrir el detalle → recuadro verde y el cartel "Viendo detalles";
    pulsar el lápiz de esa misma fila → el recuadro pasa a ámbar y el cartel a "Editando".
28. **Enlaces de la tabla**: pulsar el email → abre el cliente de correo y **la fila no se
    despliega**; pulsar en el hueco de esa misma celda, al lado del enlace → sí se despliega.
29. **Lector de pantalla** (NVDA o el Narrador de Windows): en la lista de botones, cada uno
    dice el nombre de su cliente ("Editar cliente García S.L."). Al recorrer las celdas con las
    flechas de tabla, cada valor va precedido del nombre del cliente.
30. **Zona desplazable**: a 360 px de ancho, `Tab` tiene que parar en la tabla y las flechas
    moverla en horizontal. A pantalla completa, donde la tabla cabe entera, `Tab` **no** para
    ahí (el `tabindex` se quita solo); estrechar la ventana y volver a probar.
31. **Cargando**: con la pestaña Network en "Slow 3G", paginar → la tabla se atenúa mientras
    llega la respuesta y vuelve a su opacidad al pintarse.
32. **Aviso de guardado**: guardar un cliente → sale la franja verde "Cliente guardado" encima
    de la tabla, **sobrevive al refresco** y se va sola a los cinco segundos. Con un lector de
    pantalla, se anuncia sin que haya que ir a buscarla.
33. **Foco tras guardar**: abrir el lápiz con el teclado, cambiar algo y guardar con `Enter` →
    el foco vuelve al lápiz **de esa misma fila**, no al principio de la página. Repetirlo
    ordenando por nombre y cambiando el nombre (la fila se mueve de sitio): el foco la sigue.
34. **NIF repetido, en el inspector**: poner el NIF de otro cliente y guardar → el `<input>`
    tiene que quedar con `aria-invalid="true"` y un `aria-describedby` que apunte al id del
    mensaje visible. Teclear en el campo → los dos atributos desaparecen.
35. **Cliente borrado mientras se edita**: abrir el lápiz, borrarlo desde otra pestaña (o con
    un `DELETE` en Swagger) y guardar → mensaje de "ya no existe" en la franja de avisos, que
    **sigue ahí** después de que la tabla se refresque.
36. **Página que se queda sin clientes**: dejar 31 clientes (4 páginas), ir a la página 4,
    borrar los que sobran hasta dejar 30 desde otra pestaña y refrescar con
    `document.dispatchEvent(new CustomEvent('clientes:cambiaron'))` → tiene que aterrizar en la
    **página 3 con datos**, no en una página vacía que diga "Página 4 de 3".
37. **La barra de filtros no se parte**: a 1200 y a 1440 px, pulsar la lupa → el buscador se
    abre encogiendo lo que haga falta y "Limpiar" **se queda en la misma línea**. A 768 px o
    menos, cada control ocupa su propia línea completa.
38. **Recuadro del último cliente**: abrir el detalle del **último** cliente de la página → el
    recuadro de color tiene que cerrar por abajo (antes le faltaba esa raya).

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

