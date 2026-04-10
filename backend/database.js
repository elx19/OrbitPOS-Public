const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { getPrintTemplateConfigDefaults } = require('./helpers/printTemplates');

const DEFAULT_UPDATE_PROVIDER = 'github';
const DEFAULT_UPDATE_GITHUB_OWNER = 'elx19';
const DEFAULT_UPDATE_GITHUB_REPO = 'OrbitPOS-Public';
const DEFAULT_UPDATE_GITHUB_RELEASE_TYPE = 'release';

const DATA_DIR = process.env.ORBITPOS_DATA_DIR
  ? path.resolve(process.env.ORBITPOS_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'orbitpos.db');
const CONFIG_STATEMENTS = [
  ['business_name', 'Mi Negocio'],
  ['business_rnc', ''],
  ['business_phone', ''],
  ['business_address', ''],
  ['business_logo', ''],
  ['business_currency', 'DOP'],
  ['business_currency_symbol', 'RD$'],
  ['tax_rate', '18'],
  ['ticket_footer', 'Gracias por su compra.'],
  ['theme', 'light'],
  ['ui_scale', '100'],
  ['workspace_width', 'full'],
  ['sidebar_compact', '0'],
  ['wizard_completed', '0'],
  ['printer_name', ''],
  ['printer_port', ''],
  ['printer_driver_mode', 'system'],
  ['printer_interface', ''],
  ['printer_width', '48'],
  ['auto_print_receipts', '0'],
  ['scanner_port', ''],
  ['scanner_baud_rate', '9600'],
  ['scale_enabled', '0'],
  ['scale_port', ''],
  ['scale_baud_rate', '9600'],
  ['whatsapp_phone', ''],
  ['backup_path', path.join(DATA_DIR, 'backups')],
  ['backup_retention_count', '30'],
  ['backup_cloud_enabled', '0'],
  ['backup_cloud_provider', 'dropbox'],
  ['backup_cloud_token', ''],
  ['backup_cloud_folder', ''],
  ['update_provider', DEFAULT_UPDATE_PROVIDER],
  ['update_channel', 'stable'],
  ['update_feed_url', ''],
  ['update_github_owner', DEFAULT_UPDATE_GITHUB_OWNER],
  ['update_github_repo', DEFAULT_UPDATE_GITHUB_REPO],
  ['update_github_release_type', DEFAULT_UPDATE_GITHUB_RELEASE_TYPE],
  ...getPrintTemplateConfigDefaults()
];

let db;

function getDb() {
  if (!db) {
    initDatabase();
  }
  return db;
}

function initDatabase() {
  if (db) {
    return db;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'cashier',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      category TEXT,
      image_path TEXT,
      cost_price REAL DEFAULT 0,
      sale_price REAL NOT NULL,
      stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 5,
      unit TEXT DEFAULT 'unidad',
      weighed INTEGER DEFAULT 0,
      supplier_id INTEGER REFERENCES suppliers(id),
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id),
      old_cost_price REAL,
      old_sale_price REAL,
      new_cost_price REAL,
      new_sale_price REAL,
      changed_by INTEGER REFERENCES users(id),
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      rnc TEXT,
      email TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES suppliers(id),
      user_id INTEGER REFERENCES users(id),
      invoice_ref TEXT,
      total REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER REFERENCES purchases(id),
      product_id INTEGER REFERENCES products(id),
      quantity REAL,
      unit_cost REAL,
      subtotal REAL
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER REFERENCES users(id),
      subtotal REAL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL,
      status TEXT DEFAULT 'pending',
      valid_until DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER REFERENCES quotes(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT,
      quantity REAL,
      unit_price REAL,
      subtotal REAL
    );

    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      opening_amount REAL DEFAULT 0,
      closing_amount REAL,
      expected_amount REAL,
      difference REAL,
      status TEXT DEFAULT 'open',
      notes TEXT,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      cash_register_id INTEGER REFERENCES cash_registers(id),
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      quote_id INTEGER REFERENCES quotes(id),
      type TEXT DEFAULT 'cash',
      subtotal REAL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL,
      paid REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      notes TEXT,
      qr_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT,
      quantity REAL,
      unit_price REAL,
      cost_price REAL,
      discount REAL DEFAULT 0,
      subtotal REAL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER REFERENCES users(id),
      cash_register_id INTEGER REFERENCES cash_registers(id),
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      user_id INTEGER REFERENCES users(id),
      reason TEXT,
      total REAL,
      refund_method TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER REFERENCES returns(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT,
      quantity REAL,
      unit_price REAL,
      subtotal REAL,
      restock INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      value REAL,
      applies_to TEXT,
      target_id INTEGER,
      start_date DATE,
      end_date DATE,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT,
      table_name TEXT,
      record_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL,
      machine_id TEXT,
      business_name TEXT,
      activated_at DATETIME,
      expires_at DATETIME,
      demo_started_at DATETIME,
      status TEXT DEFAULT 'demo'
    );

    CREATE TABLE IF NOT EXISTS license_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      status TEXT,
      license_key TEXT,
      machine_id TEXT,
      business_name TEXT,
      license_type TEXT,
      edition TEXT,
      serial TEXT,
      expires_at DATETIME,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS license_runtime_guard (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      last_seen_at DATETIME,
      last_machine_id TEXT,
      last_license_hash TEXT,
      last_license_serial TEXT,
      last_app_version TEXT,
      rollback_hits INTEGER DEFAULT 0,
      mismatch_hits INTEGER DEFAULT 0,
      tamper_hits INTEGER DEFAULT 0,
      last_executable_hash TEXT,
      last_warning TEXT
    );
  `);

  ensureSchemaMigrations();
  ensurePerformanceIndexes();
  seedCoreData();
  db.pragma('optimize');
  return db;
}

function tableHasColumn(tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function ensureSchemaMigrations() {
  if (!tableHasColumn('users', 'branch_id')) {
    db.exec('ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id)');
  }

  if (!tableHasColumn('users', 'security_question')) {
    db.exec('ALTER TABLE users ADD COLUMN security_question TEXT');
  }

  if (!tableHasColumn('users', 'security_answer')) {
    db.exec('ALTER TABLE users ADD COLUMN security_answer TEXT');
  }

  if (!tableHasColumn('payments', 'receipt_number')) {
    db.exec('ALTER TABLE payments ADD COLUMN receipt_number TEXT');
  }

  if (!tableHasColumn('products', 'image_path')) {
    db.exec('ALTER TABLE products ADD COLUMN image_path TEXT');
  }

  ensureUpdaterConfigurationDefaults();
}

function ensureUpdaterConfigurationDefaults() {
  const currentValues = db.prepare(`
    SELECT key, value
    FROM config
    WHERE key IN ('update_provider', 'update_feed_url', 'update_github_owner', 'update_github_repo', 'update_github_release_type')
  `).all().reduce((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});

  const currentProvider = String(currentValues.update_provider || '').trim().toLowerCase();
  const currentFeedUrl = String(currentValues.update_feed_url || '').trim();
  const currentGithubOwner = String(currentValues.update_github_owner || '').trim();
  const currentGithubRepo = String(currentValues.update_github_repo || '').trim();
  const currentGithubReleaseType = String(currentValues.update_github_release_type || '').trim();
  const shouldMigrateLegacyPrivateRepo = (
    currentProvider === 'github' &&
    currentGithubOwner.toLowerCase() === DEFAULT_UPDATE_GITHUB_OWNER.toLowerCase() &&
    currentGithubRepo === 'OrbitPOS'
  );

  const shouldUpgradeToGithubDefaults = (
    (!currentProvider || currentProvider === 'generic') &&
    !currentFeedUrl &&
    !currentGithubOwner &&
    !currentGithubRepo
  );

  if (!shouldUpgradeToGithubDefaults && currentGithubOwner && currentGithubRepo && currentProvider === 'github') {
    const patch = {};

    if (shouldMigrateLegacyPrivateRepo) {
      patch.update_github_repo = DEFAULT_UPDATE_GITHUB_REPO;
    }

    if (!currentGithubReleaseType) {
      patch.update_github_release_type = DEFAULT_UPDATE_GITHUB_RELEASE_TYPE;
    }

    if (Object.keys(patch).length) {
      setConfigEntries(patch);
    }
    return;
  }

  if (shouldUpgradeToGithubDefaults) {
    setConfigEntries({
      update_provider: DEFAULT_UPDATE_PROVIDER,
      update_github_owner: DEFAULT_UPDATE_GITHUB_OWNER,
      update_github_repo: DEFAULT_UPDATE_GITHUB_REPO,
      update_github_release_type: DEFAULT_UPDATE_GITHUB_RELEASE_TYPE
    });
  }
}

function ensurePerformanceIndexes() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_branch_role_active ON users(branch_id, role, active);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_supplier_active ON products(supplier_id, active);
    CREATE INDEX IF NOT EXISTS idx_products_stock_active ON products(active, stock);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(balance);
    CREATE INDEX IF NOT EXISTS idx_sales_created_status ON sales(created_at, status);
    CREATE INDEX IF NOT EXISTS idx_sales_type_balance_status ON sales(type, balance, status);
    CREATE INDEX IF NOT EXISTS idx_sales_customer_created ON sales(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_register_created ON sales(cash_register_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_payments_sale_created ON payments(sale_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_customer_created ON payments(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_returns_sale_created ON returns(sale_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier_created ON purchases(supplier_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_quotes_customer_status ON quotes(customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_discounts_active_dates ON discounts(active, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_read_created ON notifications(read, created_at);
    CREATE INDEX IF NOT EXISTS idx_cash_registers_user_status ON cash_registers(user_id, status, opened_at);
    CREATE INDEX IF NOT EXISTS idx_license_history_created ON license_history(created_at, id);
    CREATE INDEX IF NOT EXISTS idx_license_history_event ON license_history(event_type, created_at);
  `);
}

function seedCoreData() {
  const countUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  if (countUsers.total === 0) {
    db.prepare(`
      INSERT INTO users (name, username, password, role, active, branch_id)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run('Administrador', 'admin', bcrypt.hashSync('admin', 12), 'admin', 1);
  }

  const countBranches = db.prepare('SELECT COUNT(*) AS total FROM branches').get();
  if (countBranches.total === 0) {
    db.prepare(`
      INSERT INTO branches (name, address, phone, active)
      VALUES (?, ?, ?, ?)
    `).run('Principal', '', '', 1);
  }

  const defaultBranch = db.prepare('SELECT id FROM branches ORDER BY id ASC LIMIT 1').get();
  if (defaultBranch) {
    db.prepare(`
      UPDATE users
      SET branch_id = COALESCE(branch_id, ?)
      WHERE branch_id IS NULL
    `).run(defaultBranch.id);
  }

  const insertConfig = db.prepare(`
    INSERT INTO config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO NOTHING
  `);

  CONFIG_STATEMENTS.forEach(([key, value]) => {
    insertConfig.run(key, value);
  });
}

function getConfigValue(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function getConfigEntries(keys = null) {
  const database = getDb();
  const rows = keys && keys.length
    ? database.prepare(`
        SELECT key, value
        FROM config
        WHERE key IN (${keys.map(() => '?').join(',')})
      `).all(...keys)
    : database.prepare('SELECT key, value FROM config').all();

  return rows.reduce((accumulator, row) => {
    accumulator[row.key] = row.value;
    return accumulator;
  }, {});
}

function setConfigEntries(entries) {
  const database = getDb();
  const statement = database.prepare(`
    INSERT INTO config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const transaction = database.transaction((payload) => {
    Object.entries(payload).forEach(([key, value]) => {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      statement.run(key, serializedValue);
    });
  });

  transaction(entries);
}

function createAuditLog({ userId = null, action, tableName, recordId = null, oldValue = null, newValue = null }) {
  getDb().prepare(`
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    action,
    tableName,
    recordId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null
  );
}

function closeDb() {
  if (!db) {
    return;
  }

  db.close();
  db = null;
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  getDb,
  initDatabase,
  closeDb,
  getConfigValue,
  getConfigEntries,
  setConfigEntries,
  createAuditLog
};
