#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  LICENSE_DAYS_BY_TYPE,
  assertLicenseType,
  createLicenseKey,
  decodeLicenseKey,
  verifyLicensePayload
} = require('../shared/license-core');
const { getMachineId } = require('../shared/machine-id');

function printUsage() {
  console.log(`OrbitPOS license-generator

Comandos:
  generate  --machine-id ID --business "Nombre" --type monthly [opciones]
  decode    --key ORB2....
  verify    --key ORB2.... [--key-file ruta.txt]
  machine-id              Muestra el identificador de esta maquina

Opciones de generate:
  --edition standard       Edicion comercial
  --version-min 2.1.0     Version minima compatible
  --expires-at ISO         Expiracion exacta; omite para calcular por tipo
  --issued-at ISO          Emision exacta; util para migraciones o QA
  --serial JR-...         Serial manual opcional
  --out ruta.txt           Guarda la clave sin imprimir secretos adicionales
  --force                  Permite reemplazar --out si ya existe
  --json                   Devuelve respuesta JSON

Opciones de verify:
  --machine-id ID          Comprueba que la licencia pertenece a la maquina
  --version 2.1.0          Comprueba la version minima compatible
  --key-file ruta.txt      Lee la clave desde un archivo

Opciones generales:
  --secret-file ruta.txt   Lee la clave privada desde un archivo fuera del repositorio
  --key-file ruta.txt      Lee la licencia desde un archivo en decode o verify

Tipos admitidos: ${Object.keys(LICENSE_DAYS_BY_TYPE).join(', ')}
Requiere ORBITPOS_LICENSE_SECRET en el entorno del generador y del POS.
`);
}

function parseArguments(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      result[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      result[rawKey] = true;
      continue;
    }

    result[rawKey] = nextToken;
    index += 1;
  }
  return result;
}

function requiredOption(options, key, label = key) {
  const value = String(options[key] || '').trim();
  if (!value) {
    throw new Error(`Falta la opcion --${label}.`);
  }
  return value;
}

function readLicenseKey(options) {
  if (options.key && options['key-file']) {
    throw new Error('Usa --key o --key-file, no ambos.');
  }
  if (options['key-file']) {
    const filePath = path.resolve(String(options['key-file']));
    if (!fs.existsSync(filePath)) {
      throw new Error(`No existe el archivo de licencia: ${filePath}`);
    }
    const stats = fs.statSync(filePath);
    if (stats.size > 32 * 1024) {
      throw new Error('El archivo de licencia excede el tamano maximo permitido de 32 KB.');
    }
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return requiredOption(options, 'key');
}

function safePayload(payload) {
  return {
    schema: payload.schema,
    machineId: payload.machineId,
    businessName: payload.businessName,
    licenseType: payload.licenseType,
    edition: payload.edition,
    serial: payload.serial,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    version: payload.version,
    versionMinCompatible: payload.versionMinCompatible
  };
}

function writeKeyFile(filePath, key, { force = false } = {}) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  if (fs.existsSync(absolutePath) && !force) {
    throw new Error(`El archivo de salida ya existe: ${absolutePath}. Usa --force para reemplazarlo.`);
  }

  const temporaryPath = `${absolutePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${key}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.chmodSync(temporaryPath, 0o600);
    } catch (error) {
      // Windows puede no exponer permisos POSIX; el archivo ya fue creado correctamente.
    }

    if (force && fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { force: true });
    }
    fs.renameSync(temporaryPath, absolutePath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
    throw error;
  }
  return absolutePath;
}

function loadSecretFromOptions(options) {
  if (!options['secret-file']) {
    return;
  }

  if (process.env.ORBITPOS_LICENSE_SECRET) {
    throw new Error('Usa ORBITPOS_LICENSE_SECRET o --secret-file, no ambos.');
  }

  const secretPath = path.resolve(String(options['secret-file']));
  if (!fs.existsSync(secretPath) || !fs.statSync(secretPath).isFile()) {
    throw new Error(`No existe el archivo de secreto: ${secretPath}`);
  }

  if (fs.statSync(secretPath).size > 16 * 1024) {
    throw new Error('El archivo de secreto excede el tamano maximo permitido de 16 KB.');
  }

  const secret = fs.readFileSync(secretPath, 'utf8').trim();
  if (!secret) {
    throw new Error(`El archivo de secreto esta vacio: ${secretPath}`);
  }

  process.env.ORBITPOS_LICENSE_SECRET = secret;
}

function run(command, options) {
  if (command === 'machine-id') {
    const machineId = getMachineId();
    return options.json
      ? { ok: true, command, machineId }
      : machineId;
  }

  if (command === 'generate') {
    const machineId = requiredOption(options, 'machine-id');
    const businessName = requiredOption(options, 'business');
    const licenseType = assertLicenseType(requiredOption(options, 'type'));
    const key = createLicenseKey({
      machineId,
      businessName,
      licenseType,
      expiresAt: options['expires-at'] || undefined,
      issuedAt: options['issued-at'] || undefined,
      edition: options.edition || 'standard',
      versionMinCompatible: options['version-min'] || undefined,
      serial: options.serial || undefined
    });
    const payload = decodeLicenseKey(key);
    const outputPath = options.out
      ? writeKeyFile(options.out, key, { force: Boolean(options.force) })
      : null;
    const result = {
      ok: true,
      command,
      key,
      payload: safePayload(payload),
      outputPath
    };
    return options.json ? result : [key, outputPath ? `Guardada en: ${outputPath}` : ''].filter(Boolean).join('\n');
  }

  if (command === 'decode' || command === 'verify') {
    const key = readLicenseKey(options);
    let payload;
    try {
      payload = decodeLicenseKey(key);
    } catch (error) {
      if (command !== 'verify') {
        throw error;
      }

      const invalidResult = {
        ok: false,
        command,
        valid: false,
        payload: null,
        verification: {
          valid: false,
          cryptographicallyValid: false,
          reason: error.message
        },
        error: error.message
      };
      return options.json
        ? invalidResult
        : `Licencia no valida\n${JSON.stringify(invalidResult.verification, null, 2)}`;
    }
    const result = {
      ok: true,
      command,
      valid: true,
      payload: safePayload(payload)
    };
    if (command === 'verify') {
      result.verification = verifyLicensePayload(payload, {
        machineId: options['machine-id'] || null,
        appVersion: options.version || undefined
      });
      result.valid = result.verification.valid;
    }
    if (options.json) return result;
    const status = command === 'verify' && !result.valid ? 'Licencia no valida' : 'Firma de licencia valida';
    return `${status}\n${JSON.stringify(command === 'verify' ? { ...result.payload, verification: result.verification } : result.payload, null, 2)}`;
  }

  throw new Error(`Comando no reconocido: ${command || '(ninguno)'}`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const command = options._[0];
  if (!command || options.help) {
    printUsage();
    return;
  }

  try {
    if (command !== 'machine-id') {
      loadSecretFromOptions(options);
    }
    const result = run(command, options);
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    const verificationFailed = command === 'verify'
      && (result?.valid === false || (typeof result === 'string' && result.startsWith('Licencia no valida')));
    if (verificationFailed) {
      process.exitCode = 2;
    }
  } catch (error) {
    if (options.json) {
      console.log(JSON.stringify({
        ok: false,
        command: command || null,
        error: error.message
      }, null, 2));
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

main();
