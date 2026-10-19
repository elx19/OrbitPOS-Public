const assert = require('assert');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

process.env.ORBITPOS_LICENSE_SECRET = 'orbitpos-alpha-test-secret-change-me-32';

const {
  createLicenseKey,
  decodeLicenseKey,
  verifyLicensePayload,
  getPublicKeyFingerprint
} = require('../shared/license-core');

const { privateKey: modernPrivateKey, publicKey: modernPublicKey } = crypto.generateKeyPairSync('ed25519');
const modernPublicPem = modernPublicKey.export({ type: 'spki', format: 'pem' });
process.env.ORBITPOS_LICENSE_PUBLIC_KEY = modernPublicPem;

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

const modernKey = createLicenseKey({
  machineId: 'machine-modern-001',
  businessName: 'Tienda ORB3',
  licenseType: 'annual',
  edition: 'professional',
  versionMinCompatible: '2.1.0-alpha.61',
  serial: 'JR-ORB3-001',
  signingKey: modernPrivateKey
});
assert.match(modernKey, /^ORB3\./);
const previousSecret = process.env.ORBITPOS_LICENSE_SECRET;
delete process.env.ORBITPOS_LICENSE_SECRET;
const modernPayload = decodeLicenseKey(modernKey);
assert.equal(modernPayload.machineId, 'machine-modern-001');
assert.equal(modernPayload.serial, 'JR-ORB3-001');
assert.equal(verifyLicensePayload(modernPayload, { machineId: 'machine-modern-001' }).valid, true);
process.env.ORBITPOS_LICENSE_SECRET = previousSecret;

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
const secretFile = path.join(__dirname, '..', '.qa', 'license-generator-test.secret');
const privateKeyFile = path.join(__dirname, '..', '.qa', 'license-generator-test-private.pem');
const publicKeyFile = path.join(__dirname, '..', '.qa', 'license-generator-test-public.pem');
const keygenPrivateFile = path.join(__dirname, '..', '.qa', 'license-generator-keygen-private.pem');
const keygenPublicFile = path.join(__dirname, '..', '.qa', 'license-generator-keygen-public.pem');
const mismatchPublicKeyFile = path.join(__dirname, '..', '.qa', 'license-generator-mismatch-public.pem');

const secureDefault = spawnSync(process.execPath, [generatorPath, 'generate', '--machine-id', 'machine-secure-default', '--business', 'Tienda Segura', '--type', 'monthly', '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(secureDefault.status, 1);
assert.match(JSON.parse(secureDefault.stdout).error, /emision segura|private-key-file/i);

const generatedKeyPair = spawnSync(process.execPath, [generatorPath, 'keygen', '--private-out', keygenPrivateFile, '--public-out', keygenPublicFile, '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(generatedKeyPair.status, 0, generatedKeyPair.stderr);
const generatedKeyPairResult = JSON.parse(generatedKeyPair.stdout);
assert.equal(generatedKeyPairResult.publicKeyFingerprint.startsWith('sha256:'), true);
const generatedFingerprint = spawnSync(process.execPath, [generatorPath, 'fingerprint', '--public-key-file', keygenPublicFile, '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(generatedFingerprint.status, 0, generatedFingerprint.stderr);
assert.equal(JSON.parse(generatedFingerprint.stdout).fingerprint, generatedKeyPairResult.publicKeyFingerprint);

fs.writeFileSync(privateKeyFile, modernPrivateKey.export({ type: 'pkcs8', format: 'pem' }), { encoding: 'utf8', mode: 0o600 });
fs.writeFileSync(publicKeyFile, modernPublicPem, { encoding: 'utf8', mode: 0o644 });
const { publicKey: mismatchPublicKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(mismatchPublicKeyFile, mismatchPublicKey.export({ type: 'spki', format: 'pem' }), { encoding: 'utf8', mode: 0o644 });
const generated = spawnSync(process.execPath, [generatorPath, 'generate', '--legacy-orb2', '--machine-id', 'machine-cli-001', '--business', 'Tienda CLI', '--type', 'monthly', '--out', keyFile, '--json'], {
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
const verifiedText = spawnSync(process.execPath, [generatorPath, 'verify', '--key-file', keyFile, '--machine-id', 'different-machine'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(verifiedText.status, 2, `verify en texto debe fallar con codigo 2: ${verifiedText.stderr}`);
fs.unlinkSync(keyFile);

const generatedModern = spawnSync(process.execPath, [generatorPath, 'generate', '--private-key-file', privateKeyFile, '--public-key-file', publicKeyFile, '--machine-id', 'machine-cli-orb3', '--business', 'Tienda CLI ORB3', '--type', 'annual', '--out', keyFile, '--json'], {
  env: { ...process.env, ORBITPOS_LICENSE_SECRET: '', ORBITPOS_LICENSE_PUBLIC_KEY: modernPublicPem },
  encoding: 'utf8'
});
assert.equal(generatedModern.status, 0, generatedModern.stderr);
const generatedModernResult = JSON.parse(generatedModern.stdout);
assert.match(generatedModernResult.key, /^ORB3\./);
assert.equal(generatedModernResult.publicKeyFingerprint, getPublicKeyFingerprint(modernPublicKey));
const verifiedModern = spawnSync(process.execPath, [generatorPath, 'verify', '--key-file', keyFile, '--machine-id', 'machine-cli-orb3', '--json'], {
  env: { ORBITPOS_LICENSE_SECRET: '', ORBITPOS_LICENSE_PUBLIC_KEY: modernPublicPem },
  encoding: 'utf8'
});
assert.equal(verifiedModern.status, 0, verifiedModern.stderr);
assert.equal(JSON.parse(verifiedModern.stdout).valid, true);
fs.unlinkSync(keyFile);

const mismatchedModern = spawnSync(process.execPath, [generatorPath, 'generate', '--private-key-file', privateKeyFile, '--public-key-file', mismatchPublicKeyFile, '--machine-id', 'machine-cli-orb3', '--business', 'Tienda CLI ORB3', '--type', 'annual', '--json'], {
  env: { ...process.env, ORBITPOS_LICENSE_SECRET: '' },
  encoding: 'utf8'
});
assert.equal(mismatchedModern.status, 1);
assert.match(JSON.parse(mismatchedModern.stdout).error, /no corresponde/i);

const malformedVerification = spawnSync(process.execPath, [generatorPath, 'verify', '--key', 'ORB2.invalid-key', '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(malformedVerification.status, 2, `verify debe clasificar una clave corrupta como invalida: ${malformedVerification.stderr}`);
assert.equal(JSON.parse(malformedVerification.stdout).verification.cryptographicallyValid, false);

const machineIdResult = spawnSync(process.execPath, [generatorPath, 'machine-id', '--json'], {
  env: { ...process.env, ORBITPOS_LICENSE_SECRET: '' },
  encoding: 'utf8'
});
assert.equal(machineIdResult.status, 0, machineIdResult.stderr);
assert.ok(JSON.parse(machineIdResult.stdout).machineId);

fs.writeFileSync(secretFile, 'orbitpos-secret-file-test-change-me-32\n', 'utf8');
const generatedWithSecretFile = spawnSync(process.execPath, [generatorPath, 'generate', '--legacy-orb2', '--secret-file', secretFile, '--machine-id', 'machine-secret-file', '--business', 'Tienda Secret File', '--type', 'monthly', '--json'], {
  env: { ...process.env, ORBITPOS_LICENSE_SECRET: '' },
  encoding: 'utf8'
});
assert.equal(generatedWithSecretFile.status, 0, generatedWithSecretFile.stderr);
const generatedWithSecretFileResult = JSON.parse(generatedWithSecretFile.stdout);
assert.equal(generatedWithSecretFileResult.payload.machineId, 'machine-secret-file');
const verifiedWithSecretFile = spawnSync(process.execPath, [generatorPath, 'verify', '--secret-file', secretFile, '--key', generatedWithSecretFileResult.key, '--machine-id', 'machine-secret-file', '--json'], {
  env: { ...process.env, ORBITPOS_LICENSE_SECRET: '' },
  encoding: 'utf8'
});
assert.equal(verifiedWithSecretFile.status, 0, verifiedWithSecretFile.stderr);
assert.equal(JSON.parse(verifiedWithSecretFile.stdout).valid, true);
fs.unlinkSync(secretFile);

const weakSecret = spawnSync(process.execPath, [generatorPath, 'generate', '--legacy-orb2', '--machine-id', 'machine-weak-secret', '--business', 'Tienda Debil', '--type', 'monthly', '--json'], {
  env: { ...process.env, ORBITPOS_LICENSE_SECRET: 'too-short' },
  encoding: 'utf8'
});
assert.equal(weakSecret.status, 1);
assert.equal(JSON.parse(weakSecret.stdout).ok, false);
assert.match(JSON.parse(weakSecret.stdout).error, /32 caracteres/i);

const protectedOutputPath = path.join(__dirname, '..', '.qa', 'license-generator-protected.key');
const firstProtectedOutput = spawnSync(process.execPath, [generatorPath, 'generate', '--legacy-orb2', '--machine-id', 'machine-protected', '--business', 'Tienda Protegida', '--type', 'monthly', '--out', protectedOutputPath, '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(firstProtectedOutput.status, 0, firstProtectedOutput.stderr);
const secondProtectedOutput = spawnSync(process.execPath, [generatorPath, 'generate', '--legacy-orb2', '--machine-id', 'machine-protected', '--business', 'Tienda Protegida', '--type', 'monthly', '--out', protectedOutputPath, '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(secondProtectedOutput.status, 1, 'generate no debe reemplazar una licencia existente sin --force.');
const forcedProtectedOutput = spawnSync(process.execPath, [generatorPath, 'generate', '--legacy-orb2', '--machine-id', 'machine-protected', '--business', 'Tienda Protegida', '--type', 'monthly', '--out', protectedOutputPath, '--force', '--json'], {
  env: process.env,
  encoding: 'utf8'
});
assert.equal(forcedProtectedOutput.status, 0, forcedProtectedOutput.stderr);
fs.unlinkSync(protectedOutputPath);
fs.unlinkSync(privateKeyFile);
fs.unlinkSync(publicKeyFile);
fs.unlinkSync(keygenPrivateFile);
fs.unlinkSync(keygenPublicFile);
fs.unlinkSync(mismatchPublicKeyFile);

console.log('License generator QA: OK');
