const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');
const { getDb, getConfigValue, createAuditLog } = require('./database');
const { getMachineId } = require('../shared/machine-id');
const {
  LICENSE_DAYS_BY_TYPE,
  LICENSE_PREFIX,
  calculateExpiration,
  createLicenseKey,
  decodeLicenseKey
} = require('../shared/license-core');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

const REMINDER_DAYS = new Set([15, 7, 3, 1]);
const CLOCK_ROLLBACK_TOLERANCE_MS = 10 * 60 * 1000;
const CLOCK_ROLLBACK_BLOCK_MS = 24 * 60 * 60 * 1000;

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function compareVersions(leftVersion = '0.0.0', rightVersion = '0.0.0') {
  const leftParts = String(leftVersion).split('.').map((part) => Number(part || 0));
  const rightParts = String(rightVersion).split('.').map((part) => Number(part || 0));
  const totalParts = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < totalParts; index += 1) {
    const left = leftParts[index] || 0;
    const right = rightParts[index] || 0;
    if (left > right) {
      return 1;
    }
    if (left < right) {
      return -1;
    }
  }

  return 0;
}

function saveLicenseRecord(record) {
  getDb().prepare(`
    INSERT INTO license (
      id, key, machine_id, business_name, activated_at, expires_at, demo_started_at, status
    )
    VALUES (
      1, @key, @machine_id, @business_name, @activated_at, @expires_at, @demo_started_at, @status
    )
    ON CONFLICT(id) DO UPDATE SET
      key = excluded.key,
      machine_id = excluded.machine_id,
      business_name = excluded.business_name,
      activated_at = excluded.activated_at,
      expires_at = excluded.expires_at,
      demo_started_at = excluded.demo_started_at,
      status = excluded.status
  `).run(record);
}

function getLicenseRecord() {
  return getDb().prepare('SELECT * FROM license WHERE id = 1').get();
}

function getRuntimeGuard() {
  return getDb().prepare(`
    SELECT *
    FROM license_runtime_guard
    WHERE id = 1
  `).get() || {
    id: 1,
    rollback_hits: 0,
    mismatch_hits: 0,
    tamper_hits: 0
  };
}

function saveRuntimeGuard(patch) {
  const current = getRuntimeGuard();
  const next = {
    id: 1,
    last_seen_at: null,
    last_machine_id: null,
    last_license_hash: null,
    last_license_serial: null,
    last_app_version: null,
    rollback_hits: 0,
    mismatch_hits: 0,
    tamper_hits: 0,
    last_executable_hash: null,
    last_warning: null,
    ...current,
    ...patch
  };

  getDb().prepare(`
    INSERT INTO license_runtime_guard (
      id,
      last_seen_at,
      last_machine_id,
      last_license_hash,
      last_license_serial,
      last_app_version,
      rollback_hits,
      mismatch_hits,
      tamper_hits,
      last_executable_hash,
      last_warning
    )
    VALUES (
      @id,
      @last_seen_at,
      @last_machine_id,
      @last_license_hash,
      @last_license_serial,
      @last_app_version,
      @rollback_hits,
      @mismatch_hits,
      @tamper_hits,
      @last_executable_hash,
      @last_warning
    )
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      last_machine_id = excluded.last_machine_id,
      last_license_hash = excluded.last_license_hash,
      last_license_serial = excluded.last_license_serial,
      last_app_version = excluded.last_app_version,
      rollback_hits = excluded.rollback_hits,
      mismatch_hits = excluded.mismatch_hits,
      tamper_hits = excluded.tamper_hits,
      last_executable_hash = excluded.last_executable_hash,
      last_warning = excluded.last_warning
  `).run(next);

  return next;
}

function registerLicenseHistory({
  eventType,
  status = null,
  record = null,
  payload = null,
  detail = null
}) {
  const source = record || {};
  const decoded = payload || {};

  getDb().prepare(`
    INSERT INTO license_history (
      event_type,
      status,
      license_key,
      machine_id,
      business_name,
      license_type,
      edition,
      serial,
      expires_at,
      detail
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventType,
    status || source.status || null,
    source.key || null,
    source.machine_id || decoded.machineId || null,
    source.business_name || decoded.businessName || null,
    decoded.licenseType || (source.status === 'demo' ? 'demo' : null),
    decoded.edition || null,
    decoded.serial || null,
    source.expires_at || decoded.expiresAt || null,
    detail ? JSON.stringify(detail) : null
  );
}

function getLicenseHistory(limit = 25) {
  return getDb().prepare(`
    SELECT
      id,
      event_type,
      status,
      machine_id,
      business_name,
      license_type,
      edition,
      serial,
      expires_at,
      detail,
      created_at
    FROM license_history
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Number(limit || 25)).map((entry) => ({
    ...entry,
    detail: entry.detail ? JSON.parse(entry.detail) : null
  }));
}

function getDaysRemaining(expiresAt) {
  if (!expiresAt) {
    return null;
  }

  const currentDate = new Date();
  const expirationDate = new Date(expiresAt);

  if (expirationDate.getTime() <= currentDate.getTime()) {
    return 0;
  }

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const expirationDay = new Date(expirationDate);
  expirationDay.setHours(0, 0, 0, 0);

  const milliseconds = expirationDay.getTime() - today.getTime();
  return Math.max(0, Math.round(milliseconds / (1000 * 60 * 60 * 24)));
}

function getExecutableFingerprint() {
  try {
    const executablePath = process.execPath || __filename;
    const stats = fs.statSync(executablePath);
    return hashValue(`${path.basename(executablePath)}:${stats.size}:${Math.floor(stats.mtimeMs)}`);
  } catch (error) {
    return null;
  }
}

function summarizeLicense(record = getLicenseRecord(), options = {}) {
  const runtimeGuard = options.runtimeGuard || getRuntimeGuard();
  const decodedPayload = options.decodedPayload || null;
  const integrity = options.integrity || {
    flags: [],
    warnings: [],
    blocked: false,
    reason: null
  };
  const historyCount = getDb().prepare('SELECT COUNT(*) AS total FROM license_history').get()?.total || 0;

  if (!record) {
    return {
      status: 'pending',
      machineId: getMachineId(),
      businessName: getConfigValue('business_name', 'Mi Negocio'),
      shouldBlock: false,
      isDemo: false,
      isActive: false,
      expiresAt: null,
      daysRemaining: null,
      reminder: null,
      licenseType: null,
      edition: null,
      serial: null,
      versionMinCompatible: null,
      securityFlags: integrity.flags,
      securityWarnings: integrity.warnings,
      historyCount,
      activatedAt: null,
      demoStartedAt: null,
      diagnostics: {
        rollbackHits: Number(runtimeGuard.rollback_hits || 0),
        mismatchHits: Number(runtimeGuard.mismatch_hits || 0),
        tamperHits: Number(runtimeGuard.tamper_hits || 0),
        lastSeenAt: runtimeGuard.last_seen_at || null
      }
    };
  }

  const daysRemaining = getDaysRemaining(record.expires_at);
  const reminder = REMINDER_DAYS.has(daysRemaining)
    ? `Tu ${record.status === 'demo' ? 'demo' : 'licencia'} vence en ${daysRemaining} dia(s).`
    : null;

  return {
    status: record.status,
    machineId: record.machine_id || getMachineId(),
    businessName: record.business_name || getConfigValue('business_name', 'Mi Negocio'),
    activatedAt: record.activated_at,
    expiresAt: record.expires_at,
    demoStartedAt: record.demo_started_at,
    licenseType: decodedPayload?.licenseType || (record.status === 'demo' ? 'demo' : 'active'),
    edition: decodedPayload?.edition || (record.status === 'demo' ? 'demo' : 'standard'),
    serial: decodedPayload?.serial || null,
    versionMinCompatible: decodedPayload?.versionMinCompatible || packageJson.version,
    isDemo: record.status === 'demo',
    isActive: record.status === 'active',
    isExpired: record.status === 'expired',
    isBlocked: record.status === 'blocked',
    shouldBlock: record.status === 'expired' || record.status === 'blocked',
    daysRemaining,
    reminder,
    securityFlags: integrity.flags,
    securityWarnings: integrity.warnings,
    securityMessage: integrity.reason,
    historyCount,
    diagnostics: {
      rollbackHits: Number(runtimeGuard.rollback_hits || 0),
      mismatchHits: Number(runtimeGuard.mismatch_hits || 0),
      tamperHits: Number(runtimeGuard.tamper_hits || 0),
      lastSeenAt: runtimeGuard.last_seen_at || null
    }
  };
}

function evaluateIntegrity(record, decodedPayload, decodeError) {
  const currentMachineId = getMachineId();
  const currentVersion = packageJson.version;
  const runtimeGuard = getRuntimeGuard();
  const now = new Date();
  const lastSeenAt = runtimeGuard.last_seen_at ? new Date(runtimeGuard.last_seen_at) : null;
  const executableFingerprint = getExecutableFingerprint();
  const flags = [];
  const warnings = [];
  let blocked = false;
  let reason = null;
  let rollbackHits = Number(runtimeGuard.rollback_hits || 0);
  let mismatchHits = Number(runtimeGuard.mismatch_hits || 0);
  let tamperHits = Number(runtimeGuard.tamper_hits || 0);

  if (decodeError && record.status !== 'demo') {
    blocked = true;
    reason = 'La licencia guardada no pudo validarse. Contacta a JRTech para reemplazarla.';
    flags.push('license_signature_invalid');
  }

  if (!blocked && decodedPayload?.versionMinCompatible && compareVersions(currentVersion, decodedPayload.versionMinCompatible) < 0) {
    blocked = true;
    reason = `Esta licencia requiere OrbitPOS ${decodedPayload.versionMinCompatible} o superior.`;
    flags.push('license_version_incompatible');
  }

  if (!blocked && record.machine_id && currentMachineId !== record.machine_id) {
    const shouldCountMismatch = runtimeGuard.last_machine_id !== currentMachineId;
    mismatchHits = shouldCountMismatch ? mismatchHits + 1 : mismatchHits;
    blocked = true;
    reason = 'Se detecto un cambio de hardware o una copia no autorizada de la licencia.';
    flags.push('machine_id_mismatch');
    if (shouldCountMismatch) {
      registerLicenseHistory({
        eventType: 'machine_mismatch',
        status: 'blocked',
        record,
        payload: decodedPayload,
        detail: {
          expectedMachineId: record.machine_id,
          currentMachineId,
          mismatchHits
        }
      });
    }
  }

  if (lastSeenAt && now.getTime() + CLOCK_ROLLBACK_TOLERANCE_MS < lastSeenAt.getTime()) {
    rollbackHits += 1;
    const rollbackMs = lastSeenAt.getTime() - now.getTime();
    flags.push('clock_rollback_detected');
    warnings.push('Se detecto un retroceso del reloj local.');

    registerLicenseHistory({
      eventType: 'clock_rollback',
      status: record.status,
      record,
      payload: decodedPayload,
      detail: {
        lastSeenAt: runtimeGuard.last_seen_at,
        currentSeenAt: now.toISOString(),
        rollbackMs,
        rollbackHits
      }
    });

    if (rollbackHits >= 2 || rollbackMs >= CLOCK_ROLLBACK_BLOCK_MS) {
      blocked = true;
      reason = 'Se detectaron cambios irregulares en la fecha del sistema. Reactiva la licencia con soporte JRTech.';
    }
  }

  if (
    executableFingerprint &&
    runtimeGuard.last_executable_hash &&
    runtimeGuard.last_app_version === currentVersion &&
    runtimeGuard.last_executable_hash !== executableFingerprint
  ) {
    tamperHits += 1;
    flags.push('executable_fingerprint_changed');
    warnings.push('La huella del ejecutable cambio respecto al ultimo arranque valido.');

    registerLicenseHistory({
      eventType: 'fingerprint_changed',
      status: record.status,
      record,
      payload: decodedPayload,
      detail: {
        previousFingerprint: runtimeGuard.last_executable_hash,
        currentFingerprint: executableFingerprint,
        tamperHits
      }
    });
  }

  const lastWarning = warnings[0] || reason || null;
  const savedGuard = saveRuntimeGuard({
    last_seen_at: now.toISOString(),
    last_machine_id: currentMachineId,
    last_license_hash: record.key ? hashValue(record.key) : null,
    last_license_serial: decodedPayload?.serial || null,
    last_app_version: currentVersion,
    rollback_hits: rollbackHits,
    mismatch_hits: mismatchHits,
    tamper_hits: tamperHits,
    last_executable_hash: executableFingerprint,
    last_warning: lastWarning
  });

  return {
    blocked,
    reason,
    flags,
    warnings,
    runtimeGuard: savedGuard
  };
}

function refreshLicenseState() {
  const record = getLicenseRecord();
  if (!record) {
    return summarizeLicense(null);
  }

  let decodedPayload = null;
  let decodeError = null;

  if (record.key && record.key.startsWith(`${LICENSE_PREFIX}.`)) {
    try {
      decodedPayload = decodeLicenseKey(record.key);
    } catch (error) {
      decodeError = error;
    }
  }

  const integrity = evaluateIntegrity(record, decodedPayload, decodeError);
  let nextRecord = record;

  if (record.expires_at && new Date(record.expires_at) < new Date() && record.status !== 'expired' && record.status !== 'blocked') {
    saveLicenseRecord({
      ...record,
      status: 'expired'
    });
    registerLicenseHistory({
      eventType: 'expired',
      status: 'expired',
      record: { ...record, status: 'expired' },
      payload: decodedPayload,
      detail: {
        expiresAt: record.expires_at
      }
    });
    nextRecord = getLicenseRecord();
  }

  if (integrity.blocked && nextRecord.status !== 'blocked') {
    saveLicenseRecord({
      ...nextRecord,
      status: 'blocked'
    });
    registerLicenseHistory({
      eventType: 'blocked',
      status: 'blocked',
      record: { ...nextRecord, status: 'blocked' },
      payload: decodedPayload,
      detail: {
        reason: integrity.reason,
        flags: integrity.flags
      }
    });
    nextRecord = getLicenseRecord();
  }

  return summarizeLicense(nextRecord, {
    decodedPayload,
    integrity,
    runtimeGuard: integrity.runtimeGuard
  });
}

function startDemo(businessName = getConfigValue('business_name', 'Mi Negocio')) {
  const existing = getLicenseRecord();
  if (existing) {
    return refreshLicenseState();
  }

  const startedAt = new Date();
  const expiresAt = calculateExpiration('demo', startedAt);

  saveLicenseRecord({
    key: 'DEMO-AUTO',
    machine_id: getMachineId(),
    business_name: businessName,
    activated_at: null,
    expires_at: expiresAt,
    demo_started_at: startedAt.toISOString(),
    status: 'demo'
  });

  registerLicenseHistory({
    eventType: 'demo_started',
    status: 'demo',
    record: getLicenseRecord(),
    detail: {
      businessName
    }
  });

  return summarizeLicense(getLicenseRecord());
}

function activateLicenseKey(licenseKey, options = {}) {
  const payload = decodeLicenseKey(licenseKey);
  const currentMachineId = getMachineId();

  if (payload.machineId !== currentMachineId) {
    throw new Error('La licencia no corresponde a esta maquina.');
  }

  if (payload.versionMinCompatible && compareVersions(packageJson.version, payload.versionMinCompatible) < 0) {
    throw new Error(`La licencia requiere OrbitPOS ${payload.versionMinCompatible} o superior.`);
  }

  const previousRecord = getLicenseRecord();
  const expiresAt = payload.expiresAt || calculateExpiration(payload.licenseType);
  const currentStatus = expiresAt && new Date(expiresAt) < new Date() ? 'expired' : 'active';
  const activatedAt = new Date().toISOString();

  saveLicenseRecord({
    key: licenseKey,
    machine_id: payload.machineId,
    business_name: payload.businessName,
    activated_at: activatedAt,
    expires_at: expiresAt,
    demo_started_at: null,
    status: currentStatus
  });

  saveRuntimeGuard({
    last_seen_at: activatedAt,
    last_machine_id: currentMachineId,
    last_license_hash: hashValue(licenseKey),
    last_license_serial: payload.serial || null,
    last_app_version: packageJson.version,
    rollback_hits: 0,
    mismatch_hits: 0,
    tamper_hits: 0,
    last_executable_hash: getExecutableFingerprint(),
    last_warning: null
  });

  registerLicenseHistory({
    eventType: previousRecord?.status === 'active' ? 'renewed' : 'activated',
    status: currentStatus,
    record: getLicenseRecord(),
    payload,
    detail: {
      source: options.source || 'manual',
      previousStatus: previousRecord?.status || null
    }
  });

  createAuditLog({
    userId: options.userId || null,
    action: 'activate_license',
    tableName: 'license',
    recordId: 1,
    oldValue: previousRecord,
    newValue: {
      machine_id: payload.machineId,
      business_name: payload.businessName,
      license_type: payload.licenseType,
      edition: payload.edition,
      serial: payload.serial,
      expires_at: expiresAt,
      status: currentStatus
    }
  });

  return refreshLicenseState();
}

function createLicenseRouter() {
  const router = express.Router();

  router.get('/status', (request, response) => {
    response.json(refreshLicenseState());
  });

  router.get('/machine-id', (request, response) => {
    response.json({
      machineId: getMachineId()
    });
  });

  router.post('/activate', (request, response) => {
    try {
      const { licenseKey } = request.body || {};
      const summary = activateLicenseKey(licenseKey);
      response.json(summary);
    } catch (error) {
      registerLicenseHistory({
        eventType: 'activation_failed',
        status: 'rejected',
        detail: {
          reason: error.message || 'Error desconocido al activar licencia.'
        }
      });

      response.status(400).json({
        message: error.message
      });
    }
  });

  router.get('/history', authenticateToken, requireAdmin, (request, response) => {
    response.json({
      items: getLicenseHistory(40)
    });
  });

  router.get('/diagnostics', authenticateToken, requireAdmin, (request, response) => {
    const summary = refreshLicenseState();
    const runtimeGuard = getRuntimeGuard();

    response.json({
      summary,
      history: getLicenseHistory(60),
      runtimeGuard: {
        lastSeenAt: runtimeGuard.last_seen_at || null,
        lastMachineId: runtimeGuard.last_machine_id || null,
        rollbackHits: Number(runtimeGuard.rollback_hits || 0),
        mismatchHits: Number(runtimeGuard.mismatch_hits || 0),
        tamperHits: Number(runtimeGuard.tamper_hits || 0),
        lastWarning: runtimeGuard.last_warning || null
      }
    });
  });

  return router;
}

module.exports = {
  LICENSE_DAYS_BY_TYPE,
  activateLicenseKey,
  calculateExpiration,
  createLicenseKey,
  createLicenseRouter,
  decodeLicenseKey,
  getLicenseHistory,
  getMachineId,
  refreshLicenseState,
  startDemo,
  summarizeLicense
};
