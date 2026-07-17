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

De momento `listar-ultimos` devuelve una lista fija (los 10 últimos), **sin paginación**
(así es el esqueleto del profe). Para paginar "de 10 en 10" de forma adecuada, en el
**servidor** (la BD hace el troceado, no Java), habría que:

### Backend
1. **Repositorio** (`ClienteRepository` + `ClienteRepositoryJdbcImpl`): añadir
   ```java
   List<Cliente> findPagina(int limite, int offset); // SELECT ... ORDER BY id_cliente DESC LIMIT ? OFFSET ?
   long contarTotal();                               // SELECT COUNT(*) FROM cliente
   ```
   `LIMIT` = cuántos por página; `OFFSET` = cuántos saltar (`pagina * tamano`).
2. **DTO de página** (nuevo record en `dto/`), p. ej. `PaginaClienteResponse`:
   ```java
   record PaginaClienteResponse(
       List<ClienteResponse> contenido,
       int paginaActual, int totalPaginas, long totalElementos,
       boolean hayAnterior, boolean haySiguiente) {}
   ```
   No devolver estructuras internas de framework; decidir nosotros qué metadatos ve el front.
3. **Service** (`ClienteService` + Impl): `listarPagina(int pagina, int tamano)`:
   - `offset = pagina * tamano`.
   - `List<Cliente> pagina = repo.findPagina(tamano, offset);`
   - `long total = repo.contarTotal();`
   - `totalPaginas = (int) Math.ceil((double) total / tamano);`
   - `hayAnterior = pagina > 0;`  `haySiguiente = pagina < totalPaginas - 1;`
   - mapear a `ClienteResponse` y devolver el `PaginaClienteResponse`.
4. **Controller**: nuevo endpoint que **no rompe** el actual:
   ```java
   @GetMapping("/listar")
   public ResponseEntity<PaginaClienteResponse> listar(
           @RequestParam(defaultValue = "0") int pagina,
           @RequestParam(defaultValue = "10") int tamano) { ... }
   ```

### Frontend (`clientes.js` + `clientes.html`)
5. Recuperar en el HTML la **barra de paginación** (dos botones "Más recientes / Más
   antiguos" + un texto de estado) que se quitó al simplificar.
6. En el JS: guardar `paginaActual`, hacer `fetch('/cliente/listar?pagina=' + p + '&tamano=10')`,
   pintar filas y **activar/desactivar los botones** según `hayAnterior`/`haySiguiente`.

### Notas importantes
- Mantener **siempre el mismo `ORDER BY id_cliente DESC`**: sin orden estable, la paginación
  puede repetir o saltarse filas entre páginas.
- Cubrir **casos borde**: 0 resultados, última página incompleta, página fuera de rango.
- Esto **amplía la interfaz del profe** (métodos nuevos en el repositorio): conviene
  **acordarlo con él** antes de tocar sus interfaces.
- **Alternativa** (solo si hay pocos clientes): traer todos con `listar-ultimos` y paginar en
  el navegador con `array.slice()`. Es más simple pero **no escala** (trae todo a memoria);
  para muchos registros, la paginación en BD (la de arriba) es la correcta.
