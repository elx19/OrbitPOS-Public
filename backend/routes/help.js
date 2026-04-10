const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const MANUAL_PATH = path.join(__dirname, '..', '..', 'assets', 'manuals', 'OrbitPOS_Manual_Usuario.pdf');

router.use(authenticateToken);

router.get('/manual', (request, response) => {
  if (!fs.existsSync(MANUAL_PATH)) {
    return response.status(404).json({
      message: 'El manual de usuario aun no esta disponible.'
    });
  }

  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'inline; filename="OrbitPOS_Manual_Usuario.pdf"');
  response.sendFile(MANUAL_PATH);
});

router.get('/resources', (request, response) => {
  response.json({
    manualAvailable: fs.existsSync(MANUAL_PATH),
    supportEmail: 'jrr6867@gmail.com',
    supportWhatsapp: '+1 (809) 404-2070'
  });
});

module.exports = router;
