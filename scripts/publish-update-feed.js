const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const projectRoot = path.join(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');
const staticFeedDir = path.join(releaseDir, 'update-feed', 'orbitpos');
const serverFeedDir = path.join(projectRoot, 'update-server', 'public', 'orbitpos');

const installerName = `OrbitPOS Setup ${packageJson.version}.exe`;
const githubInstallerName = installerName.replace(/ /g, '.');
const requiredFiles = [
  githubInstallerName,
  `${githubInstallerName}.blockmap`,
  'latest.yml',
  'stable.yml'
];

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontro el archivo requerido: ${filePath}`);
  }
}

function copyFileWithRetry(sourcePath, destinationPath, retries = 12) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.copyFileSync(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code) || attempt === retries) {
        throw error;
      }

      const waitUntil = Date.now() + 500 * (attempt + 1);
      while (Date.now() < waitUntil) {
        // Espera corta para reintentar cuando Windows suelta el lock del instalador.
      }
    }
  }
}

function publishTo(destination) {
  ensureDirectory(destination);

  requiredFiles.forEach((fileName) => {
    const sourcePath = path.join(releaseDir, fileName);
    const destinationPath = path.join(destination, fileName);
    ensureFileExists(sourcePath);
    copyFileWithRetry(sourcePath, destinationPath);
  });
}

try {
  publishTo(staticFeedDir);
  publishTo(serverFeedDir);
  console.log(`Feed estatico publicado en ${staticFeedDir}`);
  console.log(`Feed del servidor publicado en ${serverFeedDir}`);
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
