const express = require('express');
const { getDb, getConfigValue, createAuditLog } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { printText } = require('../helpers/printer');
const { buildCashRegisterReceipt } = require('../helpers/receipt');

const router = express.Router();

router.use(authenticateToken);

function getOpenRegister(userId) {
  return getDb().prepare(`
    SELECT cr.*, b.name AS branch_name
    FROM cash_registers cr
    LEFT JOIN branches b ON b.id = cr.branch_id
    WHERE cr.user_id = ?
      AND cr.status = 'open'
    ORDER BY cr.opened_at DESC
    LIMIT 1
  `).get(userId);
}

function getRegisterSummary(registerId) {
  const salesByMethod = getDb().prepare(`
    SELECT sp.method, COALESCE(SUM(sp.amount), 0) AS total
    FROM sale_payments sp
    INNER JOIN sales s ON s.id = sp.sale_id
    WHERE s.cash_register_id = ?
    GROUP BY sp.method
  `).all(registerId);

  const paymentsByMethod = getDb().prepare(`
    SELECT payment_method AS method, COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE cash_register_id = ?
    GROUP BY payment_method
  `).all(registerId);

  const register = getDb().prepare(`
    SELECT opening_amount
    FROM cash_registers
    WHERE id = ?
  `).get(registerId);

  const mapTotals = (rows) => rows.reduce((accumulator, row) => {
    accumulator[row.method] = Number(row.total || 0);
    return accumulator;
  }, {});

  const sales = mapTotals(salesByMethod);
  const payments = mapTotals(paymentsByMethod);

  const cashSales = sales.cash || 0;
  const cardSales = sales.card || 0;
  const transferSales = sales.transfer || 0;
  const creditCash = payments.cash || 0;
  const creditCard = payments.card || 0;
  const creditTransfer = payments.transfer || 0;

  const totalTransactions =
    Number(register?.opening_amount || 0) +
    cashSales +
    cardSales +
    transferSales +
    creditCash +
    creditCard +
    creditTransfer;

  const expectedCash =
    Number(register?.opening_amount || 0) +
    cashSales +
    creditCash;

  return {
    openingAmount: Number(register?.opening_amount || 0),
    cashSales,
    cardSales,
    transferSales,
    creditCash,
    creditCard,
    creditTransfer,
    totalTransactions,
    expectedCash
  };
}

function formatRegisterNumber(registerId) {
  return `CAJ-${String(Number(registerId || 0)).padStart(5, '0')}`;
}

function buildRegisterTicket(register, summary, cashierName) {
  const isClosed = register.status === 'closed';
  return buildCashRegisterReceipt({
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    registerNumber: formatRegisterNumber(register.id),
    branchName: register.branch_name || 'Principal',
    cashier: cashierName || 'admin',
    mode: isClosed ? 'close' : 'open',
    openingAmount: Number(register.opening_amount || summary?.openingAmount || 0),
    cashSales: Number(summary?.cashSales || 0),
    cardSales: Number(summary?.cardSales || 0),
    transferSales: Number(summary?.transferSales || 0),
    creditCash: Number(summary?.creditCash || 0),
    creditCard: Number(summary?.creditCard || 0),
    creditTransfer: Number(summary?.creditTransfer || 0),
    expectedCash: Number(register.expected_amount || summary?.expectedCash || 0),
    countedAmount: register.closing_amount === null || register.closing_amount === undefined ? null : Number(register.closing_amount),
    difference: register.difference === null || register.difference === undefined ? null : Number(register.difference),
    timestamp: new Date((isClosed ? register.closed_at : register.opened_at) || register.opened_at).toLocaleString('es-DO')
  });
}

router.get('/current', (request, response) => {
  const register = getOpenRegister(request.user.id);
  response.json({
    register: register || null,
    summary: register ? getRegisterSummary(register.id) : null
  });
});

router.get('/history', (request, response) => {
  const history = getDb().prepare(`
    SELECT cr.*, b.name AS branch_name
    FROM cash_registers cr
    LEFT JOIN branches b ON b.id = cr.branch_id
    WHERE cr.user_id = ?
    ORDER BY cr.opened_at DESC
    LIMIT 20
  `).all(request.user.id);

  response.json(history);
});

router.get('/:id/reprint', async (request, response) => {
  const register = getDb().prepare(`
    SELECT
      cr.*,
      b.name AS branch_name,
      u.username
    FROM cash_registers cr
    LEFT JOIN branches b ON b.id = cr.branch_id
    LEFT JOIN users u ON u.id = cr.user_id
    WHERE cr.id = ?
      AND cr.user_id = ?
  `).get(request.params.id, request.user.id);

  if (!register) {
    return response.status(404).json({
      message: 'Movimiento de caja no encontrado.'
    });
  }

  const summary = getRegisterSummary(register.id);
  const ticketPreview = buildRegisterTicket(register, summary, register.username || request.user.username);
  const printResult = await printText(ticketPreview, { force: true });

  response.json({
    ok: true,
    register,
    summary,
    ticketPreview,
    printResult
  });
});

router.post('/open', async (request, response) => {
  const existing = getOpenRegister(request.user.id);
  if (existing) {
    return response.status(400).json({
      message: 'Ya tienes una caja abierta.'
    });
  }

  const branchId = Number(request.body?.branchId || request.user.branch_id || 1);
  const openingAmount = Number(request.body?.openingAmount || 0);
  const notes = request.body?.notes || '';

  const result = getDb().prepare(`
    INSERT INTO cash_registers (
      user_id, branch_id, opening_amount, status, notes
    )
    VALUES (?, ?, ?, 'open', ?)
  `).run(request.user.id, branchId, openingAmount, notes);

  createAuditLog({
    userId: request.user.id,
    action: 'open_cash',
    tableName: 'cash_registers',
    recordId: result.lastInsertRowid,
    newValue: { branchId, openingAmount, notes }
  });

  const register = getOpenRegister(request.user.id);
  const summary = getRegisterSummary(result.lastInsertRowid);
  const ticketPreview = buildRegisterTicket(register, summary, request.user.username);
  const printResult = await printText(ticketPreview);

  response.status(201).json({
    ok: true,
    register,
    summary,
    ticketPreview,
    printResult
  });
});

router.post('/close', async (request, response) => {
  const register = getOpenRegister(request.user.id);
  if (!register) {
    return response.status(400).json({
      message: 'No tienes una caja abierta.'
    });
  }

  const countedAmount = Number(request.body?.countedAmount || 0);
  const notes = request.body?.notes || '';
  const summary = getRegisterSummary(register.id);
  const difference = countedAmount - summary.expectedCash;

  getDb().prepare(`
    UPDATE cash_registers
    SET closing_amount = ?, expected_amount = ?, difference = ?, status = 'closed',
        notes = ?, closed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(countedAmount, summary.expectedCash, difference, notes || register.notes, register.id);

  createAuditLog({
    userId: request.user.id,
    action: 'close_cash',
    tableName: 'cash_registers',
    recordId: register.id,
    oldValue: register,
    newValue: {
      countedAmount,
      expectedAmount: summary.expectedCash,
      difference,
      notes
    }
  });

  const closedRegister = getDb().prepare(`
    SELECT cr.*, b.name AS branch_name
    FROM cash_registers cr
    LEFT JOIN branches b ON b.id = cr.branch_id
    WHERE cr.id = ?
  `).get(register.id);
  const ticketPreview = buildRegisterTicket(closedRegister, summary, request.user.username);
  const printResult = await printText(ticketPreview);

  response.json({
    ok: true,
    register: closedRegister,
    summary,
    ticketPreview,
    printResult
  });
});

module.exports = router;
