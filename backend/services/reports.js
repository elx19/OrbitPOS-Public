const PDFDocument = require('pdfkit');
const { getDb, getConfigValue } = require('../database');
const { withRuntimeCache } = require('../helpers/runtimeCache');

let reportStatements = null;

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function formatSqlDate(date) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

function formatMoney(value) {
  return `RD$ ${Number(value || 0).toFixed(2)}`;
}

function resolveRange(query) {
  const now = new Date();
  let range = String(query.range || '7d').toLowerCase();
  let startDate;
  let endDate;

  if (range === 'today') {
    startDate = startOfDay(now);
    endDate = endOfDay(now);
  } else if (range === '30d') {
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    endDate = endOfDay(now);
  } else if (range === 'custom' && query.dateFrom && query.dateTo) {
    startDate = startOfDay(new Date(query.dateFrom));
    endDate = endOfDay(new Date(query.dateTo));
  } else {
    range = '7d';
    startDate = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    endDate = endOfDay(now);
  }

  return {
    key: range,
    label: `${startDate.toLocaleDateString('es-DO')} - ${endDate.toLocaleDateString('es-DO')}`,
    dateFrom: startDate.toISOString().slice(0, 10),
    dateTo: endDate.toISOString().slice(0, 10),
    sqlStart: formatSqlDate(startDate),
    sqlEnd: formatSqlDate(endDate)
  };
}

function getReportStatements() {
  const db = getDb();

  if (reportStatements?.db === db) {
    return reportStatements;
  }

  reportStatements = {
    db,
    metrics: db.prepare(`
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(total), 0) AS gross_sales,
        COALESCE(SUM(discount), 0) AS discounts,
        COALESCE(SUM(tax), 0) AS taxes,
        COALESCE(SUM(CASE WHEN type = 'cash' THEN total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN total ELSE 0 END), 0) AS credit_sales,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS paid_sales
      FROM sales
      WHERE status != 'cancelled'
        AND created_at BETWEEN ? AND ?
    `),
    purchases: db.prepare(`
      SELECT
        COUNT(*) AS total_purchases,
        COALESCE(SUM(total), 0) AS purchases_total
      FROM purchases
      WHERE created_at BETWEEN ? AND ?
    `),
    returns: db.prepare(`
      SELECT
        COUNT(*) AS total_returns,
        COALESCE(SUM(total), 0) AS returns_total
      FROM returns
      WHERE created_at BETWEEN ? AND ?
    `),
    payments: db.prepare(`
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(amount), 0) AS payments_total
      FROM payments
      WHERE created_at BETWEEN ? AND ?
    `),
    pendingCredits: db.prepare(`
      SELECT
        COUNT(*) AS total_open_credits,
        COALESCE(SUM(balance), 0) AS pending_balance
      FROM sales
      WHERE type = 'credit'
        AND balance > 0
    `),
    quotes: db.prepare(`
      SELECT
        COUNT(*) AS total_quotes,
        COALESCE(SUM(total), 0) AS quoted_total,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted_quotes
      FROM quotes
      WHERE created_at BETWEEN ? AND ?
    `),
    topProducts: db.prepare(`
      SELECT
        si.product_name,
        COALESCE(SUM(si.quantity), 0) AS quantity,
        COALESCE(SUM(si.subtotal), 0) AS revenue
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status != 'cancelled'
        AND s.created_at BETWEEN ? AND ?
      GROUP BY si.product_name
      ORDER BY quantity DESC, revenue DESC
      LIMIT 8
    `),
    salesByUser: db.prepare(`
      SELECT
        u.username,
        COUNT(s.id) AS total_sales,
        COALESCE(SUM(s.total), 0) AS total_amount
      FROM sales s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.status != 'cancelled'
        AND s.created_at BETWEEN ? AND ?
      GROUP BY u.username
      ORDER BY total_amount DESC
    `),
    recentSales: db.prepare(`
      SELECT
        s.invoice_number,
        s.type,
        s.status,
        s.total,
        s.balance,
        s.created_at,
        c.name AS customer_name,
        u.username
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.created_at BETWEEN ? AND ?
      ORDER BY s.created_at DESC
      LIMIT 10
    `),
    lowStock: db.prepare(`
      SELECT id, name, category, stock, min_stock
      FROM products
      WHERE active = 1
        AND stock <= min_stock
      ORDER BY stock ASC, name ASC
      LIMIT 10
    `)
  };

  return reportStatements;
}

function buildReportData(query = {}) {
  const range = resolveRange(query);
  const cacheKey = `reports:data:${range.key}:${range.dateFrom}:${range.dateTo}`;

  return withRuntimeCache(cacheKey, 15000, () => {
    const statements = getReportStatements();
    const metrics = statements.metrics.get(range.sqlStart, range.sqlEnd);
    const purchases = statements.purchases.get(range.sqlStart, range.sqlEnd);
    const returns = statements.returns.get(range.sqlStart, range.sqlEnd);
    const payments = statements.payments.get(range.sqlStart, range.sqlEnd);
    const pendingCredits = statements.pendingCredits.get();
    const quotes = statements.quotes.get(range.sqlStart, range.sqlEnd);

    return {
      range,
      metrics: {
        totalSales: Number(metrics.total_sales || 0),
        grossSales: Number(metrics.gross_sales || 0),
        discounts: Number(metrics.discounts || 0),
        taxes: Number(metrics.taxes || 0),
        cashSales: Number(metrics.cash_sales || 0),
        creditSales: Number(metrics.credit_sales || 0),
        paidSales: Number(metrics.paid_sales || 0),
        purchasesTotal: Number(purchases.purchases_total || 0),
        totalPurchases: Number(purchases.total_purchases || 0),
        returnsTotal: Number(returns.returns_total || 0),
        totalReturns: Number(returns.total_returns || 0),
        paymentsTotal: Number(payments.payments_total || 0),
        totalPayments: Number(payments.total_payments || 0),
        pendingCredits: Number(pendingCredits.pending_balance || 0),
        totalOpenCredits: Number(pendingCredits.total_open_credits || 0)
      },
      quotes: {
        totalQuotes: Number(quotes.total_quotes || 0),
        quotedTotal: Number(quotes.quoted_total || 0),
        convertedQuotes: Number(quotes.converted_quotes || 0)
      },
      topProducts: statements.topProducts.all(range.sqlStart, range.sqlEnd),
      salesByUser: statements.salesByUser.all(range.sqlStart, range.sqlEnd),
      recentSales: statements.recentSales.all(range.sqlStart, range.sqlEnd),
      lowStock: statements.lowStock.all()
    };
  });
}

async function buildReportPdf(query = {}) {
  const report = buildReportData(query);
  const businessName = getConfigValue('business_name', 'Mi Negocio');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42
    });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), report }));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#172033').text(`${businessName} - Reporte`);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#55617a').text(`Periodo: ${report.range.label}`);
    doc.text(`Generado: ${new Date().toLocaleString('es-DO')}`);

    doc.moveDown();
    doc.fontSize(13).fillColor('#172033').text('Resumen general');
    doc.moveDown(0.4);
    [
      ['Ventas brutas', formatMoney(report.metrics.grossSales)],
      ['Descuentos', formatMoney(report.metrics.discounts)],
      ['Compras', formatMoney(report.metrics.purchasesTotal)],
      ['Devoluciones', formatMoney(report.metrics.returnsTotal)],
      ['Abonos', formatMoney(report.metrics.paymentsTotal)],
      ['Credito pendiente', formatMoney(report.metrics.pendingCredits)]
    ].forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#172033').text(`${label}: ${value}`);
    });

    doc.moveDown();
    doc.fontSize(13).fillColor('#172033').text('Productos mas vendidos');
    doc.moveDown(0.4);
    if (report.topProducts.length) {
      report.topProducts.forEach((item, index) => {
        doc.fontSize(10).text(`${index + 1}. ${item.product_name} | Cantidad: ${item.quantity} | Ingresos: ${formatMoney(item.revenue)}`);
      });
    } else {
      doc.fontSize(10).fillColor('#55617a').text('No hubo movimientos de productos en el periodo.');
    }

    doc.moveDown();
    doc.fontSize(13).fillColor('#172033').text('Ventas recientes');
    doc.moveDown(0.4);
    if (report.recentSales.length) {
      report.recentSales.forEach((item) => {
        doc.fontSize(10).text(
          `Factura #${item.invoice_number} | ${item.customer_name || 'Consumidor final'} | ${formatMoney(item.total)} | ${new Date(item.created_at).toLocaleString('es-DO')}`
        );
      });
    } else {
      doc.fontSize(10).fillColor('#55617a').text('No se registraron ventas en el rango seleccionado.');
    }

    doc.moveDown();
    doc.fontSize(13).fillColor('#172033').text('Stock bajo');
    doc.moveDown(0.4);
    if (report.lowStock.length) {
      report.lowStock.forEach((item) => {
        doc.fontSize(10).text(`${item.name} | Stock: ${item.stock} | Minimo: ${item.min_stock}`);
      });
    } else {
      doc.fontSize(10).fillColor('#55617a').text('No hay productos con stock critico.');
    }

    doc.end();
  });
}

module.exports = {
  buildReportData,
  buildReportPdf
};
