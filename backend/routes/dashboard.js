const express = require('express');
const { getDb } = require('../database');
const { withRuntimeCache } = require('../helpers/runtimeCache');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

let dashboardStatements = null;

function getDashboardStatements() {
  const db = getDb();

  if (dashboardStatements?.db === db) {
    return dashboardStatements;
  }

  dashboardStatements = {
    db,
    salesToday: db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM sales
      WHERE DATE(created_at) = DATE('now', 'localtime')
        AND status IN ('open', 'paid')
    `),
    creditsOpen: db.prepare(`
      SELECT COALESCE(SUM(balance), 0) AS total
      FROM sales
      WHERE type = 'credit'
        AND balance > 0
        AND status IN ('open', 'paid')
    `),
    lowStock: db.prepare(`
      SELECT COUNT(*) AS total
      FROM products
      WHERE active = 1
        AND stock <= min_stock
    `),
    receivables: db.prepare(`
      SELECT COALESCE(SUM(balance), 0) AS total
      FROM customers
      WHERE balance > 0
    `),
    recentSales: db.prepare(`
      SELECT invoice_number, total, created_at
      FROM sales
      ORDER BY created_at DESC
      LIMIT 5
    `),
    topProducts: db.prepare(`
      SELECT product_name AS name, COALESCE(SUM(quantity), 0) AS quantity
      FROM sale_items
      GROUP BY product_name
      ORDER BY quantity DESC
      LIMIT 5
    `),
    overdueCustomers: db.prepare(`
      SELECT name, balance
      FROM customers
      WHERE balance > 0
      ORDER BY balance DESC
      LIMIT 5
    `),
    chart: db.prepare(`
      SELECT
        strftime('%d/%m', created_at) AS label,
        ROUND(COALESCE(SUM(total), 0), 2) AS total
      FROM sales
      WHERE DATE(created_at) >= DATE('now', '-6 days', 'localtime')
        AND status IN ('open', 'paid')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `)
  };

  return dashboardStatements;
}

router.use(authenticateToken);

router.get('/summary', (request, response) => {
  const summary = withRuntimeCache('dashboard:summary', 6000, () => {
    const statements = getDashboardStatements();
    const salesToday = statements.salesToday.get();
    const creditsOpen = statements.creditsOpen.get();
    const lowStock = statements.lowStock.get();
    const receivables = statements.receivables.get();

    return {
      salesToday: salesToday.total,
      creditsOpen: creditsOpen.total,
      lowStockCount: lowStock.total,
      receivables: receivables.total,
      chart: statements.chart.all(),
      topProducts: statements.topProducts.all(),
      recentSales: statements.recentSales.all(),
      overdueCustomers: statements.overdueCustomers.all()
    };
  });

  response.json(summary);
});

module.exports = router;
