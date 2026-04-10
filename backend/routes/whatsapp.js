const express = require('express');
const { getDb, getConfigValue } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { buildCustomerStatement } = require('../helpers/receipt');

const router = express.Router();

router.use(authenticateToken);

function businessPhone() {
  return (getConfigValue('whatsapp_phone', '') || '').replace(/\D/g, '') || '18094042070';
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildWaUrl(message, phone) {
  return `https://wa.me/${normalizePhone(phone) || businessPhone()}?text=${encodeURIComponent(message)}`;
}

router.post('/statement', (request, response) => {
  const customer = getDb().prepare(`
    SELECT *
    FROM customers
    WHERE id = ?
  `).get(request.body?.customerId);

  if (!customer) {
    return response.status(404).json({
      message: 'Cliente no encontrado.'
    });
  }

  const credits = getDb().prepare(`
    SELECT invoice_number, balance
    FROM sales
    WHERE customer_id = ?
      AND type = 'credit'
      AND balance > 0
    ORDER BY created_at DESC
  `).all(customer.id);

  const message = buildCustomerStatement({
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    customerName: customer.name,
    totalBalance: customer.balance,
    credits
  });

  response.json({
    message,
    url: buildWaUrl(message, customer.phone)
  });
});

router.post('/quote', (request, response) => {
  const quote = getDb().prepare(`
    SELECT q.*, c.name AS customer_name, c.phone AS customer_phone
    FROM quotes q
    LEFT JOIN customers c ON c.id = q.customer_id
    WHERE q.id = ?
  `).get(request.body?.quoteId);

  if (!quote) {
    return response.status(404).json({
      message: 'Cotizacion no encontrada.'
    });
  }

  const message = [
    `Hola ${quote.customer_name || 'cliente'},`,
    '',
    `Le compartimos su cotizacion ${quote.quote_number}.`,
    `Total: RD$ ${Number(quote.total || 0).toFixed(2)}`,
    quote.valid_until ? `Valida hasta: ${quote.valid_until}` : null,
    '',
    `Gracias por preferir *${getConfigValue('business_name', 'Mi Negocio')}*.`
  ].filter(Boolean).join('\n');

  response.json({
    message,
    url: buildWaUrl(message, quote.customer_phone)
  });
});

router.post('/credit-reminder', (request, response) => {
  const sale = getDb().prepare(`
    SELECT s.invoice_number, s.balance, c.name AS customer_name, c.phone AS customer_phone
    FROM sales s
    INNER JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
      AND s.type = 'credit'
  `).get(request.body?.saleId);

  if (!sale) {
    return response.status(404).json({
      message: 'Credito no encontrado.'
    });
  }

  const message = [
    `Hola ${sale.customer_name},`,
    '',
    `Le recordamos el saldo pendiente de la factura #${sale.invoice_number}.`,
    `Saldo actual: RD$ ${Number(sale.balance || 0).toFixed(2)}`,
    '',
    `Puede comunicarse con *${getConfigValue('business_name', 'Mi Negocio')}* para cualquier aclaracion.`
  ].join('\n');

  response.json({
    message,
    url: buildWaUrl(message, sale.customer_phone)
  });
});

module.exports = router;
