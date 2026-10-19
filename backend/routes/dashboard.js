const express = require('express');
const { getDb } = require('../database');
const { withRuntimeCache } = require('../helpers/runtimeCache');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { getBusinessType, getBusinessCategories } = require('../helpers/businessProfile');

const router = express.Router();

let dashboardStatements = null;

function getDashboardStatements() {
  const db = getDb();
  const businessType = getBusinessType();

  if (dashboardStatements?.db === db && dashboardStatements.businessType === businessType) {
    return dashboardStatements;
  }

  const businessCategories = getBusinessCategories();
  const categoryPlaceholders = businessCategories.map(() => '?').join(', ');

  dashboardStatements = {
    db,
    businessType,
    salesToday: db.prepare(`
      SELECT COUNT(*) AS transactions, COALESCE(SUM(total), 0) AS total
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
        AND category IN (${categoryPlaceholders})
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
      SELECT si.product_name AS name, COALESCE(SUM(si.quantity), 0) AS quantity
      FROM sale_items si
      INNER JOIN products p ON p.id = si.product_id
      WHERE p.category IN (${categoryPlaceholders})
      GROUP BY si.product_name
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

router.use(authenticateToken, requirePermission('dashboard'));

router.get('/summary', (request, response) => {
  const summary = withRuntimeCache('dashboard:summary', 6000, () => {
    const statements = getDashboardStatements();
    const salesToday = statements.salesToday.get();
    const creditsOpen = statements.creditsOpen.get();
    const lowStock = statements.lowStock.get(...getBusinessCategories());
    const receivables = statements.receivables.get();

    return {
      salesToday: salesToday.total,
      transactionsToday: Number(salesToday.transactions || 0),
      creditsOpen: creditsOpen.total,
      lowStockCount: lowStock.total,
      receivables: receivables.total,
      chart: statements.chart.all(),
      topProducts: statements.topProducts.all(...getBusinessCategories()),
      recentSales: statements.recentSales.all(),
      overdueCustomers: statements.overdueCustomers.all()
    };
  });

  response.json(summary);
});

module.exports = router;
