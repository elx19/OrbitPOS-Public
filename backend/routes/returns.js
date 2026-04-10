const express = require('express');
const { getDb, getConfigValue, createAuditLog } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { printText } = require('../helpers/printer');
const { buildReturnNote } = require('../helpers/receipt');

const router = express.Router();

router.use(authenticateToken);

function nextReturnNumber() {
  const row = getDb().prepare('SELECT id FROM returns ORDER BY id DESC LIMIT 1').get();
  return `DEV-${String(Number(row?.id || 0) + 1).padStart(5, '0')}`;
}

function getSaleWithItems(saleId) {
  const sale = getDb().prepare(`
    SELECT
      s.*,
      c.name AS customer_name,
      c.id AS customer_id,
      c.balance AS customer_balance
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(saleId);

  if (!sale) {
    return null;
  }

  const returnRows = getDb().prepare(`
    SELECT
      ri.product_id,
      COALESCE(SUM(ri.quantity), 0) AS returned_quantity
    FROM return_items ri
    INNER JOIN returns r ON r.id = ri.return_id
    WHERE r.sale_id = ?
      AND r.status = 'completed'
    GROUP BY ri.product_id
  `).all(saleId);

  const returnedMap = new Map(returnRows.map((row) => [row.product_id, Number(row.returned_quantity || 0)]));

  const items = getDb().prepare(`
    SELECT *
    FROM sale_items
    WHERE sale_id = ?
    ORDER BY id ASC
  `).all(saleId).map((item) => ({
    ...item,
    returned_quantity: returnedMap.get(item.product_id) || 0,
    available_quantity: Number(item.quantity) - (returnedMap.get(item.product_id) || 0)
  }));

  return {
    ...sale,
    items
  };
}

router.get('/', (request, response) => {
  const rows = getDb().prepare(`
    SELECT
      r.*,
      s.invoice_number,
      c.name AS customer_name
    FROM returns r
    LEFT JOIN sales s ON s.id = r.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    ORDER BY r.created_at DESC
    LIMIT 30
  `).all();

  response.json(rows);
});

router.get('/lookup', (request, response) => {
  const { q = '' } = request.query;
  const params = [];
  let whereClause = `WHERE s.status IN ('open', 'paid', 'returned')`;

  if (q) {
    whereClause += ' AND (s.invoice_number LIKE ? OR c.name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const rows = getDb().prepare(`
    SELECT
      s.id,
      s.invoice_number,
      s.type,
      s.total,
      s.paid,
      s.balance,
      s.status,
      s.created_at,
      c.name AS customer_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT 20
  `).all(...params);

  response.json(rows);
});

router.get('/lookup/:saleId', (request, response) => {
  const sale = getSaleWithItems(request.params.saleId);
  if (!sale) {
    return response.status(404).json({
      message: 'Venta no encontrada.'
    });
  }

  response.json(sale);
});

router.get('/:id', (request, response) => {
  const row = getDb().prepare(`
    SELECT
      r.*,
      s.invoice_number,
      c.name AS customer_name
    FROM returns r
    LEFT JOIN sales s ON s.id = r.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE r.id = ?
  `).get(request.params.id);

  if (!row) {
    return response.status(404).json({
      message: 'Devolucion no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT *
    FROM return_items
    WHERE return_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  response.json({
    ...row,
    items
  });
});

router.get('/:id/reprint', async (request, response) => {
  const row = getDb().prepare(`
    SELECT
      r.*,
      s.invoice_number,
      c.name AS customer_name,
      u.username
    FROM returns r
    LEFT JOIN sales s ON s.id = r.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.id = ?
  `).get(request.params.id);

  if (!row) {
    return response.status(404).json({
      message: 'Devolucion no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT *
    FROM return_items
    WHERE return_id = ?
    ORDER BY id ASC
  `).all(request.params.id);

  const notePreview = buildReturnNote({
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    returnNumber: `DEV-${String(Number(row.id || 0)).padStart(5, '0')}`,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name || 'Consumidor final',
    reason: row.reason,
    items,
    total: Number(row.total || 0),
    refundMethod: row.refund_method,
    cashier: row.username || request.user.username
  });
  const printResult = await printText(notePreview, { force: true });

  response.json({
    ok: true,
    returnId: row.id,
    notePreview,
    printResult
  });
});

router.post('/', async (request, response) => {
  const {
    saleId,
    reason = '',
    refundMethod = 'cash',
    items = []
  } = request.body || {};

  if (!saleId || !Array.isArray(items) || !items.length) {
    return response.status(400).json({
      message: 'Debes seleccionar una venta y al menos un producto para devolver.'
    });
  }

  const sale = getSaleWithItems(saleId);
  if (!sale) {
    return response.status(404).json({
      message: 'La venta indicada no existe.'
    });
  }

  const normalizedItems = [];
  let returnSubtotal = 0;

  for (const item of items) {
    const saleItem = sale.items.find((entry) => Number(entry.product_id) === Number(item.productId));
    const quantity = Number(item.quantity || 0);
    if (!saleItem) {
      return response.status(400).json({
        message: 'Uno de los productos ya no pertenece a la venta.'
      });
    }
    if (quantity <= 0) {
      return response.status(400).json({
        message: `La cantidad para ${saleItem.product_name} debe ser mayor que cero.`
      });
    }
    if (quantity > Number(saleItem.available_quantity)) {
      return response.status(400).json({
        message: `La cantidad disponible para devolver de ${saleItem.product_name} es ${saleItem.available_quantity}.`
      });
    }

    const baseSubtotal = Number(saleItem.unit_price) * quantity;
    returnSubtotal += baseSubtotal;
    normalizedItems.push({
      productId: saleItem.product_id,
      productName: saleItem.product_name,
      unitPrice: Number(saleItem.unit_price),
      quantity,
      subtotal: Number(baseSubtotal.toFixed(2)),
      restock: item.restock === undefined ? true : Boolean(item.restock)
    });
  }

  const oldSubtotal = Number(sale.subtotal || 0);
  const oldDiscount = Number(sale.discount || 0);
  const oldTax = Number(sale.tax || 0);
  const oldTotal = Number(sale.total || 0);
  const oldPaid = Number(sale.paid || 0);
  const oldBalance = Number(sale.balance || 0);

  const discountReduction = oldSubtotal > 0
    ? Number((oldDiscount * (returnSubtotal / oldSubtotal)).toFixed(2))
    : 0;
  const newSubtotal = Number(Math.max(oldSubtotal - returnSubtotal, 0).toFixed(2));
  const newDiscount = Number(Math.max(oldDiscount - discountReduction, 0).toFixed(2));
  const oldTaxable = Math.max(oldSubtotal - oldDiscount, 0);
  const newTaxable = Math.max(newSubtotal - newDiscount, 0);
  const newTax = oldTaxable > 0
    ? Number((oldTax * (newTaxable / oldTaxable)).toFixed(2))
    : 0;
  const newTotal = Number((newTaxable + newTax).toFixed(2));
  const refundAmount = Number(Math.max(oldTotal - newTotal, 0).toFixed(2));
  const newPaid = refundMethod === 'cash'
    ? Number(Math.max(oldPaid - refundAmount, 0).toFixed(2))
    : Number(Math.min(oldPaid, newTotal).toFixed(2));
  const newBalance = Number(Math.max(newTotal - newPaid, 0).toFixed(2));
  const nextStatus = newTotal <= 0
    ? 'returned'
    : (newBalance > 0 ? 'open' : 'paid');

  const db = getDb();
  const returnNumber = nextReturnNumber();

  const transaction = db.transaction(() => {
    const returnInsert = db.prepare(`
      INSERT INTO returns (sale_id, user_id, reason, total, refund_method, status)
      VALUES (?, ?, ?, ?, ?, 'completed')
    `).run(sale.id, request.user.id, reason, refundAmount, refundMethod);

    const returnId = returnInsert.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO return_items (
        return_id, product_id, product_name, quantity, unit_price, subtotal, restock
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const restockProduct = db.prepare(`
      UPDATE products
      SET stock = stock + ?
      WHERE id = ?
    `);

    normalizedItems.forEach((item) => {
      insertItem.run(
        returnId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.subtotal,
        item.restock ? 1 : 0
      );

      if (item.restock) {
        restockProduct.run(item.quantity, item.productId);
      }
    });

    db.prepare(`
      UPDATE sales
      SET subtotal = ?, discount = ?, tax = ?, total = ?, paid = ?, balance = ?, status = ?
      WHERE id = ?
    `).run(newSubtotal, newDiscount, newTax, newTotal, newPaid, newBalance, nextStatus, sale.id);

    if (sale.customer_id) {
      const delta = Number((newBalance - oldBalance).toFixed(2));
      db.prepare(`
        UPDATE customers
        SET balance = MAX(balance + ?, 0)
        WHERE id = ?
      `).run(delta, sale.customer_id);
    }

    return returnId;
  });

  try {
    const returnId = transaction();
    createAuditLog({
      userId: request.user.id,
      action: 'create_return',
      tableName: 'returns',
      recordId: returnId,
      newValue: request.body
    });

    const notePreview = buildReturnNote({
      businessName: getConfigValue('business_name', 'Mi Negocio'),
      returnNumber,
      invoiceNumber: sale.invoice_number,
      customerName: sale.customer_name || 'Consumidor final',
      reason,
      items: normalizedItems,
      total: refundAmount,
      refundMethod,
      cashier: request.user.username
    });
    const printResult = await printText(notePreview);

    response.status(201).json({
      ok: true,
      returnId,
      returnNumber,
      refundAmount,
      notePreview,
      printResult
    });
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible registrar la devolucion.'
    });
  }
});

module.exports = router;
