const { getConfigEntries, getConfigValue } = require('../database');
const {
  BASE_TEMPLATE_CATALOG,
  PRINT_TEMPLATE_DOCUMENTS,
  PRINT_TEMPLATE_PLACEHOLDERS,
  PRINT_TEMPLATE_VARIANTS,
  buildTemplatePreviewPayload,
  formatAmount,
  formatPaymentMethod,
  formatPaymentMethods,
  getConfiguredPrintTemplates,
  getPrintTemplateCustomKey,
  getPrintTemplateVariantKey,
  renderPrintDocument
} = require('./printTemplates');

function getPrintOptions(documentKey, overrides = {}) {
  const width = Number(overrides.printerWidth || getConfigValue('printer_width', '48') || 48);
  const currencySymbol = overrides.currencySymbol || getConfigValue('business_currency_symbol', 'RD$') || 'RD$';
  const variant = overrides.templateVariant || getConfigValue(getPrintTemplateVariantKey(documentKey), 'classic');
  const customTemplate = overrides.customTemplate !== undefined
    ? overrides.customTemplate
    : getConfigValue(getPrintTemplateCustomKey(documentKey), '');

  return {
    width,
    currencySymbol,
    variant,
    customTemplate
  };
}

function buildWizardTestTicket(businessName = 'OrbitPOS', printerName = 'Impresora termica', overrides = {}) {
  return renderPrintDocument('wizard_test', {
    businessName,
    businessPhone: overrides.businessPhone || getConfigValue('business_phone', ''),
    printerName,
    readyMessage: overrides.readyMessage || 'OrbitPOS esta listo para vender.'
  }, getPrintOptions('wizard_test', overrides)).preview;
}

function buildPaymentReceipt(payload = {}, overrides = {}) {
  return renderPrintDocument('payment', payload, getPrintOptions('payment', overrides)).preview;
}

function buildSaleTicket(payload = {}, overrides = {}) {
  return renderPrintDocument('sale', payload, getPrintOptions('sale', overrides)).preview;
}

function buildReturnNote(payload = {}, overrides = {}) {
  return renderPrintDocument('return', payload, getPrintOptions('return', overrides)).preview;
}

function buildQuoteDocument(payload = {}, overrides = {}) {
  return renderPrintDocument('quote', payload, getPrintOptions('quote', overrides)).preview;
}

function buildCashRegisterReceipt(payload = {}, overrides = {}) {
  const documentKey = payload.mode === 'open' ? 'cash_open' : 'cash_close';
  return renderPrintDocument(documentKey, payload, getPrintOptions(documentKey, overrides)).preview;
}

function getPrintTemplateMeta() {
  return {
    documents: PRINT_TEMPLATE_DOCUMENTS,
    variants: PRINT_TEMPLATE_VARIANTS,
    placeholders: PRINT_TEMPLATE_PLACEHOLDERS,
    catalog: BASE_TEMPLATE_CATALOG
  };
}

function getConfiguredPrintTemplateSnapshot() {
  return getConfiguredPrintTemplates((key, fallback) => getConfigValue(key, fallback));
}

function buildPrintTemplatePreview(documentKey, { variant, customTemplate } = {}) {
  const configEntries = getConfigEntries();
  const payload = buildTemplatePreviewPayload(documentKey, configEntries);
  return renderPrintDocument(documentKey, payload, {
    ...getPrintOptions(documentKey, { templateVariant: variant, customTemplate }),
    variant,
    customTemplate
  });
}

function buildCustomerStatement({
  businessName = 'Mi Negocio',
  customerName = 'Cliente',
  totalBalance = 0,
  credits = []
}) {
  const lines = [
    `Hola *${customerName}*`,
    '',
    `Este es su estado de cuenta con *${businessName}*:`,
    ''
  ];

  credits.forEach((credit) => {
    lines.push(`Factura #${credit.invoice_number}: saldo RD$ ${Number(credit.balance || 0).toFixed(2)}`);
  });

  lines.push('');
  lines.push(`Total pendiente: RD$ ${Number(totalBalance || 0).toFixed(2)}`);
  lines.push('Gracias por confiar en nosotros.');

  return lines.join('\n');
}

module.exports = {
  buildCashRegisterReceipt,
  buildCustomerStatement,
  buildPaymentReceipt,
  buildPrintTemplatePreview,
  buildQuoteDocument,
  buildReturnNote,
  buildSaleTicket,
  buildWizardTestTicket,
  formatAmount,
  formatPaymentMethod,
  formatPaymentMethods,
  getConfiguredPrintTemplateSnapshot,
  getPrintTemplateMeta
};
