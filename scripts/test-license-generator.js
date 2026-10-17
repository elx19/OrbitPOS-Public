const assert = require('assert');

process.env.ORBITPOS_LICENSE_SECRET = 'orbitpos-alpha-test-secret-change-me-32';

const {
  createLicenseKey,
  decodeLicenseKey,
  verifyLicensePayload
} = require('../shared/license-core');

const key = createLicenseKey({
  machineId: 'machine-test-001',
  businessName: 'Tienda San Jose',
  licenseType: 'monthly',
  edition: 'standard',
  versionMinCompatible: '2.1.0-alpha.1',
  serial: 'JR-QA-001'
});

const payload = decodeLicenseKey(key);
assert.equal(payload.machineId, 'machine-test-001');
assert.equal(payload.businessName, 'Tienda San Jose');
assert.equal(payload.licenseType, 'monthly');
assert.equal(payload.serial, 'JR-QA-001');
assert.equal(payload.schema, 2);

const verification = verifyLicensePayload(payload, {
  machineId: 'machine-test-001',
  appVersion: '2.1.0-alpha.9',
  now: new Date(payload.issuedAt)
});
assert.equal(verification.valid, true);
assert.equal(verification.machineMatches, true);

const expiredPayload = decodeLicenseKey(createLicenseKey({
  machineId: 'machine-test-001',
  businessName: 'Tienda San Jose',
  licenseType: 'monthly',
  issuedAt: '2019-12-01T00:00:00.000Z',
  expiresAt: '2020-01-01T00:00:00.000Z'
}));
assert.equal(verifyLicensePayload(expiredPayload, { now: '2021-01-01T00:00:00.000Z' }).expired, true);
assert.equal(verifyLicensePayload(expiredPayload, { now: '2021-01-01T00:00:00.000Z' }).valid, false);
assert.equal(verifyLicensePayload(payload, { machineId: 'different-machine' }).valid, false);

assert.throws(
  () => decodeLicenseKey(`${key.slice(0, 20)}${key[20] === 'a' ? 'b' : 'a'}${key.slice(21)}`),
  /firma|formato|validarse/i
);

assert.throws(
  () => createLicenseKey({ machineId: '', businessName: 'Tienda', licenseType: 'monthly' }),
  /machineId es obligatorio/i
);

console.log('License generator QA: OK');
