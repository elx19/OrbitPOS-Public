const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');

const releaseDir = path.join(__dirname, '..', 'release');
const installerName = `OrbitPOS Setup ${packageJson.version}.exe`;
const installerPath = path.join(releaseDir, installerName);
const blockMapName = `${installerName}.blockmap`;
const blockMapPath = path.join(releaseDir, blockMapName);
const githubInstallerName = installerName.replace(/ /g, '.');
const githubInstallerPath = path.join(releaseDir, githubInstallerName);
const githubBlockMapName = `${githubInstallerName}.blockmap`;
const githubBlockMapPath = path.join(releaseDir, githubBlockMapName);
const latestPath = path.join(releaseDir, 'latest.yml');

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontro el archivo requerido: ${filePath}`);
  }
}

function ensureGithubReleaseAliases() {
  fs.copyFileSync(installerPath, githubInstallerPath);

  if (fs.existsSync(blockMapPath)) {
    fs.copyFileSync(blockMapPath, githubBlockMapPath);
  }
}

function generateManifest() {
  ensureFileExists(installerPath);
  ensureGithubReleaseAliases();

  const installerStats = fs.statSync(githubInstallerPath);
  const installerSha512 = sha512Base64(githubInstallerPath);
  const blockMapSize = fs.existsSync(githubBlockMapPath)
    ? fs.statSync(githubBlockMapPath).size
    : 0;

  const manifest = [
    `version: ${packageJson.version}`,
    'files:',
    `  - url: ${githubInstallerName}`,
    `    sha512: ${installerSha512}`,
    `    size: ${installerStats.size}`,
    `path: ${githubInstallerName}`,
    `sha512: ${installerSha512}`,
    `releaseDate: '${new Date(installerStats.mtime).toISOString()}'`,
    `blockMapSize: ${blockMapSize}`
  ].join('\n');

  fs.writeFileSync(latestPath, `${manifest}\n`, 'utf8');
  return latestPath;
}

try {
  const manifestPath = generateManifest();
  console.log(`Manifest generado en ${manifestPath}`);
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
