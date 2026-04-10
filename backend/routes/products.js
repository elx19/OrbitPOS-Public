const express = require('express');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const { q = '', lowStock = '', active = '1' } = request.query;
  const filters = [];
  const params = [];

  if (active !== 'all') {
    filters.push('active = ?');
    params.push(Number(active));
  }

  if (q) {
    filters.push('(name LIKE ? OR barcode LIKE ? OR category LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (lowStock === '1') {
    filters.push('stock <= min_stock');
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const products = getDb().prepare(`
    SELECT *
    FROM products
    ${whereClause}
    ORDER BY name COLLATE NOCASE ASC
  `).all(...params);

  response.json(products);
});

router.post('/', requireAdmin, (request, response) => {
  const {
    name,
    barcode = '',
    category = '',
    cost_price = 0,
    sale_price,
    stock = 0,
    min_stock = 5,
    unit = 'unidad',
    weighed = 0,
    supplier_id = null,
    active = 1
  } = request.body || {};

  if (!name || sale_price === undefined || sale_price === null) {
    return response.status(400).json({
      message: 'Nombre y precio de venta son obligatorios.'
    });
  }

  try {
    const result = getDb().prepare(`
      INSERT INTO products (
        name, barcode, category, cost_price, sale_price, stock, min_stock, unit, weighed, supplier_id, active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      barcode || null,
      category,
      Number(cost_price),
      Number(sale_price),
      Number(stock),
      Number(min_stock),
      unit,
      weighed ? 1 : 0,
      supplier_id || null,
      active ? 1 : 0
    );

    createAuditLog({
      userId: request.user.id,
      action: 'create',
      tableName: 'products',
      recordId: result.lastInsertRowid,
      newValue: request.body
    });

    response.status(201).json({
      id: result.lastInsertRowid
    });
  } catch (error) {
    response.status(400).json({
      message: 'No fue posible guardar el producto.'
    });
  }
});

router.put('/:id', requireAdmin, (request, response) => {
  const { id } = request.params;
  const existing = getDb().prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    return response.status(404).json({
      message: 'Producto no encontrado.'
    });
  }

  const payload = {
    name: request.body?.name ?? existing.name,
    barcode: request.body?.barcode ?? existing.barcode,
    category: request.body?.category ?? existing.category,
    cost_price: Number(request.body?.cost_price ?? existing.cost_price),
    sale_price: Number(request.body?.sale_price ?? existing.sale_price),
    stock: Number(request.body?.stock ?? existing.stock),
    min_stock: Number(request.body?.min_stock ?? existing.min_stock),
    unit: request.body?.unit ?? existing.unit,
    weighed: request.body?.weighed === undefined ? existing.weighed : (request.body.weighed ? 1 : 0),
    supplier_id: request.body?.supplier_id ?? existing.supplier_id,
    active: request.body?.active === undefined ? existing.active : (request.body.active ? 1 : 0)
  };

  const transaction = getDb().transaction(() => {
    getDb().prepare(`
      UPDATE products
      SET name = ?, barcode = ?, category = ?, cost_price = ?, sale_price = ?,
          stock = ?, min_stock = ?, unit = ?, weighed = ?, supplier_id = ?, active = ?
      WHERE id = ?
    `).run(
      payload.name,
      payload.barcode || null,
      payload.category,
      payload.cost_price,
      payload.sale_price,
      payload.stock,
      payload.min_stock,
      payload.unit,
      payload.weighed,
      payload.supplier_id || null,
      payload.active,
      id
    );

    if (
      existing.cost_price !== payload.cost_price ||
      existing.sale_price !== payload.sale_price
    ) {
      getDb().prepare(`
        INSERT INTO product_price_history (
          product_id, old_cost_price, old_sale_price, new_cost_price, new_sale_price, changed_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        existing.cost_price,
        existing.sale_price,
        payload.cost_price,
        payload.sale_price,
        request.user.id
      );
    }
  });

  try {
    transaction();
    createAuditLog({
      userId: request.user.id,
      action: 'update',
      tableName: 'products',
      recordId: Number(id),
      oldValue: existing,
      newValue: payload
    });

    response.json({ ok: true });
  } catch (error) {
    response.status(400).json({
      message: 'No fue posible actualizar el producto.'
    });
  }
});

module.exports = router;
