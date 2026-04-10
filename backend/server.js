const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const { refreshLicenseState, createLicenseRouter } = require('./license');
const { createWizardRouter } = require('./wizard');
const { getUpdaterStatus } = require('./updater');

initDatabase();
refreshLicenseState();

const app = express();
const PORT = Number(process.env.PORT || 3030);
let serverInstance = null;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (request, response) => {
  response.json({
    ok: true,
    service: 'OrbitPOS API',
    version: '2.0.0'
  });
});

app.get('/api/meta', (request, response) => {
  response.json({
    name: 'OrbitPOS',
    version: '2.0.0',
    updater: getUpdaterStatus()
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/license', createLicenseRouter());
app.use('/api/wizard', createWizardRouter());
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/config', require('./routes/config'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/help', require('./routes/help'));

app.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  response.status(500).json({
    message: error.message || 'Ha ocurrido un error inesperado.'
  });
});

if (require.main === module) {
  startServer(PORT);
}

function startServer(port = PORT) {
  if (serverInstance) {
    return serverInstance;
  }

  serverInstance = app.listen(port, () => {
    console.log(`OrbitPOS backend listo en http://localhost:${port}`);
  });

  return serverInstance;
}

function stopServer() {
  if (!serverInstance) {
    return;
  }

  serverInstance.close();
  serverInstance = null;
}

module.exports = {
  app,
  startServer,
  stopServer
};
