import { crearAvisos } from "./js/notificaciones.js";
import { motivoDe } from "./js/problema.js";

const estadoVisor = document.getElementById("estadoVisor");
const contenidoFactura = document.getElementById("contenidoFactura");
const botonImprimir = document.getElementById("botonImprimir");
const tablaConceptos = document.getElementById("tablaConceptos");
const tablaDesglose = document.getElementById("tablaDesglose");
const bloqueDesglose = document.getElementById("bloqueDesglose");

const bloqueQr      = document.getElementById("bloqueQr");
const imagenQr      = document.getElementById("imagenQr");
const marcaAgua     = document.getElementById("marcaAgua");
const selectFormato = document.getElementById("selectFormatoPapel");
const estiloHoja    = document.getElementById("estiloFormatoPapel");

// Los avisos de esta pantalla. Aquí la franja es el propio rótulo de estado del visor: el
// "Cargando factura..." que ya viene escrito en el HTML es un estado, no un evento, así que
// se queda hasta que la factura carga (limpiar) o hasta que falla (fijar).
const { fijar, limpiar } = crearAvisos({
    franja: estadoVisor,
    region: document.getElementById("anuncios"),
});

/** Carga la factura indicada en la dirección de la página. */
async function cargarDetalleFactura() {
    const parametros = new URLSearchParams(window.location.search);
    const idFactura = Number(parametros.get("idFactura"));

    if (Number.isInteger(idFactura) && idFactura > 0) {
        try {
            const respuesta = await fetch("/factura/" + idFactura + "/detalle");
            if (respuesta.ok) {
                const detalle = await respuesta.json();
                mostrarDetalle(detalle);
            } else {
                mostrarError(await motivoDe(respuesta, "No se pudo cargar la factura."));
            }
        } catch (error) {
            console.error("Error al cargar el detalle de la factura", error);
            mostrarError("No se pudo conectar con el servidor.");
        }
    } else {
        mostrarError("El identificador de factura no es válido.");
    }
}

/** Muestra la cabecera, el cliente, los conceptos y los totales. */
function mostrarDetalle(detalle) {
    const factura = detalle.factura;
    const cliente = detalle.cliente;
    const editar = document.getElementById("botonEditarBorrador");
    editar.classList.toggle("d-none", factura.estado != "BORRADOR");
    if (factura.estado == "BORRADOR") {
        editar.href = "facturas.html?editar=" + factura.idFactura;
    }

    document.getElementById("numeroFactura").textContent = factura.numeroFactura;
    document.getElementById("fechaFactura").textContent = "Fecha: " + formatearFecha(factura.fechaEmision);
    document.getElementById("estadoFactura").textContent = "Estado: " + factura.estado;
    document.getElementById("nombreCliente").textContent = cliente.nombre;
    document.getElementById("nifCliente").textContent = "NIF/CIF: " + cliente.nifCif;
    document.getElementById("direccionCliente").textContent = formarDireccion(cliente);
    document.getElementById("contactoCliente").textContent = formarContacto(cliente);
    document.getElementById("subtotalFactura").textContent = formatearImporte(factura.subtotal);
    document.getElementById("ivaFactura").textContent = formatearImporte(factura.importeIva);
    document.getElementById("totalFactura").textContent = formatearImporte(factura.total);

    mostrarConceptos(detalle.conceptos);
    mostrarDesglose(detalle.desglose);

    if (factura.observaciones != null && factura.observaciones.trim() != "") {
        document.getElementById("observacionesFactura").textContent = factura.observaciones;
        document.getElementById("bloqueObservaciones").classList.remove("d-none");
    }

    limpiar();
    contenidoFactura.classList.remove("d-none");
    document.getElementById("documentoFactura").setAttribute("aria-busy", "false");
    botonImprimir.disabled = false;

    const esBorrador = factura.estado === "BORRADOR";
    marcaAgua.classList.toggle("d-none", !esBorrador);
    mostrarQr(esBorrador, factura.idFactura);
}

/**
 * Pinta el cuadro del IVA agrupado por tipo.
 *
 * El desglose lo calcula el SERVIDOR y aqui solo se pinta. No es pereza: la regla de
 * redondeo -redondear la cuota de cada linea y luego sumar- es la misma que acabara dentro
 * de la huella que se comunica a Hacienda, y tenerla escrita en dos idiomas es tenerla
 * escrita dos veces para que se desalineen.
 *
 * Si no hay desglose -una factura sin conceptos- el cuadro no se ensena en vez de salir
 * vacio: un recuadro con cabeceras y nada debajo parece un fallo de carga.
 *
 * @param {Array} desglose una linea por tipo impositivo, o nada
 */
function mostrarDesglose(desglose) {
    tablaDesglose.replaceChildren();

    if (!desglose || desglose.length == 0) {
        bloqueDesglose.classList.add("d-none");
        return;
    }

    for (const linea of desglose) {
        const fila = document.createElement("tr");
        agregarCelda(fila, formatearImporte(linea.baseImponible), "text-end");
        agregarCelda(fila, formatearPorcentaje(linea.tipoImpositivo), "text-end");
        agregarCelda(fila, formatearImporte(linea.cuotaRepercutida), "text-end");
        tablaDesglose.appendChild(fila);
    }

    bloqueDesglose.classList.remove("d-none");
}

/** Rellena la tabla o muestra una fila informativa si la factura no tiene conceptos. */
function mostrarConceptos(conceptos) {
    tablaConceptos.replaceChildren();

    if (conceptos.length == 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 7;
        celda.className = "text-center text-muted";
        celda.textContent = "Esta factura no tiene conceptos registrados.";
        fila.appendChild(celda);
        tablaConceptos.appendChild(fila);
    } else {
        for (const concepto of conceptos) {
            const fila = document.createElement("tr");
            agregarCelda(fila, concepto.descripcion || "—");
            agregarCelda(fila, concepto.cantidad ?? "—", "text-end");
            agregarCelda(fila, formatearImporte(concepto.precioUnitario), "text-end");
            agregarCelda(fila, formatearPorcentaje(concepto.descuento), "text-end");
            agregarCelda(fila, formatearImporte(concepto.baseImponible), "text-end");
            agregarCelda(fila, formatearImporte(concepto.importeIva), "text-end");
            agregarCelda(fila, formatearImporte(concepto.total), "text-end");
            tablaConceptos.appendChild(fila);
        }
    }
}

/**
 * Muestra el bloque QR si la factura está emitida, o lo oculta si es borrador.
 *
 * Los borradores no generan registro de facturación y por tanto no tienen URL
 * en la sede de la AEAT. Intentar cargar la imagen daría un 404.
 *
 * @param {boolean} esBorrador - true si la factura es un borrador
 * @param {number}  idFactura  - identificador de la factura
 */
function mostrarQr(esBorrador, idFactura) {
    if (esBorrador) {
        bloqueQr.classList.add("d-none");
        return;
    }
    imagenQr.src = `/verifactu/qr/${idFactura}`;
    bloqueQr.classList.remove("d-none");
}

/** Carga los datos de la informacion del emisor */
async function cargarEmisor() {
    try {
        const respuesta = await fetch("/emisor");
        if (respuesta.ok) {
            const emisor = await respuesta.json();
            mostrarEmisor(emisor);
        }
    } catch (error) {
        console.error("Error al cargar los datos del emisor", error);
    }
}
/** Muestra los datos de la informacion del emisor */
function mostrarEmisor(emisor) {
    if (!emisor) return;
    
    // Asignamos los datos únicamente a la sección del recuadro "Emisor"
    document.getElementById("nombreEmisor").textContent = emisor.nombre || "—";
    document.getElementById("cifEmisor").textContent = "NIF/CIF: " + (emisor.cif || emisor.nifCif || "—");
    document.getElementById("direccionEmisor").textContent = emisor.direccion || "—";
    
    const tel = emisor.telefono || "";
    const email = emisor.email || "";
    document.getElementById("contactoEmisor").textContent = [tel, email].filter(Boolean).join(" · ") || "Sin contacto";
}

function agregarCelda(fila, texto, clases) {
    const celda = document.createElement("td");
    celda.textContent = texto;
    if (clases != null) {
        celda.className = clases;
    }
    fila.appendChild(celda);
}

function formarDireccion(cliente) {
    const codigoPostal = cliente.codigoPostal || "";
    return cliente.direccion + ", " + codigoPostal + " " + cliente.poblacion + " (" + cliente.provincia + ")";
}

function formarContacto(cliente) {
    const telefono = cliente.telefono || "Sin teléfono";
    const email = cliente.email || "Sin email";
    return telefono + " · " + email;
}

function formatearFecha(fecha) {
    const partes = fecha.split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function formatearImporte(importe) {
    const valor = importe == null ? 0 : importe;
    return Number(valor).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatearPorcentaje(porcentaje) {
    const valor = porcentaje == null ? 0 : porcentaje;
    return Number(valor).toLocaleString("es-ES") + " %";
}

function mostrarError(mensaje) {
    fijar(mensaje, { esError: true });
    document.getElementById("documentoFactura").setAttribute("aria-busy", "false");
}

botonImprimir.addEventListener("click", function () {
    window.print();
});

/**
 * Dimensiones de la hoja del borrador en pantalla, por formato.
 * "" (por defecto) no puede saber el papel de la impresora, así que el
 * borrador se queda como referencia en A4.
 * "estrecha" marca la hoja que necesita la maquetación de columna
 * (la misma que la impresión aplica con @media contra el papel).
 */
const HOJAS = {
    "":     { ancho: "210mm",   alto: "297mm" },
    A4:     { ancho: "210mm",   alto: "297mm" },
    A5:     { ancho: "148mm",   alto: "210mm", estrecha: true },
    letter: { ancho: "215.9mm", alto: "279.4mm" },
};

/**
 * Inyecta o elimina la regla @page dinámicamente en el documento y
 * redimensiona la hoja del borrador para que la vista en pantalla
 * coincida con el formato que se imprimirá.
 * Si el usuario no elige formato, se deja vacío para respetar la configuración
 * por defecto del cuadro de diálogo de impresión del navegador.
 */
function actualizarFormatoPapel() {
    estiloHoja.textContent = selectFormato.value
        ? `@page { size: ${selectFormato.value}; margin: 14mm; }`
        : "";

    const hoja = HOJAS[selectFormato.value];
    if (hoja) {
        document.documentElement.style.setProperty("--hoja-ancho", hoja.ancho);
        document.documentElement.style.setProperty("--hoja-alto", hoja.alto);
        document.getElementById("documentoFactura")
            .classList.toggle("hoja-estrecha", Boolean(hoja.estrecha));
    }
}

selectFormato.addEventListener("change", actualizarFormatoPapel);
actualizarFormatoPapel();

cargarDetalleFactura();
cargarEmisor();