const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, createAuditLog } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const securityQuestions = require('../../shared/security-questions.json');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

function normalizeSecurityAnswer(answer = '') {
  return String(answer || '').trim().toLowerCase();
}

function isSupportedSecurityQuestion(question = '') {
  return securityQuestions.includes(String(question || '').trim());
}

function parseBranchId(branchId) {
  const value = Number(branchId);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function ensureValidRole(role) {
  if (!['admin', 'cashier'].includes(role)) {
    throw new Error('El rol indicado no es valido.');
  }
}

function ensureBranchExists(branchId) {
  if (!branchId) {
    return null;
  }

  const branch = getDb().prepare(`
    SELECT id, name, active
    FROM branches
    WHERE id = ?
  `).get(branchId);

  if (!branch) {
    throw new Error('La sucursal indicada no existe.');
  }

  return branch;
}

function getUserById(id) {
  return getDb().prepare(`
    SELECT
      u.id,
      u.name,
      u.username,
      u.role,
      u.active,
      u.branch_id,
      u.security_question,
      u.created_at,
      CASE
        WHEN u.security_question IS NOT NULL AND TRIM(u.security_question) != '' THEN 1
        ELSE 0
      END AS has_security_question,
      b.name AS branch_name
    FROM users u
    LEFT JOIN branches b ON b.id = u.branch_id
    WHERE u.id = ?
  `).get(id);
}

function countOtherActiveAdmins(excludedUserId) {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS total
    FROM users
    WHERE role = 'admin'
      AND active = 1
      AND id != ?
  `).get(excludedUserId);

  return Number(row?.total || 0);
}

function guardAdminContinuity({ existingUser, nextRole, nextActive, actorUserId }) {
  const removingAdminAccess = existingUser.role === 'admin' && (nextRole !== 'admin' || !nextActive);
  if (!removingAdminAccess) {
    return;
  }

  if (Number(existingUser.id) === Number(actorUserId)) {
    throw new Error('No puedes quitarte tus propios permisos de administrador desde esta pantalla.');
  }

  if (countOtherActiveAdmins(existingUser.id) <= 0) {
    throw new Error('Debe existir al menos un administrador activo.');
  }
}

function resolveSecurityFields({
  question,
  answer,
  existingQuestion = null,
  existingAnswer = null,
  requireOnCreate = false
}) {
  const questionProvided = question !== undefined;
  const answerProvided = answer !== undefined;
  const trimmedQuestion = questionProvided ? String(question || '').trim() : undefined;
  const trimmedAnswer = answerProvided ? String(answer || '').trim() : undefined;

  if (requireOnCreate) {
    if (!trimmedQuestion || !trimmedAnswer) {
      throw new Error('La pregunta y respuesta de seguridad son obligatorias.');
    }
    if (!isSupportedSecurityQuestion(trimmedQuestion)) {
      throw new Error('La pregunta de seguridad debe elegirse de la lista precargada.');
    }

    return {
      securityQuestion: trimmedQuestion,
      securityAnswer: bcrypt.hashSync(normalizeSecurityAnswer(trimmedAnswer), 12)
    };
  }

  if (!questionProvided && !answerProvided) {
    return {
      securityQuestion: existingQuestion,
      securityAnswer: existingAnswer
    };
  }

  if (questionProvided && answerProvided && !trimmedQuestion && !trimmedAnswer) {
    return {
      securityQuestion: null,
      securityAnswer: null
    };
  }

  if (trimmedAnswer) {
    const nextQuestion = trimmedQuestion || existingQuestion;
    if (!nextQuestion) {
      throw new Error('Debes indicar una pregunta de seguridad.');
    }
    if (!isSupportedSecurityQuestion(nextQuestion) && nextQuestion !== existingQuestion) {
      throw new Error('La pregunta de seguridad debe elegirse de la lista precargada.');
    }

    return {
      securityQuestion: nextQuestion,
      securityAnswer: bcrypt.hashSync(normalizeSecurityAnswer(trimmedAnswer), 12)
    };
  }

  if (questionProvided) {
    if (!trimmedQuestion) {
      if (existingAnswer) {
        throw new Error('No puedes dejar vacia la pregunta mientras exista recuperacion configurada.');
      }

      return {
        securityQuestion: null,
        securityAnswer: null
      };
    }

    if (!existingAnswer) {
      throw new Error('Debes indicar tambien la respuesta para configurar la recuperacion.');
    }
    if (!isSupportedSecurityQuestion(trimmedQuestion) && trimmedQuestion !== existingQuestion) {
      throw new Error('La pregunta de seguridad debe elegirse de la lista precargada.');
    }

    return {
      securityQuestion: trimmedQuestion,
      securityAnswer: existingAnswer
    };
  }

  return {
    securityQuestion: existingQuestion,
    securityAnswer: existingAnswer
  };
}

router.get('/', (request, response) => {
  const users = getDb().prepare(`
    SELECT
      u.id,
      u.name,
      u.username,
      u.role,
      u.active,
      u.branch_id,
      u.security_question,
      u.created_at,
      CASE
        WHEN u.security_question IS NOT NULL AND TRIM(u.security_question) != '' THEN 1
        ELSE 0
      END AS has_security_question,
      b.name AS branch_name
    FROM users u
    LEFT JOIN branches b ON b.id = u.branch_id
    ORDER BY u.created_at DESC
  `).all();

  response.json(users);
});

router.post('/', (request, response) => {
  const {
    name,
    username,
    password,
    role = 'cashier',
    branchId,
    securityQuestion,
    securityAnswer
  } = request.body || {};
  if (!name || !username || !password) {
    return response.status(400).json({
      message: 'Nombre, usuario y contrasena son obligatorios.'
    });
  }

  try {
    ensureValidRole(role);
    const resolvedBranchId = parseBranchId(branchId);
    ensureBranchExists(resolvedBranchId);
    const securityFields = resolveSecurityFields({
      question: securityQuestion,
      answer: securityAnswer,
      requireOnCreate: true
    });

    const result = getDb().prepare(`
      INSERT INTO users (name, username, password, role, active, branch_id, security_question, security_answer)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      name,
      username,
      bcrypt.hashSync(password, 12),
      role,
      resolvedBranchId,
      securityFields.securityQuestion,
      securityFields.securityAnswer
    );

    createAuditLog({
      userId: request.user.id,
      action: 'create',
      tableName: 'users',
      recordId: result.lastInsertRowid,
      newValue: {
        name,
        username,
        role,
        branchId: resolvedBranchId,
        securityQuestion: securityFields.securityQuestion
      }
    });

    response.status(201).json(getUserById(result.lastInsertRowid));
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible crear el usuario.'
    });
  }
});

router.put('/:id', (request, response) => {
  const { id } = request.params;
  const existingUser = getDb().prepare(`
    SELECT *
    FROM users
    WHERE id = ?
  `).get(id);

  if (!existingUser) {
    return response.status(404).json({
      message: 'Usuario no encontrado.'
    });
  }

  try {
    const { name, role, active, branchId, securityQuestion, securityAnswer } = request.body || {};
    const nextRole = role || existingUser.role;
    const nextActive = active === undefined ? Boolean(existingUser.active) : Boolean(active);
    const resolvedBranchId = branchId === undefined ? existingUser.branch_id : parseBranchId(branchId);
    const securityFields = resolveSecurityFields({
      question: securityQuestion,
      answer: securityAnswer,
      existingQuestion: existingUser.security_question,
      existingAnswer: existingUser.security_answer
    });

    ensureValidRole(nextRole);
    ensureBranchExists(resolvedBranchId);
    guardAdminContinuity({
      existingUser,
      nextRole,
      nextActive,
      actorUserId: request.user.id
    });

    getDb().prepare(`
      UPDATE users
      SET name = ?,
          role = ?,
          active = ?,
          branch_id = ?,
          security_question = ?,
          security_answer = ?
      WHERE id = ?
    `).run(
      name || existingUser.name,
      nextRole,
      nextActive ? 1 : 0,
      resolvedBranchId,
      securityFields.securityQuestion,
      securityFields.securityAnswer,
      id
    );

    createAuditLog({
      userId: request.user.id,
      action: 'update',
      tableName: 'users',
      recordId: id,
      oldValue: existingUser,
      newValue: {
        name: name || existingUser.name,
        role: nextRole,
        active: nextActive ? 1 : 0,
        branchId: resolvedBranchId,
        securityQuestion: securityFields.securityQuestion
      }
    });

    response.json(getUserById(id));
  } catch (error) {
    response.status(400).json({
      message: error.message || 'No fue posible actualizar el usuario.'
    });
  }
});

router.patch('/:id/password', (request, response) => {
  const { id } = request.params;
  const { password } = request.body || {};
  if (!password) {
    return response.status(400).json({
      message: 'Debes indicar una contrasena.'
    });
  }

  getDb().prepare(`
    UPDATE users
    SET password = ?
    WHERE id = ?
  `).run(bcrypt.hashSync(password, 12), id);

  createAuditLog({
    userId: request.user.id,
    action: 'change_password',
    tableName: 'users',
    recordId: id
  });

  response.json({ ok: true });
});

module.exports = router;
