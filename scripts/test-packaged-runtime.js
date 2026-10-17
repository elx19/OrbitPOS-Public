#!/usr/bin/env node

const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const packageJson = require('../package.json');

const root = path.resolve(__dirname, '..');
const executablePath = path.join(root, 'release', 'win-unpacked', 'OrbitPOS.exe');
const qaDataRoot = path.join(root, '.qa', 'packaged-runtime');

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;
      probe.close(() => resolve(port));
    });
  });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Respuesta JSON invalida: ${error.message}`));
        }
      });
    });
    request.setTimeout(1500, () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

async function waitForJson(url, child, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`OrbitPOS termino antes de responder (codigo ${child.exitCode}).`);
    }
    try {
      return await requestJson(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Tiempo agotado esperando ${url}: ${lastError?.message || 'sin respuesta'}`);
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore'
      });
    } catch (error) {
      // El proceso pudo terminar justo antes de taskkill.
    }
    return;
  }
  child.kill('SIGTERM');
}

async function main() {
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Falta el ejecutable empaquetado: ${executablePath}`);
  }

  const port = await getAvailablePort();
  const dataDirectory = path.join(qaDataRoot, `${Date.now()}-${process.pid}`);
  fs.mkdirSync(dataDirectory, { recursive: true });

  let child = null;
  try {
    child = spawn(executablePath, [], {
      cwd: root,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: String(port),
        ORBITPOS_DATA_DIR: dataDirectory,
        ORBITPOS_LICENSE_SECRET: process.env.ORBITPOS_LICENSE_SECRET || 'orbitpos-packaged-qa-secret-2026'
      }
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const health = await waitForJson(`${baseUrl}/api/health`, child);
    if (!health.ok || health.version !== packageJson.version) {
      throw new Error(`Health check inesperado: ${JSON.stringify(health)}`);
    }

    const meta = await requestJson(`${baseUrl}/api/meta`);
    if (meta.version !== packageJson.version || meta.updater?.currentVersion !== packageJson.version) {
      throw new Error(`Meta check inesperado: ${JSON.stringify(meta)}`);
    }

    console.log(`Packaged runtime QA: OK (${packageJson.version}, puerto ${port})`);
  } finally {
    stopProcessTree(child);
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      fs.rmSync(dataDirectory, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Aviso: no se pudo limpiar ${dataDirectory}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(`Packaged runtime QA: FALLO\n${error.message || error}`);
  process.exitCode = 1;
});
