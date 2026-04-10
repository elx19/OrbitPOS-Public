const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, getConfigEntries, setConfigEntries, createAuditLog } = require('./database');
const { startDemo, activateLicenseKey, getMachineId, refreshLicenseState } = require('./license');
const { listPrinters, testPrinter, autoDetectPrinter } = require('./helpers/printer');
const { listSerialPorts, testScannerConnection, autoDetectScanner } = require('./helpers/barcode');
const { testScaleConnection, autoDetectScale } = require('./helpers/scale');
const securityQuestions = require('../shared/security-questions.json');

function mapWizardConfig(config, adminUser = null) {
  return {
    business: {
      name: config.business_name || '',
      rnc: config.business_rnc || '',
      phone: config.business_phone || '',
      address: config.business_address || '',
      logo: config.business_logo || '',
      currency: config.business_currency || 'DOP'
    },
    printer: {
      name: config.printer_name || '',
      port: config.printer_port || ''
    },
    scanner: {
      port: config.scanner_port || '',
      baudRate: Number(config.scanner_baud_rate || 9600)
    },
    scale: {
      enabled: config.scale_enabled === '1',
      port: config.scale_port || '',
      baudRate: Number(config.scale_baud_rate || 9600)
    },
    admin: {
      username: 'admin',
      name: adminUser?.name || 'Administrador',
      securityQuestion: adminUser?.security_question || ''
    },
    wizardCompleted: config.wizard_completed === '1'
  };
}

function flattenWizardPayload(payload) {
  return {
    business_name: payload.business?.name || '',
    business_rnc: payload.business?.rnc || '',
    business_phone: payload.business?.phone || '',
    business_address: payload.business?.address || '',
    business_logo: payload.business?.logo || '',
    business_currency: payload.business?.currency || 'DOP',
    printer_name: payload.printer?.name || '',
    printer_port: payload.printer?.port || '',
    scanner_port: payload.scanner?.port || '',
    scanner_baud_rate: String(payload.scanner?.baudRate || 9600),
    scale_enabled: payload.scale?.enabled ? '1' : '0',
    scale_port: payload.scale?.port || '',
    scale_baud_rate: String(payload.scale?.baudRate || 9600)
  };
}

function createWizardRouter() {
  const router = express.Router();

  router.get('/status', async (request, response) => {
    const config = getConfigEntries();
    const adminUser = getDb().prepare(`
      SELECT name, security_question
      FROM users
      WHERE username = 'admin'
      LIMIT 1
    `).get();
    const [printers, serialPorts] = await Promise.all([
      listPrinters(),
      listSerialPorts()
    ]);
    response.json({
      machineId: getMachineId(),
      printers,
      serialPorts,
      config: mapWizardConfig(config, adminUser),
      license: refreshLicenseState()
    });
  });

  router.post('/detect-printer', async (request, response) => {
    try {
      response.json(await autoDetectPrinter());
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  router.post('/detect-scanner', async (request, response) => {
    try {
      response.json(await autoDetectScanner({
        baudRate: request.body?.baudRate || 9600
      }));
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  router.post('/detect-scale', async (request, response) => {
    try {
      response.json(await autoDetectScale({
        baudRate: request.body?.baudRate || 9600
      }));
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  router.post('/save-step', (request, response) => {
    const { payload } = request.body || {};
    if (!payload) {
      return response.status(400).json({
        message: 'No se recibio informacion del wizard.'
      });
    }

    setConfigEntries(flattenWizardPayload(payload));
    response.json({ ok: true });
  });

  router.post('/test-printer', async (request, response) => {
    try {
      const { printerName, businessName } = request.body || {};
      const result = await testPrinter(printerName, businessName);
      response.json(result);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  router.post('/test-scanner', async (request, response) => {
    try {
      const result = await testScannerConnection(request.body || {});
      response.json(result);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  router.post('/test-scale', async (request, response) => {
    try {
      const result = await testScaleConnection(request.body || {});
      response.json(result);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  });

  router.post('/complete', (request, response) => {
    try {
      const { business, printer, scanner, scale, admin, licenseKey } = request.body || {};
      if (!admin?.password || String(admin.password).trim().length < 4) {
        throw new Error('La contrasena inicial del administrador debe tener al menos 4 caracteres.');
      }
      if (!String(admin.securityQuestion || '').trim() || !String(admin.securityAnswer || '').trim()) {
        throw new Error('Debes configurar pregunta y respuesta de seguridad para el administrador.');
      }
      if (!securityQuestions.includes(String(admin.securityQuestion || '').trim())) {
        throw new Error('La pregunta de seguridad debe elegirse de la lista precargada.');
      }

      const configPayload = flattenWizardPayload({ business, printer, scanner, scale });
      configPayload.wizard_completed = '1';

      setConfigEntries(configPayload);

      if (admin?.password) {
        getDb().prepare(`
          UPDATE users
          SET name = ?,
              password = ?,
              security_question = ?,
              security_answer = ?
          WHERE username = 'admin'
        `).run(
          admin.name || 'Administrador',
          bcrypt.hashSync(admin.password, 12),
          String(admin.securityQuestion || '').trim() || null,
          admin.securityAnswer
            ? bcrypt.hashSync(String(admin.securityAnswer || '').trim().toLowerCase(), 12)
            : null
        );
      }

      const summary = licenseKey
        ? activateLicenseKey(licenseKey)
        : startDemo(business?.name || 'Mi Negocio');

      createAuditLog({
        action: 'wizard_completed',
        tableName: 'config',
        newValue: {
          business,
          printer,
          scanner,
          scale
        }
      });

      response.json({
        ok: true,
        license: summary
      });
    } catch (error) {
      response.status(400).json({
        message: error.message
      });
    }
  });

  router.post('/reconfigure', (request, response) => {
    setConfigEntries({ wizard_completed: '0' });
    response.json({ ok: true });
  });

  return router;
}

module.exports = {
  createWizardRouter
};
