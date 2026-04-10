const express = require('express');
const { getDb, getConfigValue, createAuditLog } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { printText } = require('../helpers/printer');
const { buildPaymentReceipt, formatPaymentMethods } = require('../helpers/receipt');

const router = express.Router();

router.use(authenticateToken);

function nextReceiptNumber() {
  const row = getDb().prepare('SELECT id FROM payments ORDER BY id DESC LIMIT 1').get();
  return `AB-${String(Number(row?.id || 0) + 1).padStart(5, '0')}`;
}

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

function normalizeSplits(splits = []) {
  return splits
    .map((split) => ({
      method: String(split.method || '').toLowerCase(),
      amount: Number(split.amount || 0),
      reference: split.reference || ''
    }))
    .filter((split) => split.method && split.amount > 0);
}

function buildWhatsappUrl({ customerName, invoiceNumber, amount, previousBalance, newBalance }) {
  const message = encodeURIComponent(
    `Hola *${customerName}*\n\nLe informamos que hemos recibido su abono:\n\nFactura: #${invoiceNumber}\nAbono recibido: RD$ ${Number(amount).toFixed(2)}\nSaldo anterior: RD$ ${Number(previousBalance).toFixed(2)}\nNuevo saldo: RD$ ${Number(newBalance).toFixed(2)}\nFecha: ${new Date().toLocaleDateString('es-DO')}\n\nGracias por su pago.\n*${getConfigValue('business_name', 'Mi Negocio')}* | Tel: ${getConfigValue('business_phone', '')}`
  );
  const phone = (getConfigValue('whatsapp_phone', '') || '').replace(/\D/g, '');
  return `https://wa.me/${phone || '18094042070'}?text=${message}`;
}

function resolveReceiptNumber(payment) {
  if (payment?.receipt_number) {
    return payment.receipt_number;
  }

  const notes = String(payment?.notes || '');
  const token = notes.split('|')[0]?.trim();
  return token && /^AB-\d+$/i.test(token) ? token : null;
}

function buildReceiptPayloadFromPayment(paymentId) {
  const payment = getDb().prepare(`
    SELECT
      p.*,
      s.invoice_number,
      s.total AS sale_total,
      c.name AS customer_name,
      u.username
    FROM payments p
    INNER JOIN sales s ON s.id = p.sale_id
    INNER JOIN customers c ON c.id = p.customer_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(paymentId);

  if (!payment) {
    return null;
  }

  const receiptNumber = resolveReceiptNumber(payment);
  const rows = receiptNumber
    ? getDb().prepare(`
        SELECT *
        FROM payments
        WHERE sale_id = ?
          AND receipt_number = ?
        ORDER BY id ASC
      `).all(payment.sale_id, receiptNumber)
    : [payment];

  const totalAmount = Number(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2));
  const receiptMaxId = Math.max(...rows.map((row) => Number(row.id || 0)));
  const cumulativePaid = getDb().prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE sale_id = ?
      AND id <= ?
  `).get(payment.sale_id, receiptMaxId);
  const newBalance = Number((Number(payment.sale_total || 0) - Number(cumulativePaid.total || 0)).toFixed(2));
  const previousBalance = Number((newBalance + totalAmount).toFixed(2));
  const paymentMethods = rows.map((row) => row.payment_method);
  const receiptPreview = buildPaymentReceipt({
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    receiptNumber: receiptNumber || `AB-${String(payment.id).padStart(5, '0')}`,
    customerName: payment.customer_name,
    invoiceNumber: `#${payment.invoice_number}`,
    previousBalance,
    paidAmount: totalAmount,
    newBalance,
    paymentMethod: formatPaymentMethods(paymentMethods),
    cashier: payment.username || 'admin'
  });

  return {
    payment,
    receiptNumber: receiptNumber || `AB-${String(payment.id).padStart(5, '0')}`,
    previousBalance,
    newBalance,
    totalAmount,
    paymentMethods,
    receiptPreview
  };
}

router.get('/', (request, response) => {
  const { saleId } = request.query;
  const payments = saleId
    ? getDb().prepare(`
        SELECT *
        FROM payments
        WHERE sale_id = ?
        ORDER BY created_at DESC, id DESC
      `).all(saleId)
    : getDb().prepare(`
        SELECT *
        FROM payments
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      `).all();

  response.json(payments);
});

router.get('/:id/reprint', async (request, response) => {
  const payload = buildReceiptPayloadFromPayment(request.params.id);
  if (!payload) {
    return response.status(404).json({
      message: 'Recibo no encontrado.'
    });
  }

  const printResult = await printText(payload.receiptPreview, { force: true });
  response.json({
    ok: true,
    receiptNumber: payload.receiptNumber,
    receiptPreview: payload.receiptPreview,
    printResult
  });
});

router.post('/', async (request, response) => {
  const { saleId, splits = [], notes = '' } = request.body || {};
  const register = getOpenRegister(request.user.id);
  if (!register) {
    return response.status(400).json({
      message: 'Debes abrir una caja antes de registrar abonos.'
    });
  }

  const credit = getDb().prepare(`
    SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
    FROM sales s
    INNER JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
      AND s.type = 'credit'
  `).get(saleId);

  if (!credit) {
    return response.status(404).json({
      message: 'La venta a credito no existe.'
    });
  }

  if (Number(credit.balance) <= 0) {
    return response.status(400).json({
      message: 'Este credito ya fue saldado.'
    });
  }

  const normalizedSplits = normalizeSplits(splits);
  if (!normalizedSplits.length) {
    return response.status(400).json({
      message: 'Debes indicar al menos un metodo de pago.'
    });
  }

  const totalAmount = Number(normalizedSplits.reduce((sum, split) => sum + split.amount, 0).toFixed(2));
  if (totalAmount > Number(credit.balance)) {
    return response.status(400).json({
      message: 'El abono no puede superar el saldo pendiente.'
    });
  }

  const receiptNumber = nextReceiptNumber();
  const newBalance = Number((Number(credit.balance) - totalAmount).toFixed(2));
  const previousBalance = Number(credit.balance);
  const db = getDb();

    const transaction = db.transaction(() => {
      const insertPayment = db.prepare(`
        INSERT INTO payments (
        sale_id, customer_id, user_id, cash_register_id, amount, payment_method, reference, receipt_number, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    normalizedSplits.forEach((split) => {
      insertPayment.run(
        credit.id,
        credit.customer_id,
        request.user.id,
        register.id,
        split.amount,
        split.method,
        split.reference || null,
        receiptNumber,
        notes ? `${receiptNumber} | ${notes}` : receiptNumber
      );
    });

    db.prepare(`
      UPDATE sales
      SET paid = paid + ?, balance = balance - ?, status = CASE WHEN balance - ? <= 0 THEN 'paid' ELSE status END
      WHERE id = ?
    `).run(totalAmount, totalAmount, totalAmount, credit.id);

    db.prepare(`
      UPDATE customers
      SET balance = MAX(balance - ?, 0)
      WHERE id = ?
    `).run(totalAmount, credit.customer_id);
  });

  try {
    transaction();

    createAuditLog({
      userId: request.user.id,
      action: 'register_payment',
      tableName: 'payments',
      recordId: credit.id,
      newValue: request.body
    });

    const receiptPreview = buildPaymentReceipt({
      businessName: getConfigValue('business_name', 'Mi Negocio'),
      receiptNumber,
      customerName: credit.customer_name,
      invoiceNumber: `#${credit.invoice_number}`,
      previousBalance,
      paidAmount: totalAmount,
      newBalance,
      paymentMethod: formatPaymentMethods(normalizedSplits.map((split) => split.method)),
      cashier: request.user.username
    });
    const printResult = await printText(receiptPreview);

    response.status(201).json({
      ok: true,
      receiptNumber,
      totalAmount,
      previousBalance,
      newBalance,
      receiptPreview,
      printResult,
      whatsappUrl: buildWhatsappUrl({
        customerName: credit.customer_name,
        invoiceNumber: credit.invoice_number,
        amount: totalAmount,
        previousBalance,
        newBalance
      })
    });
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible registrar el abono.'
    });
  }
});

module.exports = router;
