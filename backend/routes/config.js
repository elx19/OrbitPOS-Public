const express = require('express');
const { createAuditLog, getConfigEntries, setConfigEntries, getDb } = require('../database');
const { createBackup, restoreBackup } = require('../helpers/backup');
const {
  getConfiguredPrintTemplateSnapshot,
  getPrintTemplateMeta,
  buildPrintTemplatePreview
} = require('../helpers/receipt');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', (request, response) => {
  const entries = getConfigEntries();

  if (request.user?.role !== 'admin') {
    delete entries.backup_cloud_token;
  }

  response.json(entries);
});

router.put('/', requireAdmin, (request, response) => {
  setConfigEntries(request.body || {});
  response.json({
    ok: true
  });
});

router.post('/backup', requireAdmin, async (request, response) => {
  try {
    const result = await createBackup({
      destination: request.body?.destination,
      cloudEnabled: request.body?.cloudEnabled,
      provider: request.body?.provider,
      token: request.body?.token,
      folder: request.body?.folder
    });

    const message = result.cloud
      ? `Backup completado: local + nube (${result.cloud.provider}).`
      : result.cloudError
        ? `Backup local completado, pero fallo la nube: ${result.cloudError}`
        : 'Backup local completado correctamente.';

    getDb().prepare(`
      INSERT INTO notifications (type, message)
      VALUES ('system', ?)
    `).run(message);

    response.json({
      ok: true,
      ...result
    });
  } catch (error) {
    getDb().prepare(`
      INSERT INTO notifications (type, message)
      VALUES ('system', ?)
    `).run(`Fallo de backup: ${error.message}`);

    response.status(400).json({
      message: error.message || 'No fue posible completar el backup.'
    });
  }
});

router.post('/backup/restore', requireAdmin, (request, response) => {
  try {
    const result = restoreBackup(request.body?.backupFile);
    const message = `Restauracion completada desde ${result.restoredFrom}.`;

    getDb().prepare(`
      INSERT INTO notifications (type, message)
      VALUES ('system', ?)
    `).run(message);

    response.json({
      ok: true,
      ...result,
      message
    });
  } catch (error) {
    try {
      getDb().prepare(`
        INSERT INTO notifications (type, message)
        VALUES ('system', ?)
      `).run(`Fallo de restauracion: ${error.message}`);
    } catch (notificationError) {
      // Ignora fallos secundarios al registrar la notificacion.
    }

    response.status(400).json({
      message: error.message || 'No fue posible restaurar el backup.'
    });
  }
});

router.get('/print-templates', requireAdmin, (request, response) => {
  response.json({
    ...getPrintTemplateMeta(),
    templates: getConfiguredPrintTemplateSnapshot()
  });
});

router.put('/print-templates', requireAdmin, (request, response) => {
  const templates = request.body?.templates || {};
  const meta = getPrintTemplateMeta();
  const allowedDocuments = new Set(meta.documents.map((document) => document.key));
  const allowedVariants = new Set(meta.variants.map((variant) => variant.value));
  const entries = {};
  const previousTemplates = getConfiguredPrintTemplateSnapshot();

  Object.entries(templates).forEach(([documentKey, value]) => {
    if (!allowedDocuments.has(documentKey)) {
      return;
    }

    const variant = String(value?.variant || 'classic').trim().toLowerCase();
    entries[`print_template_${documentKey}_variant`] = allowedVariants.has(variant) ? variant : 'classic';
    entries[`print_template_${documentKey}_custom`] = String(value?.customTemplate || '');
  });

  setConfigEntries(entries);

  createAuditLog({
    userId: request.user?.id || null,
    action: 'update_print_templates',
    tableName: 'config',
    oldValue: previousTemplates,
    newValue: templates
  });

  response.json({
    ok: true,
    ...meta,
    templates: getConfiguredPrintTemplateSnapshot()
  });
});

router.post('/print-templates/preview', requireAdmin, (request, response) => {
  try {
    const preview = buildPrintTemplatePreview(request.body?.documentKey, {
      variant: request.body?.variant,
      customTemplate: request.body?.customTemplate
    });

    response.json(preview);
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible generar la vista previa de la plantilla.'
    });
  }
});

module.exports = router;
