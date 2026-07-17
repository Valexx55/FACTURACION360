# Clientes — Listar últimos (nuestra parte)

Nuestra parte del proyecto: mostrar en la tabla de `clientes.html` **los últimos clientes**
dados de alta, pidiéndolos al backend por `fetch`. Está hecha con **JDBC Template + MySQL**,
siguiendo la arquitectura por capas que subió el profe a `master`.

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
| Controller | `controller/ClienteController.java` | Recibe el HTTP y devuelve `200 OK` con la lista. |
| Service | `service/ClienteServiceImpl.java` | Lógica de negocio ("los últimos N"). |
| Repository | `repository/ClienteRepositoryJdbcImpl.java` | Habla con la BD (SQL). |
| RowMapper | `repository/ClienteRowMapper.java` | Convierte una fila de la BD en un `Cliente`. |
| DTOs | `dto/Cliente.java`, `dto/ClienteResponse.java` | Objeto de dominio y objeto de salida. |
| Mapper | `dto/ClienteMapper.java` | Convierte `Cliente` → `ClienteResponse`. |

## Cómo lo hemos hecho (pieza a pieza)

1. **`ClienteRepositoryJdbcImpl.findUltimos(limite)`** — ejecuta con `JdbcTemplate`:
   ```sql
   SELECT id_cliente, nombre_razon_social, nif_cif, direccion, codigo_postal,
          poblacion, provincia, telefono, email, fecha_alta
   FROM cliente ORDER BY id_cliente DESC LIMIT ?
   ```
   El `id_cliente` es autoincremental, así que el más alto = el más reciente. El troceado
   (`LIMIT`) lo hace MySQL. El `?` es un parámetro (evita inyección SQL).
2. **`ClienteRowMapper.mapRow`** — construye un `Cliente` leyendo cada columna del `ResultSet`.
3. **`ClienteServiceImpl.listarUltimos(limite)`** — delega en el repositorio (aquí viviría la
   regla de negocio si se complicara).
4. **`ClienteMapper.toResponse(cliente)`** — traduce el `Cliente` de dominio al
   `ClienteResponse` que viaja como JSON.
5. **`ClienteController.listarUltimos()`** — pide al service los últimos 10, mapea a
   `ClienteResponse` y devuelve `ResponseEntity.ok(...)`.
6. **`clientes.js`** — hace `fetch('/cliente/listar-ultimos')`, y por cada cliente clona el
   `<template>` de la tabla rellenándolo con `textContent` (seguro frente a `<`/`&`). El
   **buscador** de arriba se ve pero **aún no funciona** (su lógica es de otro compañero).

## Base de datos

La app se conecta a `jdbc:mysql://localhost:3306/bd_facturacion` (root/root, en
`application.properties`). Para tener la BD en tu PC, ejecuta el script incluido:

```bash
mysql -u root -p < facturacion360/src/main/resources/docu/bd_facturacion.sql
```
Crea la tabla `cliente` (según el `docu/ESQUEMA ER.png`) e inserta 15 clientes de ejemplo.

## ⚠️ Si en la BD real la tabla o las columnas se llaman distinto

Los nombres de tabla/columnas están escritos "a mano" en el SQL, así que **deben coincidir en
3 sitios a la vez**. Si el esquema real usa otros nombres, hay que cambiarlos en los tres:

1. El `SELECT ... FROM cliente ...` de **`ClienteRepositoryJdbcImpl.findUltimos`**.
2. Los `rs.getXxx("nombre_columna")` de **`ClienteRowMapper.mapRow`**.
3. El `CREATE TABLE cliente (...)` de **`docu/bd_facturacion.sql`** (este solo si replicas la BD).

Ejemplo: si la tabla se llamara `clientes` (plural) y la columna fuera `id` en vez de
`id_cliente`, habría que ajustar el `FROM clientes`, el `ORDER BY id DESC`, el
`rs.getInt("id")` y el `CREATE TABLE clientes`.

> **Incoherencia detectada (comentar con el profe):** el `ESQUEMA ER.png` usa
> `nombre_razon_social` y `pais`, pero el record `Cliente` usa `nombre` y **no** tiene `pais`.
> Lo hemos reconciliado en `ClienteRowMapper` (vuelca `nombre_razon_social` en `nombre` e
> ignora `pais`). Convendría unificar el modelo y el diagrama.

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
   List<Cliente> findPagina(int limite, int offset); // SELECT ... ORDER BY id_cliente DESC LIMIT ? OFFSET ?
   long contarTotal();                               // SELECT COUNT(*) FROM cliente
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
- Mantener **siempre el mismo `ORDER BY id_cliente DESC`**: la BD no garantiza un orden fijo si
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
**entenderlas**. Algunas **cambian el esqueleto del profe**, así que habría que acordarlas con él.

### A. Inyección por constructor (en vez de por campo)
**Concepto**: "inyección de dependencias" = en vez de crear tú los objetos que necesitas
(`new ClienteService()`), Spring te los da ya creados. Hoy los recibimos en un atributo marcado
con `@Autowired` (**inyección por campo**); la alternativa es recibirlos por el **constructor**.
- **Cómo**: atributos `private final` y un constructor que los recibe (con un solo constructor,
  Spring lo inyecta sin `@Autowired`):
  ```java
  private final ClienteService clienteService;
  private final ClienteMapper clienteMapper;
  public ClienteController(ClienteService s, ClienteMapper m) {
      this.clienteService = s; this.clienteMapper = m;
  }
  ```
- **Por qué es mejor**: los campos pueden ser `final` (**inmutables**, nadie los cambia por
  error); las dependencias quedan **a la vista** en el constructor (con inyección por campo están
  "escondidas"); y puedes **testear la clase sin arrancar Spring**, pasándole dobles de prueba por
  el constructor. Es la práctica que recomienda el propio Spring. *(Cambia el patrón del profe →
  acordarlo.)*

### B. Manejo de errores centralizado (`@RestControllerAdvice`)
**Concepto**: cuando un endpoint lanza una excepción, Spring puede **desviarla** a una clase
"guardiana" que decide qué responder, en vez de soltar el error por defecto. Es como un `catch`
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
  (con detalles que no deberían salir). Con esto das respuestas **limpias y uniformes** y no
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
