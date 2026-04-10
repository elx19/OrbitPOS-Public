const { EventEmitter } = require('events');
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

const DEFAULT_UPDATE_PROVIDER = 'github';
const DEFAULT_UPDATE_GITHUB_OWNER = 'elx19';
const DEFAULT_UPDATE_GITHUB_REPO = 'OrbitPOS-Public';
const DEFAULT_UPDATE_GITHUB_RELEASE_TYPE = 'release';

let listenersAttached = false;
let currentCheckPromise = null;
const updaterEvents = new EventEmitter();
const SAFE_ERROR_EVENT = 'updater-error';

const updaterState = {
  currentVersion: app.getVersion(),
  latestVersion: app.getVersion(),
  provider: DEFAULT_UPDATE_PROVIDER,
  githubOwner: DEFAULT_UPDATE_GITHUB_OWNER,
  githubRepo: DEFAULT_UPDATE_GITHUB_REPO,
  channel: 'stable',
  configured: false,
  checking: false,
  updateAvailable: false,
  downloading: false,
  downloaded: false,
  progress: 0,
  lastCheckedAt: null,
  notes: 'Actualizador pendiente de configurar.',
  error: null
};

function emitUpdaterEvent(eventName) {
  const safeEventName = eventName === 'error' ? SAFE_ERROR_EVENT : eventName;
  updaterEvents.emit(safeEventName, { ...updaterState });
  updaterEvents.emit('state-changed', {
    eventName: safeEventName,
    state: { ...updaterState }
  });
}

function resolveUpdaterChannel(provider, configuredChannel) {
  const normalizedChannel = String(configuredChannel || 'stable').trim().toLowerCase();

  if (provider === 'github') {
    return normalizedChannel === 'beta' ? 'beta' : 'latest';
  }

  return normalizedChannel || 'stable';
}

function normalizeUpdaterError(provider, error) {
  const rawMessage = String(error?.message || error || '').trim();

  if (provider === 'github') {
    if (/stable\.yml/i.test(rawMessage) && /\b404\b/.test(rawMessage)) {
      return 'La release publica no incluye el manifiesto estable del actualizador. Publica stable.yml junto a latest.yml en GitHub Releases.';
    }

    if (/releases\.atom/i.test(rawMessage) && /\b404\b/.test(rawMessage)) {
      return 'GitHub Releases no puede comprobar actualizaciones desde un repositorio privado. Para clientes finales usa un repositorio publico de updates o cambia a Servidor generico.';
    }

    if ((/\b401\b/.test(rawMessage) || /\b403\b/.test(rawMessage)) && /github/i.test(rawMessage)) {
      return 'GitHub rechazo la verificacion de actualizaciones. Verifica que el repositorio de updates sea publico o usa un feed generico.';
    }
  }

  return rawMessage || 'No fue posible comprobar actualizaciones en este momento.';
}

function pushNotification(message, dedupeMinutes = 180) {
  try {
    const { getDb } = require('../backend/database');
    const db = getDb();

    if (dedupeMinutes > 0) {
      const duplicate = db.prepare(`
        SELECT id
        FROM notifications
        WHERE type = 'system'
          AND message = ?
          AND created_at >= datetime('now', ?)
        ORDER BY created_at DESC
        LIMIT 1
      `).get(message, `-${Number(dedupeMinutes) || 180} minutes`);

      if (duplicate) {
        return;
      }
    }

    db.prepare(`
      INSERT INTO notifications (type, message)
      VALUES ('system', ?)
    `).run(message);
  } catch (error) {
    // Ignore notification write errors to avoid blocking updater flow.
  }
}

function refreshConfiguration() {
  const { getConfigValue } = require('../backend/database');
  const provider = String(getConfigValue('update_provider', DEFAULT_UPDATE_PROVIDER) || DEFAULT_UPDATE_PROVIDER).trim().toLowerCase();
  const channel = getConfigValue('update_channel', 'stable');
  const feedUrl = String(getConfigValue('update_feed_url', '') || '').trim();
  const githubOwner = String(getConfigValue('update_github_owner', DEFAULT_UPDATE_GITHUB_OWNER) || DEFAULT_UPDATE_GITHUB_OWNER).trim();
  const githubRepo = String(getConfigValue('update_github_repo', DEFAULT_UPDATE_GITHUB_REPO) || DEFAULT_UPDATE_GITHUB_REPO).trim();
  const githubReleaseType = String(getConfigValue('update_github_release_type', DEFAULT_UPDATE_GITHUB_RELEASE_TYPE) || DEFAULT_UPDATE_GITHUB_RELEASE_TYPE).trim().toLowerCase();
  const effectiveProvider = provider === 'generic' && !feedUrl && githubOwner && githubRepo
    ? 'github'
    : provider;
  updaterState.currentVersion = app.getVersion();
  updaterState.provider = effectiveProvider;
  updaterState.githubOwner = githubOwner;
  updaterState.githubRepo = githubRepo;
  updaterState.channel = channel;
  updaterState.configured = effectiveProvider === 'github'
    ? Boolean(githubOwner && githubRepo)
    : Boolean(feedUrl);

  if (!app.isPackaged) {
    updaterState.notes = 'El auto-updater solo verifica versiones en la app empaquetada.';
  } else if (!updaterState.configured) {
    updaterState.notes = effectiveProvider === 'github'
      ? 'Configura un owner y repositorio publico de GitHub Releases para habilitar el updater.'
      : 'Configura la URL del servidor de actualizaciones para habilitar el updater.';
  } else if (!updaterState.lastCheckedAt) {
    updaterState.notes = effectiveProvider === 'github'
      ? 'Listo para buscar actualizaciones desde GitHub Releases publicas.'
      : 'Listo para buscar actualizaciones.';
  }

  return {
    provider: effectiveProvider,
    channel,
    feedUrl,
    githubOwner,
    githubRepo,
    githubReleaseType
  };
}

function attachListeners() {
  if (listenersAttached) {
    return;
  }

  listenersAttached = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updaterState.checking = true;
    updaterState.error = null;
    updaterState.notes = 'Buscando actualizaciones...';
    emitUpdaterEvent('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    updaterState.checking = false;
    updaterState.updateAvailable = true;
    updaterState.downloaded = false;
    updaterState.downloading = false;
    updaterState.latestVersion = info?.version || updaterState.latestVersion;
    updaterState.notes = `Nueva version disponible: ${updaterState.latestVersion}.`;
    pushNotification(`Nueva actualizacion disponible: ${updaterState.latestVersion}.`, 360);
    emitUpdaterEvent('update-available');
  });

  autoUpdater.on('update-not-available', (info) => {
    updaterState.checking = false;
    updaterState.updateAvailable = false;
    updaterState.downloading = false;
    updaterState.downloaded = false;
    updaterState.progress = 0;
    updaterState.latestVersion = info?.version || updaterState.currentVersion;
    updaterState.notes = 'Ya tienes la version mas reciente instalada.';
    emitUpdaterEvent('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    updaterState.downloading = true;
    updaterState.progress = Number(progress?.percent || 0);
    updaterState.notes = `Descargando actualizacion (${updaterState.progress.toFixed(0)}%).`;
    emitUpdaterEvent('download-progress');
  });

  autoUpdater.on('update-downloaded', (info) => {
    updaterState.downloading = false;
    updaterState.downloaded = true;
    updaterState.latestVersion = info?.version || updaterState.latestVersion;
    updaterState.notes = `Actualizacion ${updaterState.latestVersion} lista para instalar.`;
    pushNotification(`Actualizacion ${updaterState.latestVersion} lista para instalar.`, 360);
    emitUpdaterEvent('update-downloaded');
  });

  autoUpdater.on('error', (error) => {
    updaterState.checking = false;
    updaterState.downloading = false;
    updaterState.error = error?.message || 'Error desconocido del updater.';
    updaterState.notes = updaterState.error;
    pushNotification(`Error del actualizador: ${updaterState.error}`, 720);
    emitUpdaterEvent('error');
  });
}

function initializeUpdater() {
  attachListeners();
  refreshConfiguration();
  return updaterState;
}

function getUpdaterState() {
  refreshConfiguration();
  return updaterState;
}

async function checkForOrbitUpdates() {
  if (currentCheckPromise) {
    return currentCheckPromise;
  }

  currentCheckPromise = (async () => {
  const {
    provider,
    channel,
    feedUrl,
    githubOwner,
    githubRepo,
    githubReleaseType
  } = refreshConfiguration();

  updaterState.lastCheckedAt = new Date().toISOString();
  updaterState.error = null;
  updaterState.progress = 0;

  if (!app.isPackaged) {
    return updaterState;
  }

  if (!updaterState.configured) {
    updaterState.notes = provider === 'github'
      ? 'Debes configurar propietario y repositorio publico de GitHub Releases.'
      : 'Debes configurar la URL del servidor de actualizaciones.';
    return updaterState;
  }

  const updaterChannel = resolveUpdaterChannel(provider, channel);
  autoUpdater.channel = updaterChannel;
  autoUpdater.allowPrerelease = updaterChannel === 'beta';

  if (provider === 'github') {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: githubOwner,
      repo: githubRepo,
      releaseType: githubReleaseType
    });
  } else {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
      channel
    });
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = normalizeUpdaterError(provider, error);
    updaterState.checking = false;
    updaterState.downloading = false;
    updaterState.error = message;
    updaterState.notes = message;
    throw new Error(message);
  }

  return updaterState;
  })();

  try {
    return await currentCheckPromise;
  } finally {
    currentCheckPromise = null;
  }
}

async function downloadOrbitUpdate() {
  refreshConfiguration();

  if (!app.isPackaged) {
    updaterState.notes = 'La descarga de actualizaciones solo funciona en la app empaquetada.';
    return updaterState;
  }

  if (!updaterState.updateAvailable) {
    updaterState.notes = 'No hay actualizacion disponible para descargar.';
    return updaterState;
  }

  await autoUpdater.downloadUpdate();
  return updaterState;
}

function installOrbitUpdate() {
  if (!updaterState.downloaded) {
    return updaterState;
  }

  setImmediate(() => autoUpdater.quitAndInstall());
  return updaterState;
}

function onUpdaterEvent(eventName, listener) {
  updaterEvents.on(eventName, listener);
  return () => {
    updaterEvents.off(eventName, listener);
  };
}

module.exports = {
  initializeUpdater,
  getUpdaterState,
  checkForOrbitUpdates,
  downloadOrbitUpdate,
  installOrbitUpdate,
  onUpdaterEvent
};
