const express = require('express');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const { q = '', active = '1' } = request.query;
  const filters = [];
  const params = [];

  if (active !== 'all') {
    filters.push('active = ?');
    params.push(Number(active));
  }

  if (q) {
    filters.push('(name LIKE ? OR contact LIKE ? OR phone LIKE ? OR email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const suppliers = getDb().prepare(`
    SELECT *
    FROM suppliers
    ${whereClause}
    ORDER BY name COLLATE NOCASE ASC
  `).all(...params);

  response.json(suppliers);
});

router.post('/', requireAdmin, (request, response) => {
  const {
    name,
    contact = '',
    phone = '',
    email = '',
    address = '',
    notes = '',
    active = 1
  } = request.body || {};

  if (!name) {
    return response.status(400).json({
      message: 'El nombre del proveedor es obligatorio.'
    });
  }

  const result = getDb().prepare(`
    INSERT INTO suppliers (name, contact, phone, email, address, notes, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, contact, phone, email, address, notes, active ? 1 : 0);

  createAuditLog({
    userId: request.user.id,
    action: 'create',
    tableName: 'suppliers',
    recordId: result.lastInsertRowid,
    newValue: request.body
  });

  response.status(201).json({
    id: result.lastInsertRowid
  });
});

router.put('/:id', requireAdmin, (request, response) => {
  const existing = getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(request.params.id);
  if (!existing) {
    return response.status(404).json({
      message: 'Proveedor no encontrado.'
    });
  }

  const payload = {
    name: request.body?.name ?? existing.name,
    contact: request.body?.contact ?? existing.contact,
    phone: request.body?.phone ?? existing.phone,
    email: request.body?.email ?? existing.email,
    address: request.body?.address ?? existing.address,
    notes: request.body?.notes ?? existing.notes,
    active: request.body?.active === undefined ? existing.active : (request.body.active ? 1 : 0)
  };

  getDb().prepare(`
    UPDATE suppliers
    SET name = ?, contact = ?, phone = ?, email = ?, address = ?, notes = ?, active = ?
    WHERE id = ?
  `).run(
    payload.name,
    payload.contact,
    payload.phone,
    payload.email,
    payload.address,
    payload.notes,
    payload.active,
    request.params.id
  );

  createAuditLog({
    userId: request.user.id,
    action: 'update',
    tableName: 'suppliers',
    recordId: Number(request.params.id),
    oldValue: existing,
    newValue: payload
  });

  response.json({ ok: true });
});

module.exports = router;
