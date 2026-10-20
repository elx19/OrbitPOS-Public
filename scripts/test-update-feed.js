#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const packageJson = require('../package.json');

const root = path.resolve(__dirname, '..');
const version = packageJson.version;
const installerName = `OrbitPOS.Setup.${version}.exe`;
const feedRoots = [
  path.join(root, 'release', 'update-feed', 'orbitpos'),
  path.join(root, 'update-server', 'public', 'orbitpos')
];

function fail(message) {
  throw new Error(message);
}

function sha512Base64(buffer) {
  return crypto.createHash('sha512').update(buffer).digest('base64');
}

function parseManifest(content) {
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

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) fail(`Falta ${filePath}.`);
  return fs.readFileSync(filePath);
}

function requestBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        if (response.statusCode !== 200) {
          reject(new Error(`${url} respondio ${response.statusCode}.`));
          return;
        }
        resolve(body);
      });
    });
    request.on('error', reject);
  });
}

async function main() {
  const sourceInstaller = readRequired(path.join(root, 'release', installerName));
  const expectedHash = sha512Base64(sourceInstaller);
  const expectedSize = sourceInstaller.length;
  const expectedManifest = {
    version,
    fileName: installerName,
    sha512: expectedHash,
    size: expectedSize
  };

  for (const feedRoot of feedRoots) {
    for (const manifestName of ['latest.yml', 'stable.yml']) {
      const manifest = parseManifest(readRequired(path.join(feedRoot, manifestName)).toString('utf8'));
      for (const [key, expected] of Object.entries(expectedManifest)) {
        if (manifest[key] !== expected) {
          fail(`${path.relative(root, feedRoot)}\\${manifestName}: ${key} no coincide.`);
        }
      }
    }
    const feedInstaller = readRequired(path.join(feedRoot, installerName));
    if (feedInstaller.length !== expectedSize || sha512Base64(feedInstaller) !== expectedHash) {
      fail(`${path.relative(root, feedRoot)} contiene un instalador distinto.`);
    }
  }

  const serverRoot = feedRoots[1];
  const server = http.createServer((request, response) => {
    const relative = decodeURIComponent(request.url.replace(/^\//, ''));
    const filePath = path.resolve(serverRoot, relative);
    if (!filePath.startsWith(`${serverRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200);
    response.end(fs.readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const manifest = parseManifest((await requestBuffer(`http://127.0.0.1:${port}/stable.yml`)).toString('utf8'));
    const downloaded = await requestBuffer(`http://127.0.0.1:${port}/${installerName}`);
    if (manifest.version !== version || downloaded.length !== expectedSize || sha512Base64(downloaded) !== expectedHash) {
      fail('El feed HTTP local no entrega la version/hash esperados.');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`Update feed QA: OK (${version}, latest/stable y descarga HTTP verificados)`);
}

main().catch((error) => {
  console.error(`Update feed QA: FALLO\n- ${error.message}`);
  process.exitCode = 1;
});
