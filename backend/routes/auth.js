const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, getConfigValue, createAuditLog } = require('../database');
const { authenticateToken, signToken } = require('../middleware/auth');
const { refreshLicenseState } = require('../license');

const router = express.Router();

function normalizeRecoveryAnswer(answer = '') {
  return String(answer || '').trim().toLowerCase();
}

router.post('/login', (request, response) => {
  const { username, password } = request.body || {};
  const licenseState = refreshLicenseState();

  if (licenseState.shouldBlock) {
    return response.status(403).json({
      message: licenseState.securityMessage || 'La licencia debe reactivarse antes de iniciar sesion.'
    });
  }

  const user = getDb().prepare(`
    SELECT
      u.*,
      b.name AS branch_name
    FROM users u
    LEFT JOIN branches b ON b.id = u.branch_id
    WHERE u.username = ?
  `).get(username);

  if (!user || !user.active || !bcrypt.compareSync(password || '', user.password)) {
    return response.status(401).json({
      message: 'Usuario o contrasena incorrectos.'
    });
  }

  const token = signToken(user);
  response.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id || null,
      branch_name: user.branch_name || null
    },
    license: licenseState,
    wizardCompleted: getConfigValue('wizard_completed', '0') === '1'
  });
});

router.get('/me', authenticateToken, (request, response) => {
  response.json({
    user: request.user,
    wizardCompleted: getConfigValue('wizard_completed', '0') === '1'
  });
});

router.get('/recovery/question', (request, response) => {
  const username = String(request.query.username || '').trim();
  if (!username) {
    return response.status(400).json({
      message: 'Indica el usuario para buscar su pregunta de seguridad.'
    });
  }

  const user = getDb().prepare(`
    SELECT id, name, username, active, security_question
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user || !user.active || !user.security_question) {
    return response.status(404).json({
      message: 'Ese usuario no tiene recuperacion local configurada.'
    });
  }

  response.json({
    username: user.username,
    name: user.name,
    question: user.security_question
  });
});

router.post('/recovery/reset', (request, response) => {
  const { username, answer, password } = request.body || {};

  if (!username || !answer || !password) {
    return response.status(400).json({
      message: 'Usuario, respuesta y nueva contrasena son obligatorios.'
    });
  }

  if (String(password).trim().length < 4) {
    return response.status(400).json({
      message: 'La nueva contrasena debe tener al menos 4 caracteres.'
    });
  }

  const user = getDb().prepare(`
    SELECT id, name, username, active, security_question, security_answer
    FROM users
    WHERE username = ?
  `).get(String(username).trim());

  if (!user || !user.active || !user.security_question || !user.security_answer) {
    return response.status(404).json({
      message: 'Ese usuario no tiene recuperacion local configurada.'
    });
  }

  const answerIsValid = bcrypt.compareSync(normalizeRecoveryAnswer(answer), user.security_answer);
  if (!answerIsValid) {
    return response.status(400).json({
      message: 'La respuesta de seguridad no coincide.'
    });
  }

  getDb().prepare(`
    UPDATE users
    SET password = ?
    WHERE id = ?
  `).run(bcrypt.hashSync(password, 12), user.id);

  createAuditLog({
    action: 'recover_password',
    tableName: 'users',
    recordId: user.id,
    newValue: {
      username: user.username
    }
  });

  response.json({
    ok: true,
    message: 'Contrasena restablecida correctamente.'
  });
});

module.exports = router;
