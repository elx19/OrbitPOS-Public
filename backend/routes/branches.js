const express = require('express');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const branches = getDb().prepare(`
    SELECT *
    FROM branches
    ORDER BY name COLLATE NOCASE ASC
  `).all();

  response.json(branches);
});

router.post('/', requireAdmin, (request, response) => {
  const { name, address = '', phone = '', active = 1 } = request.body || {};
  if (!name) {
    return response.status(400).json({
      message: 'El nombre de la sucursal es obligatorio.'
    });
  }

  const result = getDb().prepare(`
    INSERT INTO branches (name, address, phone, active)
    VALUES (?, ?, ?, ?)
  `).run(name, address, phone, active ? 1 : 0);

  createAuditLog({
    userId: request.user.id,
    action: 'create',
    tableName: 'branches',
    recordId: result.lastInsertRowid,
    newValue: request.body
  });

  response.status(201).json({
    id: result.lastInsertRowid
  });
});

router.put('/:id', requireAdmin, (request, response) => {
  const existing = getDb().prepare('SELECT * FROM branches WHERE id = ?').get(request.params.id);
  if (!existing) {
    return response.status(404).json({
      message: 'Sucursal no encontrada.'
    });
  }

  const payload = {
    name: request.body?.name ?? existing.name,
    address: request.body?.address ?? existing.address,
    phone: request.body?.phone ?? existing.phone,
    active: request.body?.active === undefined ? existing.active : (request.body.active ? 1 : 0)
  };

  getDb().prepare(`
    UPDATE branches
    SET name = ?, address = ?, phone = ?, active = ?
    WHERE id = ?
  `).run(payload.name, payload.address, payload.phone, payload.active, request.params.id);

  createAuditLog({
    userId: request.user.id,
    action: 'update',
    tableName: 'branches',
    recordId: Number(request.params.id),
    oldValue: existing,
    newValue: payload
  });

  response.json({ ok: true });
});

module.exports = router;
