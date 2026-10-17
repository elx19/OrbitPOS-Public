#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const packageJson = require('../package.json');

const root = path.resolve(__dirname, '..');
const version = packageJson.version;
const failures = [];

function absolute(...parts) {
  return path.join(root, ...parts);
}

function requireFile(relativePath) {
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    failures.push(`Falta el archivo ${relativePath}.`);
    return null;
  }
  return filePath;
}

function sha512Base64(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

function readManifest(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const versionMatch = content.match(/^version:\s*(.+)$/m);
  const fileMatch = content.match(/^\s*- url:\s*(.+)$/m);
  const hashMatch = content.match(/^\s*sha512:\s*(.+)$/m);
  const sizeMatch = content.match(/^\s*size:\s*(\d+)$/m);
  return {
    version: versionMatch?.[1]?.trim(),
    fileName: fileMatch?.[1]?.trim(),
    sha512: hashMatch?.[1]?.trim(),
    size: sizeMatch ? Number(sizeMatch[1]) : null
  };
}

function checkVersionFiles() {
  const packageLock = JSON.parse(fs.readFileSync(absolute('package-lock.json'), 'utf8'));
  if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
    failures.push(`package-lock.json no coincide con ${version}.`);
  }

  const expectedTag = `v${version}`;
  try {
    const tags = execFileSync('git', ['tag', '--points-at', 'HEAD'], { cwd: root, encoding: 'utf8' });
    if (!tags.split(/\r?\n/).includes(expectedTag)) {
      failures.push(`HEAD no tiene el tag ${expectedTag}.`);
    }
  } catch (error) {
    failures.push(`No fue posible verificar el tag ${expectedTag}: ${error.message}`);
  }
}

function checkReleaseArtifacts() {
  const installerRelative = `release/OrbitPOS Setup ${version}.exe`;
  const installer = requireFile(installerRelative);
  const manifest = requireFile('release/latest.yml');
  requireFile('release/win-unpacked/OrbitPOS.exe');
  const releaseNotes = requireFile(`docs/releases/${version}.md`);

  if (!installer || !manifest || !releaseNotes) return;
  const metadata = readManifest(manifest);
  const expectedFileName = `OrbitPOS.Setup.${version}.exe`;
  const actualHash = sha512Base64(installer);
  const actualSize = fs.statSync(installer).size;

  if (metadata.version !== version) failures.push(`latest.yml declara ${metadata.version || 'sin version'}.`);
  if (metadata.fileName !== expectedFileName) failures.push(`latest.yml no apunta a ${expectedFileName}.`);
  if (metadata.sha512 !== actualHash) failures.push('El SHA-512 del instalador no coincide con latest.yml.');
  if (metadata.size !== actualSize) failures.push('El tamaño del instalador no coincide con latest.yml.');
}

function checkBrandAndReferences() {
  requireFile('assets/orbitpos-logo.png');
  requireFile('assets/orbitpos-license.png');
  requireFile('frontend/src/assets/orbitpos-logo.png');
  requireFile('frontend/src/assets/orbitpos-license.png');

  const referenceDirectory = absolute('docs/ui-reference');
  const references = fs.readdirSync(referenceDirectory)
    .filter((fileName) => fileName.endsWith('-reference.png'))
    .sort();
  if (references.length !== 19) {
    failures.push(`Se esperaban 19 referencias visuales PNG y se encontraron ${references.length}.`);
  }

  const authoritativeDirectory = absolute('docs/ui-reference/authoritative');
  if (!fs.existsSync(authoritativeDirectory) || !fs.statSync(authoritativeDirectory).isDirectory()) {
    failures.push('Falta docs/ui-reference/authoritative con las referencias entregadas por el usuario.');
  } else {
    const authoritativeReferences = fs.readdirSync(authoritativeDirectory)
      .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
      .sort();
    if (authoritativeReferences.length !== 19) {
      failures.push(`Se esperaban 19 referencias autoritativas PNG y se encontraron ${authoritativeReferences.length}.`);
    }
  }

  const distAssets = fs.existsSync(absolute('frontend/dist/assets'))
    ? fs.readdirSync(absolute('frontend/dist/assets'))
    : [];
  if (!distAssets.some((fileName) => fileName.startsWith('orbitpos-logo-'))) {
    failures.push('El build web no contiene el logo OrbitPOS.');
  }
  if (!distAssets.some((fileName) => fileName.startsWith('orbitpos-license-'))) {
    failures.push('El build web no contiene el icono de activacion.');
  }
}

checkVersionFiles();
checkReleaseArtifacts();
checkBrandAndReferences();

if (failures.length) {
  console.error('Release QA: FALLO');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Release QA: OK (${version})`);
}
