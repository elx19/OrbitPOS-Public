import { useEffect, useState } from 'react';
import LoginScreen from './components/Auth/LoginScreen';
import WizardScreen from './components/Wizard/WizardScreen';
import AppShell from './components/Layout/AppShell';
import LicenseGate from './components/License/LicenseGate';
import { apiRequest } from './lib/api';

const SESSION_STORAGE_KEY = 'orbitpos.session';
const THEME_STORAGE_KEY = 'orbitpos.theme';
const UI_SCALE_STORAGE_KEY = 'orbitpos.uiScale';
const WORKSPACE_WIDTH_STORAGE_KEY = 'orbitpos.workspaceWidth';
const SIDEBAR_COMPACT_STORAGE_KEY = 'orbitpos.sidebarCompact';
const ALLOWED_THEMES = new Set(['light', 'dark', 'ocean', 'forest', 'sunset']);
const ALLOWED_UI_SCALES = new Set(['90', '100', '110', '120']);
const ALLOWED_WORKSPACE_WIDTHS = new Set(['compact', 'balanced', 'wide', 'full']);
const DEFAULT_UPDATE_PROVIDER = 'github';
const DEFAULT_UPDATE_GITHUB_OWNER = 'elx19';
const DEFAULT_UPDATE_GITHUB_REPO = 'OrbitPOS-Public';

function getStoredValue(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (error) {
    return fallback;
  }
}

function getStoredSession() {
  try {
    const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    return null;
  }
}

function persistSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function getStoredTheme() {
  const theme = getStoredValue(THEME_STORAGE_KEY, 'light');
  return ALLOWED_THEMES.has(theme) ? theme : 'light';
}

function getStoredUiScale() {
  const value = getStoredValue(UI_SCALE_STORAGE_KEY, '100');
  return ALLOWED_UI_SCALES.has(value) ? value : '100';
}

function getStoredWorkspaceWidth() {
  const value = getStoredValue(WORKSPACE_WIDTH_STORAGE_KEY, 'full');
  return ALLOWED_WORKSPACE_WIDTHS.has(value) ? value : 'full';
}

function getStoredSidebarCompact() {
  return getStoredValue(SIDEBAR_COMPACT_STORAGE_KEY, '0') === '1' ? '1' : '0';
}

function applyAppearance(configMap) {
  const theme = ALLOWED_THEMES.has(configMap.theme) ? configMap.theme : 'light';
  const uiScale = ALLOWED_UI_SCALES.has(String(configMap.ui_scale)) ? String(configMap.ui_scale) : '100';
  const workspaceWidth = ALLOWED_WORKSPACE_WIDTHS.has(configMap.workspace_width) ? configMap.workspace_width : 'full';
  const sidebarCompact = String(configMap.sidebar_compact) === '1' ? 'true' : 'false';

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.workspaceWidth = workspaceWidth;
  document.documentElement.dataset.sidebarCompact = sidebarCompact;
  document.documentElement.style.setProperty('--ui-scale', String(Number(uiScale) / 100));
}

export default function App() {
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    meta: null,
    wizard: null,
    license: null,
    machineId: '',
    printers: [],
    serialPorts: [],
    configMap: {}
  });
  const [session, setSession] = useState(() => getStoredSession());

  async function loadBootstrap() {
    const [meta, wizardStatus, license] = await Promise.all([
      apiRequest('/api/meta'),
      apiRequest('/api/wizard/status'),
      apiRequest('/api/license/status')
    ]);

    setBootstrap({
      loading: false,
      meta,
      wizard: wizardStatus.config,
      license,
      machineId: wizardStatus.machineId,
      printers: wizardStatus.printers || [],
      serialPorts: wizardStatus.serialPorts || [],
      configMap: {
        business_name: wizardStatus.config.business.name,
        business_rnc: wizardStatus.config.business.rnc,
        business_phone: wizardStatus.config.business.phone,
        business_address: wizardStatus.config.business.address,
        business_logo: wizardStatus.config.business.logo,
        business_currency: wizardStatus.config.business.currency,
        business_currency_symbol: wizardStatus.config.business.currency === 'USD' ? '$' : wizardStatus.config.business.currency === 'EUR' ? 'EUR' : 'RD$',
        printer_name: wizardStatus.config.printer.name,
        printer_port: wizardStatus.config.printer.port,
        printer_driver_mode: 'system',
        printer_interface: '',
        printer_width: '48',
        auto_print_receipts: '0',
        scanner_port: wizardStatus.config.scanner.port,
        scanner_baud_rate: String(wizardStatus.config.scanner.baudRate),
        scale_enabled: wizardStatus.config.scale.enabled ? '1' : '0',
        scale_port: wizardStatus.config.scale.port,
        scale_baud_rate: String(wizardStatus.config.scale.baudRate),
        tax_rate: '18',
        ticket_footer: 'Gracias por su compra.',
        whatsapp_phone: '',
        backup_path: '',
        backup_retention_count: '30',
        backup_cloud_enabled: '0',
        backup_cloud_provider: 'dropbox',
        backup_cloud_token: '',
        backup_cloud_folder: '',
        update_provider: DEFAULT_UPDATE_PROVIDER,
        update_channel: 'stable',
        update_feed_url: '',
        update_github_owner: DEFAULT_UPDATE_GITHUB_OWNER,
        update_github_repo: DEFAULT_UPDATE_GITHUB_REPO,
        update_github_release_type: 'release',
        theme: getStoredTheme(),
        ui_scale: getStoredUiScale(),
        workspace_width: getStoredWorkspaceWidth(),
        sidebar_compact: getStoredSidebarCompact()
      }
    });
  }

  useEffect(() => {
    let isMounted = true;

    loadBootstrap()
      .then(async () => {
        const storedSession = getStoredSession();
        if (storedSession?.token) {
          try {
            const currentUser = await apiRequest('/api/auth/me', { token: storedSession.token });
            if (isMounted) {
              setSession({
                token: storedSession.token,
                user: currentUser.user
              });
            }
          } catch (error) {
            persistSession(null);
            if (isMounted) {
              setSession(null);
            }
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setBootstrap((current) => ({ ...current, loading: false }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    applyAppearance(bootstrap.configMap);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, bootstrap.configMap.theme || 'light');
      window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(bootstrap.configMap.ui_scale || '100'));
      window.localStorage.setItem(WORKSPACE_WIDTH_STORAGE_KEY, bootstrap.configMap.workspace_width || 'full');
      window.localStorage.setItem(SIDEBAR_COMPACT_STORAGE_KEY, String(bootstrap.configMap.sidebar_compact || '0'));
    } catch (error) {
      // Ignore storage write errors.
    }
  }, [
    bootstrap.configMap.theme,
    bootstrap.configMap.ui_scale,
    bootstrap.configMap.workspace_width,
    bootstrap.configMap.sidebar_compact
  ]);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    let ignore = false;

    apiRequest('/api/config', { token: session.token })
      .then((configEntries) => {
        if (!ignore) {
          setBootstrap((current) => ({
            ...current,
            configMap: {
              ...current.configMap,
              ...configEntries
            }
          }));
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [session?.token]);

  function handleLogin(result) {
    const nextSession = {
      token: result.token,
      user: result.user
    };
    setSession(nextSession);
    persistSession(nextSession);
    setBootstrap((current) => ({
      ...current,
      license: result.license || current.license
    }));
  }

  async function handleWizardCompleted() {
    persistSession(null);
    setSession(null);
    await loadBootstrap();
  }

  async function handleReconfigure() {
    await apiRequest('/api/wizard/reconfigure', {
      method: 'POST'
    });
    persistSession(null);
    setSession(null);
    await loadBootstrap();
  }

  async function handleLicenseActivated() {
    await loadBootstrap();
  }

  function handleLogout() {
    persistSession(null);
    setSession(null);
  }

  function handleConfigSaved(entries) {
    setBootstrap((current) => ({
      ...current,
      configMap: {
        ...current.configMap,
        ...entries
      }
    }));
  }

  if (bootstrap.loading) {
    return (
      <div className="app-surface flex min-h-screen items-center justify-center">
        <div className="glass-panel rounded-[28px] px-8 py-6 text-sm font-semibold text-slate-700">
          Preparando OrbitPOS...
        </div>
      </div>
    );
  }

  if (!bootstrap.wizard?.wizardCompleted) {
    return (
      <WizardScreen
        initialData={bootstrap.wizard}
        machineId={bootstrap.machineId}
        printers={bootstrap.printers}
        serialPorts={bootstrap.serialPorts}
        onCompleted={handleWizardCompleted}
      />
    );
  }

  if (bootstrap.license?.shouldBlock) {
    return (
      <LicenseGate
        license={bootstrap.license}
        machineId={bootstrap.machineId}
        onActivated={handleLicenseActivated}
      />
    );
  }

  if (!session?.token || !session?.user) {
    return (
      <LoginScreen
        businessName={bootstrap.wizard?.business?.name}
        businessLogo={bootstrap.wizard?.business?.logo}
        license={bootstrap.license}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <AppShell
      user={session.user}
      meta={bootstrap.meta}
      license={bootstrap.license}
      config={bootstrap.configMap}
      machineId={bootstrap.machineId}
      token={session.token}
      onLogout={handleLogout}
      onReconfigure={handleReconfigure}
      onConfigSaved={handleConfigSaved}
      onLicenseUpdated={handleLicenseActivated}
    />
  );
}
