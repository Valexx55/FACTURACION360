# Clientes — Listar últimos

Muestra en la tabla de `clientes.html` **los últimos clientes**
dados de alta, pidiéndolos al backend por `fetch`.
Está hecha con **JDBC Template + MySQL**,
siguiendo la arquitectura por capas que subió Val a `master`.

## Qué hace

- **Listar paginado**: `GET /cliente/listar-pagina?pagina=0&tamano=10` → devuelve una **página**
  de clientes (los más recientes primero) + metadatos de paginación, como JSON.
- **Listar últimos** (endpoint del profe, se mantiene): `GET /cliente/listar-ultimos` → los **10
  más recientes** en una lista simple.
- **Frontend**: `clientes.js` pide una página y pinta la tabla; los botones **"Más recientes" /
  "Más antiguos"** permiten moverse entre páginas.

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
   rellenándolo con `textContent` (seguro frente a `<`/`&`). El **buscador** de arriba se ve pero
   **aún no funciona** (su lógica es de otro compañero).

### Paginación (de N en N)

Además de `listar-ultimos`, añadimos un **endpoint nuevo** `GET /cliente/listar-pagina?pagina=&tamano=`
(deja `listar-ultimos` intacto). **Idea**: `LIMIT n` = "dame n filas"; `OFFSET m` = "sáltate m". Con
páginas de 10: página 0 → `OFFSET 0`, página 1 → `OFFSET 10`… (`offset = pagina * tamano`); el
troceado lo hace MySQL. Las piezas:

- **Repositorio**: `findPagina(tamano, offset)` (`... ORDER BY idcliente DESC LIMIT ? OFFSET ?`) y
  `contarTotal()` (`SELECT COUNT(*)` con `queryForObject`, que devuelve un único valor).
- **DTO `PaginaClienteResponse`**: la lista de la página + metadatos (`paginaActual`, `totalPaginas`,
  `totalElementos`, `hayAnterior`, `haySiguiente`) para que el frontend sepa dónde está.
- **Service `listarPagina(pagina, tamano)`**: calcula `offset`, el total de páginas con
  `Math.ceil((double) total / tamano)`, los flags `hayAnterior/haySiguiente`, y mapea a `ClienteResponse`.
- **Controller `listarPagina`**: mismo patrón (validación, logs, `try/catch`); devuelve el `PaginaClienteResponse`.
- **`clientes.js`**: guarda la `paginaActual`, pide `/cliente/listar-pagina?pagina=&tamano=10`, pinta
  `datos.contenido` y **activa/desactiva** los botones "Más recientes"/"Más antiguos" según los flags.

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
5. **Frontend**: abrir `http://localhost:8080/clientes.html` → la tabla se rellena y los botones
   **"Más recientes" / "Más antiguos"** cambian de página; el texto muestra "Página X de Y".
6. **Refresco automático**: en la consola del navegador ejecutar
   `document.dispatchEvent(new CustomEvent('clientes:cambiaron'))` → la tabla se recarga sola.
7. **Logs y errores**: mira la consola (`GET /cliente/...`, `listarUltimos(...) -> N`); si paras
   MySQL y repites, la respuesta es `500` y aparece un `log.error`.

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

