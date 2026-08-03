# 📄 FACTURACION360

Sistema de gestión de clientes y facturación desarrollado con **Java 21**, **Spring Boot**, **Hibernate/JPA**, **MySQL** y tecnologías web estándar (**HTML, CSS y JavaScript**).

El objetivo del proyecto es proporcionar una aplicación sencilla, escalable y mantenible para la administración de clientes y facturas siguiendo una arquitectura profesional basada en capas.

---

# 🚀 Tecnologías utilizadas

### Backend

- Java 21
- Spring Boot
- Spring MVC
- Spring Data JPA (Hibernate)
- Maven

### Base de datos

- MySQL

### Frontend

- HTML5
- CSS3
- JavaScript (Fetch API)

---

# 📂 Arquitectura

El proyecto sigue una arquitectura por capas:

```
Controller
     │
     ▼
Service
     │
     ▼
Repository
     │
     ▼
Base de datos MySQL
```

Cada capa tiene una única responsabilidad:

- **Controller**
    - Gestiona las peticiones HTTP.
    - Valida la entrada.
    - Devuelve respuestas REST.

- **Service**
    - Contiene toda la lógica de negocio.
    - Coordina operaciones entre repositorios.

- **Repository**
    - Accede a la base de datos mediante JDBC

---

# 📁 Estructura del proyecto

```
src
 ├── main
 │   ├── java
 │   │    └── ...
 │   │         ├── controller
 │   │         ├── service
 │   │         ├── repository
 │   │         ├── dto
 │   │         ├── entity
 │   │         └── config
 │   │
 │   └── resources
 │        ├── static
 │        ├── templates
 │        └── application.properties
 │
 └── test
```

---

# ⚙️ Instalación

## 1. Clonar el repositorio

```bash
git clone https://github.com/Valexx55/FACTURACION360.git
```

Entrar en la carpeta:

```bash
cd FACTURACION360
```

---

## 2. Configurar la base de datos

Crear una base de datos MySQL.

Ejemplo:

```sql
CREATE DATABASE facturacion360;
```

Modificar el archivo:

```
src/main/resources/application.properties
```

Ejemplo:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/facturacion360
spring.datasource.username=root
spring.datasource.password=tu_password

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
```

---

## 3. Ejecutar la aplicación

Desde Maven:

```bash
mvn spring-boot:run
```

O desde tu IDE (IntelliJ IDEA o Eclipse).

---

# ✨ Funcionalidades

Actualmente el sistema incluye:

- Gestión de clientes
- Alta de clientes
- Edición de clientes
- Consulta de clientes
- Persistencia mediante JPA/Hibernate
- API REST
- Interfaz web
- Integración con MySQL

Próximamente:

- Eliminación de clientes
- Gestión de productos
- Facturación
- PDF de facturas
- Dashboard
- Búsquedas avanzadas
- Paginación

---

# 📡 API REST

Ejemplos de endpoints:

| Método | Endpoint | Descripción |
|---------|----------|-------------|
| GET | `/clientes` | Obtener todos los clientes |
| GET | `/clientes/{id}` | Obtener un cliente |
| POST | `/clientes` | Crear cliente |
| PUT | `/clientes/{id}` | Actualizar cliente |
| DELETE | `/clientes/{id}` | Eliminar cliente |

---

# 🛠 Buenas prácticas aplicadas

- Arquitectura en capas
- Separación de responsabilidades
- Programación orientada a objetos
- Uso de DTOs
- Spring Data JPA
- Código limpio
- Principios SOLID
- Reutilización de código
- Manejo de excepciones
- Respuestas HTTP adecuadas

---

# 📸 Capturas

<img width="1565" height="883" alt="image" src="https://github.com/user-attachments/assets/c840e5e0-9b52-440c-b7cd-1be25552417d" />

<hr>

<img width="1565" height="959" alt="image" src="https://github.com/user-attachments/assets/a656b2fe-6fe5-42ea-9ac4-7fe93e00dc01" />


---

# 🔮 Mejoras futuras

- Spring Security
- Roles y permisos (Login)
- Exportación PDF
- Exportación Excel
- Gestión de productos
- Gestión de impuestos

---

# 👨‍💻 Autor

**Val, Jaime, Daniel, Gonzalo, Sergio y Fran **

GitHub:

https://github.com/Valexx55

---

# 📄 Licencia

Este proyecto ha sido desarrollado con fines educativos y de aprendizaje.

Se puede utilizar como base para proyectos personales o académicos.
