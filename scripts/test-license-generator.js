const assert = require('assert');

process.env.ORBITPOS_LICENSE_SECRET = 'orbitpos-alpha-test-secret-change-me-32';

const {
  createLicenseKey,
  decodeLicenseKey
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

assert.throws(
  () => decodeLicenseKey(`${key.slice(0, 20)}${key[20] === 'a' ? 'b' : 'a'}${key.slice(21)}`),
  /firma|formato|validarse/i
);

assert.throws(
  () => createLicenseKey({ machineId: '', businessName: 'Tienda', licenseType: 'monthly' }),
  /machineId es obligatorio/i
);

console.log('License generator QA: OK');
