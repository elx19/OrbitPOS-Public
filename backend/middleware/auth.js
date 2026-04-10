const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const JWT_SECRET = process.env.ORBITPOS_JWT_SECRET || 'orbitpos-local-jwt-secret';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: '8h'
    }
  );
}

function authenticateToken(request, response, next) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return response.status(401).json({
      message: 'Debes iniciar sesion.'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getDb().prepare(`
      SELECT
        u.id,
        u.name,
        u.username,
        u.role,
        u.active,
        u.branch_id,
        u.created_at,
        b.name AS branch_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.id = ?
    `).get(payload.sub);

    if (!user || !user.active) {
      return response.status(401).json({
        message: 'Tu usuario no esta disponible.'
      });
    }

    const { refreshLicenseState } = require('../license');
    const licenseState = refreshLicenseState();
    if (licenseState.shouldBlock) {
      return response.status(403).json({
        message: licenseState.securityMessage || 'La licencia debe reactivarse antes de continuar.'
      });
    }

    request.user = user;
    next();
  } catch (error) {
    response.status(401).json({
      message: 'Tu sesion ha expirado.'
    });
  }
}

function requireAdmin(request, response, next) {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({
      message: 'Esta accion requiere permisos de administrador.'
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  signToken
};
