# Clientes: acceso a datos — JPA vs SQL manual

> ✅ **DECISIÓN FINAL (ya implementada): JDBC Template + MySQL**, siguiendo la estructura
> por capas que subió el profe a `master` (paquetes `controller / dto / repository /
> service`, con interfaz + Impl). Se **descartó JPA/H2**. Mi parte implementada es
> `GET /cliente/listar-ultimos` (los 10 últimos, **sin paginación**, siguiendo su diseño).
> Para levantar la BD en tu PC, ejecuta `facturacion360/src/main/resources/docu/bd_facturacion.sql`.
>
> ⚠️ Incoherencia detectada en los materiales del profe: el `ESQUEMA ER.png` usa
> `nombre_razon_social` y `pais`, pero el record `Cliente` usa `nombre` y no tiene `pais`.
> Reconciliado en `ClienteRowMapper` (mapea `nombre_razon_social → nombre`, ignora `pais`).
> Conviene comentarlo con el profe para unificarlo.
>
> El resto del documento es el **análisis didáctico** que llevó a esta decisión (JPA vs SQL
> manual) y sigue siendo útil para entender los conceptos.

---

## 1. Qué hace esta parte

- Endpoint REST: `GET /api/clientes?pagina=0&tamano=10`.
- Devuelve una página de clientes (los más recientes primero) + metadatos de paginación
  (`PaginaClientesDTO`).
- El frontend (`static/clientes.html` + `clientes.js`) pinta la tabla con un `<template>`
  y los botones "Más recientes / Más antiguos".

**Importante:** el **contrato con el frontend no cambia** en ninguna de las opciones. El
JSON que se envía (`ClienteDTO` y `PaginaClientesDTO`) es siempre el mismo, así que el
JavaScript **no se toca decidamos lo que decidamos**.

---

## 2. Qué usamos ahora (Opción A: JPA + H2)

### ¿Qué es JPA? (concepto — aún no lo hemos dado en clase)

En una base de datos los datos viven en **tablas y filas**. En Java trabajamos con
**objetos**. JPA es el **"traductor" automático** entre esos dos mundos; a esa idea se le
llama **ORM** (*Object-Relational Mapping*, mapeo objeto-relacional).

Sin JPA, para leer un cliente tendrías que: escribir el `SELECT`, recorrer el resultado
fila a fila y, a mano, ir construyendo objetos `Cliente` columna a columna. Con JPA **eso
lo hace la librería por ti**: tú manejas objetos y ella se ocupa del SQL y de convertir
filas ↔ objetos.

Tres nombres que conviene distinguir:
- **JPA**: el *estándar* (la "norma": un conjunto de reglas e interfaces). Por sí solo no
  hace el trabajo.
- **Hibernate**: la *implementación* que sí lo hace (genera el SQL y habla con la BD). Es
  el motor que hay por debajo.
- **Spring Data JPA**: una capa **encima** de Hibernate que nos regala repositorios ya
  hechos (con `save`, `findAll`, paginación…) con solo declarar una interfaz.

Las dos piezas clave en nuestro código:
- **Entidad** (`@Entity` en `Cliente`): una clase Java **atada a una tabla**. Cada objeto
  `Cliente` = una fila de `clientes`; cada campo = una columna.
- **Repositorio** (`ClienteRepository`): una **interfaz** que Spring implementa solo. Al
  heredar de `JpaRepository` ya tienes los métodos de acceso a datos sin escribirlos
  (incluido `findAll(Pageable)`, que es el que resuelve la paginación).

### En este proyecto

- **H2**: base de datos SQL **en memoria** (vive en la RAM, se borra al apagar la app).
  No hay que instalar nada. Es solo para desarrollo/clase.
- **Spring Data JPA (Hibernate)**: mapea la clase `Cliente` a la tabla `clientes` y
  **genera el SQL automáticamente**. Gracias a `JpaRepository` tenemos `findAll(Pageable)`,
  que resuelve la paginación (`LIMIT/OFFSET`) sin escribir SQL a mano.

Con JPA, este código:
```java
repo.findAll(PageRequest.of(0, 10, Sort.by("id").descending()));
```
hace que Hibernate ejecute por debajo:
```sql
SELECT id, nombre, cif, email, telefono FROM clientes ORDER BY id DESC LIMIT 10 OFFSET 0;
```

---

## 3. Comparativa rápida

| | **A) JPA (actual)** | **B) SQL manual (JdbcTemplate)** | **C) Híbrido (JPA + `@Query`)** |
|---|---|---|---|
| ¿Quién escribe el SQL? | Hibernate | **Nosotros** | **Nosotros** (el `SELECT`) |
| ¿Practicamos SQL? | No | **Sí** | **Sí** |
| Fila → objeto Java | Automático | Manual (`RowMapper`) | Automático |
| Crear la tabla | Hibernate (auto) | Nosotros (`schema.sql`) | Hibernate (auto) |
| Metadatos de página | `Page` los da hechos | A mano (`COUNT(*)`, cálculos) | A mano (`COUNT(*)`) |
| Base de datos (H2) | **Necesaria** | **Necesaria** | **Necesaria** |
| Archivos a cambiar | — | pom, properties, 5 clases + 1 SQL | solo el repositorio + service |

**H2 hace falta en las tres.** "SQL manual" **no** quita H2; solo quita Hibernate y hace
que el SQL lo escribamos nosotros.

---

## 4. Opción B — Pasar a SQL manual con `JdbcTemplate` (cambios EXACTOS)

Escribimos nosotros todo el SQL. Es la opción que más SQL practica.

### 4.1. `facturacion360/pom.xml`
**Quitar** la dependencia de JPA y **poner** la de JDBC (H2 se queda igual):
```xml
<!-- QUITAR esto -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- AÑADIR esto en su lugar -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
```

### 4.2. `facturacion360/src/main/resources/application.properties`
**Quitar** las líneas específicas de JPA/Hibernate (ya no hay Hibernate):
```properties
# QUITAR estas dos:
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
```
Las de `spring.datasource.*` y `spring.h2.console.enabled` se quedan. (Opcional) para
forzar que se ejecute nuestro `schema.sql`:
```properties
spring.sql.init.mode=always
```

### 4.3. NUEVO archivo `facturacion360/src/main/resources/schema.sql`
Sin Hibernate, la tabla la creamos nosotros. Spring Boot ejecuta este archivo al arrancar:
```sql
CREATE TABLE clientes (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre   VARCHAR(255),
    cif      VARCHAR(255),
    email    VARCHAR(255),
    telefono VARCHAR(255)
);
```

### 4.4. `Cliente.java` → pasa a ser una clase normal (POJO), sin anotaciones JPA
```java
package edu.xtd.facturacion360.cliente;

public class Cliente {
    private Long id;
    private String nombre;
    private String cif;
    private String email;
    private String telefono;

    // Constructor completo (lo usa el RowMapper al leer de la BD)
    public Cliente(Long id, String nombre, String cif, String email, String telefono) {
        this.id = id;
        this.nombre = nombre;
        this.cif = cif;
        this.email = email;
        this.telefono = telefono;
    }

    public Long getId()       { return id; }
    public String getNombre() { return nombre; }
    public String getCif()    { return cif; }
    public String getEmail()  { return email; }
    public String getTelefono(){ return telefono; }
}
```
(Se quitan `@Entity`, `@Table`, `@Id`, `@GeneratedValue` y sus `import`.)

### 4.5. `ClienteRepository.java` → deja de ser interfaz; ahora escribe SQL
```java
package edu.xtd.facturacion360.cliente;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public class ClienteRepository {

    private final JdbcTemplate jdbc;

    public ClienteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Traduce una fila del ResultSet a un objeto Cliente (lo hacemos a mano)
    private static final RowMapper<Cliente> MAPPER = (rs, fila) -> new Cliente(
            rs.getLong("id"),
            rs.getString("nombre"),
            rs.getString("cif"),
            rs.getString("email"),
            rs.getString("telefono"));

    // Los 'tamano' clientes de la página 'pagina', del más nuevo al más viejo
    public List<Cliente> buscarPagina(int pagina, int tamano) {
        String sql = "SELECT id, nombre, cif, email, telefono " +
                     "FROM clientes ORDER BY id DESC LIMIT ? OFFSET ?";
        return jdbc.query(sql, MAPPER, tamano, pagina * tamano);
    }

    // Total de clientes: lo necesitamos para calcular el número de páginas
    public long contar() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM clientes", Long.class);
    }
}
```

### 4.6. `ClienteService.java` → calcula la paginación a mano (ya no hay `Page`)
```java
package edu.xtd.facturacion360.cliente;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ClienteService {

    private final ClienteRepository repositorio;
    private final ClienteMapper mapper;

    public ClienteService(ClienteRepository repositorio, ClienteMapper mapper) {
        this.repositorio = repositorio;
        this.mapper = mapper;
    }

    public PaginaClientesDTO obtenerPagina(int pagina, int tamano) {
        List<ClienteDTO> contenido = repositorio.buscarPagina(pagina, tamano)
                .stream().map(mapper::aDTO).toList();

        long totalElementos = repositorio.contar();
        int totalPaginas = (int) Math.ceil((double) totalElementos / tamano);

        boolean hayAnterior  = pagina > 0;
        boolean haySiguiente = pagina < totalPaginas - 1;

        return new PaginaClientesDTO(
                contenido, pagina, totalPaginas, totalElementos, hayAnterior, haySiguiente);
    }
}
```

### 4.7. `CargaDatosInicial.java` → inserta con SQL en vez de `repo.save`
```java
package edu.xtd.facturacion360.cliente;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class CargaDatosInicial implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    public CargaDatosInicial(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM clientes", Long.class);
        if (n != null && n > 0) return;

        for (int i = 1; i <= 28; i++) {
            String num = String.format("%02d", i);
            jdbc.update(
                "INSERT INTO clientes (nombre, cif, email, telefono) VALUES (?, ?, ?, ?)",
                "Empresa " + num + " S.L.",
                "B" + (10_000_000 + i),
                "contacto" + num + "@empresa" + num + ".es",
                "6" + String.format("%08d", i));
        }
    }
}
```
> Alternativa: en vez de esta clase, podríamos poner los 28 `INSERT` en un archivo
> `src/main/resources/data.sql` (más SQL puro, pero 28 líneas escritas a mano).

### 4.8. Lo que NO se toca en la Opción B
- `ClienteController.java` — igual.
- `ClienteDTO.java`, `ClienteMapper.java`, `PaginaClientesDTO.java` — igual.
- **Todo el frontend** (`clientes.html`, `clientes.js`, `style.css`) — igual.

---

## 5. Opción C — Híbrido: seguir con JPA pero escribir el SQL con `@Query`

Es la opción que **menos toca** y aun así nos deja practicar SQL. Se queda TODO como
está (entidad, H2, JPA) y solo cambia el repositorio y un poco el service.

### 5.1. `ClienteRepository.java` (sigue siendo interfaz, con SQL nuestro)
```java
package edu.xtd.facturacion360.cliente;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {

    @Query(value = "SELECT * FROM clientes ORDER BY id DESC LIMIT :tamano OFFSET :desde",
           nativeQuery = true)
    List<Cliente> buscarPagina(@Param("tamano") int tamano, @Param("desde") int desde);
}
```
`nativeQuery = true` = SQL de verdad (el de H2). `count()` ya lo hereda de `JpaRepository`.

### 5.2. `ClienteService.java`
Igual que en 4.6 pero llamando a `repositorio.buscarPagina(tamano, pagina * tamano)` y
usando `repositorio.count()` (el de JPA) para el total. La entidad `Cliente` y el resto
**no cambian**.

---

## 6. Estructura de paquetes: ¿añadir un paquete `.modelo`? (para hablar con el equipo)

> Esto es una decisión **de equipo**, no del profe: afecta a cómo organizamos todas
> nuestras partes, así que conviene acordar una misma convención entre todos.

### Recordatorio: qué es un paquete y cómo se suele organizar

Un **paquete** en Java es como una **carpeta que agrupa clases relacionadas**: sirve para
ordenar el código y no tenerlo todo revuelto. Hay dos formas habituales de organizarlo:
- **Por funcionalidad** (*feature*): todo lo de "cliente" en un mismo sitio. **Es lo que
  tenemos ahora.**
- **Por capas**: agrupar por su **rol técnico** → los datos (`modelo`), la lógica
  (`service`), la web (`controller`)…

Un paquete **`modelo`** agruparía las clases que representan **los datos** (la entidad y
los DTOs): el *"qué"* maneja la aplicación, separado del *"cómo"* (lógica de negocio,
acceso a la BD, capa web). Es la idea de separar responsabilidades que vimos en clase,
llevada a la organización de carpetas.

Ahora mismo **todo lo de clientes está en un único paquete**
`edu.xtd.facturacion360.cliente` (patrón *"paquete por funcionalidad"*):
```
cliente/
├── Cliente.java            (entidad)
├── ClienteDTO.java         (record)
├── PaginaClientesDTO.java  (record)
├── ClienteMapper.java
├── ClienteRepository.java
├── ClienteService.java
├── ClienteController.java
└── CargaDatosInicial.java
```

La propuesta es separar las **clases de datos** en un subpaquete `cliente.modelo`
(patrón *"paquete por capas"*):
```
cliente/
├── modelo/
│   ├── Cliente.java
│   ├── ClienteDTO.java
│   └── PaginaClientesDTO.java
├── ClienteMapper.java
├── ClienteRepository.java
├── ClienteService.java
├── ClienteController.java
└── CargaDatosInicial.java
```

### Pros
- **Capas más visibles**: se distingue "datos" de "lógica" de un vistazo (bien para la nota).
- **Escala mejor** si la feature crece (más DTOs, más entidades).
- Sigue la organización **por capas** que muchos profesores esperan ver.

### Contras
- Para ~8 clases de una sola feature, **añade saltos de carpeta** a cambio de poco.
- Meter la **entidad `Cliente`** (persistencia) junto a los **DTOs** (transferencia) en un
  mismo `modelo` no es del todo limpio: lo purista sería `modelo` (entidad) **+** `dto`
  (records) por separado → todavía más paquetes.
- **Es una convención de equipo**: si uno lo hace y otros no, el proyecto queda
  **inconsistente**. Solo tiene sentido si lo aplicamos todos igual.

### Cómo afectaría al trabajo (impacto real)
- Mover 3 archivos (`Cliente`, `ClienteDTO`, `PaginaClientesDTO`) y cambiar su línea
  `package` a `...cliente.modelo`.
- Añadir los `import` en las 5 clases que los usan (`Repository`, `Mapper`, `Service`,
  `Controller`, `CargaDatosInicial`) — antes no hacían falta por estar en el mismo paquete.
- **Sin cambios de configuración**: `cliente.modelo` sigue bajo `edu.xtd.facturacion360`,
  así que Spring lo detecta igual.
- **No afecta al frontend** ni al JSON de la API.
- Coste: unos 10–15 min, mecánico y de bajo riesgo. Pero si se adopta, **cada uno debería
  aplicar la misma estructura a su feature** para mantener la coherencia.

### Recomendación
Para features pequeñas, dejarlo **plano** (por funcionalidad) es válido y más simple. Si
el equipo prefiere ver las capas, adoptarlo **entre todos** y, ya puestos, separar
`modelo` (entidad) de `dto` (records) en vez de mezclarlos.

---

## 7. Recomendación y preguntas para el profesor

- **Si el objetivo es aprender SQL:** la **Opción B (JdbcTemplate)** es la que más SQL
  escribe (SELECT, COUNT, INSERT, CREATE TABLE). La **Opción C** es un término medio muy
  cómodo: practicamos el `SELECT` sin rehacer casi nada.
- **Si el objetivo es un backend "de libro":** la **Opción A (JPA)** es el estándar en la
  industria y ya está hecha y probada.

**Para preguntar mañana:**
1. ¿Quiere que **escribamos el SQL a mano** (B o C) o que usemos JPA (A)?
2. Si es SQL manual, ¿prefiere `JdbcTemplate` puro (B) o `@Query` nativa sobre JPA (C)?
3. ¿Seguimos con **H2 en memoria** o montamos una BD real (MySQL) más adelante? (En los
   tres casos H2 se cambia por el driver de MySQL sin tocar apenas el código.)

> Estado actual del repo: **Opción A implementada y funcionando** en la rama `Angel`.
> Cambiar a B o C es seguir esta guía; el frontend no se ve afectado en ningún caso.
