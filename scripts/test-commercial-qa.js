const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const securityQuestions = require('../shared/security-questions.json');
const { createLicenseKey } = require('../shared/license-core');

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function buildRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(apiBaseUrl, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Continues until the backend is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('El backend no inicio a tiempo para la prueba comercial.');
}

async function apiRequest(apiBaseUrl, route, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(`${apiBaseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.arrayBuffer();

  if (!response.ok) {
    const message = isJson ? (payload?.message || 'La solicitud de QA fallo.') : 'La solicitud de QA fallo.';
    throw new Error(message);
  }

  return {
    response,
    payload
  };
}

async function runCommercialQa() {
  const runId = buildRunId();
  const qaRoot = path.join(__dirname, '..', '.qa', 'commercial', runId);
  const dataDir = path.join(qaRoot, 'data');
  const backupsDir = path.join(qaRoot, 'backups');
  const reportsDir = path.join(qaRoot, 'reports');
  const port = 3470;
  const apiBaseUrl = `http://127.0.0.1:${port}`;

  ensureDirectory(qaRoot);
  ensureDirectory(backupsDir);
  ensureDirectory(reportsDir);

  process.env.ORBITPOS_DATA_DIR = dataDir;
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'test';

  const results = {
    runId,
    startedAt: new Date().toISOString(),
    apiBaseUrl,
    dataDir,
    backupsDir,
    steps: [],
    manualChecksPending: [
      'Prueba con impresora termica real.',
      'Prueba con lector de codigo real.',
      'Prueba con bascula real.',
      'Prueba de instalacion limpia en otra PC.',
      'Prueba de actualizacion real desde GitHub Releases o feed productivo.'
    ]
  };

  function recordStep(name, detail = {}) {
    results.steps.push({
      name,
      status: 'ok',
      ...detail
    });
  }

  function writeReports() {
    results.finishedAt = new Date().toISOString();
    const jsonPath = path.join(reportsDir, 'commercial-qa-result.json');
    const markdownPath = path.join(reportsDir, 'commercial-qa-result.md');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

    const markdown = [
      '# QA Comercial OrbitPOS',
      '',
      `- Run ID: \`${results.runId}\``,
      `- Inicio: \`${results.startedAt}\``,
      `- Fin: \`${results.finishedAt}\``,
      `- API: \`${results.apiBaseUrl}\``,
      `- Data temporal: \`${results.dataDir}\``,
      '',
      '## Pasos automatizados',
      '',
      ...results.steps.map((step) => `- ${step.status === 'ok' ? '[OK]' : '[FAIL]'} ${step.name}`),
      '',
      '## Validaciones manuales pendientes',
      '',
      ...results.manualChecksPending.map((item) => `- ${item}`)
    ].join('\n');

    fs.writeFileSync(markdownPath, markdown, 'utf8');
    results.reportJson = jsonPath;
    results.reportMarkdown = markdownPath;
  }

  let stopServer = null;
  let closeDb = null;

  try {
    const serverModule = require('../backend/server');
    const databaseModule = require('../backend/database');
    stopServer = serverModule.stopServer;
    closeDb = databaseModule.closeDb;

    serverModule.startServer(port);
    await waitForServer(apiBaseUrl);

    const health = await apiRequest(apiBaseUrl, '/api/health');
    assertCondition(health.payload.ok === true, 'Health check invalido.');
    recordStep('Health check', { version: health.payload.version });

    const meta = await apiRequest(apiBaseUrl, '/api/meta');
    recordStep('Meta del sistema', { updaterProvider: meta.payload.updater?.provider || 'generic' });

    const wizardStatus = await apiRequest(apiBaseUrl, '/api/wizard/status');
    assertCondition(Boolean(wizardStatus.payload.machineId), 'El wizard no devolvio machine ID.');
    recordStep('Wizard status inicial', {
      machineId: wizardStatus.payload.machineId,
      wizardCompleted: wizardStatus.payload.config?.wizardCompleted || false
    });

    const adminQuestion = securityQuestions[0];
    assertCondition(Boolean(adminQuestion), 'No hay preguntas de seguridad precargadas.');

    const wizardComplete = await apiRequest(apiBaseUrl, '/api/wizard/complete', {
      method: 'POST',
      body: {
        business: {
          name: 'OrbitPOS QA Comercial',
          rnc: 'QA-001',
          phone: '809-555-0001',
          address: 'Laboratorio QA',
          logo: '',
          currency: 'DOP'
        },
        printer: {
          name: '',
          port: ''
        },
        scanner: {
          port: '',
          baudRate: 9600
        },
        scale: {
          enabled: false,
          port: '',
          baudRate: 9600
        },
        admin: {
          name: 'Administrador QA',
          password: 'admin1234',
          securityQuestion: adminQuestion,
          securityAnswer: 'azul'
        }
      }
    });
    assertCondition(wizardComplete.payload.license?.isDemo, 'El wizard no inicio la demo automatica.');
    assertCondition(wizardComplete.payload.license?.daysRemaining === 30, 'La demo no quedo con 30 dias.');
    recordStep('Wizard completado con demo', {
      daysRemaining: wizardComplete.payload.license.daysRemaining
    });

    const login = await apiRequest(apiBaseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'admin1234'
      }
    });
    let token = login.payload.token;
    assertCondition(Boolean(token), 'El login admin no devolvio token.');
    recordStep('Login administrador', { role: login.payload.user?.role });

    const recoveryQuestion = await apiRequest(apiBaseUrl, '/api/auth/recovery/question?username=admin');
    assertCondition(recoveryQuestion.payload.question === adminQuestion, 'La pregunta de seguridad no coincide.');
    recordStep('Pregunta de seguridad disponible');

    const machineIdResponse = await apiRequest(apiBaseUrl, '/api/license/machine-id');
    const licenseKey = createLicenseKey({
      machineId: machineIdResponse.payload.machineId,
      businessName: 'OrbitPOS QA Comercial',
      licenseType: 'monthly',
      edition: 'standard',
      versionMinCompatible: packageJson.version
    });
    const activated = await apiRequest(apiBaseUrl, '/api/license/activate', {
      method: 'POST',
      body: {
        licenseKey
      }
    });
    assertCondition(activated.payload.isActive === true, 'La licencia no quedo activa.');
    recordStep('Activacion de licencia mensual', {
      licenseStatus: activated.payload.status,
      edition: activated.payload.edition
    });

    const loginAfterActivation = await apiRequest(apiBaseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'admin1234'
      }
    });
    token = loginAfterActivation.payload.token;
    recordStep('Login luego de activar licencia');

    const productWater = await apiRequest(apiBaseUrl, '/api/products', {
      method: 'POST',
      token,
      body: {
        name: 'Agua QA 1L',
        barcode: 'QA-AGUA-001',
        category: 'Bebidas',
        cost_price: 18,
        sale_price: 35,
        stock: 50,
        min_stock: 5,
        unit: 'unidad',
        weighed: false,
        active: true
      }
    });
    const productBread = await apiRequest(apiBaseUrl, '/api/products', {
      method: 'POST',
      token,
      body: {
        name: 'Pan QA',
        barcode: 'QA-PAN-001',
        category: 'Panaderia',
        cost_price: 12,
        sale_price: 28,
        stock: 40,
        min_stock: 4,
        unit: 'unidad',
        weighed: false,
        active: true
      }
    });
    recordStep('Creacion de productos base', {
      created: [productWater.payload.id, productBread.payload.id]
    });

    const customer = await apiRequest(apiBaseUrl, '/api/customers', {
      method: 'POST',
      token,
      body: {
        name: 'Cliente QA',
        phone: '8095550101',
        rnc: 'QA-RNC-01',
        email: 'qa@example.com',
        address: 'Sucursal QA',
        credit_limit: 5000
      }
    });
    recordStep('Creacion de cliente para credito', { customerId: customer.payload.id });

    const openedCash = await apiRequest(apiBaseUrl, '/api/cash/open', {
      method: 'POST',
      token,
      body: {
        openingAmount: 1500,
        notes: 'QA comercial automatizada'
      }
    });
    assertCondition(openedCash.payload.register?.status === 'open', 'La caja no se abrio.');
    recordStep('Apertura de caja', {
      registerId: openedCash.payload.register?.id
    });

    const cashPreview = await apiRequest(apiBaseUrl, '/api/sales/preview', {
      method: 'POST',
      token,
      body: {
        customerId: null,
        items: [
          { productId: productWater.payload.id, quantity: 2, discount: 0 },
          { productId: productBread.payload.id, quantity: 1, discount: 0 }
        ],
        discount: 0
      }
    });
    assertCondition(Number(cashPreview.payload.total) > 0, 'La vista previa de contado no genero total.');
    recordStep('Preview de venta de contado', { total: cashPreview.payload.total });

    const cashSale = await apiRequest(apiBaseUrl, '/api/sales', {
      method: 'POST',
      token,
      body: {
        customerId: null,
        type: 'cash',
        items: [
          { productId: productWater.payload.id, quantity: 2, discount: 0 },
          { productId: productBread.payload.id, quantity: 1, discount: 0 }
        ],
        payments: [
          { method: 'cash', amount: Number(Number(cashPreview.payload.total).toFixed(2)), reference: '' }
        ],
        discount: 0,
        notes: 'Venta QA contado'
      }
    });
    assertCondition(Boolean(cashSale.payload.sale?.id), 'La venta de contado no se registro.');
    recordStep('Venta de contado registrada', {
      saleId: cashSale.payload.sale.id,
      invoice: cashSale.payload.sale.invoice_number
    });

    const creditPreview = await apiRequest(apiBaseUrl, '/api/sales/preview', {
      method: 'POST',
      token,
      body: {
        customerId: customer.payload.id,
        items: [
          { productId: productBread.payload.id, quantity: 3, discount: 0 }
        ],
        discount: 0
      }
    });
    const initialCreditPayment = Number((Number(creditPreview.payload.total) / 2).toFixed(2));
    const creditSale = await apiRequest(apiBaseUrl, '/api/sales', {
      method: 'POST',
      token,
      body: {
        customerId: customer.payload.id,
        type: 'credit',
        items: [
          { productId: productBread.payload.id, quantity: 3, discount: 0 }
        ],
        payments: [
          { method: 'cash', amount: initialCreditPayment, reference: '' }
        ],
        discount: 0,
        notes: 'Venta QA credito'
      }
    });
    assertCondition(Number(creditSale.payload.sale?.balance || 0) > 0, 'La venta a credito no dejo balance pendiente.');
    recordStep('Venta a credito registrada', {
      saleId: creditSale.payload.sale.id,
      balance: creditSale.payload.sale.balance
    });

    const creditsList = await apiRequest(apiBaseUrl, '/api/credits?q=Cliente QA', { token });
    assertCondition(Array.isArray(creditsList.payload) && creditsList.payload.length > 0, 'No aparecio la venta a credito en cartera.');
    recordStep('Listado de creditos', {
      count: creditsList.payload.length
    });

    const paymentAmount = Number((Number(creditSale.payload.sale.balance) / 2).toFixed(2));
    const paymentResult = await apiRequest(apiBaseUrl, '/api/payments', {
      method: 'POST',
      token,
      body: {
        saleId: creditSale.payload.sale.id,
        splits: [
          { method: 'cash', amount: paymentAmount, reference: '' }
        ],
        notes: 'Abono QA'
      }
    });
    assertCondition(Number(paymentResult.payload.newBalance) < Number(creditSale.payload.sale.balance), 'El abono no redujo el saldo.');
    recordStep('Abono registrado', {
      receiptNumber: paymentResult.payload.receiptNumber,
      newBalance: paymentResult.payload.newBalance
    });

    const returnLookup = await apiRequest(apiBaseUrl, `/api/returns/lookup/${cashSale.payload.sale.id}`, { token });
    const firstReturnItem = returnLookup.payload.items?.[0];
    assertCondition(Boolean(firstReturnItem), 'No se encontraron items para devolver.');
    const returnResult = await apiRequest(apiBaseUrl, '/api/returns', {
      method: 'POST',
      token,
      body: {
        saleId: cashSale.payload.sale.id,
        reason: 'QA devolucion parcial',
        refundMethod: 'cash',
        items: [
          {
            productId: firstReturnItem.product_id,
            quantity: 1,
            restock: true
          }
        ]
      }
    });
    assertCondition(Number(returnResult.payload.refundAmount) > 0, 'La devolucion no genero reembolso.');
    recordStep('Devolucion parcial registrada', {
      returnId: returnResult.payload.returnId,
      refundAmount: returnResult.payload.refundAmount
    });

    const reportResult = await apiRequest(apiBaseUrl, '/api/reports?range=30d', { token });
    assertCondition(Number(reportResult.payload.metrics?.grossSales || 0) > 0, 'El reporte no reflejo ventas.');
    recordStep('Reporte resumido generado', {
      grossSales: reportResult.payload.metrics.grossSales
    });

    const reportPdf = await apiRequest(apiBaseUrl, '/api/reports/pdf?range=30d', { token });
    assertCondition(String(reportPdf.response.headers.get('content-type') || '').includes('application/pdf'), 'El PDF del reporte no devolvio un PDF.');
    recordStep('Reporte PDF generado');

    const backupResult = await apiRequest(apiBaseUrl, '/api/config/backup', {
      method: 'POST',
      token,
      body: {
        destination: backupsDir,
        cloudEnabled: false
      }
    });
    const backupFile = backupResult.payload.path;
    assertCondition(fs.existsSync(backupFile), 'El backup no fue creado.');
    recordStep('Backup completo generado', {
      backupFile
    });

    await apiRequest(apiBaseUrl, '/api/products', {
      method: 'POST',
      token,
      body: {
        name: 'Producto Temporal QA',
        barcode: 'QA-TMP-001',
        category: 'Temporal',
        cost_price: 5,
        sale_price: 10,
        stock: 5,
        min_stock: 1,
        unit: 'unidad',
        weighed: false,
        active: true
      }
    });
    recordStep('Mutacion posterior al backup');

    await apiRequest(apiBaseUrl, '/api/config/backup/restore', {
      method: 'POST',
      token,
      body: {
        backupFile
      }
    });
    const productsAfterRestore = await apiRequest(apiBaseUrl, '/api/products', { token });
    assertCondition(!productsAfterRestore.payload.some((product) => product.name === 'Producto Temporal QA'), 'La restauracion no elimino el producto temporal.');
    recordStep('Restauracion completa del backup', {
      productsAfterRestore: productsAfterRestore.payload.length
    });

    const licenseHistory = await apiRequest(apiBaseUrl, '/api/license/history', { token });
    const diagnostics = await apiRequest(apiBaseUrl, '/api/license/diagnostics', { token });
    assertCondition(Array.isArray(licenseHistory.payload.items), 'No se obtuvo historial de licencia.');
    assertCondition(Boolean(diagnostics.payload.summary), 'No se obtuvo diagnostico de licencia.');
    recordStep('Historial y diagnostico de licencia');

    const recoveryReset = await apiRequest(apiBaseUrl, '/api/auth/recovery/reset', {
      method: 'POST',
      body: {
        username: 'admin',
        answer: 'azul',
        password: 'admin5678'
      }
    });
    assertCondition(recoveryReset.payload.ok === true, 'La recuperacion local no restablecio la contrasena.');
    const loginRecovered = await apiRequest(apiBaseUrl, '/api/auth/login', {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'admin5678'
      }
    });
    token = loginRecovered.payload.token;
    recordStep('Recuperacion local de contrasena validada');

    const currentRegister = await apiRequest(apiBaseUrl, '/api/cash/current', { token });
    const expectedCash = Number(currentRegister.payload.summary?.expectedCash || 0);
    const closeCash = await apiRequest(apiBaseUrl, '/api/cash/close', {
      method: 'POST',
      token,
      body: {
        countedAmount: expectedCash,
        notes: 'Cierre QA exacto'
      }
    });
    assertCondition(closeCash.payload.register?.status === 'closed', 'La caja no se cerro correctamente.');
    recordStep('Cierre de caja', {
      expectedCash
    });

    const notificationSummary = await apiRequest(apiBaseUrl, '/api/notifications?summaryOnly=1', { token });
    recordStep('Resumen de notificaciones', {
      unread: notificationSummary.payload.summary?.unread || 0
    });

    results.status = 'ok';
    return results;
  } catch (error) {
    results.status = 'failed';
    results.failure = {
      message: error.message,
      stack: error.stack
    };
    throw error;
  } finally {
    try {
      if (typeof stopServer === 'function') {
        stopServer();
      }
    } catch (error) {
      // Intentionally ignored during QA cleanup.
    }

    try {
      if (typeof closeDb === 'function') {
        closeDb();
      }
    } catch (error) {
      // Intentionally ignored during QA cleanup.
    }

    writeReports();
  }
}

runCommercialQa()
  .then((results) => {
    console.log(`QA comercial completada correctamente. Reporte: ${results.reportMarkdown}`);
  })
  .catch((error) => {
    console.error(`QA comercial fallo: ${error.message}`);
    process.exitCode = 1;
  });
