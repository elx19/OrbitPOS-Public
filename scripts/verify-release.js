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
  const pathMatch = content.match(/^path:\s*(.+)$/m);
  const blockMapSizeMatch = content.match(/^blockMapSize:\s*(\d+)$/m);
  return {
    version: versionMatch?.[1]?.trim(),
    fileName: fileMatch?.[1]?.trim(),
    sha512: hashMatch?.[1]?.trim(),
    size: sizeMatch ? Number(sizeMatch[1]) : null,
    path: pathMatch?.[1]?.trim(),
    blockMapSize: blockMapSizeMatch ? Number(blockMapSizeMatch[1]) : null
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
  const stableManifest = requireFile('release/stable.yml');
  requireFile('release/win-unpacked/OrbitPOS.exe');
  const releaseNotes = requireFile(`docs/releases/${version}.md`);

  if (!installer || !manifest || !stableManifest || !releaseNotes) return;
  const expectedFileName = `OrbitPOS.Setup.${version}.exe`;
  const actualHash = sha512Base64(installer);
  const actualSize = fs.statSync(installer).size;
  const expectedBlockMapSize = fs.existsSync(`${installer}.blockmap`)
    ? fs.statSync(`${installer}.blockmap`).size
    : 0;

  const manifests = [
    { relativePath: 'release/latest.yml', filePath: manifest },
    { relativePath: 'release/stable.yml', filePath: stableManifest },
    { relativePath: 'release/update-feed/orbitpos/latest.yml', filePath: requireFile('release/update-feed/orbitpos/latest.yml') },
    { relativePath: 'release/update-feed/orbitpos/stable.yml', filePath: requireFile('release/update-feed/orbitpos/stable.yml') },
    { relativePath: 'update-server/public/orbitpos/latest.yml', filePath: requireFile('update-server/public/orbitpos/latest.yml') },
    { relativePath: 'update-server/public/orbitpos/stable.yml', filePath: requireFile('update-server/public/orbitpos/stable.yml') }
  ].filter((entry) => entry.filePath);

  const expectedMetadata = {
    version,
    fileName: expectedFileName,
    sha512: actualHash,
    size: actualSize,
    path: expectedFileName,
    blockMapSize: expectedBlockMapSize
  };

  manifests.forEach(({ relativePath, filePath }) => {
    const metadata = readManifest(filePath);
    if (metadata.version !== expectedMetadata.version) {
      failures.push(`${relativePath} declara ${metadata.version || 'sin version'}.`);
    }
    if (metadata.fileName !== expectedMetadata.fileName) {
      failures.push(`${relativePath} no apunta a ${expectedFileName}.`);
    }
    if (metadata.path !== expectedMetadata.path) {
      failures.push(`${relativePath} tiene un path distinto al instalador publicado.`);
    }
    if (metadata.sha512 !== expectedMetadata.sha512) {
      failures.push(`El SHA-512 de ${relativePath} no coincide con el instalador.`);
    }
    if (metadata.size !== expectedMetadata.size) {
      failures.push(`El tamaño declarado en ${relativePath} no coincide con el instalador.`);
    }
    if (metadata.blockMapSize !== expectedMetadata.blockMapSize) {
      failures.push(`El blockMapSize de ${relativePath} no coincide con el artefacto local.`);
    }
  });

  const feedDirectories = [
    'release/update-feed/orbitpos',
    'update-server/public/orbitpos'
  ];
  feedDirectories.forEach((relativeDirectory) => {
    const feedInstaller = requireFile(`${relativeDirectory}/${expectedFileName}`);
    if (!feedInstaller) return;
    const feedStats = fs.statSync(feedInstaller);
    if (feedStats.size !== actualSize || sha512Base64(feedInstaller) !== actualHash) {
      failures.push(`El instalador publicado en ${relativeDirectory} no coincide con release/${expectedFileName}.`);
    }

    const feedBlockMap = requireFile(`${relativeDirectory}/${expectedFileName}.blockmap`);
    if (feedBlockMap && fs.statSync(feedBlockMap).size !== expectedBlockMapSize) {
      failures.push(`El blockmap publicado en ${relativeDirectory} no coincide con el artefacto local.`);
    }
  });
}

function checkBrandAndReferences() {
  requireFile('assets/orbitpos-logo.png');
  requireFile('assets/orbitpos-license.png');
  requireFile('frontend/src/assets/orbitpos-logo.png');
  requireFile('frontend/src/assets/orbitpos-license.png');
  ['colmado', 'carniceria', 'embutidos', 'mixto'].forEach((name) => {
    requireFile(`assets/business-types/${name}.png`);
    requireFile(`frontend/src/assets/business-types/${name}.png`);
  });
  ['login-storefront', 'wizard-storefront'].forEach((name) => {
    requireFile(`assets/${name}.png`);
    requireFile(`frontend/src/assets/${name}.png`);
  });

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

  const referenceManifest = requireFile('shared/ui-reference-manifest.json');
  if (referenceManifest) {
    try {
      const manifest = JSON.parse(fs.readFileSync(referenceManifest, 'utf8'));
      [
        ...Object.values(manifest.flows || {}),
        ...Object.values(manifest.modules || {}),
        ...(manifest.alternateReferences || [])
      ].forEach((relativePath) => requireFile(relativePath));
    } catch (error) {
      failures.push(`shared/ui-reference-manifest.json no es valido: ${error.message}`);
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
