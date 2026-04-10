const express = require('express');
const { getDb, getConfigValue } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { printText } = require('../helpers/printer');
const { buildSaleTicket } = require('../helpers/receipt');
const { refreshLicenseState } = require('../license');
const { calculateSalePreview, createSale } = require('../services/sales');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const sales = getDb().prepare(`
    SELECT
      s.*,
      c.name AS customer_name,
      u.username,
      b.name AS branch_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN branches b ON b.id = s.branch_id
    ORDER BY s.created_at DESC
    LIMIT 30
  `).all();

  response.json(sales);
});

router.get('/:id', (request, response) => {
  const sale = getDb().prepare(`
    SELECT
      s.*,
      c.name AS customer_name,
      b.name AS branch_name,
      u.username
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN branches b ON b.id = s.branch_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(request.params.id);

  if (!sale) {
    return response.status(404).json({
      message: 'Venta no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT *
    FROM sale_items
    WHERE sale_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  const payments = getDb().prepare(`
    SELECT *
    FROM sale_payments
    WHERE sale_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  response.json({
    ...sale,
    items,
    payments
  });
});

router.get('/:id/reprint', async (request, response) => {
  const sale = getDb().prepare(`
    SELECT
      s.*,
      c.name AS customer_name,
      b.name AS branch_name,
      u.username
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN branches b ON b.id = s.branch_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(request.params.id);

  if (!sale) {
    return response.status(404).json({
      message: 'Venta no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT si.*, p.weighed
    FROM sale_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
    ORDER BY si.id ASC
  `).all(request.params.id);
  const payments = getDb().prepare(`
    SELECT *
    FROM sale_payments
    WHERE sale_id = ?
    ORDER BY id ASC
  `).all(request.params.id);
  const license = refreshLicenseState();

  const ticketPreview = buildSaleTicket({
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    businessPhone: getConfigValue('business_phone', ''),
    businessRnc: getConfigValue('business_rnc', ''),
    invoiceNumber: sale.invoice_number,
    branchName: sale.branch_name || 'Principal',
    cashier: sale.username || request.user.username,
    customerName: sale.customer_name || '',
    saleType: sale.type || 'cash',
    items,
    subtotal: Number(sale.subtotal || 0),
    discount: Number(sale.discount || 0),
    tax: Number(sale.tax || 0),
    total: Number(sale.total || 0),
    payments,
    change: Math.max(Number(sale.paid || 0) - Number(sale.total || 0), 0),
    footer: getConfigValue('ticket_footer', 'Gracias por su compra.'),
    isDemo: license.isDemo
  });
  const printResult = await printText(ticketPreview, { force: true });

  response.json({
    ok: true,
    sale,
    ticketPreview,
    printResult
  });
});

router.post('/preview', (request, response) => {
  try {
    const preview = calculateSalePreview({
      customerId: request.body?.customerId || null,
      items: request.body?.items || [],
      discount: Number(request.body?.discount || 0)
    });

    response.json({
      subtotal: preview.subtotal,
      discount: preview.totalDiscount,
      tax: preview.tax,
      total: preview.total,
      appliedDiscounts: preview.appliedDiscounts
    });
  } catch (error) {
    response.status(400).json({
      message: error.message
    });
  }
});

router.post('/', async (request, response) => {
  try {
    const result = await createSale({
      user: request.user,
      customerId: request.body?.customerId || null,
      type: request.body?.type || 'cash',
      items: request.body?.items || [],
      payments: request.body?.payments || [],
      discount: Number(request.body?.discount || 0),
      notes: request.body?.notes || ''
    });

    response.status(201).json(result);
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible registrar la venta.'
    });
  }
});

module.exports = router;
