const { getDb, getConfigValue, createAuditLog } = require('../database');
const { printText } = require('../helpers/printer');
const { generateQrCode } = require('../helpers/qrcode');
const { buildSaleTicket } = require('../helpers/receipt');
const { refreshLicenseState } = require('../license');
const { evaluateAutomaticDiscounts, getLineKey } = require('./discounts');

function nextSequence(tableName) {
  const row = getDb().prepare(`SELECT id FROM ${tableName} ORDER BY id DESC LIMIT 1`).get();
  return Number(row?.id || 0) + 1;
}

function nextInvoiceNumber() {
  return String(nextSequence('sales')).padStart(6, '0');
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

function getBusinessSnapshot() {
  return {
    name: getConfigValue('business_name', 'Mi Negocio'),
    phone: getConfigValue('business_phone', ''),
    rnc: getConfigValue('business_rnc', ''),
    footer: getConfigValue('ticket_footer', 'Gracias por su compra.')
  };
}

function mapPaymentRows(payments = []) {
  return payments
    .map((payment) => ({
      method: String(payment.method || '').toLowerCase(),
      amount: Number(payment.amount || 0),
      reference: payment.reference || ''
    }))
    .filter((payment) => payment.method && payment.amount > 0);
}

function allocateAmountProportionally(lines, amount, lineKeySelector) {
  const roundedAmount = Number(amount.toFixed(2));
  if (roundedAmount <= 0 || !lines.length) {
    return new Map();
  }

  const totalBase = lines.reduce((sum, line) => sum + Number(line.availableForAllocation || 0), 0);
  if (totalBase <= 0) {
    return new Map();
  }

  const allocations = new Map();
  let distributed = 0;

  lines.forEach((line, index) => {
    const lineKey = lineKeySelector(line, index);
    const base = Number(line.availableForAllocation || 0);
    const raw = index === lines.length - 1
      ? Number((roundedAmount - distributed).toFixed(2))
      : Number(((roundedAmount * (base / totalBase))).toFixed(2));
    const safe = Math.min(raw, base);
    allocations.set(lineKey, safe);
    distributed = Number((distributed + safe).toFixed(2));
  });

  if (distributed < roundedAmount) {
    const lastLine = lines[lines.length - 1];
    const key = lineKeySelector(lastLine, lines.length - 1);
    allocations.set(key, Number((allocations.get(key) + (roundedAmount - distributed)).toFixed(2)));
  }

  return allocations;
}

function calculateSalePreview({
  customerId = null,
  items = [],
  discount = 0,
  taxRate = Number(getConfigValue('tax_rate', '18'))
}) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Debes agregar al menos un producto.');
  }

  const db = getDb();
  const productIds = [...new Set(items.map((item) => Number(item.productId)).filter(Boolean))];
  const productRows = productIds.length
    ? db.prepare(`
        SELECT *
        FROM products
        WHERE id IN (${productIds.map(() => '?').join(',')})
      `).all(...productIds)
    : [];
  const productsMap = new Map(productRows.map((product) => [product.id, product]));
  const selectedCustomer = customerId
    ? db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
    : null;

  const lines = [];

  items.forEach((item) => {
    const product = productsMap.get(Number(item.productId));
    const quantity = Number(item.quantity || 0);
    const manualItemDiscount = Number(item.discount || 0);
    const unitPrice = item.unitPriceOverride === undefined || item.unitPriceOverride === null
      ? Number(product?.sale_price || 0)
      : Number(item.unitPriceOverride);

    if (!product) {
      throw new Error('Uno de los productos ya no existe.');
    }
    if (!product.active) {
      throw new Error(`El producto ${product.name} esta inactivo.`);
    }
    if (quantity <= 0) {
      throw new Error(`La cantidad para ${product.name} debe ser mayor que cero.`);
    }
    if (Number(product.stock) < quantity) {
      throw new Error(`Stock insuficiente para ${product.name}.`);
    }

    const baseSubtotal = Number((unitPrice * quantity).toFixed(2));
    lines.push({
      product,
      quantity,
      unitPrice,
      costPrice: Number(product.cost_price || 0),
      manualItemDiscount: Number(manualItemDiscount.toFixed(2)),
      baseSubtotal,
      availableForAllocation: baseSubtotal,
      lineKey: `${product.id}:${lines.length}`
    });
  });

  const automatic = evaluateAutomaticDiscounts(lines, customerId);
  const cartLevelLines = [];
  const lineDiscounts = new Map();
  const automaticDetails = [...automatic.details];

  lines.forEach((line, index) => {
    const key = line.lineKey || getLineKey(line, index);
    const automaticLineDiscount = Number(automatic.lineDiscounts.get(key) || 0);
    const cappedManual = Math.min(line.manualItemDiscount, line.baseSubtotal);
    const provisional = Math.min(cappedManual + automaticLineDiscount, line.baseSubtotal);
    lineDiscounts.set(key, provisional);
    cartLevelLines.push({
      ...line,
      lineKey: key,
      availableForAllocation: Number((line.baseSubtotal - provisional).toFixed(2))
    });
  });

  automatic.cartDiscounts.forEach((cartDiscount) => {
    const eligibleLines = cartLevelLines.filter((line) => cartDiscount.lineKeys.includes(line.lineKey));
    const allocations = allocateAmountProportionally(eligibleLines, cartDiscount.amount, (line) => line.lineKey);
    let applied = 0;
    eligibleLines.forEach((line) => {
      const amount = Number(allocations.get(line.lineKey) || 0);
      if (amount <= 0) {
        return;
      }
      lineDiscounts.set(line.lineKey, Number((lineDiscounts.get(line.lineKey) + amount).toFixed(2)));
      line.availableForAllocation = Number((line.availableForAllocation - amount).toFixed(2));
      applied += amount;
    });

    if (applied > 0) {
      automaticDetails.push({
        id: cartDiscount.discountId,
        name: cartDiscount.name,
        type: cartDiscount.type,
        amount: Number(applied.toFixed(2)),
        appliesTo: 'cart'
      });
    }
  });

  const manualGlobalDiscount = Number(discount || 0);
  if (manualGlobalDiscount > 0) {
    const allocations = allocateAmountProportionally(cartLevelLines, manualGlobalDiscount, (line) => line.lineKey);
    let distributed = 0;
    cartLevelLines.forEach((line) => {
      const amount = Number(allocations.get(line.lineKey) || 0);
      if (amount <= 0) {
        return;
      }
      lineDiscounts.set(line.lineKey, Number((lineDiscounts.get(line.lineKey) + amount).toFixed(2)));
      line.availableForAllocation = Number((line.availableForAllocation - amount).toFixed(2));
      distributed += amount;
    });

    if (distributed > 0) {
      automaticDetails.push({
        id: 'manual-global',
        name: 'Descuento manual global',
        type: 'manual',
        amount: Number(distributed.toFixed(2)),
        appliesTo: 'cart'
      });
    }
  }

  const normalizedItems = lines.map((line, index) => {
    const lineKey = getLineKey(line, index);
    const totalLineDiscount = Math.min(Number(lineDiscounts.get(lineKey) || 0), line.baseSubtotal);
    const subtotal = Number((line.baseSubtotal - totalLineDiscount).toFixed(2));
    return {
      product: line.product,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      costPrice: line.costPrice,
      discount: totalLineDiscount,
      subtotal,
      manualItemDiscount: line.manualItemDiscount
    };
  });

  const subtotal = Number(lines.reduce((sum, line) => sum + line.baseSubtotal, 0).toFixed(2));
  const totalDiscount = Number(normalizedItems.reduce((sum, item) => sum + item.discount, 0).toFixed(2));
  const taxable = Number(Math.max(subtotal - totalDiscount, 0).toFixed(2));
  const tax = Number((taxable * (taxRate / 100)).toFixed(2));
  const total = Number((taxable + tax).toFixed(2));

  return {
    selectedCustomer,
    normalizedItems,
    subtotal,
    totalDiscount,
    tax,
    total,
    taxRate,
    appliedDiscounts: automaticDetails
  };
}

async function createSale({
  user,
  customerId = null,
  type = 'cash',
  items = [],
  payments = [],
  discount = 0,
  notes = '',
  quoteId = null
}) {
  const register = getOpenRegister(user.id);
  if (!register) {
    throw new Error('Debes abrir una caja antes de vender.');
  }

  const preview = calculateSalePreview({ customerId, items, discount });
  const normalizedPayments = mapPaymentRows(payments);
  const paid = Number(normalizedPayments.reduce((accumulator, payment) => accumulator + payment.amount, 0).toFixed(2));

  if (type === 'credit' && !preview.selectedCustomer) {
    throw new Error('Debes seleccionar un cliente para vender a credito.');
  }
  if (type === 'cash' && paid < preview.total) {
    throw new Error('Una venta de contado debe cubrir el total.');
  }
  if (type === 'credit' && paid > preview.total) {
    throw new Error('El abono inicial no puede superar el total.');
  }

  const balance = Number(Math.max(preview.total - paid, 0).toFixed(2));
  if (type === 'credit' && preview.selectedCustomer?.credit_limit > 0) {
    const projectedBalance = Number(preview.selectedCustomer.balance || 0) + balance;
    if (projectedBalance > Number(preview.selectedCustomer.credit_limit)) {
      throw new Error('La venta supera el limite de credito del cliente.');
    }
  }

  const invoiceNumber = nextInvoiceNumber();
  const qrPayload = {
    invoiceNumber,
    total: preview.total,
    businessName: getConfigValue('business_name', 'Mi Negocio'),
    createdAt: new Date().toISOString()
  };
  const qrCode = await generateQrCode(JSON.stringify(qrPayload));
  const license = refreshLicenseState();
  const db = getDb();

  const transaction = db.transaction(() => {
    const saleInsert = db.prepare(`
      INSERT INTO sales (
        invoice_number, cash_register_id, customer_id, user_id, branch_id, quote_id, type,
        subtotal, discount, tax, total, paid, balance, status, notes, qr_code
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoiceNumber,
      register.id,
      customerId || null,
      user.id,
      register.branch_id,
      quoteId || null,
      type,
      preview.subtotal,
      preview.totalDiscount,
      preview.tax,
      preview.total,
      paid,
      balance,
      balance > 0 ? 'open' : 'paid',
      notes,
      qrCode
    );

    const saleId = saleInsert.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, product_name, quantity, unit_price, cost_price, discount, subtotal
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare(`
      UPDATE products
      SET stock = stock - ?
      WHERE id = ?
    `);
    const insertPayment = db.prepare(`
      INSERT INTO sale_payments (sale_id, method, amount, reference)
      VALUES (?, ?, ?, ?)
    `);

    preview.normalizedItems.forEach((item) => {
      insertItem.run(
        saleId,
        item.product.id,
        item.product.name,
        item.quantity,
        item.unitPrice,
        item.costPrice,
        item.discount,
        item.subtotal
      );
      updateStock.run(item.quantity, item.product.id);
    });

    normalizedPayments.forEach((payment) => {
      insertPayment.run(saleId, payment.method, payment.amount, payment.reference || null);
    });

    if (balance > 0 && customerId) {
      db.prepare(`
        UPDATE customers
        SET balance = balance + ?
        WHERE id = ?
      `).run(balance, customerId);
    }

    if (quoteId) {
      db.prepare(`
        UPDATE quotes
        SET status = 'converted'
        WHERE id = ?
      `).run(quoteId);
    }

    preview.normalizedItems
      .filter((item) => (Number(item.product.stock) - item.quantity) <= Number(item.product.min_stock))
      .forEach((item) => {
        db.prepare(`
          INSERT INTO notifications (type, message)
          VALUES ('stock', ?)
        `).run(`Stock bajo detectado para ${item.product.name}.`);
      });

    return saleId;
  });

  const saleId = transaction();
  const sale = db.prepare(`
    SELECT *
    FROM sales
    WHERE id = ?
  `).get(saleId);
  const saleItems = db.prepare(`
    SELECT si.*, p.weighed
    FROM sale_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE sale_id = ?
    ORDER BY id ASC
  `).all(saleId);

  createAuditLog({
    userId: user.id,
    action: 'create_sale',
    tableName: 'sales',
    recordId: saleId,
    newValue: {
      customerId,
      type,
      items,
      payments,
      discount,
      notes,
      quoteId
    }
  });

  const business = getBusinessSnapshot();
  const ticketPreview = buildSaleTicket({
    businessName: business.name,
    businessPhone: business.phone,
    businessRnc: business.rnc,
    invoiceNumber,
    branchName: register.branch_name || 'Principal',
    cashier: user.username,
    customerName: preview.selectedCustomer?.name || '',
    saleType: type,
    items: saleItems,
    subtotal: preview.subtotal,
    discount: preview.totalDiscount,
    tax: preview.tax,
    total: preview.total,
    payments: normalizedPayments,
    change: type === 'cash' ? Math.max(paid - preview.total, 0) : 0,
    footer: business.footer,
    isDemo: license.isDemo
  });
  const printResult = await printText(ticketPreview);

  return {
    sale,
    items: saleItems,
    ticketPreview,
    printResult,
    qrCode,
    change: type === 'cash' ? Math.max(paid - preview.total, 0) : 0,
    appliedDiscounts: preview.appliedDiscounts
  };
}

module.exports = {
  calculateSalePreview,
  createSale,
  getBusinessSnapshot,
  getOpenRegister,
  mapPaymentRows,
  nextInvoiceNumber
};
