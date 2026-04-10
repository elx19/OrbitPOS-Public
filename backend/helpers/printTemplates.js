const PRINT_TEMPLATE_VARIANTS = [
  { value: 'classic', label: 'Clasico', description: 'Formato termico tradicional balanceado.' },
  { value: 'compact', label: 'Compacto', description: 'Usa menos lineas y tickets mas cortos.' },
  { value: 'detailed', label: 'Detallado', description: 'Muestra mas contexto operativo.' },
  { value: 'modern', label: 'Comercial', description: 'Presentacion mas cuidada y moderna.' }
];

const PRINT_TEMPLATE_DOCUMENTS = [
  { key: 'wizard_test', label: 'Prueba de impresora', description: 'Validacion del wizard y configuracion.' },
  { key: 'sale', label: 'Venta', description: 'Ticket principal de venta.' },
  { key: 'payment', label: 'Abono', description: 'Recibo de abono o pago de credito.' },
  { key: 'return', label: 'Devolucion', description: 'Nota de devolucion.' },
  { key: 'quote', label: 'Cotizacion', description: 'Documento comercial de cotizacion.' },
  { key: 'cash_open', label: 'Apertura de caja', description: 'Comprobante de apertura.' },
  { key: 'cash_close', label: 'Cierre de caja', description: 'Comprobante de cierre.' }
];

const PRINT_TEMPLATE_PLACEHOLDERS = {
  common: [
    { token: '{{separator}}', label: 'Linea gruesa de separacion' },
    { token: '{{thinSeparator}}', label: 'Linea fina de separacion' },
    { token: '{{centeredBusinessNameUpper}}', label: 'Nombre del negocio centrado en mayusculas' },
    { token: '{{businessPhoneCentered}}', label: 'Telefono centrado si existe' },
    { token: '{{businessRncCentered}}', label: 'RNC centrado si existe' },
    { token: '{{dateTime}}', label: 'Fecha y hora actual' },
    { token: '{{footer}}', label: 'Mensaje final del ticket' },
    { token: '{{blank}}', label: 'Linea en blanco obligatoria' }
  ],
  wizard_test: [
    { token: '{{printerNameLine}}', label: 'Linea con nombre de impresora' },
    { token: '{{readyLine}}', label: 'Mensaje final de prueba' }
  ],
  sale: [
    { token: '{{invoiceNumber}}', label: 'Numero de factura' },
    { token: '{{cashier}}', label: 'Cajero' },
    { token: '{{branchName}}', label: 'Sucursal' },
    { token: '{{customerLine}}', label: 'Linea de cliente si existe' },
    { token: '{{saleTypeLine}}', label: 'Linea con tipo de venta' },
    { token: '[[itemsHeader]]', label: 'Cabecera del detalle de productos' },
    { token: '[[items]]', label: 'Detalle de productos preformateado' },
    { token: '{{subtotalLine}}', label: 'Linea de subtotal' },
    { token: '{{discountLine}}', label: 'Linea de descuento si aplica' },
    { token: '{{taxLine}}', label: 'Linea de impuesto' },
    { token: '{{totalLine}}', label: 'Linea de total' },
    { token: '[[payments]]', label: 'Bloque de metodos de pago' },
    { token: '{{changeLine}}', label: 'Linea de vuelto si aplica' },
    { token: '{{qrLine}}', label: 'Texto del QR' },
    { token: '{{demoLine}}', label: 'Badge demo si aplica' }
  ],
  payment: [
    { token: '{{receiptNumber}}', label: 'Numero de recibo' },
    { token: '{{customerName}}', label: 'Nombre del cliente' },
    { token: '{{invoiceNumberLabel}}', label: 'Factura asociada' },
    { token: '{{previousBalanceLine}}', label: 'Saldo anterior' },
    { token: '{{paidAmountLine}}', label: 'Abono recibido' },
    { token: '{{newBalanceLine}}', label: 'Nuevo saldo' },
    { token: '{{paymentMethodLine}}', label: 'Metodo de pago' },
    { token: '{{cashierLine}}', label: 'Cajero' }
  ],
  return: [
    { token: '{{returnNumber}}', label: 'Numero de devolucion' },
    { token: '{{invoiceNumberLabel}}', label: 'Factura original' },
    { token: '{{customerLine}}', label: 'Linea de cliente' },
    { token: '{{reasonLine}}', label: 'Motivo de devolucion' },
    { token: '[[items]]', label: 'Detalle de articulos devueltos' },
    { token: '{{totalLine}}', label: 'Monto total devuelto' },
    { token: '{{refundMethodLine}}', label: 'Metodo de devolucion' },
    { token: '{{cashierLine}}', label: 'Cajero' }
  ],
  quote: [
    { token: '{{quoteNumber}}', label: 'Numero de cotizacion' },
    { token: '{{validUntilLine}}', label: 'Vigencia si existe' },
    { token: '{{customerLine}}', label: 'Linea de cliente' },
    { token: '[[items]]', label: 'Detalle de la cotizacion' },
    { token: '{{subtotalLine}}', label: 'Linea de subtotal' },
    { token: '{{discountLine}}', label: 'Linea de descuento' },
    { token: '{{taxLine}}', label: 'Linea de impuesto' },
    { token: '{{totalLine}}', label: 'Linea de total' }
  ],
  cash_open: [
    { token: '{{registerNumber}}', label: 'Numero de caja' },
    { token: '{{branchLine}}', label: 'Sucursal' },
    { token: '{{cashierLine}}', label: 'Cajero' },
    { token: '{{openingAmountLine}}', label: 'Monto inicial' }
  ],
  cash_close: [
    { token: '{{registerNumber}}', label: 'Numero de caja' },
    { token: '{{branchLine}}', label: 'Sucursal' },
    { token: '{{cashierLine}}', label: 'Cajero' },
    { token: '{{openingAmountLine}}', label: 'Monto inicial' },
    { token: '{{cashSalesLine}}', label: 'Ventas en efectivo' },
    { token: '{{cardSalesLine}}', label: 'Ventas con tarjeta' },
    { token: '{{transferSalesLine}}', label: 'Ventas por transferencia' },
    { token: '{{creditCashLine}}', label: 'Abonos en efectivo' },
    { token: '{{creditCardLine}}', label: 'Abonos en tarjeta' },
    { token: '{{creditTransferLine}}', label: 'Abonos por transferencia' },
    { token: '{{expectedCashLine}}', label: 'Total esperado' },
    { token: '{{countedAmountLine}}', label: 'Monto contado si existe' },
    { token: '{{differenceLine}}', label: 'Diferencia si existe' }
  ]
};

const BASE_TEMPLATE_CATALOG = {
  wizard_test: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'PRUEBA DE IMPRESION', '{{thinSeparator}}', '{{printerNameLine}}', '{{dateLine}}', '{{thinSeparator}}', '{{readyLine}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', 'PRUEBA', '{{thinSeparator}}', '{{printerNameLine}}', '{{dateLine}}', '{{readyLine}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'VALIDACION DE IMPRESORA', '{{businessPhoneCentered}}', '{{thinSeparator}}', '{{printerNameLine}}', '{{dateLine}}', '{{thinSeparator}}', 'OrbitPOS detecto la impresora y envio', 'esta impresion correctamente.', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · PRUEBA DE IMPRESION', '{{thinSeparator}}', '{{printerNameLine}}', '{{dateLine}}', '{{thinSeparator}}', '{{readyLine}}', 'Todo listo para vender.', '{{separator}}'].join('\n')
  },
  sale: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', '{{businessPhoneCentered}}', '{{businessRncCentered}}', '{{thinSeparator}}', 'Factura: #{{invoiceNumber}}', 'Fecha: {{dateTime}}', 'Cajero: {{cashier}}', 'Sucursal: {{branchName}}', '{{customerLine}}', '{{saleTypeLine}}', '{{thinSeparator}}', '[[itemsHeader]]', '[[items]]', '{{thinSeparator}}', '{{subtotalLine}}', '{{discountLine}}', '{{taxLine}}', '{{totalLine}}', '[[payments]]', '{{changeLine}}', '{{thinSeparator}}', '{{qrLine}}', '{{demoLine}}', '{{footer}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', '{{thinSeparator}}', 'VENTA #{{invoiceNumber}}', '{{dateTime}}', '{{customerLine}}', '[[items]]', '{{thinSeparator}}', '{{totalLine}}', '[[payments]]', '{{changeLine}}', '{{footer}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', '{{businessPhoneCentered}}', '{{businessRncCentered}}', 'TICKET DE VENTA', '{{thinSeparator}}', 'Factura: #{{invoiceNumber}}', 'Fecha: {{dateTime}}', 'Cajero: {{cashier}}', 'Sucursal: {{branchName}}', '{{customerLine}}', '{{saleTypeLine}}', '{{thinSeparator}}', '[[itemsHeader]]', '[[items]]', '{{thinSeparator}}', '{{subtotalLine}}', '{{discountLine}}', '{{taxLine}}', '{{totalLine}}', '[[payments]]', '{{changeLine}}', '{{thinSeparator}}', '{{qrLine}}', '{{demoLine}}', 'Gracias por elegirnos.', '{{footer}}', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · VENTA', '{{thinSeparator}}', '#{{invoiceNumber}} · {{dateTime}}', '{{customerLine}}', '{{saleTypeLine}}', '{{thinSeparator}}', '[[itemsHeader]]', '[[items]]', '{{thinSeparator}}', '{{subtotalLine}}', '{{discountLine}}', '{{taxLine}}', '{{totalLine}}', '[[payments]]', '{{changeLine}}', '{{thinSeparator}}', '{{qrLine}}', '{{demoLine}}', '{{footer}}', '{{separator}}'].join('\n')
  },
  payment: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'RECIBO DE ABONO', '{{thinSeparator}}', 'Recibo: {{receiptNumber}}', 'Cliente: {{customerName}}', '{{invoiceNumberLabel}}', '{{thinSeparator}}', '{{previousBalanceLine}}', '{{paidAmountLine}}', '{{newBalanceLine}}', '{{thinSeparator}}', '{{paymentMethodLine}}', '{{cashierLine}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', 'ABONO {{receiptNumber}}', '{{customerName}}', '{{invoiceNumberLabel}}', '{{paidAmountLine}}', '{{newBalanceLine}}', '{{paymentMethodLine}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'RECIBO DE ABONO', '{{businessPhoneCentered}}', '{{thinSeparator}}', 'Recibo: {{receiptNumber}}', 'Fecha: {{dateTime}}', 'Cliente: {{customerName}}', '{{invoiceNumberLabel}}', '{{thinSeparator}}', '{{previousBalanceLine}}', '{{paidAmountLine}}', '{{newBalanceLine}}', '{{thinSeparator}}', '{{paymentMethodLine}}', '{{cashierLine}}', '{{footer}}', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · RECIBO DE ABONO', '{{thinSeparator}}', '{{receiptNumber}} · {{dateTime}}', 'Cliente: {{customerName}}', '{{invoiceNumberLabel}}', '{{thinSeparator}}', '{{previousBalanceLine}}', '{{paidAmountLine}}', '{{newBalanceLine}}', '{{paymentMethodLine}}', '{{cashierLine}}', '{{separator}}'].join('\n')
  },
  return: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'NOTA DE DEVOLUCION', '{{thinSeparator}}', 'Nota: {{returnNumber}}', '{{invoiceNumberLabel}}', 'Fecha: {{dateTime}}', '{{customerLine}}', '{{reasonLine}}', '{{thinSeparator}}', '[[items]]', '{{thinSeparator}}', '{{totalLine}}', '{{refundMethodLine}}', '{{cashierLine}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', 'DEVOLUCION {{returnNumber}}', '{{customerLine}}', '[[items]]', '{{totalLine}}', '{{refundMethodLine}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'NOTA DE DEVOLUCION', '{{thinSeparator}}', 'Nota: {{returnNumber}}', '{{invoiceNumberLabel}}', 'Fecha: {{dateTime}}', '{{customerLine}}', '{{reasonLine}}', '{{thinSeparator}}', '[[items]]', '{{thinSeparator}}', '{{totalLine}}', '{{refundMethodLine}}', '{{cashierLine}}', '{{footer}}', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · DEVOLUCION', '{{thinSeparator}}', '{{returnNumber}} · {{dateTime}}', '{{customerLine}}', '{{reasonLine}}', '{{thinSeparator}}', '[[items]]', '{{totalLine}}', '{{refundMethodLine}}', '{{cashierLine}}', '{{separator}}'].join('\n')
  },
  quote: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'COTIZACION', '{{thinSeparator}}', 'Cotizacion: {{quoteNumber}}', 'Fecha: {{dateOnly}}', '{{validUntilLine}}', '{{customerLine}}', '{{thinSeparator}}', '[[items]]', '{{thinSeparator}}', '{{subtotalLine}}', '{{discountLine}}', '{{taxLine}}', '{{totalLine}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', 'COT {{quoteNumber}}', '{{customerLine}}', '[[items]]', '{{totalLine}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'COTIZACION COMERCIAL', '{{businessPhoneCentered}}', '{{thinSeparator}}', 'Cotizacion: {{quoteNumber}}', 'Fecha: {{dateOnly}}', '{{validUntilLine}}', '{{customerLine}}', '{{thinSeparator}}', '[[items]]', '{{thinSeparator}}', '{{subtotalLine}}', '{{discountLine}}', '{{taxLine}}', '{{totalLine}}', '{{footer}}', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · COTIZACION', '{{thinSeparator}}', '{{quoteNumber}} · {{dateOnly}}', '{{validUntilLine}}', '{{customerLine}}', '{{thinSeparator}}', '[[items]]', '{{subtotalLine}}', '{{discountLine}}', '{{taxLine}}', '{{totalLine}}', '{{separator}}'].join('\n')
  },
  cash_open: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'APERTURA DE CAJA', '{{thinSeparator}}', 'Caja: {{registerNumber}}', '{{branchLine}}', '{{cashierLine}}', '{{dateLine}}', '{{thinSeparator}}', '{{openingAmountLine}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', 'APERTURA {{registerNumber}}', '{{cashierLine}}', '{{openingAmountLine}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'CONTROL DE APERTURA DE CAJA', '{{thinSeparator}}', 'Caja: {{registerNumber}}', '{{branchLine}}', '{{cashierLine}}', '{{dateLine}}', '{{thinSeparator}}', '{{openingAmountLine}}', '{{footer}}', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · APERTURA', '{{thinSeparator}}', '{{registerNumber}} · {{dateTime}}', '{{branchLine}}', '{{cashierLine}}', '{{openingAmountLine}}', '{{separator}}'].join('\n')
  },
  cash_close: {
    classic: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'CIERRE DE CAJA', '{{thinSeparator}}', 'Caja: {{registerNumber}}', '{{branchLine}}', '{{cashierLine}}', '{{dateLine}}', '{{thinSeparator}}', '{{openingAmountLine}}', '{{cashSalesLine}}', '{{cardSalesLine}}', '{{transferSalesLine}}', '{{creditCashLine}}', '{{creditCardLine}}', '{{creditTransferLine}}', '{{thinSeparator}}', '{{expectedCashLine}}', '{{countedAmountLine}}', '{{differenceLine}}', '{{separator}}'].join('\n'),
    compact: ['{{centeredBusinessNameUpper}}', 'CIERRE {{registerNumber}}', '{{expectedCashLine}}', '{{countedAmountLine}}', '{{differenceLine}}'].join('\n'),
    detailed: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'CONTROL DE CIERRE DE CAJA', '{{thinSeparator}}', 'Caja: {{registerNumber}}', '{{branchLine}}', '{{cashierLine}}', '{{dateLine}}', '{{thinSeparator}}', '{{openingAmountLine}}', '{{cashSalesLine}}', '{{cardSalesLine}}', '{{transferSalesLine}}', '{{creditCashLine}}', '{{creditCardLine}}', '{{creditTransferLine}}', '{{thinSeparator}}', '{{expectedCashLine}}', '{{countedAmountLine}}', '{{differenceLine}}', '{{footer}}', '{{separator}}'].join('\n'),
    modern: ['{{separator}}', '{{centeredBusinessNameUpper}}', 'ORBITPOS · CIERRE DE CAJA', '{{thinSeparator}}', '{{registerNumber}} · {{dateTime}}', '{{branchLine}}', '{{cashierLine}}', '{{thinSeparator}}', '{{cashSalesLine}}', '{{cardSalesLine}}', '{{transferSalesLine}}', '{{creditCashLine}}', '{{creditCardLine}}', '{{creditTransferLine}}', '{{thinSeparator}}', '{{expectedCashLine}}', '{{countedAmountLine}}', '{{differenceLine}}', '{{separator}}'].join('\n')
  }
};

const BLANK_SENTINEL = '__ORBITPOS_PRINT_BLANK__';

function normalizeTemplateVariant(value = 'classic') {
  const normalized = String(value || '').trim().toLowerCase();
  return PRINT_TEMPLATE_VARIANTS.some((variant) => variant.value === normalized) ? normalized : 'classic';
}

function getPrintTemplateVariantKey(documentKey) {
  return `print_template_${documentKey}_variant`;
}

function getPrintTemplateCustomKey(documentKey) {
  return `print_template_${documentKey}_custom`;
}

function getPrintTemplateConfigDefaults() {
  return PRINT_TEMPLATE_DOCUMENTS.flatMap((document) => ([
    [getPrintTemplateVariantKey(document.key), 'classic'],
    [getPrintTemplateCustomKey(document.key), '']
  ]));
}

function formatAmount(value, currencySymbol = 'RD$') {
  return `${currencySymbol} ${Number(value || 0).toFixed(2)}`;
}

function formatCompactAmount(value) {
  return Number(value || 0).toFixed(2);
}

function formatPaymentMethod(method = '') {
  const normalized = String(method).trim().toLowerCase();
  if (normalized === 'cash') return 'Efectivo';
  if (normalized === 'card') return 'Tarjeta';
  if (normalized === 'transfer') return 'Transferencia';
  if (normalized === 'credit_note') return 'Nota credito';
  if (normalized === 'exchange') return 'Cambio';
  return normalized || 'Pago';
}

function formatPaymentMethods(methods = []) {
  const values = methods.map((method) => formatPaymentMethod(method)).filter(Boolean);
  return values.length ? values.join(' + ') : 'Pago';
}

function normalizeWidth(width) {
  return Number(width || 48) <= 32 ? 32 : 48;
}

function makeLine(width, character = '=') {
  return String(character || '=').repeat(normalizeWidth(width));
}

function centerText(value, width) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const targetWidth = normalizeWidth(width);
  if (normalized.length >= targetWidth) return normalized.slice(0, targetWidth);
  const leftPadding = Math.floor((targetWidth - normalized.length) / 2);
  return `${' '.repeat(leftPadding)}${normalized}`;
}

function padEndSafe(value, width) {
  const content = String(value || '');
  return content.length >= width ? content.slice(0, width) : content.padEnd(width, ' ');
}

function padStartSafe(value, width) {
  const content = String(value || '');
  return content.length >= width ? content.slice(0, width) : content.padStart(width, ' ');
}

function makeKeyValueLine(label, value, width) {
  const left = String(label || '').trim();
  const right = String(value || '').trim();
  if (!left && !right) return '';
  if (!right) return left;
  const targetWidth = normalizeWidth(width);
  const spaces = targetWidth - left.length - right.length;
  return spaces >= 1 ? `${left}${' '.repeat(spaces)}${right}` : `${left} ${right}`;
}

function makeAmountLine(label, value, width, currencySymbol = 'RD$') {
  return makeKeyValueLine(label, formatAmount(value, currencySymbol), width);
}

function normalizeQuantity(quantity, weighed = false) {
  const numeric = Number(quantity || 0);
  if (weighed || Math.abs(numeric % 1) > 0.0001) return numeric.toFixed(2);
  return numeric.toFixed(0);
}

function buildSaleItemsBlock(items = [], width) {
  const targetWidth = normalizeWidth(width);
  const nameWidth = targetWidth <= 32 ? 15 : 24;
  const quantityWidth = targetWidth <= 32 ? 5 : 7;
  const amountWidth = Math.max(targetWidth - nameWidth - quantityWidth, 10);

  const header = `${padEndSafe('Producto', nameWidth)}${padStartSafe('Cant', quantityWidth)}${padStartSafe('Importe', amountWidth)}`;
  const lines = items.map((item) => {
    const name = String(item.product_name || item.name || '').trim();
    const quantity = normalizeQuantity(item.quantity, item.weighed);
    const amount = formatCompactAmount(item.subtotal);
    return `${padEndSafe(name, nameWidth)}${padStartSafe(quantity, quantityWidth)}${padStartSafe(amount, amountWidth)}`;
  });

  return {
    header,
    block: lines.join('\n')
  };
}

function buildSimpleItemBlock(items = [], width) {
  const targetWidth = normalizeWidth(width);
  const nameWidth = targetWidth <= 32 ? 18 : 30;
  const quantityWidth = targetWidth <= 32 ? 4 : 6;
  const amountWidth = Math.max(targetWidth - nameWidth - quantityWidth, 8);

  return items.map((item) => {
    const name = String(item.product_name || item.name || '').trim();
    const quantity = `x${normalizeQuantity(item.quantity, false)}`;
    const amount = formatCompactAmount(item.subtotal);
    return `${padEndSafe(name, nameWidth)}${padStartSafe(quantity, quantityWidth)}${padStartSafe(amount, amountWidth)}`;
  }).join('\n');
}

function buildPaymentsBlock(payments = [], width, currencySymbol) {
  return payments.map((payment) => (
    makeKeyValueLine(formatPaymentMethod(payment.method), formatAmount(payment.amount, currencySymbol), width)
  )).join('\n');
}

function renderTemplateString(template, context) {
  let output = String(template || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  output = output.replaceAll('{{blank}}', BLANK_SENTINEL);

  Object.entries(context || {}).forEach(([key, value]) => {
    const tokenValue = value === undefined || value === null ? '' : String(value);
    output = output.replaceAll(`{{${key}}}`, tokenValue);
    output = output.replaceAll(`[[${key}]]`, tokenValue);
  });

  output = output.replace(/{{[a-zA-Z0-9_]+}}/g, '');
  output = output.replace(/\[\[[a-zA-Z0-9_]+\]\]/g, '');

  const lines = output
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .flatMap((line) => (line.includes(BLANK_SENTINEL) ? [''] : [line]))
    .filter((line) => line === '' || line.trim().length > 0);

  return lines.join('\n').trim();
}

function getBaseTemplate(documentKey, variant = 'classic') {
  const catalog = BASE_TEMPLATE_CATALOG[documentKey];
  if (!catalog) {
    throw new Error('Tipo de documento de impresion no valido.');
  }

  const normalizedVariant = normalizeTemplateVariant(variant);
  return catalog[normalizedVariant] || catalog.classic;
}

function resolveTemplate({ documentKey, variant = 'classic', customTemplate = '' }) {
  const normalizedVariant = normalizeTemplateVariant(variant);
  const custom = String(customTemplate || '').trim();

  return {
    documentKey,
    variant: normalizedVariant,
    customTemplate: customTemplate || '',
    usingCustom: Boolean(custom),
    template: custom || getBaseTemplate(documentKey, normalizedVariant)
  };
}

function buildWizardContext(payload, { width }) {
  const businessName = payload.businessName || 'OrbitPOS';
  return {
    separator: makeLine(width, '='),
    thinSeparator: makeLine(width, '-'),
    centeredBusinessNameUpper: centerText(String(businessName).toUpperCase(), width),
    businessPhoneCentered: payload.businessPhone ? centerText(`Tel: ${payload.businessPhone}`, width) : '',
    printerNameLine: `Impresora: ${payload.printerName || 'Impresora termica'}`,
    dateLine: `Fecha: ${payload.dateTime || new Date().toLocaleString('es-DO')}`,
    readyLine: payload.readyMessage || 'OrbitPOS esta listo para vender.'
  };
}

function buildSaleContext(payload, { width, currencySymbol }) {
  const saleItems = buildSaleItemsBlock(payload.items || [], width);
  const saleTypeLabel = String(payload.saleType || 'cash').toLowerCase() === 'credit' ? 'Credito' : 'Contado';

  return {
    separator: makeLine(width, '='),
    thinSeparator: makeLine(width, '-'),
    centeredBusinessNameUpper: centerText(String(payload.businessName || 'Mi Negocio').toUpperCase(), width),
    businessPhoneCentered: payload.businessPhone ? centerText(`Tel: ${payload.businessPhone}`, width) : '',
    businessRncCentered: payload.businessRnc ? centerText(`RNC: ${payload.businessRnc}`, width) : '',
    invoiceNumber: payload.invoiceNumber || '000001',
    dateTime: payload.dateTime || new Date().toLocaleString('es-DO'),
    cashier: payload.cashier || 'admin',
    branchName: payload.branchName || 'Principal',
    customerLine: payload.customerName ? `Cliente: ${payload.customerName}` : '',
    saleTypeLine: `Tipo: ${saleTypeLabel}`,
    itemsHeader: saleItems.header,
    items: saleItems.block,
    subtotalLine: makeAmountLine('Subtotal:', payload.subtotal, width, currencySymbol),
    discountLine: Number(payload.discount || 0) > 0 ? makeKeyValueLine('Descuento:', `- ${formatAmount(payload.discount, currencySymbol)}`, width) : '',
    taxLine: makeAmountLine('ITBIS:', payload.tax, width, currencySymbol),
    totalLine: makeAmountLine('TOTAL:', payload.total, width, currencySymbol),
    payments: buildPaymentsBlock(payload.payments || [], width, currencySymbol),
    changeLine: Number(payload.change || 0) > 0 ? makeAmountLine('Vuelto:', payload.change, width, currencySymbol) : '',
    qrLine: payload.includeQr === false ? '' : '[QR de verificacion]',
    demoLine: payload.isDemo ? '[ DEMO ]' : '',
    footer: payload.footer || 'Gracias por su compra.'
  };
}

function buildPaymentContext(payload, { width, currencySymbol }) {
  return {
    separator: makeLine(width, '='),
    thinSeparator: makeLine(width, '-'),
    centeredBusinessNameUpper: centerText(String(payload.businessName || 'Mi Negocio').toUpperCase(), width),
    businessPhoneCentered: payload.businessPhone ? centerText(`Tel: ${payload.businessPhone}`, width) : '',
    receiptNumber: payload.receiptNumber || 'AB-00001',
    dateTime: payload.dateTime || new Date().toLocaleString('es-DO'),
    customerName: payload.customerName || 'Cliente',
    invoiceNumberLabel: `Factura: ${payload.invoiceNumber || '#000001'}`,
    previousBalanceLine: makeAmountLine('Saldo anterior:', payload.previousBalance, width, currencySymbol),
    paidAmountLine: makeAmountLine('Abono recibido:', payload.paidAmount, width, currencySymbol),
    newBalanceLine: makeAmountLine('Nuevo saldo:', payload.newBalance, width, currencySymbol),
    paymentMethodLine: `Metodo: ${payload.paymentMethod || 'Efectivo'}`,
    cashierLine: `Cajero: ${payload.cashier || 'admin'}`,
    footer: payload.footer || 'Gracias por su pago.'
  };
}

function buildReturnContext(payload, { width, currencySymbol }) {
  return {
    separator: makeLine(width, '='),
    thinSeparator: makeLine(width, '-'),
    centeredBusinessNameUpper: centerText(String(payload.businessName || 'Mi Negocio').toUpperCase(), width),
    returnNumber: payload.returnNumber || 'DEV-00001',
    invoiceNumberLabel: `Factura: #${payload.invoiceNumber || '000001'}`,
    dateTime: payload.dateTime || new Date().toLocaleString('es-DO'),
    customerLine: `Cliente: ${payload.customerName || 'Consumidor final'}`,
    reasonLine: `Motivo: ${payload.reason || 'No indicado'}`,
    items: buildSimpleItemBlock(payload.items || [], width),
    totalLine: makeAmountLine('Total devuelto:', payload.total, width, currencySymbol),
    refundMethodLine: `Metodo: ${formatPaymentMethod(payload.refundMethod || 'cash')}`,
    cashierLine: `Cajero: ${payload.cashier || 'admin'}`,
    footer: payload.footer || 'Gracias por su visita.'
  };
}

function buildQuoteContext(payload, { width, currencySymbol }) {
  return {
    separator: makeLine(width, '='),
    thinSeparator: makeLine(width, '-'),
    centeredBusinessNameUpper: centerText(String(payload.businessName || 'Mi Negocio').toUpperCase(), width),
    businessPhoneCentered: payload.businessPhone ? centerText(`Tel: ${payload.businessPhone}`, width) : '',
    quoteNumber: payload.quoteNumber || 'COT-00001',
    dateOnly: payload.dateOnly || new Date().toLocaleDateString('es-DO'),
    validUntilLine: payload.validUntil ? `Valida hasta: ${payload.validUntil}` : '',
    customerLine: `Cliente: ${payload.customerName || 'Consumidor final'}`,
    items: buildSimpleItemBlock(payload.items || [], width),
    subtotalLine: makeAmountLine('Subtotal:', payload.subtotal, width, currencySymbol),
    discountLine: Number(payload.discount || 0) > 0 ? makeAmountLine('Descuento:', payload.discount, width, currencySymbol) : '',
    taxLine: Number(payload.tax || 0) > 0 ? makeAmountLine('ITBIS:', payload.tax, width, currencySymbol) : '',
    totalLine: makeAmountLine('TOTAL:', payload.total, width, currencySymbol),
    footer: payload.footer || 'Gracias por cotizar con nosotros.'
  };
}

function buildCashContext(payload, { width, currencySymbol }) {
  const isClose = payload.mode === 'close';
  const difference = Number(payload.difference || 0);
  const differenceText = difference >= 0 ? `+ ${formatAmount(Math.abs(difference), currencySymbol)}` : `- ${formatAmount(Math.abs(difference), currencySymbol)}`;

  return {
    separator: makeLine(width, '='),
    thinSeparator: makeLine(width, '-'),
    centeredBusinessNameUpper: centerText(String(payload.businessName || 'Mi Negocio').toUpperCase(), width),
    registerNumber: payload.registerNumber || 'CAJ-00001',
    dateTime: payload.timestamp || new Date().toLocaleString('es-DO'),
    dateLine: `Fecha: ${payload.timestamp || new Date().toLocaleString('es-DO')}`,
    branchLine: `Sucursal: ${payload.branchName || 'Principal'}`,
    cashierLine: `Cajero: ${payload.cashier || 'admin'}`,
    openingAmountLine: makeAmountLine('Monto inicial:', payload.openingAmount, width, currencySymbol),
    cashSalesLine: isClose ? makeAmountLine('Ventas efectivo:', payload.cashSales, width, currencySymbol) : '',
    cardSalesLine: isClose ? makeAmountLine('Ventas tarjeta:', payload.cardSales, width, currencySymbol) : '',
    transferSalesLine: isClose ? makeAmountLine('Ventas transf.:', payload.transferSales, width, currencySymbol) : '',
    creditCashLine: isClose ? makeAmountLine('Abonos efectivo:', payload.creditCash, width, currencySymbol) : '',
    creditCardLine: isClose ? makeAmountLine('Abonos tarjeta:', payload.creditCard, width, currencySymbol) : '',
    creditTransferLine: isClose ? makeAmountLine('Abonos transf.:', payload.creditTransfer, width, currencySymbol) : '',
    expectedCashLine: isClose ? makeAmountLine('Esperado caja:', payload.expectedCash, width, currencySymbol) : '',
    countedAmountLine: isClose && payload.countedAmount !== null && payload.countedAmount !== undefined ? makeAmountLine('Contado caja:', payload.countedAmount, width, currencySymbol) : '',
    differenceLine: isClose && payload.difference !== null && payload.difference !== undefined ? makeKeyValueLine('Diferencia:', differenceText, width) : '',
    footer: payload.footer || 'Operacion registrada correctamente.'
  };
}

function buildDocumentContext(documentKey, payload, options) {
  switch (documentKey) {
    case 'wizard_test':
      return buildWizardContext(payload, options);
    case 'sale':
      return buildSaleContext(payload, options);
    case 'payment':
      return buildPaymentContext(payload, options);
    case 'return':
      return buildReturnContext(payload, options);
    case 'quote':
      return buildQuoteContext(payload, options);
    case 'cash_open':
    case 'cash_close':
      return buildCashContext(payload, options);
    default:
      throw new Error('Tipo de documento de impresion no soportado.');
  }
}

function renderPrintDocument(documentKey, payload, options = {}) {
  const width = normalizeWidth(options.width || 48);
  const currencySymbol = options.currencySymbol || 'RD$';
  const template = resolveTemplate({
    documentKey,
    variant: options.variant,
    customTemplate: options.customTemplate
  });
  const context = buildDocumentContext(documentKey, payload, { width, currencySymbol });

  return {
    ...template,
    width,
    preview: renderTemplateString(template.template, context)
  };
}

function buildTemplatePreviewPayload(documentKey, configEntries = {}) {
  const businessName = configEntries.business_name || 'Mi Negocio';
  const businessPhone = configEntries.business_phone || '809-000-0000';
  const businessRnc = configEntries.business_rnc || '000-000000-0';
  const footer = configEntries.ticket_footer || 'Gracias por su compra.';

  switch (documentKey) {
    case 'wizard_test':
      return { businessName, businessPhone, printerName: configEntries.printer_name || 'XP-80', readyMessage: 'OrbitPOS esta listo para vender.' };
    case 'sale':
      return {
        businessName,
        businessPhone,
        businessRnc,
        invoiceNumber: '000123',
        branchName: 'Principal',
        cashier: 'admin',
        customerName: 'Juan Perez',
        saleType: 'cash',
        items: [
          { product_name: 'Coca Cola 2L', quantity: 2, subtotal: 240, weighed: false },
          { product_name: 'Pan Sobao', quantity: 3, subtotal: 90, weighed: false },
          { product_name: 'Queso por libra', quantity: 1.25, subtotal: 275, weighed: true }
        ],
        subtotal: 605,
        discount: 25,
        tax: 104.4,
        total: 684.4,
        payments: [{ method: 'cash', amount: 500 }, { method: 'card', amount: 184.4 }],
        change: 0,
        footer,
        isDemo: false
      };
    case 'payment':
      return { businessName, businessPhone, receiptNumber: 'AB-00045', customerName: 'Juan Perez', invoiceNumber: '#000123', previousBalance: 1500, paidAmount: 500, newBalance: 1000, paymentMethod: 'Efectivo + Tarjeta', cashier: 'admin', footer: 'Gracias por su pago.' };
    case 'return':
      return { businessName, returnNumber: 'DEV-00012', invoiceNumber: '000118', customerName: 'Ana Garcia', reason: 'Producto defectuoso', items: [{ product_name: 'Coca Cola 2L', quantity: 1, subtotal: 120 }], total: 120, refundMethod: 'cash', cashier: 'admin', footer: 'Gracias por su confianza.' };
    case 'quote':
      return { businessName, businessPhone, quoteNumber: 'COT-00008', customerName: 'Empresa XYZ', validUntil: '17/04/2026', items: [{ product_name: 'Impresora termica', quantity: 1, subtotal: 4500 }, { product_name: 'Rollo de papel', quantity: 5, subtotal: 1250 }], subtotal: 5750, discount: 250, tax: 0, total: 5500, footer: 'Cotizacion valida sujeta a disponibilidad.' };
    case 'cash_open':
      return { businessName, registerNumber: 'CAJ-00025', branchName: 'Principal', cashier: 'admin', mode: 'open', openingAmount: 2000, footer: 'Caja abierta correctamente.' };
    case 'cash_close':
      return { businessName, registerNumber: 'CAJ-00025', branchName: 'Principal', cashier: 'admin', mode: 'close', openingAmount: 2000, cashSales: 8450, cardSales: 3200, transferSales: 1150, creditCash: 1800, creditCard: 400, creditTransfer: 0, expectedCash: 12250, countedAmount: 12190, difference: -60, footer: 'Cierre revisado por administracion.' };
    default:
      throw new Error('Tipo de documento de impresion no soportado.');
  }
}

function getConfiguredPrintTemplates(getConfigValue) {
  const templates = {};

  PRINT_TEMPLATE_DOCUMENTS.forEach((document) => {
    const variant = normalizeTemplateVariant(getConfigValue(getPrintTemplateVariantKey(document.key), 'classic'));
    const customTemplate = String(getConfigValue(getPrintTemplateCustomKey(document.key), '') || '');
    templates[document.key] = {
      variant,
      customTemplate,
      usingCustom: Boolean(customTemplate.trim()),
      resolvedTemplate: customTemplate.trim() || getBaseTemplate(document.key, variant)
    };
  });

  return templates;
}

module.exports = {
  BASE_TEMPLATE_CATALOG,
  PRINT_TEMPLATE_DOCUMENTS,
  PRINT_TEMPLATE_PLACEHOLDERS,
  PRINT_TEMPLATE_VARIANTS,
  buildTemplatePreviewPayload,
  formatAmount,
  formatPaymentMethod,
  formatPaymentMethods,
  getBaseTemplate,
  getConfiguredPrintTemplates,
  getPrintTemplateConfigDefaults,
  getPrintTemplateCustomKey,
  getPrintTemplateVariantKey,
  normalizeTemplateVariant,
  renderPrintDocument
};
