const express = require('express');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const purchases = getDb().prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      u.username
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 30
  `).all();

  response.json(purchases);
});

router.get('/:id', (request, response) => {
  const purchase = getDb().prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      u.username
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(request.params.id);

  if (!purchase) {
    return response.status(404).json({
      message: 'Compra no encontrada.'
    });
  }

  const items = getDb().prepare(`
    SELECT
      pi.*,
      pr.name AS product_name
    FROM purchase_items pi
    LEFT JOIN products pr ON pr.id = pi.product_id
    WHERE pi.purchase_id = ?
    ORDER BY pi.id ASC
  `).all(request.params.id);

  response.json({
    ...purchase,
    items
  });
});

router.post('/', requireAdmin, (request, response) => {
  const {
    supplierId = null,
    invoiceRef = '',
    notes = '',
    items = []
  } = request.body || {};

  if (!Array.isArray(items) || !items.length) {
    return response.status(400).json({
      message: 'Debes agregar al menos un producto a la compra.'
    });
  }

  const productIds = [...new Set(items.map((item) => Number(item.productId)).filter(Boolean))];
  const db = getDb();
  const selectedSupplier = supplierId
    ? db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId)
    : null;

  if (supplierId && !selectedSupplier) {
    return response.status(400).json({
      message: 'El proveedor seleccionado no existe.'
    });
  }

  const productRows = productIds.length
    ? db.prepare(`
        SELECT *
        FROM products
        WHERE id IN (${productIds.map(() => '?').join(',')})
      `).all(...productIds)
    : [];
  const productsMap = new Map(productRows.map((product) => [product.id, product]));

  const normalizedItems = [];
  let total = 0;

  for (const item of items) {
    const product = productsMap.get(Number(item.productId));
    const quantity = Number(item.quantity || 0);
    const unitCost = Number(item.unitCost || 0);
    const updateCostPrice = Boolean(item.updateCostPrice);
    const newSalePrice = item.newSalePrice === '' || item.newSalePrice === null || item.newSalePrice === undefined
      ? null
      : Number(item.newSalePrice);

    if (!product) {
      return response.status(400).json({
        message: 'Uno de los productos de la compra no existe.'
      });
    }
    if (quantity <= 0) {
      return response.status(400).json({
        message: `La cantidad para ${product.name} debe ser mayor que cero.`
      });
    }
    if (unitCost < 0) {
      return response.status(400).json({
        message: `El costo para ${product.name} no puede ser negativo.`
      });
    }

    const subtotal = Number((quantity * unitCost).toFixed(2));
    total += subtotal;
    normalizedItems.push({
      product,
      quantity,
      unitCost,
      subtotal,
      updateCostPrice,
      newSalePrice
    });
  }

  const transaction = db.transaction(() => {
    const purchaseInsert = db.prepare(`
      INSERT INTO purchases (supplier_id, user_id, invoice_ref, total, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(supplierId || null, request.user.id, invoiceRef || null, Number(total.toFixed(2)), notes);

    const purchaseId = purchaseInsert.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare(`
      UPDATE products
      SET stock = stock + ?,
          cost_price = ?,
          sale_price = ?,
          supplier_id = ?
      WHERE id = ?
    `);
    const insertHistory = db.prepare(`
      INSERT INTO product_price_history (
        product_id, old_cost_price, old_sale_price, new_cost_price, new_sale_price, changed_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    normalizedItems.forEach((item) => {
      insertItem.run(purchaseId, item.product.id, item.quantity, item.unitCost, item.subtotal);

      const nextCostPrice = item.updateCostPrice ? item.unitCost : Number(item.product.cost_price);
      const nextSalePrice = item.newSalePrice === null ? Number(item.product.sale_price) : item.newSalePrice;

      updateStock.run(
        item.quantity,
        nextCostPrice,
        nextSalePrice,
        supplierId || item.product.supplier_id || null,
        item.product.id
      );

      if (
        Number(item.product.cost_price) !== Number(nextCostPrice) ||
        Number(item.product.sale_price) !== Number(nextSalePrice)
      ) {
        insertHistory.run(
          item.product.id,
          item.product.cost_price,
          item.product.sale_price,
          nextCostPrice,
          nextSalePrice,
          request.user.id
        );
      }
    });

    return purchaseId;
  });

  try {
    const purchaseId = transaction();
    createAuditLog({
      userId: request.user.id,
      action: 'create_purchase',
      tableName: 'purchases',
      recordId: purchaseId,
      newValue: request.body
    });

    response.status(201).json({
      ok: true,
      purchaseId,
      total
    });
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible registrar la compra.'
    });
  }
});

module.exports = router;
