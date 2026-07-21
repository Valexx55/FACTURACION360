# Clientes — Listar últimos

Muestra en la tabla de `clientes.html` **los últimos clientes**
dados de alta, pidiéndolos al backend por `fetch`.
Está hecha con **JDBC Template + MySQL**,
siguiendo la arquitectura por capas que subió el Val a `master`.

## Qué hace

- **Endpoint**: `GET /cliente/listar-ultimos` → devuelve los **10 clientes más recientes**
  como una lista JSON de `ClienteResponse`.
- **Frontend**: `clientes.js` llama a ese endpoint y pinta cada cliente en la tabla.

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
6. **`clientes.js`** — hace `fetch('/cliente/listar-ultimos')`, y por cada cliente clona el
   `<template>` de la tabla rellenándolo con `textContent` (seguro frente a `<`/`&`). El
   **buscador** de arriba se ve pero **aún no funciona** (su lógica es de otro compañero).

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

## ⚠️ Si en la BD real la tabla o las columnas se llaman distinto

Los nombres de tabla/columnas están escritos "a mano" en el SQL, así que **deben coincidir en
2 sitios a la vez**. Si el esquema cambiara, hay que ajustar los dos:

1. El `SELECT ... FROM clientes ...` de **`ClienteRepositoryJdbcImpl.findUltimos`**.
2. Los `rs.getXxx("nombre_columna")` de **`ClienteRowMapper.mapRow`**.

Ejemplo: si la columna pasara a llamarse `id` en vez de `idcliente`, habría que ajustar el
`SELECT idcliente`, el `ORDER BY idcliente DESC` y el `rs.getInt("idcliente")`.

> **Nota:** al principio seguimos el `ESQUEMA ER.png` (que usa `nombre_razon_social` y `pais`),
> pero el profe fijó como buenos los nombres **reales de la BD**: tabla `clientes`, columnas
> `idcliente`, `nombre`, `codigopostal`… El código ya usa esos nombres reales.

---

## TODO — Implementar la paginación correctamente

De momento `listar-ultimos` devuelve una lista fija (los 10 últimos), **sin paginación** (así
es el esqueleto del profe). Esto explica cómo se paginaría "de 10 en 10" de forma adecuada.

### Idea: qué es paginar y cómo lo hace la BD
Paginar = pedir los datos **de X en X** en vez de todos de golpe. La base de datos lo resuelve
con dos palabras en el `SELECT`:
- **`LIMIT n`** → "dame como mucho **n** filas" (el tamaño de página).
- **`OFFSET m`** → "**sáltate** las primeras **m** filas".

Con páginas de 10: página 0 → `LIMIT 10 OFFSET 0` (filas 1–10); página 1 → `LIMIT 10 OFFSET 10`
(salta 10 → filas 11–20); página 2 → `OFFSET 20`… La fórmula es **`offset = pagina * tamano`**.
Lo trocea MySQL (no Java), así que es eficiente aunque haya miles de filas.

### Backend
1. **Repositorio** (`ClienteRepository` + `ClienteRepositoryJdbcImpl`): añadir dos métodos:
   ```java
   List<Cliente> findPagina(int limite, int offset); // SELECT ... ORDER BY idcliente DESC LIMIT ? OFFSET ?
   long contarTotal();                               // SELECT COUNT(*) FROM clientes
   ```
   El `COUNT(*)` hace falta para saber **cuántas páginas hay en total**; si no, no puedes saber
   si el usuario está en la última.
2. **DTO de página** (nuevo record en `dto/`), p. ej. `PaginaClienteResponse`:
   ```java
   record PaginaClienteResponse(
       List<ClienteResponse> contenido,       // los clientes de ESTA página
       int paginaActual, int totalPaginas, long totalElementos,
       boolean hayAnterior, boolean haySiguiente) {}  // para activar/desactivar los botones
   ```
   Enviamos también esos "metadatos" para que el frontend sepa dónde está y si puede avanzar o
   retroceder, **sin recalcular nada** por su cuenta.
3. **Service** (`ClienteService` + Impl): `listarPagina(int pagina, int tamano)`:
   - `int offset = pagina * tamano;` → cuántas filas saltar.
   - `List<Cliente> pagina = repo.findPagina(tamano, offset);`
   - `long total = repo.contarTotal();`
   - `int totalPaginas = (int) Math.ceil((double) total / tamano);` → redondeo **hacia arriba**:
     28 clientes / 10 = 2,8 → **3** páginas (la última con 8). El `(double)` es clave: sin él, la
     división entera daría 2 y perderías la última página.
   - `boolean hayAnterior = pagina > 0;` → hay anterior salvo en la página 0.
   - `boolean haySiguiente = pagina < totalPaginas - 1;` → hay siguiente salvo en la última.
   - mapear los `Cliente` a `ClienteResponse` y devolver el `PaginaClienteResponse`.
4. **Controller**: un endpoint NUEVO (no rompe `listar-ultimos`):
   ```java
   @GetMapping("/listar")
   public ResponseEntity<PaginaClienteResponse> listar(
           @RequestParam(defaultValue = "0") int pagina,
           @RequestParam(defaultValue = "10") int tamano) { ... }
   ```
   `@RequestParam` lee `?pagina=1&tamano=10` de la URL; con `defaultValue` funciona aunque no se
   manden.

### Frontend (`clientes.js` + `clientes.html`)
5. Recuperar en el HTML la **barra de paginación** (botones "Más recientes / Más antiguos" + un
   texto tipo "Página 2 de 3") que quitamos al simplificar.
6. En el JS: guardar la `paginaActual`, hacer `fetch('/cliente/listar?pagina=' + p + '&tamano=10')`,
   pintar las filas y **desactivar** el botón "anterior" si `!hayAnterior` y el "siguiente" si
   `!haySiguiente`. Así el usuario nunca se sale del rango.

### Notas importantes
- Mantener **siempre el mismo `ORDER BY idcliente DESC`**: la BD no garantiza un orden fijo si
  no se lo pides, y sin orden estable la paginación puede **repetir o saltarse** filas entre páginas.
- Cubrir **casos borde**: 0 resultados, última página incompleta, o una página fuera de rango.
- Esto **amplía la interfaz del profe** (métodos nuevos en el repositorio): **acordarlo con él**
  antes de tocar sus interfaces.
- **Alternativa** (solo si hay muy pocos clientes): traerlos todos y paginar en el navegador con
  `array.slice()`. Más simple, pero **no escala** (carga todo en memoria); con muchos registros la
  paginación en BD es la correcta.

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
