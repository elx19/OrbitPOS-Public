const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

assert.throws(
  () => createLicenseKey({
    machineId: 'machine-test-001',
    businessName: 'Tienda San Jose',
    licenseType: 'monthly',
    issuedAt: '2026-01-02T00:00:00.000Z',
    expiresAt: '2026-01-01T00:00:00.000Z'
  }),
  /expiracion no puede ser anterior/i
);

assert.throws(
  () => verifyLicensePayload({ issuedAt: 'not-a-date', expiresAt: null }),
  /fecha de emision no es valida/i
);

const generatorPath = path.join(__dirname, 'license-generator.js');
const keyFile = path.join(__dirname, '..', '.qa', 'license-generator-test.key');
const generated = spawnSync(process.execPath, [generatorPath, 'generate', '--machine-id', 'machine-cli-001', '--business', 'Tienda CLI', '--type', 'monthly', '--out', keyFile, '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(generated.status, 0, generated.stderr);
const generatedResult = JSON.parse(generated.stdout);
assert.equal(generatedResult.ok, true);
assert.ok(generatedResult.outputPath);

const verified = spawnSync(process.execPath, [generatorPath, 'verify', '--key-file', keyFile, '--machine-id', 'different-machine', '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(verified.status, 2, `verify debe fallar con codigo 2: ${verified.stderr}`);
assert.equal(JSON.parse(verified.stdout).valid, false);
fs.unlinkSync(keyFile);

console.log('License generator QA: OK');
