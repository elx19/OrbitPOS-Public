#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  LICENSE_DAYS_BY_TYPE,
  assertLicenseType,
  createLicenseKey,
  decodeLicenseKey,
  verifyLicensePayload,
  getPublicKeyFingerprint,
  getPrivateKeyPublicKeyFingerprint
} = require('../shared/license-core');
const { getMachineId } = require('../shared/machine-id');

function printUsage() {
  console.log(`OrbitPOS license-generator

Comandos:
  generate  --private-key-file clave-privada.pem --machine-id ID --business "Nombre" --type monthly [opciones]
  decode    --key ORB2....
  verify    --key ORB2.... [--key-file ruta.txt]
  fingerprint --public-key-file ruta.pem
  machine-id              Muestra el identificador de esta maquina

Opciones de generate:
  --edition standard       Edicion comercial
  --version-min 2.1.0     Version minima compatible
  --expires-at ISO         Expiracion exacta; omite para calcular por tipo
  --issued-at ISO          Emision exacta; util para migraciones o QA
  --serial JR-...         Serial manual opcional
  --out ruta.txt           Guarda la clave sin imprimir secretos adicionales
  --private-key-file ruta  Firma una licencia ORB3 con una clave Ed25519 externa (recomendado)
  --public-key-file ruta   Verifica que la publica corresponde a --private-key-file
  --legacy-orb2             Permite emitir ORB2 solo para compatibilidad heredada
  --force                  Permite reemplazar --out si ya existe
  --json                   Devuelve respuesta JSON

Opciones de keygen:
  keygen --private-out ruta.pem --public-out ruta.pem
  Genera un par Ed25519. La clave privada debe conservarse fuera del repositorio.

Opciones de verify:
  --machine-id ID          Comprueba que la licencia pertenece a la maquina
  --version 2.1.0          Comprueba la version minima compatible
  --key-file ruta.txt      Lee la clave desde un archivo

Opciones generales:
  --secret-file ruta.txt   Lee la clave privada desde un archivo fuera del repositorio
  --key-file ruta.txt      Lee la licencia desde un archivo en decode o verify
  fingerprint devuelve SHA-256 de la clave publica en formato sha256:...

Tipos admitidos: ${Object.keys(LICENSE_DAYS_BY_TYPE).join(', ')}
ORB3 usa Ed25519 y es el formato de emision predeterminado. ORB2 requiere la opcion
explicita --legacy-orb2 y ORBITPOS_LICENSE_SECRET. ORB3 usa Ed25519: el generador conserva la
clave privada y el POS solo necesita la clave publica incluida en shared/license-public-key.pem.
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

function writeTextFile(filePath, content, { force = false, mode = 0o600 } = {}) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  if (fs.existsSync(absolutePath) && !force) {
    throw new Error(`El archivo de salida ya existe: ${absolutePath}. Usa --force para reemplazarlo.`);
  }

  const temporaryPath = `${absolutePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${content}\n`, { encoding: 'utf8', mode });
    try {
      fs.chmodSync(temporaryPath, mode);
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

function writeKeyFile(filePath, key, options = {}) {
  return writeTextFile(filePath, key, options);
}

function readPrivateSigningKey(options) {
  const privateKeyPath = path.resolve(String(options['private-key-file'] || ''));
  if (!options['private-key-file']) {
    throw new Error('Falta la opcion --private-key-file para generar una licencia ORB3.');
  }
  if (!fs.existsSync(privateKeyPath) || !fs.statSync(privateKeyPath).isFile()) {
    throw new Error(`No existe la clave privada: ${privateKeyPath}`);
  }
  if (fs.statSync(privateKeyPath).size > 16 * 1024) {
    throw new Error('El archivo de clave privada excede el tamano maximo permitido de 16 KB.');
  }
  try {
    return crypto.createPrivateKey(fs.readFileSync(privateKeyPath, 'utf8'));
  } catch (error) {
    throw new Error(`La clave privada no es valida: ${error.message}`);
  }
}

function readPublicSigningKey(options) {
  const publicKeyPath = path.resolve(String(options['public-key-file'] || ''));
  if (!options['public-key-file']) {
    throw new Error('Falta la opcion --public-key-file.');
  }
  if (!fs.existsSync(publicKeyPath) || !fs.statSync(publicKeyPath).isFile()) {
    throw new Error(`No existe la clave publica: ${publicKeyPath}`);
  }
  if (fs.statSync(publicKeyPath).size > 16 * 1024) {
    throw new Error('El archivo de clave publica excede el tamano maximo permitido de 16 KB.');
  }
  try {
    return crypto.createPublicKey(fs.readFileSync(publicKeyPath, 'utf8'));
  } catch (error) {
    throw new Error(`La clave publica no es valida: ${error.message}`);
  }
}

function generateKeyPair(options) {
  const privateOut = requiredOption(options, 'private-out');
  const publicOut = requiredOption(options, 'public-out');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privatePath = writeTextFile(privateOut, privatePem, { force: Boolean(options.force), mode: 0o600 });
  const publicPath = writeTextFile(publicOut, publicPem, { force: Boolean(options.force), mode: 0o644 });
  const result = {
    ok: true,
    command: 'keygen',
    privatePath,
    publicPath,
    algorithm: 'ed25519',
    publicKeyFingerprint: getPublicKeyFingerprint(publicKey)
  };
  return options.json ? result : `Clave privada: ${privatePath}\nClave publica: ${publicPath}`;
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

  if (command === 'keygen') {
    return generateKeyPair(options);
  }

  if (command === 'fingerprint') {
    const publicKey = readPublicSigningKey(options);
    const fingerprint = getPublicKeyFingerprint(publicKey);
    const result = { ok: true, command, algorithm: 'ed25519', fingerprint };
    return options.json ? result : fingerprint;
  }

  if (command === 'generate') {
    const machineId = requiredOption(options, 'machine-id');
    const businessName = requiredOption(options, 'business');
    const licenseType = assertLicenseType(requiredOption(options, 'type'));
    const signingKey = options['private-key-file'] ? readPrivateSigningKey(options) : null;
    const legacyOrb2 = Boolean(options['legacy-orb2']);
    if (!signingKey && !legacyOrb2) {
      throw new Error('La emision segura usa ORB3. Indica --private-key-file o usa --legacy-orb2 solo para compatibilidad heredada.');
    }
    if (signingKey && legacyOrb2) {
      throw new Error('No combines --private-key-file con --legacy-orb2.');
    }
    let publicKeyFingerprint = null;
    if (signingKey) {
      publicKeyFingerprint = getPrivateKeyPublicKeyFingerprint(signingKey);
      if (options['public-key-file']) {
        const publicKey = readPublicSigningKey(options);
        const expectedFingerprint = getPublicKeyFingerprint(publicKey);
        if (expectedFingerprint !== publicKeyFingerprint) {
          throw new Error('La clave publica no corresponde a la clave privada indicada.');
        }
      }
    } else if (options['public-key-file']) {
      throw new Error('Usa --public-key-file junto con --private-key-file para validar un par ORB3.');
    }
    if (signingKey && options['secret-file']) {
      throw new Error('Usa --private-key-file o --secret-file, no ambos.');
    }
    const key = createLicenseKey({
      machineId,
      businessName,
      licenseType,
      expiresAt: options['expires-at'] || undefined,
      issuedAt: options['issued-at'] || undefined,
      edition: options.edition || 'standard',
      versionMinCompatible: options['version-min'] || undefined,
      serial: options.serial || undefined,
      signingKey
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
      outputPath,
      publicKeyFingerprint
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
    if (options['secret-file']) {
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
