-- ============================================================================
--  bd_facturacion.sql  —  Replica la base de datos en tu MySQL local
-- ----------------------------------------------------------------------------
--  Ejecútalo en MySQL (Workbench, o:  mysql -u root -p < bd_facturacion.sql).
--  Requisito: tener MySQL arrancado. La app se conecta con la config de
--  application.properties (jdbc:mysql://localhost:3306/bd_facturacion, root/root).
--
--  La tabla 'cliente' sigue el ESQUEMA ER del profe (docu/ESQUEMA ER.png).
--  NOTA: el record Cliente de Java usa 'nombre' y no tiene 'pais'; en la tabla
--  la columna es 'nombre_razon_social' y sí existe 'pais'. El ClienteRowMapper
--  vuelca 'nombre_razon_social' en el campo 'nombre' e ignora 'pais'.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bd_facturacion
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bd_facturacion;

DROP TABLE IF EXISTS cliente;

CREATE TABLE cliente (
    id_cliente          INT AUTO_INCREMENT PRIMARY KEY,
    nombre_razon_social VARCHAR(150) NOT NULL,
    nif_cif             VARCHAR(15)  NOT NULL UNIQUE,
    direccion           VARCHAR(200),
    codigo_postal       VARCHAR(10),
    poblacion           VARCHAR(100),
    provincia           VARCHAR(100),
    pais                VARCHAR(100) DEFAULT 'España',
    telefono            VARCHAR(20),
    email               VARCHAR(150),
    fecha_alta          DATE NOT NULL
);

-- Datos de ejemplo (id_cliente autoincremental: los de abajo son los "más recientes").
INSERT INTO cliente
    (nombre_razon_social, nif_cif, direccion, codigo_postal, poblacion, provincia, pais, telefono, email, fecha_alta)
VALUES
    ('Acme Corporation S.L.',      'B12345678', 'Calle Mayor 1',        '28001', 'Madrid',    'Madrid',    'España', '+34 912 345 678', 'contacto@acme.com',          '2026-01-10'),
    ('Tech Solutions S.L.',        'B87654321', 'Av. Diagonal 200',     '08018', 'Barcelona', 'Barcelona', 'España', '+34 933 456 789', 'info@techsolutions.es',      '2026-01-15'),
    ('Innova Digital S.A.',        'A11223344', 'Calle Colón 45',       '46004', 'Valencia',  'Valencia',  'España', '+34 961 112 233', 'hola@innovadigital.es',      '2026-01-20'),
    ('Construcciones López S.L.',  'B22334455', 'Av. de la Paz 12',     '41001', 'Sevilla',   'Sevilla',   'España', '+34 954 223 344', 'obras@lopezsl.es',           '2026-01-25'),
    ('Gráficas del Norte S.L.',    'B33445566', 'Polígono Sur, Nave 3', '48013', 'Bilbao',    'Vizcaya',   'España', '+34 944 334 455', 'pedidos@graficasnorte.es',   '2026-02-01'),
    ('Alimentos Frescos S.A.',     'A44556677', 'Ctra. Nacional 340',   '29001', 'Málaga',    'Málaga',    'España', '+34 952 445 566', 'ventas@alimentosfrescos.es', '2026-02-05'),
    ('Muebles García S.L.',        'B55667788', 'Calle del Roble 8',    '50001', 'Zaragoza',  'Zaragoza',  'España', '+34 976 556 677', 'info@mueblesgarcia.es',      '2026-02-10'),
    ('Transporte Rápido S.L.',     'B66778899', 'Av. Logística 100',    '15008', 'A Coruña',  'A Coruña',  'España', '+34 981 667 788', 'flota@transporterapido.es',  '2026-02-14'),
    ('Clínica Salud Plus S.L.',    'B77889900', 'Calle Salud 22',       '30001', 'Murcia',    'Murcia',    'España', '+34 968 778 899', 'citas@saludplus.es',         '2026-02-18'),
    ('Bodegas Valdés S.A.',        'A88990011', 'Camino Viñedo 5',      '26001', 'Logroño',   'La Rioja',  'España', '+34 941 889 900', 'club@bodegasvaldes.es',      '2026-02-22'),
    ('Electro Hogar S.L.',         'B99001122', 'Gran Vía 77',          '18001', 'Granada',   'Granada',   'España', '+34 958 990 011', 'atencion@electrohogar.es',   '2026-02-26'),
    ('Seguros Confianza S.A.',     'A10111213', 'Paseo del Prado 30',   '28014', 'Madrid',    'Madrid',    'España', '+34 913 101 112', 'polizas@confianza.es',       '2026-03-02'),
    ('Papelería Central S.L.',     'B12131415', 'Calle Libros 9',       '47001', 'Valladolid','Valladolid','España', '+34 983 121 314', 'tienda@papeleriacentral.es', '2026-03-06'),
    ('Jardines Verdes S.L.',       'B14151617', 'Av. de los Olivos 3',  '06001', 'Badajoz',   'Badajoz',   'España', '+34 924 141 516', 'proyectos@jardinesverdes.es','2026-03-10'),
    ('Software Ibérico S.A.',      'A16171819', 'Calle Código 42',      '33001', 'Oviedo',    'Asturias',  'España', '+34 985 161 718', 'dev@softwareiberico.es',     '2026-03-15');
