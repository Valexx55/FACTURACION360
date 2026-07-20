CREATE DATABASE  IF NOT EXISTS `bd_facturacion` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `bd_facturacion`;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: bd_facturacion
-- ------------------------------------------------------
-- Server version	8.4.10

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `idcliente` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(60) NOT NULL,
  `nif_cif` varchar(10) NOT NULL,
  `direccion` varchar(90) NOT NULL,
  `codigopostal` varchar(6) DEFAULT NULL,
  `poblacion` varchar(30) NOT NULL,
  `provincia` varchar(15) NOT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `email` varchar(30) DEFAULT NULL,
  `fecha_alta` date DEFAULT NULL,
  PRIMARY KEY (`idcliente`),
  UNIQUE KEY `nif_cif_UNIQUE` (`nif_cif`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
INSERT INTO `clientes` VALUES (1,'Tecnologías Norte SL','B12345678','Calle Alcalá 120','28009','Madrid','Madrid','910123456','info@tecnorte.es','2026-01-10'),(2,'María López García','12345678Z','Avenida del Puerto 45','46021','Valencia','Valencia','620345678','maria.lopez@email.es','2026-01-18'),(3,'Comercial Andaluza SA','A87654321','Calle Sierpes 18','41004','Sevilla','Sevilla','954234567','admin@comercialandal.es','2026-02-03'),(4,'Soluciones Digitales BCN SL','B45879632','Rambla de Catalunya 72','08007','Barcelona','Barcelona','932345678','contacto@digitalbcn.es','2026-02-14'),(5,'Carlos Martín Ruiz','48765432P','Calle Mayor 15','19001','Guadalajara','Guadalajara','630987654','carlos.martin@email.es','2026-03-01'),(6,'Fundación Once','G6975841','Fray Luis de León, 11','28012','Madrid','Madrid','916054578','fundacion@once.es','2026-07-09'),(16,'Juanita Pérez García','12345678Q','Calle Lérida','28056','Parla','Madrid','600123456','juani.perez@example.com','2026-07-16');
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conceptos`
--

DROP TABLE IF EXISTS `conceptos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conceptos` (
  `idconcepto` bigint NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(50) DEFAULT NULL,
  `cantidad` int DEFAULT NULL,
  `precio_unitario` decimal(10,2) DEFAULT NULL,
  `descuento` decimal(5,2) DEFAULT NULL,
  `porcentaje_iva` decimal(4,2) DEFAULT NULL,
  `importe_iva` decimal(10,2) DEFAULT NULL,
  `base_imponible` decimal(10,2) DEFAULT NULL,
  `total` decimal(10,2) NOT NULL,
  `idfactura` int NOT NULL,
  PRIMARY KEY (`idconcepto`),
  KEY `FK_FACTURA_idx` (`idfactura`),
  CONSTRAINT `FK_FACTURA` FOREIGN KEY (`idfactura`) REFERENCES `facturas` (`idfactura`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conceptos`
--

LOCK TABLES `conceptos` WRITE;
/*!40000 ALTER TABLE `conceptos` DISABLE KEYS */;
INSERT INTO `conceptos` VALUES (1,'Desarrollo página corporativa',2,450.00,0.00,21.00,189.00,900.00,1089.00,1),(2,'Mantenimiento mensual',1,120.00,10.00,21.00,22.68,108.00,130.68,1),(3,'Diseño de logotipo',1,350.00,0.00,21.00,73.50,350.00,423.50,2),(4,'Consultoría técnica',8,65.00,5.00,21.00,103.74,494.00,597.74,3),(5,'Configuración servidor',1,280.00,0.00,21.00,58.80,280.00,338.80,3),(6,'Licencia anual',2,90.00,0.00,21.00,37.80,180.00,217.80,3),(7,'Reparación de equipos',3,85.00,0.00,21.00,53.55,255.00,308.55,4),(8,'Sustitución disco SSD',2,110.00,0.00,21.00,46.20,220.00,266.20,4),(9,'Desplazamiento',1,35.00,0.00,21.00,7.35,35.00,42.35,4),(10,'Copia de seguridad',1,75.00,15.00,21.00,13.39,63.75,77.14,4),(11,'Curso de formación',10,45.00,10.00,21.00,85.05,405.00,490.05,5),(12,'Material didáctico',10,12.00,0.00,21.00,25.20,120.00,145.20,5),(13,'Alquiler de aula',1,180.00,0.00,21.00,37.80,180.00,217.80,5),(14,'Diplomas acreditativos',10,4.50,0.00,21.00,9.45,45.00,54.45,5),(15,'Soporte posterior',2,50.00,0.00,21.00,21.00,100.00,121.00,5),(16,'Auditoría de seguridad',1,780.00,0.00,21.00,163.80,780.00,943.80,6),(17,'Informe técnico',1,160.00,0.00,21.00,33.60,160.00,193.60,6),(18,'Campaña de publicidad',1,600.00,5.00,21.00,119.70,570.00,689.70,7),(19,'Gestión redes sociales',2,210.00,0.00,21.00,88.20,420.00,508.20,7),(20,'Diseño de creatividades',4,55.00,0.00,21.00,46.20,220.00,266.20,7),(21,'Migración de datos',6,70.00,0.00,21.00,88.20,420.00,508.20,8),(22,'Pruebas de integración',5,52.00,0.00,21.00,54.60,260.00,314.60,8),(23,'Documentación técnica',1,140.00,0.00,21.00,29.40,140.00,169.40,8),(24,'Puesta en producción',1,240.00,0.00,21.00,50.40,240.00,290.40,8);
/*!40000 ALTER TABLE `conceptos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `facturas`
--

DROP TABLE IF EXISTS `facturas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `facturas` (
  `idfactura` int NOT NULL AUTO_INCREMENT,
  `idcliente` int NOT NULL,
  `num_factura` varchar(15) NOT NULL,
  `fecha_emision` date NOT NULL,
  `estado` enum('BORRADOR','EMITIDA','PAGADA','ANULADA') DEFAULT NULL,
  `observaciones` varchar(90) DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `importe_iva` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `fecha_creacion` datetime DEFAULT NULL,
  `fecha_actualizacion` datetime DEFAULT NULL,
  PRIMARY KEY (`idfactura`),
  UNIQUE KEY `num_factura_UNIQUE` (`num_factura`),
  KEY `FK_CLIENTE_idx` (`idcliente`),
  CONSTRAINT `FK_CLIENTE` FOREIGN KEY (`idcliente`) REFERENCES `clientes` (`idcliente`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `facturas`
--

LOCK TABLES `facturas` WRITE;
/*!40000 ALTER TABLE `facturas` DISABLE KEYS */;
INSERT INTO `facturas` VALUES (1,1,'F-2026-0001','2026-01-15','PAGADA','Desarrollo inicial de la web corporativa',1008.00,211.68,1219.68,'2026-01-15 09:30:00','2026-01-20 12:15:00'),(2,2,'F-2026-0002','2026-01-25','EMITIDA','Diseño de la imagen corporativa',350.00,73.50,423.50,'2026-01-25 10:00:00','2026-01-25 10:00:00'),(3,1,'F-2026-0003','2026-02-05','PAGADA','Servicios de consultoría y servidor',954.00,200.34,1154.34,'2026-02-05 11:20:00','2026-02-12 09:45:00'),(4,3,'F-2026-0004','2026-02-18','EMITIDA','Reparación y actualización de equipos',573.75,120.49,694.24,'2026-02-18 16:10:00','2026-02-18 16:10:00'),(5,4,'F-2026-0005','2026-03-04','PAGADA','Curso de formación para empleados',850.00,178.50,1028.50,'2026-03-04 08:45:00','2026-03-10 13:30:00'),(6,5,'F-2026-0006','2026-03-17','BORRADOR','Auditoría pendiente de aprobación',940.00,197.40,1137.40,'2026-03-17 12:00:00','2026-03-17 12:00:00'),(7,3,'F-2026-0007','2026-04-02','ANULADA','Factura anulada por cambio de campaña',1210.00,254.10,1464.10,'2026-04-02 10:35:00','2026-04-04 17:20:00'),(8,4,'F-2026-0008','2026-04-21','EMITIDA','Migración y puesta en producción',1060.00,222.60,1282.60,'2026-04-21 09:15:00','2026-04-21 09:15:00');
/*!40000 ALTER TABLE `facturas` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-20  9:31:25
