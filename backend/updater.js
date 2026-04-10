const packageJson = require('../package.json');
const { getConfigValue } = require('./database');

const DEFAULT_UPDATE_PROVIDER = 'github';
const DEFAULT_UPDATE_GITHUB_OWNER = 'elx19';
const DEFAULT_UPDATE_GITHUB_REPO = 'OrbitPOS-Public';

function getUpdaterStatus() {
  const provider = String(getConfigValue('update_provider', DEFAULT_UPDATE_PROVIDER) || DEFAULT_UPDATE_PROVIDER).trim().toLowerCase();
  const feedUrl = String(getConfigValue('update_feed_url', '') || '').trim();
  const githubOwner = String(getConfigValue('update_github_owner', DEFAULT_UPDATE_GITHUB_OWNER) || DEFAULT_UPDATE_GITHUB_OWNER).trim();
  const githubRepo = String(getConfigValue('update_github_repo', DEFAULT_UPDATE_GITHUB_REPO) || DEFAULT_UPDATE_GITHUB_REPO).trim();
  const channel = getConfigValue('update_channel', 'stable');
  const effectiveProvider = provider === 'generic' && !feedUrl && githubOwner && githubRepo
    ? 'github'
    : provider;
  const configured = effectiveProvider === 'github'
    ? Boolean(githubOwner && githubRepo)
    : Boolean(feedUrl);

  return {
    currentVersion: packageJson.version,
    provider: effectiveProvider,
    githubOwner,
    githubRepo,
    channel,
    updateAvailable: false,
    latestVersion: packageJson.version,
    configured,
    notes: configured
      ? effectiveProvider === 'github'
        ? 'El canal de actualizaciones esta configurado para GitHub Releases publicas.'
        : 'El canal de actualizaciones esta configurado. Usa la app de escritorio para buscar nuevas versiones.'
      : effectiveProvider === 'github'
        ? 'Configura propietario y repositorio publico de GitHub para habilitar el updater.'
        : 'Configura la URL del servidor de actualizaciones para habilitar el auto-updater.'
  };
}

module.exports = {
  getUpdaterStatus
};
