const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const LICENSE_PREFIX = 'ORB2';
const MODERN_LICENSE_PREFIX = 'ORB3';
const LICENSE_PREFIXES = [LICENSE_PREFIX, MODERN_LICENSE_PREFIX];
const MODERN_LICENSE_ALGORITHM = 'ed25519';
const LICENSE_SCHEMA_VERSION = 2;
const MIN_LICENSE_SECRET_LENGTH = 32;
const MAX_LICENSE_KEY_LENGTH = 32 * 1024;
const LICENSE_PUBLIC_KEY_PATH = path.join(__dirname, 'license-public-key.pem');
const LICENSE_DAYS_BY_TYPE = {
  demo: 30,
  monthly: 30,
  trimestral: 90,
  annual: 365,
  permanent: null
};

function getLicenseSecret() {
  const secret = String(process.env.ORBITPOS_LICENSE_SECRET || '').trim();

  if (!secret) {
    throw new Error('ORBITPOS_LICENSE_SECRET no esta configurado. La activacion comercial y la validacion de licencias firmadas requieren una clave privada fuera del repositorio publico.');
  }

  if (secret.length < MIN_LICENSE_SECRET_LENGTH) {
    throw new Error(`ORBITPOS_LICENSE_SECRET debe tener al menos ${MIN_LICENSE_SECRET_LENGTH} caracteres.`);
  }

  return secret;
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(`enc:${getLicenseSecret()}`).digest();
}

function getHmacKey() {
  return crypto.createHash('sha256').update(`hmac:${getLicenseSecret()}`).digest();
}

function getLicensePublicKey() {
  const configuredKey = String(process.env.ORBITPOS_LICENSE_PUBLIC_KEY || '').trim();
  if (configuredKey) {
    return configuredKey.replace(/\\n/g, '\n');
  }

  try {
    return fs.readFileSync(LICENSE_PUBLIC_KEY_PATH, 'utf8').trim();
  } catch (error) {
    throw new Error('No se encontro la clave publica de licencias de OrbitPOS.');
  }
}

function getPublicKeyFingerprint(publicKeyInput) {
  const publicKey = publicKeyInput?.type === 'public'
    ? publicKeyInput
    : crypto.createPublicKey(publicKeyInput);
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return `sha256:${crypto.createHash('sha256').update(der).digest('hex')}`;
}

function getPrivateKeyPublicKeyFingerprint(privateKeyInput) {
  const privateKey = privateKeyInput?.type === 'private'
    ? privateKeyInput
    : crypto.createPrivateKey(privateKeyInput);
  return getPublicKeyFingerprint(crypto.createPublicKey(privateKey));
}

function isLicenseKey(licenseKey) {
  const normalized = String(licenseKey || '').trim();
  return LICENSE_PREFIXES.some((prefix) => normalized.startsWith(`${prefix}.`));
}

function buildLicenseSerial() {
  return `JR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalizeLicenseType(licenseType = 'monthly') {
  const normalized = String(licenseType).trim().toLowerCase();
  return LICENSE_DAYS_BY_TYPE[normalized] === undefined ? 'monthly' : normalized;
}

function assertLicenseType(licenseType) {
  const normalized = String(licenseType || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(LICENSE_DAYS_BY_TYPE, normalized)) {
    throw new Error(`Tipo de licencia no valido: ${licenseType}. Usa demo, monthly, trimestral, annual o permanent.`);
  }
  return normalized;
}

function requireText(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`El campo ${fieldName} es obligatorio.`);
  }
  return normalized;
}

function normalizeDate(value, fieldName, { nullable = true } = {}) {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    throw new Error(`El campo ${fieldName} es obligatorio.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`El campo ${fieldName} no contiene una fecha valida.`);
  }
  return date.toISOString();
}

function compareVersions(leftVersion = '0.0.0', rightVersion = '0.0.0') {
  const normalize = (version) => String(version).trim().replace(/^v/i, '').split('-')[0].split('.').map((part) => {
    const parsed = Number(part);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const leftParts = normalize(leftVersion);
  const rightParts = normalize(rightVersion);
  const totalParts = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < totalParts; index += 1) {
    const left = leftParts[index] || 0;
    const right = rightParts[index] || 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function calculateExpiration(licenseType, startDate = new Date()) {
  const normalizedType = normalizeLicenseType(licenseType);
  const days = LICENSE_DAYS_BY_TYPE[normalizedType];
  if (days === null) {
    return null;
  }

  const expiration = new Date(startDate);
  expiration.setDate(expiration.getDate() + days);
  expiration.setHours(23, 59, 59, 999);
  return expiration.toISOString();
}

function normalizeLicensePayload(payload) {
  const schema = Number(payload.schema || 1);
  if (schema !== LICENSE_SCHEMA_VERSION) {
    throw new Error(`Esquema de licencia no soportado: ${schema}.`);
  }

  const normalizedLicenseType = assertLicenseType(payload.licenseType);
  const normalizedIssuedAt = payload.issuedAt ? normalizeDate(payload.issuedAt, 'issuedAt', { nullable: false }) : null;
  const normalizedExpiresAt = normalizeDate(payload.expiresAt, 'expiresAt');
  if (!normalizedIssuedAt) {
    throw new Error('La licencia debe incluir una fecha de emision.');
  }
  if (normalizedLicenseType !== 'permanent' && !normalizedExpiresAt) {
    throw new Error('Las licencias con duracion deben incluir una fecha de expiracion.');
  }
  if (normalizedIssuedAt && normalizedExpiresAt && new Date(normalizedExpiresAt) < new Date(normalizedIssuedAt)) {
    throw new Error('La fecha de expiracion no puede ser anterior a la emision.');
  }

  return {
    ...payload,
    schema,
    machineId: requireText(payload.machineId, 'machineId'),
    businessName: requireText(payload.businessName, 'businessName'),
    licenseType: normalizedLicenseType,
    issuedAt: normalizedIssuedAt,
    expiresAt: normalizedExpiresAt,
    edition: String(payload.edition || 'standard').trim().toLowerCase(),
    versionMinCompatible: payload.versionMinCompatible || payload.version || packageJson.version,
    serial: String(payload.serial || '').trim() || 'SIN-SERIAL'
  };
}

function createModernLicenseKey(payload, signingKey) {
  const payloadBuffer = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, payloadBuffer, signingKey);
  const envelope = {
    alg: MODERN_LICENSE_ALGORITHM,
    payload: payloadBuffer.toString('base64url'),
    sig: signature.toString('base64url')
  };
  return `${MODERN_LICENSE_PREFIX}.${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')}`;
}

function createLicenseKey({
  machineId,
  businessName,
  licenseType,
  expiresAt,
  edition = 'standard',
  versionMinCompatible = packageJson.version,
  serial = buildLicenseSerial(),
  issuedAt = new Date().toISOString(),
  signingKey = null
}) {
  const normalizedMachineId = requireText(machineId, 'machineId');
  const normalizedBusinessName = requireText(businessName, 'businessName');
  const normalizedLicenseType = assertLicenseType(licenseType);
  const normalizedEdition = requireText(edition || 'standard', 'edition').toLowerCase();
  const normalizedIssuedAt = normalizeDate(issuedAt, 'issuedAt', { nullable: false });
  const normalizedExpiresAt = normalizeDate(expiresAt || calculateExpiration(normalizedLicenseType, normalizedIssuedAt), 'expiresAt');
  if (normalizedIssuedAt && normalizedExpiresAt && new Date(normalizedExpiresAt) < new Date(normalizedIssuedAt)) {
    throw new Error('La fecha de expiracion no puede ser anterior a la emision.');
  }
  const payload = {
    schema: LICENSE_SCHEMA_VERSION,
    machineId: normalizedMachineId,
    businessName: normalizedBusinessName,
    licenseType: normalizedLicenseType,
    expiresAt: normalizedExpiresAt,
    issuedAt: normalizedIssuedAt,
    version: packageJson.version,
    versionMinCompatible: requireText(versionMinCompatible || packageJson.version, 'versionMinCompatible'),
    edition: normalizedEdition,
    serial: String(serial || buildLicenseSerial()).trim()
  };

  if (signingKey) {
    return createModernLicenseKey(payload, signingKey);
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const signature = crypto
    .createHmac('sha256', getHmacKey())
    .update(iv)
    .update(encrypted)
    .digest();

  const envelope = {
    iv: iv.toString('base64url'),
    data: encrypted.toString('base64url'),
    sig: signature.toString('base64url')
  };

  return `${LICENSE_PREFIX}.${Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')}`;
}

function decodeModernLicenseKey(licenseKey) {
  const parts = licenseKey.split('.');
  if (parts.length !== 2 || !parts[1]) {
    throw new Error('La licencia no tiene un formato valido.');
  }

  const envelope = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (!envelope || envelope.alg !== MODERN_LICENSE_ALGORITHM || !envelope.payload || !envelope.sig) {
    throw new Error('El sobre de la licencia ORB3 esta incompleto.');
  }

  const payloadBuffer = Buffer.from(envelope.payload, 'base64url');
  const signature = Buffer.from(envelope.sig, 'base64url');
  if (!payloadBuffer.length || signature.length !== 64) {
    throw new Error('El sobre de la licencia ORB3 tiene longitudes invalidas.');
  }

  const validSignature = crypto.verify(
    null,
    payloadBuffer,
    crypto.createPublicKey(getLicensePublicKey()),
    signature
  );
  if (!validSignature) {
    throw new Error('La firma de la licencia no es valida.');
  }

  return normalizeLicensePayload(JSON.parse(payloadBuffer.toString('utf8')));
}

function decodeLicenseKey(licenseKey) {
  try {
    const normalizedLicenseKey = typeof licenseKey === 'string' ? licenseKey.trim() : '';
    if (!normalizedLicenseKey || normalizedLicenseKey.length > MAX_LICENSE_KEY_LENGTH || !isLicenseKey(normalizedLicenseKey)) {
      throw new Error('La licencia no tiene un formato valido.');
    }

    if (normalizedLicenseKey.startsWith(`${MODERN_LICENSE_PREFIX}.`)) {
      return decodeModernLicenseKey(normalizedLicenseKey);
    }

    const parts = normalizedLicenseKey.split('.');
    if (parts.length !== 2 || !parts[1]) {
      throw new Error('La licencia no tiene un formato valido.');
    }

    const envelope = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!envelope || typeof envelope !== 'object' || !envelope.iv || !envelope.data || !envelope.sig) {
      throw new Error('El sobre de la licencia esta incompleto.');
    }

    const iv = Buffer.from(envelope.iv, 'base64url');
    const encrypted = Buffer.from(envelope.data, 'base64url');
    const providedSignature = Buffer.from(envelope.sig, 'base64url');
    if (iv.length !== 16 || encrypted.length === 0 || providedSignature.length !== 32) {
      throw new Error('El sobre de la licencia tiene longitudes invalidas.');
    }

    const expectedSignature = crypto
      .createHmac('sha256', getHmacKey())
      .update(iv)
      .update(encrypted)
      .digest();

    if (!crypto.timingSafeEqual(providedSignature, expectedSignature)) {
      throw new Error('La firma de la licencia no es valida.');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return normalizeLicensePayload(JSON.parse(decrypted.toString('utf8')));
  } catch (error) {
    if (error.message === 'La firma de la licencia no es valida.' || error.message === 'La licencia no tiene un formato valido.') {
      throw error;
    }
    throw new Error(`La licencia no pudo validarse: ${error.message}`);
  }
}

function verifyLicensePayload(payload, { machineId = null, appVersion = packageJson.version, now = new Date() } = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('La licencia no contiene un payload valido.');
  }

  const currentDate = new Date(now);
  if (Number.isNaN(currentDate.getTime())) {
    throw new Error('La fecha de verificacion no es valida.');
  }

  const expiresDate = payload.expiresAt ? new Date(payload.expiresAt) : null;
  const issuedDate = payload.issuedAt ? new Date(payload.issuedAt) : null;
  if (expiresDate && Number.isNaN(expiresDate.getTime())) {
    throw new Error('La fecha de expiracion no es valida.');
  }
  if (issuedDate && Number.isNaN(issuedDate.getTime())) {
    throw new Error('La fecha de emision no es valida.');
  }
  if (issuedDate && expiresDate && expiresDate < issuedDate) {
    throw new Error('La fecha de expiracion no puede ser anterior a la emision.');
  }
  const expired = Boolean(expiresDate && expiresDate.getTime() <= currentDate.getTime());
  const notYetIssued = Boolean(issuedDate && issuedDate.getTime() > currentDate.getTime());
  const machineMatches = machineId ? String(payload.machineId) === String(machineId) : null;
  const versionCompatible = payload.versionMinCompatible
    ? compareVersions(appVersion, payload.versionMinCompatible) >= 0
    : true;
  const daysRemaining = expiresDate && !expired
    ? Math.max(0, Math.ceil((expiresDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)))
    : expiresDate ? 0 : null;

  return {
    valid: !expired && !notYetIssued && machineMatches !== false && versionCompatible,
    cryptographicallyValid: true,
    expired,
    notYetIssued,
    machineMatches,
    versionCompatible,
    daysRemaining,
    checkedAt: currentDate.toISOString()
  };
}

module.exports = {
  LICENSE_DAYS_BY_TYPE,
  LICENSE_SCHEMA_VERSION,
  LICENSE_PREFIX,
  MODERN_LICENSE_PREFIX,
  LICENSE_PREFIXES,
  MODERN_LICENSE_ALGORITHM,
  MIN_LICENSE_SECRET_LENGTH,
  MAX_LICENSE_KEY_LENGTH,
  LICENSE_PUBLIC_KEY_PATH,
  buildLicenseSerial,
  calculateExpiration,
  createLicenseKey,
  decodeLicenseKey,
  getLicensePublicKey,
  getPublicKeyFingerprint,
  getPrivateKeyPublicKeyFingerprint,
  isLicenseKey,
  verifyLicensePayload,
  compareVersions,
  normalizeDate,
  getLicenseSecret,
  assertLicenseType,
  normalizeLicenseType
};
