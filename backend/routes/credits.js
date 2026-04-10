const express = require('express');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const { q = '' } = request.query;
  const params = [];
  let whereClause = `
    WHERE s.type = 'credit'
      AND s.balance > 0
      AND s.status IN ('open', 'paid')
  `;

  if (q) {
    whereClause += ' AND (s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const credits = getDb().prepare(`
    SELECT
      s.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.credit_limit,
      b.name AS branch_name
    FROM sales s
    INNER JOIN customers c ON c.id = s.customer_id
    LEFT JOIN branches b ON b.id = s.branch_id
    ${whereClause}
    ORDER BY s.created_at DESC
  `).all(...params);

  response.json(credits);
});

router.get('/:saleId', (request, response) => {
  const credit = getDb().prepare(`
    SELECT
      s.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      b.name AS branch_name
    FROM sales s
    INNER JOIN customers c ON c.id = s.customer_id
    LEFT JOIN branches b ON b.id = s.branch_id
    WHERE s.id = ?
      AND s.type = 'credit'
  `).get(request.params.saleId);

  if (!credit) {
    return response.status(404).json({
      message: 'Credito no encontrado.'
    });
  }

  const items = getDb().prepare(`
    SELECT *
    FROM sale_items
    WHERE sale_id = ?
    ORDER BY id ASC
  `).all(request.params.saleId);

  const payments = getDb().prepare(`
    SELECT *
    FROM payments
    WHERE sale_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(request.params.saleId);

  response.json({
    ...credit,
    items,
    payments
  });
});

module.exports = router;
