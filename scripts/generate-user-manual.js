const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputDir = path.join(__dirname, '..', 'assets', 'manuals');
const outputPath = path.join(outputDir, 'OrbitPOS_Manual_Usuario.pdf');

const sections = [
  {
    title: '1. Introduccion',
    body: [
      'OrbitPOS es un sistema de terminal de venta al publico desarrollado por JRTech para trabajar localmente en Windows, Linux y macOS.',
      'Este manual resume el flujo principal del sistema: configuracion inicial, ventas, creditos, inventario, reportes, respaldos y soporte.'
    ]
  },
  {
    title: '2. Primer inicio',
    body: [
      'La primera vez que abras OrbitPOS se ejecuta el Wizard inicial.',
      'Completa los datos del negocio, impresora, lector, bascula opcional y credenciales del administrador.',
      'Si no cuentas con licencia al finalizar, el sistema activa automaticamente una demo de 30 dias.'
    ]
  },
  {
    title: '3. Inicio de sesion',
    body: [
      'El usuario por defecto es admin y la clave inicial es admin, salvo que se haya cambiado en el Wizard.',
      'Los roles disponibles son administrador y cajero.'
    ]
  },
  {
    title: '4. Punto de venta',
    body: [
      'Antes de vender, abre una caja desde el modulo Caja.',
      'Busca productos por nombre, categoria o codigo y agregalos al carrito.',
      'El POS calcula descuentos, impuestos, pagos mixtos, cambio o saldo pendiente antes de registrar la venta.',
      'Si esta habilitada la pantalla cliente, el resumen de la venta se muestra en vivo en la segunda pantalla.'
    ]
  },
  {
    title: '5. Creditos y abonos',
    body: [
      'Las ventas a credito requieren un cliente seleccionado.',
      'Desde el modulo Creditos puedes ver saldos abiertos, registrar abonos e imprimir recibos.',
      'Tambien puedes generar recordatorios y estados de cuenta por WhatsApp.'
    ]
  },
  {
    title: '6. Inventario y compras',
    body: [
      'En Productos puedes crear, editar y controlar stock minimo.',
      'En Compras registras entradas de inventario ligadas a proveedores.',
      'Las devoluciones reintegran stock segun la configuracion del item.'
    ]
  },
  {
    title: '7. Cotizaciones, descuentos y sucursales',
    body: [
      'Las cotizaciones pueden aprobarse, rechazarse y convertirse directamente en venta.',
      'Los descuentos automaticos pueden aplicarse por producto, categoria, cliente o a todo el catalogo.',
      'Las sucursales permiten separar operaciones y reportes.'
    ]
  },
  {
    title: '8. Reportes',
    body: [
      'El modulo Reportes permite filtrar por periodo, exportar CSV y generar PDF.',
      'Incluye ventas, compras, devoluciones, abonos, cotizaciones y stock bajo.'
    ]
  },
  {
    title: '9. Configuracion y backups',
    body: [
      'Desde Configuracion puedes ajustar impuestos, dispositivos, tema visual, servidor de actualizaciones y rutas de backup.',
      'El sistema soporta backup local con retencion y backup en nube usando Dropbox o Google Drive con token de acceso.'
    ]
  },
  {
    title: '10. Licencias',
    body: [
      'OrbitPOS valida la licencia contra el machine ID del equipo.',
      'JRTech utiliza un generador independiente para emitir, renovar y revocar licencias con historial SQLite propio.'
    ]
  },
  {
    title: '11. Soporte',
    body: [
      'Correo: jrr6867@gmail.com',
      'WhatsApp: +1 (809) 404-2070',
      'Version del sistema: OrbitPOS 2.0.0'
    ]
  }
];

function ensureOutputDirectory() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function drawHeader(doc) {
  doc.roundedRect(40, 34, 515, 86, 22).fill('#172033');
  doc.fillColor('#ffffff');
  doc.fontSize(11).text('JRTech', 62, 56);
  doc.fontSize(26).text('OrbitPOS', 62, 74);
  doc.fontSize(12).fillColor('#dbeafe').text('Manual de usuario', 152, 80);
  doc.fillColor('#172033');
  doc.moveDown(4);
}

function addSection(doc, section) {
  doc.moveDown(0.8);
  doc.fillColor('#172033').fontSize(16).text(section.title);
  doc.moveDown(0.4);
  section.body.forEach((paragraph) => {
    doc.fillColor('#334155').fontSize(11).text(paragraph, {
      width: 510,
      lineGap: 3
    });
    doc.moveDown(0.45);
  });
}

function generateManual() {
  ensureOutputDirectory();
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40
  });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  drawHeader(doc);
  doc.fillColor('#475569').fontSize(11).text(
    'Guia rapida para instalacion, operacion diaria, reportes, respaldos, licencias y soporte tecnico.',
    40,
    150,
    { width: 500, lineGap: 4 }
  );

  sections.forEach((section, index) => {
    if (index > 0 && doc.y > 700) {
      doc.addPage();
    }
    addSection(doc, section);
  });

  doc.moveDown(1.2);
  doc.fillColor('#64748b').fontSize(10).text(
    'Documento generado automaticamente desde el proyecto OrbitPOS.',
    { align: 'center' }
  );

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

generateManual()
  .then((manualPath) => {
    console.log(`Manual generado en ${manualPath}`);
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
