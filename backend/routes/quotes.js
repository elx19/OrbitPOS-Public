const express = require('express');
const { getDb, getConfigValue, createAuditLog } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { printText } = require('../helpers/printer');
const { buildQuoteDocument } = require('../helpers/receipt');
const { calculateSalePreview, createSale } = require('../services/sales');

const router = express.Router();

router.use(authenticateToken);

function nextQuoteNumber() {
  const row = getDb().prepare('SELECT id FROM quotes ORDER BY id DESC LIMIT 1').get();
  return `COT-${String(Number(row?.id || 0) + 1).padStart(5, '0')}`;
}

router.get('/', (request, response) => {
  const rows = getDb().prepare(`
    SELECT
      q.*,
      c.name AS customer_name,
      u.username
    FROM quotes q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.user_id
    ORDER BY q.created_at DESC, q.id DESC
    LIMIT 50
  `).all();

  response.json(rows);
});

router.get('/:id', (request, response) => {
  const quote = getDb().prepare(`
    SELECT
      q.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      u.username
    FROM quotes q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.user_id
    WHERE q.id = ?
  `).get(request.params.id);

  if (!quote) {
    return response.status(404).json({
      message: 'Cotizacion no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT *
    FROM quote_items
    WHERE quote_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  response.json({
    ...quote,
    items
  });
});

router.get('/:id/reprint', async (request, response) => {
  const quote = getDb().prepare(`
    SELECT
      q.*,
      c.name AS customer_name,
      u.username
    FROM quotes q
    LEFT JOIN customers c ON c.id = q.customer_id
    LEFT JOIN users u ON u.id = q.user_id
    WHERE q.id = ?
  `).get(request.params.id);

  if (!quote) {
    return response.status(404).json({
      message: 'Cotizacion no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT *
    FROM quote_items
    WHERE quote_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  const preview = buildQuoteDocument({
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    quoteNumber: quote.quote_number,
    customerName: quote.customer_name || 'Consumidor final',
    validUntil: quote.valid_until,
    items,
    subtotal: Number(quote.subtotal || 0),
    discount: Number(quote.discount || 0),
    tax: Number(quote.tax || 0),
    total: Number(quote.total || 0)
  });
  const printResult = await printText(preview, { force: true });

  response.json({
    ok: true,
    quoteId: quote.id,
    preview,
    printResult
  });
});

router.post('/', async (request, response) => {
  const {
    customerId = null,
    items = [],
    discount = 0,
    validUntil = null,
    notes = ''
  } = request.body || {};

  try {
    const preview = calculateSalePreview({
      customerId,
      items,
      discount: Number(discount || 0)
    });
    const quoteNumber = nextQuoteNumber();
    const db = getDb();

    const transaction = db.transaction(() => {
      const insertQuote = db.prepare(`
        INSERT INTO quotes (
          quote_number, customer_id, user_id, subtotal, discount, tax, total, status, valid_until, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        quoteNumber,
        customerId || null,
        request.user.id,
        preview.subtotal,
        preview.totalDiscount,
        preview.tax,
        preview.total,
        validUntil || null,
        notes
      );

      const quoteId = insertQuote.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO quote_items (
          quote_id, product_id, product_name, quantity, unit_price, subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      preview.normalizedItems.forEach((item) => {
        insertItem.run(
          quoteId,
          item.product.id,
          item.product.name,
          item.quantity,
          item.unitPrice,
          item.subtotal
        );
      });

      return quoteId;
    });

    const quoteId = transaction();
    createAuditLog({
      userId: request.user.id,
      action: 'create_quote',
      tableName: 'quotes',
      recordId: quoteId,
      newValue: request.body
    });

    const previewText = buildQuoteDocument({
      businessName: getConfigValue('business_name', 'Mi Negocio'),
      quoteNumber,
      customerName: preview.selectedCustomer?.name || 'Consumidor final',
      validUntil,
      items: preview.normalizedItems.map((item) => ({
        product_name: item.product.name,
        quantity: item.quantity,
        subtotal: item.subtotal
      })),
      subtotal: preview.subtotal,
      discount: preview.totalDiscount,
      tax: preview.tax,
      total: preview.total
    });
    const printResult = await printText(previewText);

    response.status(201).json({
      quoteId,
      quoteNumber,
      preview: previewText,
      printResult,
      appliedDiscounts: preview.appliedDiscounts
    });
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible crear la cotizacion.'
    });
  }
});

router.post('/:id/convert', async (request, response) => {
  const quote = getDb().prepare(`
    SELECT *
    FROM quotes
    WHERE id = ?
  `).get(request.params.id);

  if (!quote) {
    return response.status(404).json({
      message: 'Cotizacion no encontrada.'
    });
  }
  if (quote.status === 'converted') {
    return response.status(400).json({
      message: 'Esta cotizacion ya fue convertida.'
    });
  }
  if (quote.status === 'rejected') {
    return response.status(400).json({
      message: 'No puedes convertir una cotizacion rechazada.'
    });
  }

  const quoteItems = getDb().prepare(`
    SELECT *
    FROM quote_items
    WHERE quote_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  try {
    const result = await createSale({
      user: request.user,
      customerId: quote.customer_id || null,
      type: request.body?.type || 'cash',
      items: quoteItems.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        discount: Number(((Number(item.unit_price) * Number(item.quantity)) - Number(item.subtotal)).toFixed(2)),
        unitPriceOverride: item.unit_price
      })),
      payments: request.body?.payments || [],
      discount: 0,
      notes: request.body?.notes || `Convertida desde cotizacion ${quote.quote_number}`,
      quoteId: quote.id
    });

    response.status(201).json(result);
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible convertir la cotizacion.'
    });
  }
});

router.patch('/:id/status', (request, response) => {
  const allowed = new Set(['pending', 'approved', 'rejected', 'converted']);
  const status = request.body?.status;
  if (!allowed.has(status)) {
    return response.status(400).json({
      message: 'Estado de cotizacion no valido.'
    });
  }

  getDb().prepare(`
    UPDATE quotes
    SET status = ?
    WHERE id = ?
  `).run(status, request.params.id);

  response.json({ ok: true });
});

module.exports = router;
