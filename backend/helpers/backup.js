const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const {
  DATA_DIR,
  getConfigValue,
  getDb,
  closeDb,
  initDatabase,
  setConfigEntries
} = require('../database');

const BACKUP_PREFIX = 'orbitpos-full-';
const BACKUP_EXTENSION = '.zip';
const MANIFEST_FILENAME = 'manifest.json';

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function normalizeFolderPath(folderPath = '') {
  const cleaned = String(folderPath || '').trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!cleaned) {
    return '';
  }
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

function isManagedBackupFile(fileName = '') {
  return fileName.startsWith(BACKUP_PREFIX) && fileName.endsWith(BACKUP_EXTENSION);
}

function applyLocalRetention(destination, retentionCount) {
  const parsedRetention = Number(retentionCount || 30);
  if (!Number.isFinite(parsedRetention) || parsedRetention <= 0) {
    return;
  }

  const backupFiles = fs.readdirSync(destination)
    .map((name) => ({
      name,
      fullPath: path.join(destination, name),
      stats: fs.statSync(path.join(destination, name))
    }))
    .filter((file) => file.stats.isFile() && isManagedBackupFile(file.name))
    .sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs);

  backupFiles.slice(parsedRetention).forEach((file) => {
    fs.rmSync(file.fullPath, { force: true });
  });
}

function clearDirectoryContents(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  fs.readdirSync(directoryPath).forEach((entry) => {
    fs.rmSync(path.join(directoryPath, entry), {
      recursive: true,
      force: true
    });
  });
}

function copyDirectoryContents(sourceDirectory, destinationDirectory) {
  ensureDirectory(destinationDirectory);

  fs.readdirSync(sourceDirectory, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const destinationPath = path.join(destinationDirectory, entry.name);

    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, destinationPath, {
        recursive: true,
        force: true
      });
      return;
    }

    ensureDirectory(path.dirname(destinationPath));
    fs.copyFileSync(sourcePath, destinationPath);
  });
}

async function createSnapshotData(tempDataDirectory) {
  ensureDirectory(tempDataDirectory);
  await getDb().backup(path.join(tempDataDirectory, 'orbitpos.db'));

  fs.readdirSync(DATA_DIR, { withFileTypes: true }).forEach((entry) => {
    if (['orbitpos.db', 'orbitpos.db-wal', 'orbitpos.db-shm', 'backups'].includes(entry.name)) {
      return;
    }

    const sourcePath = path.join(DATA_DIR, entry.name);
    const destinationPath = path.join(tempDataDirectory, entry.name);

    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, destinationPath, {
        recursive: true,
        force: true
      });
      return;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  });
}

function bundleBusinessLogo(zip) {
  const rawLogoPath = String(getConfigValue('business_logo', '') || '').trim();
  if (!rawLogoPath) {
    return null;
  }

  const resolvedLogoPath = path.resolve(rawLogoPath);
  if (!fs.existsSync(resolvedLogoPath) || !fs.statSync(resolvedLogoPath).isFile()) {
    return null;
  }

  const extension = path.extname(resolvedLogoPath) || '.png';
  const bundledName = `business-logo${extension.toLowerCase()}`;
  zip.addLocalFile(resolvedLogoPath, 'extras', bundledName);

  return {
    archivePath: `extras/${bundledName}`,
    originalPath: resolvedLogoPath
  };
}

async function createLocalBackup(destination = getConfigValue('backup_path', path.join(DATA_DIR, 'backups'))) {
  ensureDirectory(destination);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${BACKUP_PREFIX}${timestamp}${BACKUP_EXTENSION}`;
  const fullPath = path.join(destination, filename);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpos-backup-'));
  const tempDataDirectory = path.join(tempRoot, 'data');

  try {
    await createSnapshotData(tempDataDirectory);

    const zip = new AdmZip();
    zip.addLocalFolder(tempDataDirectory, 'data');

    const bundledLogo = bundleBusinessLogo(zip);
    const manifest = {
      backupType: 'full-system',
      createdAt: new Date().toISOString(),
      businessName: getConfigValue('business_name', 'Mi Negocio'),
      version: '2.0.0',
      contents: [
        'base de datos',
        'configuracion',
        'licencia',
        'usuarios',
        'inventario',
        'ventas',
        'clientes',
        'sucursales',
        'logo del negocio'
      ],
      bundledLogo
    };

    zip.addFile(MANIFEST_FILENAME, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
    zip.writeZip(fullPath);
    applyLocalRetention(destination, getConfigValue('backup_retention_count', '30'));

    return {
      success: true,
      path: fullPath,
      filename,
      backupType: 'full-system',
      manifest
    };
  } finally {
    fs.rmSync(tempRoot, {
      recursive: true,
      force: true
    });
  }
}

async function uploadToDropbox({ filePath, accessToken, folderPath }) {
  const uploadPath = `${normalizeFolderPath(folderPath)}/${path.basename(filePath)}`.replace(/\/+/g, '/');
  const fileBuffer = fs.readFileSync(filePath);
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: uploadPath,
        mode: 'add',
        autorename: true,
        mute: true
      })
    },
    body: fileBuffer
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_summary || 'No fue posible subir el backup a Dropbox.');
  }

  return {
    provider: 'dropbox',
    id: payload.id,
    path: payload.path_display || uploadPath
  };
}

async function uploadToGoogleDrive({ filePath, accessToken, folderId }) {
  const boundary = `orbitpos-${Date.now()}`;
  const metadata = {
    name: path.basename(filePath),
    ...(folderId ? { parents: [folderId] } : {})
  };
  const fileBuffer = fs.readFileSync(filePath);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'No fue posible subir el backup a Google Drive.');
  }

  return {
    provider: 'google-drive',
    id: payload.id,
    path: payload.webViewLink || payload.name
  };
}

async function uploadBackupToCloud(filePath, options = {}) {
  const provider = String(options.provider || getConfigValue('backup_cloud_provider', '')).trim().toLowerCase();
  const accessToken = String(options.token || getConfigValue('backup_cloud_token', '')).trim();
  const targetFolder = String(options.folder || getConfigValue('backup_cloud_folder', '')).trim();

  if (!provider) {
    throw new Error('No hay proveedor de nube configurado.');
  }
  if (!accessToken) {
    throw new Error('Falta el token de acceso para el backup en nube.');
  }

  if (provider === 'dropbox') {
    return uploadToDropbox({
      filePath,
      accessToken,
      folderPath: targetFolder
    });
  }

  if (provider === 'google-drive' || provider === 'gdrive') {
    return uploadToGoogleDrive({
      filePath,
      accessToken,
      folderId: targetFolder
    });
  }

  throw new Error('Proveedor de nube no soportado.');
}

async function createBackup(options = {}) {
  const localBackup = await createLocalBackup(options.destination);
  const cloudEnabled = options.cloudEnabled !== undefined
    ? String(options.cloudEnabled) === 'true' || String(options.cloudEnabled) === '1'
    : getConfigValue('backup_cloud_enabled', '0') === '1';

  if (!cloudEnabled) {
    return {
      ...localBackup,
      cloud: null,
      cloudError: null
    };
  }

  try {
    const cloud = await uploadBackupToCloud(localBackup.path, options);
    return {
      ...localBackup,
      cloud,
      cloudError: null
    };
  } catch (error) {
    return {
      ...localBackup,
      cloud: null,
      cloudError: error.message || 'No fue posible subir el backup a la nube.'
    };
  }
}

function restoreBackup(backupFilePath) {
  const rawBackupPath = String(backupFilePath || '').trim();
  if (!rawBackupPath) {
    throw new Error('Debes seleccionar un archivo de backup para restaurar.');
  }

  const resolvedBackupPath = path.resolve(rawBackupPath);
  if (!fs.existsSync(resolvedBackupPath) || !fs.statSync(resolvedBackupPath).isFile()) {
    throw new Error('No se encontro el backup seleccionado.');
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpos-restore-'));
  const safeBackupCopy = path.join(tempRoot, path.basename(resolvedBackupPath));
  const currentDataSnapshot = path.join(tempRoot, 'current-data');
  const extractedDataDirectory = path.join(tempRoot, 'data');

  try {
    fs.copyFileSync(resolvedBackupPath, safeBackupCopy);
    const zip = new AdmZip(safeBackupCopy);
    zip.extractAllTo(tempRoot, true);

    const manifestPath = path.join(tempRoot, MANIFEST_FILENAME);
    if (!fs.existsSync(manifestPath) || !fs.existsSync(extractedDataDirectory)) {
      throw new Error('El backup no tiene la estructura esperada para OrbitPOS.');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const bundledLogoPath = manifest?.bundledLogo?.archivePath
      ? path.join(tempRoot, ...String(manifest.bundledLogo.archivePath).split('/'))
      : null;

    closeDb();

    if (fs.existsSync(DATA_DIR)) {
      fs.cpSync(DATA_DIR, currentDataSnapshot, {
        recursive: true,
        force: true
      });
    }

    try {
      ensureDirectory(DATA_DIR);
      clearDirectoryContents(DATA_DIR);
      copyDirectoryContents(extractedDataDirectory, DATA_DIR);
      initDatabase();

      let restoredLogoPath = null;
      if (bundledLogoPath && fs.existsSync(bundledLogoPath)) {
        const destinationDirectory = path.join(DATA_DIR, 'restored-assets');
        ensureDirectory(destinationDirectory);
        restoredLogoPath = path.join(destinationDirectory, path.basename(bundledLogoPath));
        fs.copyFileSync(bundledLogoPath, restoredLogoPath);
        setConfigEntries({
          business_logo: restoredLogoPath
        });
      }

      return {
        ok: true,
        backupType: manifest?.backupType || 'full-system',
        restoredFrom: resolvedBackupPath,
        restoredLogoPath,
        manifest
      };
    } catch (restoreError) {
      ensureDirectory(DATA_DIR);
      clearDirectoryContents(DATA_DIR);

      if (fs.existsSync(currentDataSnapshot)) {
        copyDirectoryContents(currentDataSnapshot, DATA_DIR);
      }

      initDatabase();
      throw restoreError;
    }
  } finally {
    fs.rmSync(tempRoot, {
      recursive: true,
      force: true
    });
  }
}

module.exports = {
  createBackup,
  createLocalBackup,
  restoreBackup,
  uploadBackupToCloud
};
