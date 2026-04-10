const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { buildReportData, buildReportPdf } = require('../services/reports');

const router = express.Router();

router.use(authenticateToken);

router.get('/pdf', async (request, response) => {
  try {
    const { buffer, report } = await buildReportPdf(request.query || {});
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="orbitpos-report-${report.range.dateFrom}-${report.range.dateTo}.pdf"`
    );
    response.send(buffer);
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible generar el reporte PDF.'
    });
  }
});

router.get('/', (request, response) => {
  try {
    response.json(buildReportData(request.query || {}));
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible generar el reporte.'
    });
  }
});

module.exports = router;
