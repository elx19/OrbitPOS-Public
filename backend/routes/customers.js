const express = require('express');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const { q = '' } = request.query;
  const params = [];
  let whereClause = '';

  if (q) {
    whereClause = 'WHERE name LIKE ? OR phone LIKE ? OR rnc LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const customers = getDb().prepare(`
    SELECT *
    FROM customers
    ${whereClause}
    ORDER BY name COLLATE NOCASE ASC
  `).all(...params);

  response.json(customers);
});

router.post('/', (request, response) => {
  const {
    name,
    phone = '',
    rnc = '',
    email = '',
    address = '',
    credit_limit = 0
  } = request.body || {};

  if (!name) {
    return response.status(400).json({
      message: 'El nombre del cliente es obligatorio.'
    });
  }

  const result = getDb().prepare(`
    INSERT INTO customers (name, phone, rnc, email, address, credit_limit, balance)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(name, phone, rnc, email, address, Number(credit_limit));

  createAuditLog({
    userId: request.user.id,
    action: 'create',
    tableName: 'customers',
    recordId: result.lastInsertRowid,
    newValue: request.body
  });

  response.status(201).json({
    id: result.lastInsertRowid
  });
});

router.put('/:id', (request, response) => {
  const { id } = request.params;
  const existing = getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) {
    return response.status(404).json({
      message: 'Cliente no encontrado.'
    });
  }

  const payload = {
    name: request.body?.name ?? existing.name,
    phone: request.body?.phone ?? existing.phone,
    rnc: request.body?.rnc ?? existing.rnc,
    email: request.body?.email ?? existing.email,
    address: request.body?.address ?? existing.address,
    credit_limit: Number(request.body?.credit_limit ?? existing.credit_limit)
  };

  getDb().prepare(`
    UPDATE customers
    SET name = ?, phone = ?, rnc = ?, email = ?, address = ?, credit_limit = ?
    WHERE id = ?
  `).run(
    payload.name,
    payload.phone,
    payload.rnc,
    payload.email,
    payload.address,
    payload.credit_limit,
    id
  );

  createAuditLog({
    userId: request.user.id,
    action: 'update',
    tableName: 'customers',
    recordId: Number(id),
    oldValue: existing,
    newValue: payload
  });

  response.json({ ok: true });
});

module.exports = router;
