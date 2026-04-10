const crypto = require('crypto');
const packageJson = require('../package.json');

const LICENSE_PREFIX = 'ORB2';
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

  return secret;
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(`enc:${getLicenseSecret()}`).digest();
}

function getHmacKey() {
  return crypto.createHash('sha256').update(`hmac:${getLicenseSecret()}`).digest();
}

function buildLicenseSerial() {
  return `JR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalizeLicenseType(licenseType = 'monthly') {
  const normalized = String(licenseType).trim().toLowerCase();
  return LICENSE_DAYS_BY_TYPE[normalized] === undefined ? 'monthly' : normalized;
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

function createLicenseKey({
  machineId,
  businessName,
  licenseType,
  expiresAt,
  edition = 'standard',
  versionMinCompatible = packageJson.version,
  serial = buildLicenseSerial(),
  issuedAt = new Date().toISOString()
}) {
  const payload = {
    machineId,
    businessName,
    licenseType: normalizeLicenseType(licenseType),
    expiresAt: expiresAt || calculateExpiration(licenseType),
    issuedAt,
    version: packageJson.version,
    versionMinCompatible,
    edition: String(edition || 'standard').trim().toLowerCase(),
    serial: String(serial || buildLicenseSerial()).trim()
  };

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

function decodeLicenseKey(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.startsWith(`${LICENSE_PREFIX}.`)) {
    throw new Error('La licencia no tiene un formato valido.');
  }

  const token = licenseKey.split('.')[1];
  const envelope = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  const iv = Buffer.from(envelope.iv, 'base64url');
  const encrypted = Buffer.from(envelope.data, 'base64url');
  const providedSignature = Buffer.from(envelope.sig, 'base64url');
  const expectedSignature = crypto
    .createHmac('sha256', getHmacKey())
    .update(iv)
    .update(encrypted)
    .digest();

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new Error('La firma de la licencia no es valida.');
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  const payload = JSON.parse(decrypted.toString('utf8'));

  return {
    ...payload,
    edition: String(payload.edition || 'standard').trim().toLowerCase(),
    versionMinCompatible: payload.versionMinCompatible || payload.version || packageJson.version,
    serial: String(payload.serial || '').trim() || 'SIN-SERIAL'
  };
}

module.exports = {
  LICENSE_DAYS_BY_TYPE,
  LICENSE_PREFIX,
  buildLicenseSerial,
  calculateExpiration,
  createLicenseKey,
  decodeLicenseKey,
  getLicenseSecret,
  normalizeLicenseType
};
