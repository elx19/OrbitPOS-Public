const express = require('express');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { calculateSalePreview } = require('../services/sales');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const discounts = getDb().prepare(`
    SELECT *
    FROM discounts
    ORDER BY created_at DESC, id DESC
  `).all();

  response.json(discounts);
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

router.post('/', requireAdmin, (request, response) => {
  const {
    name,
    type,
    value = 0,
    applies_to = 'all',
    target_id = null,
    start_date = null,
    end_date = null,
    active = 1
  } = request.body || {};

  if (!name || !type) {
    return response.status(400).json({
      message: 'Nombre y tipo de descuento son obligatorios.'
    });
  }

  const result = getDb().prepare(`
    INSERT INTO discounts (
      name, type, value, applies_to, target_id, start_date, end_date, active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    type,
    Number(value || 0),
    applies_to,
    target_id === '' ? null : target_id,
    start_date || null,
    end_date || null,
    active ? 1 : 0
  );

  createAuditLog({
    userId: request.user.id,
    action: 'create',
    tableName: 'discounts',
    recordId: result.lastInsertRowid,
    newValue: request.body
  });

  response.status(201).json({
    id: result.lastInsertRowid
  });
});

router.put('/:id', requireAdmin, (request, response) => {
  const existing = getDb().prepare('SELECT * FROM discounts WHERE id = ?').get(request.params.id);
  if (!existing) {
    return response.status(404).json({
      message: 'Descuento no encontrado.'
    });
  }

  const payload = {
    name: request.body?.name ?? existing.name,
    type: request.body?.type ?? existing.type,
    value: Number(request.body?.value ?? existing.value),
    applies_to: request.body?.applies_to ?? existing.applies_to,
    target_id: request.body?.target_id === undefined ? existing.target_id : (request.body.target_id === '' ? null : request.body.target_id),
    start_date: request.body?.start_date === undefined ? existing.start_date : (request.body.start_date || null),
    end_date: request.body?.end_date === undefined ? existing.end_date : (request.body.end_date || null),
    active: request.body?.active === undefined ? existing.active : (request.body.active ? 1 : 0)
  };

  getDb().prepare(`
    UPDATE discounts
    SET name = ?, type = ?, value = ?, applies_to = ?, target_id = ?, start_date = ?, end_date = ?, active = ?
    WHERE id = ?
  `).run(
    payload.name,
    payload.type,
    payload.value,
    payload.applies_to,
    payload.target_id,
    payload.start_date,
    payload.end_date,
    payload.active,
    request.params.id
  );

  createAuditLog({
    userId: request.user.id,
    action: 'update',
    tableName: 'discounts',
    recordId: Number(request.params.id),
    oldValue: existing,
    newValue: payload
  });

  response.json({ ok: true });
});

module.exports = router;
