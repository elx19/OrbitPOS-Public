import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, Select, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import BranchesPanel from '../Branches/BranchesPanel';
import PrintTemplatesPanel from './PrintTemplatesPanel';
import { getInitials, resolveAssetUrl } from '../../lib/assets';

const DEFAULT_UPDATE_PROVIDER = 'github';
const DEFAULT_UPDATE_GITHUB_OWNER = 'elx19';
const DEFAULT_UPDATE_GITHUB_REPO = 'OrbitPOS-Public';
const APP_VERSION = window.orbit?.version || '2.0.2';

const themeOptions = [
  {
    value: 'light',
    label: 'Claro clasico',
    description: 'Arena clara con contraste limpio.',
    preview: ['#fbf5ea', '#d97706', '#0f766e']
  },
  {
    value: 'dark',
    label: 'Oscuro profundo',
    description: 'Modo oscuro con alto contraste.',
    preview: ['#0c1420', '#f59e0b', '#14b8a6']
  },
  {
    value: 'ocean',
    label: 'Oceano',
    description: 'Azules suaves y acento marino.',
    preview: ['#e8f3fb', '#0f5d7a', '#1d8aa5']
  },
  {
    value: 'forest',
    label: 'Bosque',
    description: 'Verdes limpios con acento natural.',
    preview: ['#edf6ef', '#2f6a4f', '#78a35c']
  },
  {
    value: 'sunset',
    label: 'Atardecer',
    description: 'Tonos calidos con energia comercial.',
    preview: ['#fff1e6', '#c45b32', '#d38b2a']
  }
];

const uiScaleOptions = [
  ['90', '90% compacto'],
  ['100', '100% normal'],
  ['110', '110% comodo'],
  ['120', '120% grande']
];

const workspaceWidthOptions = [
  ['full', 'Pantalla completa'],
  ['wide', 'Muy amplio'],
  ['balanced', 'Amplio estandar'],
  ['compact', 'Compacto y centrado'],
];

const configSections = [
  ['general', 'Negocio', 'Datos comerciales, fiscales y ticket'],
  ['devices', 'Dispositivos', 'Impresora, lector y bascula'],
  ['tickets', 'Tickets', 'Plantillas editables y tipos de impresion'],
  ['appearance', 'Apariencia', 'Tema, ancho y distribucion'],
  ['backups', 'Backups', 'Copias locales y nube'],
  ['updates', 'Actualizaciones', 'Canal, servidor y update local'],
  ['branches', 'Sucursales', 'Gestion separada por sucursal'],
  ['maintenance', 'Mantenimiento', 'Guardar, respaldar y reconfigurar']
];

function buildForm(config) {
  return {
    business_name: config.business_name || 'Mi Negocio',
    business_rnc: config.business_rnc || '',
    business_phone: config.business_phone || '',
    business_address: config.business_address || '',
    business_logo: config.business_logo || '',
    printer_name: config.printer_name || '',
    printer_port: config.printer_port || '',
    printer_driver_mode: config.printer_driver_mode || 'system',
    printer_interface: config.printer_interface || '',
    printer_width: config.printer_width || '48',
    auto_print_receipts: config.auto_print_receipts === '1',
    scanner_port: config.scanner_port || '',
    scanner_baud_rate: config.scanner_baud_rate || '9600',
    scale_enabled: config.scale_enabled === '1',
    scale_port: config.scale_port || '',
    scale_baud_rate: config.scale_baud_rate || '9600',
    tax_rate: config.tax_rate || '18',
    ticket_footer: config.ticket_footer || 'Gracias por su compra.',
    whatsapp_phone: config.whatsapp_phone || '',
    backup_path: config.backup_path || '',
    backup_retention_count: config.backup_retention_count || '30',
    backup_cloud_enabled: config.backup_cloud_enabled === '1',
    backup_cloud_provider: config.backup_cloud_provider || 'dropbox',
    backup_cloud_token: config.backup_cloud_token || '',
    backup_cloud_folder: config.backup_cloud_folder || '',
    update_provider: config.update_provider || DEFAULT_UPDATE_PROVIDER,
    update_channel: config.update_channel || 'stable',
    update_feed_url: config.update_feed_url || '',
    update_github_owner: config.update_github_owner || DEFAULT_UPDATE_GITHUB_OWNER,
    update_github_repo: config.update_github_repo || DEFAULT_UPDATE_GITHUB_REPO,
    update_github_release_type: config.update_github_release_type || 'release',
    theme: config.theme || 'light',
    ui_scale: config.ui_scale || '100',
    workspace_width: config.workspace_width || 'full',
    sidebar_compact: config.sidebar_compact === '1'
  };
}

const defaultUpdaterStatus = {
  currentVersion: APP_VERSION,
  latestVersion: APP_VERSION,
  provider: DEFAULT_UPDATE_PROVIDER,
  githubOwner: DEFAULT_UPDATE_GITHUB_OWNER,
  githubRepo: DEFAULT_UPDATE_GITHUB_REPO,
  channel: 'stable',
  configured: true,
  checking: false,
  updateAvailable: false,
  downloading: false,
  downloaded: false,
  progress: 0,
  notes: 'Actualizador no disponible.'
};

function ConfigCard({ title, description, className = '', children }) {
  return (
    <div className={`rounded-[24px] border border-slate-200/80 bg-white/72 p-5 shadow-[0_14px_28px_-24px_rgba(23,32,51,0.45)] ${className}`.trim()}>
      <div className="text-sm font-bold text-ink">{title}</div>
      {description ? (
        <div className="mt-1 text-xs leading-6 text-slate-500">{description}</div>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ConfigSectionButton({ label, helper, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? 'w-full rounded-[22px] border border-transparent bg-ink px-4 py-3 text-left text-white shadow-soft transition'
        : 'w-full rounded-[22px] border border-slate-200/80 bg-white/72 px-4 py-3 text-left text-slate-700 transition hover:bg-white'}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className={`mt-1 text-xs ${active ? 'text-white/72' : 'text-slate-500'}`}>{helper}</div>
    </button>
  );
}

export default function ConfigPanel({ token, meta, config, onReconfigure, onConfigSaved, onActivity }) {
  const [form, setForm] = useState(() => buildForm(config));
  const [activeSection, setActiveSection] = useState('general');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [updaterStatus, setUpdaterStatus] = useState(defaultUpdaterStatus);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [installingLocalUpdate, setInstallingLocalUpdate] = useState(false);
  const [localUpdatePackage, setLocalUpdatePackage] = useState(null);
  const [restoreBackupFile, setRestoreBackupFile] = useState('');
  const [logoPreviewVisible, setLogoPreviewVisible] = useState(true);
  const [hardwareCatalog, setHardwareCatalog] = useState({
    printers: [],
    serialPorts: []
  });
  const logoUrl = resolveAssetUrl(form.business_logo);
  const logoInitials = getInitials(form.business_name || 'Mi Negocio');
  const activeSectionMeta = configSections.find(([key]) => key === activeSection) || configSections[0];

  useEffect(() => {
    setForm(buildForm(config));
  }, [config]);

  useEffect(() => {
    setLogoPreviewVisible(true);
  }, [logoUrl]);

  useEffect(() => {
    let ignore = false;

    if (!window.orbit?.updater?.getStatus) {
      const fallbackProvider = config.update_provider || form.update_provider || DEFAULT_UPDATE_PROVIDER;
      const fallbackGithubOwner = config.update_github_owner || form.update_github_owner || DEFAULT_UPDATE_GITHUB_OWNER;
      const fallbackGithubRepo = config.update_github_repo || form.update_github_repo || DEFAULT_UPDATE_GITHUB_REPO;

      setUpdaterStatus({
        ...defaultUpdaterStatus,
        currentVersion: meta?.version || defaultUpdaterStatus.currentVersion,
        latestVersion: meta?.version || defaultUpdaterStatus.latestVersion,
        provider: fallbackProvider,
        githubOwner: fallbackGithubOwner,
        githubRepo: fallbackGithubRepo,
        channel: config.update_channel || form.update_channel,
        configured: fallbackProvider === 'github'
          ? Boolean(fallbackGithubOwner && fallbackGithubRepo)
          : Boolean(config.update_feed_url || form.update_feed_url),
        notes: fallbackProvider === 'github'
          ? 'GitHub Releases listo para usarse si el repositorio de updates es publico.'
          : 'El actualizador se controla desde la app de escritorio.'
      });
      return undefined;
    }

    window.orbit.updater.getStatus()
      .then((status) => {
        if (!ignore && status) {
          setUpdaterStatus(status);
        }
      })
      .catch(() => {
        if (!ignore) {
          setUpdaterStatus((current) => ({
            ...current,
            notes: 'No fue posible consultar el estado del actualizador.'
          }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    meta?.version,
    config.update_provider,
    config.update_channel,
    config.update_feed_url,
    config.update_github_owner,
    config.update_github_repo
  ]);

  useEffect(() => {
    let ignore = false;

    apiRequest('/api/wizard/status')
      .then((result) => {
        if (!ignore) {
          setHardwareCatalog({
            printers: result.printers || [],
            serialPorts: result.serialPorts || []
          });
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function pickLogoFile() {
    if (!window.orbit?.files?.pickLogo) {
      setMessage('El selector de archivos solo esta disponible en la app de escritorio.');
      return;
    }

    try {
      const selectedPath = await window.orbit.files.pickLogo();
      if (selectedPath) {
        updateField('business_logo', selectedPath);
      }
    } catch (error) {
      setMessage('No fue posible seleccionar el logo.');
    }
  }

  async function pickBackupFile() {
    if (!window.orbit?.files?.pickBackup) {
      setMessage('El selector de backups solo esta disponible en la app de escritorio.');
      return;
    }

    try {
      const selectedPath = await window.orbit.files.pickBackup();
      if (selectedPath) {
        setRestoreBackupFile(selectedPath);
      }
    } catch (error) {
      setMessage('No fue posible seleccionar el backup.');
    }
  }

  async function detectPrinter() {
    setMessage('');
    try {
      const result = await apiRequest('/api/wizard/detect-printer', { method: 'POST' });
      if (result?.name) {
        updateField('printer_name', result.name);
      }
      if (result?.port) {
        updateField('printer_port', result.port);
      }
      setMessage(result.message || 'Deteccion de impresora completada.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function detectScanner() {
    setMessage('');
    try {
      const result = await apiRequest('/api/wizard/detect-scanner', {
        method: 'POST',
        body: {
          baudRate: form.scanner_baud_rate
        }
      });
      if (result?.port) {
        updateField('scanner_port', result.port);
      }
      if (result?.baudRate) {
        updateField('scanner_baud_rate', String(result.baudRate));
      }
      setMessage(result.message || 'Deteccion de lector completada.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function detectScale() {
    setMessage('');
    try {
      const result = await apiRequest('/api/wizard/detect-scale', {
        method: 'POST',
        body: {
          baudRate: form.scale_baud_rate
        }
      });
      if (result?.port) {
        updateField('scale_enabled', true);
        updateField('scale_port', result.port);
      }
      if (result?.baudRate) {
        updateField('scale_baud_rate', String(result.baudRate));
      }
      setMessage(result.message || 'Deteccion de bascula completada.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = {
        ...form,
        scale_enabled: form.scale_enabled ? '1' : '0',
        backup_cloud_enabled: form.backup_cloud_enabled ? '1' : '0',
        auto_print_receipts: form.auto_print_receipts ? '1' : '0',
        sidebar_compact: form.sidebar_compact ? '1' : '0'
      };

      await apiRequest('/api/config', {
        method: 'PUT',
        token,
        body: payload
      });

      onConfigSaved?.(payload);
      if (window.orbit?.updater?.getStatus) {
        const status = await window.orbit.updater.getStatus();
        setUpdaterStatus(status);
      }
      setMessage('Configuracion guardada correctamente.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function runBackup() {
    setBackingUp(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/config/backup', {
        method: 'POST',
        token,
        body: {
          destination: form.backup_path || undefined,
          cloudEnabled: form.backup_cloud_enabled,
          provider: form.backup_cloud_provider,
          token: form.backup_cloud_token,
          folder: form.backup_cloud_folder
        }
      });

      setMessage(
        result.cloud
          ? `Backup completo generado en ${result.path} y subido a ${result.cloud.provider}.`
          : result.cloudError
            ? `Backup completo generado en ${result.path}, pero la nube fallo: ${result.cloudError}`
            : `Backup completo generado en: ${result.path}`
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBackingUp(false);
    }
  }

  async function restoreSystemBackup() {
    if (!restoreBackupFile.trim()) {
      setMessage('Selecciona primero un archivo de backup.');
      return;
    }

    setRestoringBackup(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/config/backup/restore', {
        method: 'POST',
        token,
        body: {
          backupFile: restoreBackupFile
        }
      });

      setMessage(`${result.message} OrbitPOS recargara la interfaz para aplicar los datos restaurados.`);
      onActivity?.();
      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setRestoringBackup(false);
    }
  }

  async function checkUpdates() {
    if (!window.orbit?.updater?.check) {
      setMessage('La verificacion de actualizaciones solo funciona en la app de escritorio.');
      return;
    }

    setCheckingUpdate(true);
    setMessage('');

    try {
      const status = await window.orbit.updater.check();
      setUpdaterStatus(status);
      setMessage(status.notes || 'Revision de actualizaciones completada.');
    } catch (error) {
      setMessage(error.message || 'No fue posible revisar actualizaciones.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function downloadUpdate() {
    if (!window.orbit?.updater?.download) {
      setMessage('La descarga de actualizaciones solo funciona en la app de escritorio.');
      return;
    }

    setDownloadingUpdate(true);
    setMessage('');

    try {
      const status = await window.orbit.updater.download();
      setUpdaterStatus(status);
      setMessage(status.notes || 'Descarga de actualizacion iniciada.');
    } catch (error) {
      setMessage(error.message || 'No fue posible descargar la actualizacion.');
    } finally {
      setDownloadingUpdate(false);
    }
  }

  async function installUpdate() {
    if (!window.orbit?.updater?.install) {
      setMessage('La instalacion de actualizaciones solo funciona en la app de escritorio.');
      return;
    }

    try {
      const status = await window.orbit.updater.install();
      setUpdaterStatus(status);
      setMessage('La aplicacion se reiniciara para instalar la actualizacion.');
    } catch (error) {
      setMessage(error.message || 'No fue posible instalar la actualizacion.');
    }
  }

  async function pickLocalUpdatePackage() {
    if (!window.orbit?.updater?.pickLocalPackage) {
      setMessage('La carga de actualizaciones locales solo funciona en la app de escritorio.');
      return;
    }

    try {
      const result = await window.orbit.updater.pickLocalPackage();
      if (!result) {
        return;
      }

      setLocalUpdatePackage(result);
      setMessage(`Archivo de actualizacion listo: ${result.name}`);
    } catch (error) {
      setMessage(error.message || 'No fue posible seleccionar la actualizacion local.');
    }
  }

  async function installLocalUpdate() {
    if (!window.orbit?.updater?.installLocalPackage) {
      setMessage('La instalacion local solo funciona en la app de escritorio.');
      return;
    }

    if (!localUpdatePackage?.path) {
      setMessage('Selecciona primero un archivo de actualizacion local.');
      return;
    }

    setInstallingLocalUpdate(true);
    setMessage('');

    try {
      const result = await window.orbit.updater.installLocalPackage(localUpdatePackage.path);
      setMessage(result.message || 'Instalacion local iniciada.');
    } catch (error) {
      setMessage(error.message || 'No fue posible iniciar la actualizacion local.');
    } finally {
      setInstallingLocalUpdate(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Configuracion del sistema</div>
            <h2 className="mt-3 text-3xl font-bold text-ink">Centro de configuracion</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Aqui puedes actualizar datos del negocio, respaldos, integracion de nube
              y el canal de actualizaciones del sistema.
            </p>
          </div>
            <div className="rounded-[24px] bg-white/80 p-5 text-sm text-slate-600">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Version actual</div>
              <div className="mt-2 text-lg font-bold text-ink">{meta?.version || APP_VERSION}</div>
              <div className="mt-2">Canal: {form.update_channel}</div>
              <div className="mt-1">Origen: {form.update_provider === 'github' ? 'GitHub Releases' : 'Servidor generico'}</div>
            </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
        <Panel className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Modulos de configuracion</div>
          <div className="mt-4 space-y-2">
            {configSections.map(([key, label, helper]) => (
              <ConfigSectionButton
                key={key}
                label={label}
                helper={helper}
                active={activeSection === key}
                onClick={() => setActiveSection(key)}
              />
            ))}
          </div>
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{activeSectionMeta[1]}</div>
                <h3 className="mt-2 text-2xl font-bold text-ink">{activeSectionMeta[2]}</h3>
              </div>
              {activeSection !== 'branches' && activeSection !== 'maintenance' && activeSection !== 'tickets' ? (
                <div className="flex flex-wrap gap-3">
                  <Button disabled={saving} onClick={handleSubmit}>
                    {saving ? 'Guardando...' : 'Guardar configuracion'}
                  </Button>
                  <Button variant="secondary" disabled={backingUp} onClick={runBackup}>
                    {backingUp ? 'Generando backup...' : 'Backup ahora'}
                  </Button>
                </div>
              ) : null}
            </div>

            {message ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}
          </Panel>

          {activeSection === 'branches' ? <BranchesPanel token={token} onActivity={onActivity} /> : null}
          {activeSection === 'tickets' ? <PrintTemplatesPanel token={token} onActivity={onActivity} /> : null}

          <form onSubmit={handleSubmit} className={activeSection === 'branches' || activeSection === 'tickets' ? 'hidden' : 'space-y-6'}>
            <div className="space-y-6">
          {activeSection === 'general' ? (
          <Panel className="p-5 md:p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Negocio</div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <ConfigCard title="Identidad comercial" description="Nombre visible del negocio y datos fiscales basicos.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre del negocio">
                    <Input value={form.business_name} onChange={(event) => updateField('business_name', event.target.value)} />
                  </Field>
                  <Field label="RNC">
                    <Input value={form.business_rnc} onChange={(event) => updateField('business_rnc', event.target.value)} />
                  </Field>
                </div>
              </ConfigCard>

              <ConfigCard title="Contacto comercial" description="Telefonos usados para clientes, tickets y WhatsApp.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Telefono">
                    <Input value={form.business_phone} onChange={(event) => updateField('business_phone', event.target.value)} />
                  </Field>
                  <Field label="Telefono WhatsApp">
                    <Input value={form.whatsapp_phone} onChange={(event) => updateField('whatsapp_phone', event.target.value)} />
                  </Field>
                </div>
              </ConfigCard>

              <ConfigCard title="Logo y marca" description="Ruta del logo y vista previa de como se mostrara en el sistema." className="xl:col-span-2">
                <Field label="Logo del negocio">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input value={form.business_logo} onChange={(event) => updateField('business_logo', event.target.value)} placeholder="C:\\logos\\negocio.png" />
                    <Button variant="secondary" onClick={pickLogoFile}>
                      Buscar logo
                    </Button>
                  </div>
                </Field>

                <div className="mt-4 flex items-center gap-4 rounded-[22px] border border-slate-200/80 bg-white/72 p-4">
                  {logoUrl && logoPreviewVisible ? (
                    <img
                      key={logoUrl}
                      src={logoUrl}
                      alt={`Logo de ${form.business_name || 'Mi Negocio'}`}
                      className="h-20 w-20 rounded-[22px] border border-slate-200 bg-white object-cover p-2"
                      onError={() => setLogoPreviewVisible(false)}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-[22px] border border-slate-200 bg-white text-2xl font-bold text-ink">
                      {logoInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Vista previa</div>
                    <div className="mt-2 truncate text-lg font-bold text-ink">{form.business_name || 'Mi Negocio'}</div>
                    <div className="mt-1 text-sm text-slate-600">Este logo se mostrara en el acceso y en la barra lateral.</div>
                  </div>
                </div>
              </ConfigCard>

              <ConfigCard title="Direccion del negocio" description="Direccion que aparecera en tickets, cotizaciones y ayudas." className="xl:col-span-2">
                <Field label="Direccion">
                  <TextArea rows={4} value={form.business_address} onChange={(event) => updateField('business_address', event.target.value)} />
                </Field>
              </ConfigCard>
            </div>
          </Panel>
          ) : null}

          {activeSection === 'devices' ? (
          <Panel className="p-5 md:p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Dispositivos</div>
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <ConfigCard title="Impresion" description="Seleccion de impresora, driver y deteccion automatica." className="xl:col-span-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Impresora termica">
                    <Select value={form.printer_name} onChange={(event) => updateField('printer_name', event.target.value)}>
                      <option value="">Seleccionar impresora</option>
                      {hardwareCatalog.printers.map((printer) => (
                        <option key={printer} value={printer}>{printer}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Puerto impresora">
                    <Input value={form.printer_port} onChange={(event) => updateField('printer_port', event.target.value)} />
                  </Field>
                  <Field label="Modo de impresion">
                    <Select value={form.printer_driver_mode} onChange={(event) => updateField('printer_driver_mode', event.target.value)}>
                      <option value="system">Spooler del sistema</option>
                      <option value="escpos">ESC/POS directo</option>
                    </Select>
                  </Field>
                  <Field label="Interfaz impresora" hint="tcp://, printer:, usb o com://">
                    <Input value={form.printer_interface} onChange={(event) => updateField('printer_interface', event.target.value)} />
                  </Field>
                  <Field label="Ancho ticket">
                    <Select value={form.printer_width} onChange={(event) => updateField('printer_width', event.target.value)}>
                      <option value="32">58mm / 32 col</option>
                      <option value="48">80mm / 48 col</option>
                    </Select>
                  </Field>
                </div>

                <label className="mt-4 flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.auto_print_receipts} onChange={(event) => updateField('auto_print_receipts', event.target.checked)} />
                  Imprimir tickets automaticamente
                </label>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={detectPrinter}>
                    Detectar impresora
                  </Button>
                </div>
              </ConfigCard>

              <ConfigCard title="Lector de codigo" description="Puerto COM y velocidad del lector serial.">
                <Field label="Puerto lector">
                  <Select value={form.scanner_port} onChange={(event) => updateField('scanner_port', event.target.value)}>
                    <option value="">Seleccionar puerto</option>
                    {hardwareCatalog.serialPorts.map((port) => (
                      <option key={port} value={port}>{port}</option>
                    ))}
                  </Select>
                </Field>
                <div className="mt-4">
                  <Field label="Baud rate lector">
                    <Input value={form.scanner_baud_rate} onChange={(event) => updateField('scanner_baud_rate', event.target.value)} />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={detectScanner}>
                    Detectar lector
                  </Button>
                </div>
              </ConfigCard>

              <ConfigCard title="Bascula digital" description="Habilita la bascula y detecta su puerto automaticamente." className="xl:col-span-3">
                <div className="grid gap-4 md:grid-cols-[0.9fr,1fr,1fr]">
                  <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={form.scale_enabled} onChange={(event) => updateField('scale_enabled', event.target.checked)} />
                    Bascula habilitada
                  </label>
                  <Field label="Puerto bascula">
                    <Select value={form.scale_port} onChange={(event) => updateField('scale_port', event.target.value)}>
                      <option value="">Seleccionar puerto</option>
                      {hardwareCatalog.serialPorts.map((port) => (
                        <option key={port} value={port}>{port}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Baud rate bascula">
                    <Input value={form.scale_baud_rate} onChange={(event) => updateField('scale_baud_rate', event.target.value)} />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={detectScale}>
                    Detectar bascula
                  </Button>
                </div>
              </ConfigCard>
            </div>
          </Panel>
          ) : null}

          {activeSection === 'backups' ? (
          <Panel className="p-5 md:p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Backups</div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <ConfigCard title="Backup local" description="Genera un backup completo del sistema con datos, licencia, configuracion y logo del negocio.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Ruta backup local">
                    <Input value={form.backup_path} onChange={(event) => updateField('backup_path', event.target.value)} />
                  </Field>
                  <Field label="Retencion local">
                    <Input type="number" min="1" value={form.backup_retention_count} onChange={(event) => updateField('backup_retention_count', event.target.value)} />
                  </Field>
                </div>
                <div className="mt-4 rounded-[22px] bg-white/72 p-4 text-sm leading-7 text-slate-600">
                  Cada backup guarda la base completa, usuarios, productos, ventas, licencia,
                  configuracion y una copia restaurable del logo del negocio.
                </div>
              </ConfigCard>

              <ConfigCard title="Backup en nube" description="Proveedor, carpeta remota y token usado para subir copias.">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Proveedor nube">
                      <Select value={form.backup_cloud_provider} onChange={(event) => updateField('backup_cloud_provider', event.target.value)}>
                        <option value="dropbox">Dropbox</option>
                        <option value="google-drive">Google Drive</option>
                      </Select>
                    </Field>
                    <Field label={form.backup_cloud_provider === 'google-drive' ? 'Folder ID / carpeta' : 'Ruta remota / carpeta'}>
                      <Input value={form.backup_cloud_folder} onChange={(event) => updateField('backup_cloud_folder', event.target.value)} />
                    </Field>
                  </div>
                  <Field label="Token de acceso nube" hint="Se usa para subir el archivo al proveedor elegido">
                    <Input type="password" value={form.backup_cloud_token} onChange={(event) => updateField('backup_cloud_token', event.target.value)} />
                  </Field>
                  <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={form.backup_cloud_enabled} onChange={(event) => updateField('backup_cloud_enabled', event.target.checked)} />
                    Subir backup tambien a la nube
                  </label>
                </div>
              </ConfigCard>

              <ConfigCard title="Restaurar backup" description="Carga un backup completo para reconstruir OrbitPOS en este equipo." className="xl:col-span-2">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),auto,auto]">
                  <Field label="Archivo de backup">
                    <Input
                      value={restoreBackupFile}
                      onChange={(event) => setRestoreBackupFile(event.target.value)}
                      placeholder="C:\\Respaldos\\orbitpos-full-2026-03-26.zip"
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button variant="secondary" onClick={pickBackupFile}>
                      Buscar backup
                    </Button>
                  </div>
                  <div className="flex items-end">
                    <Button variant="danger" disabled={restoringBackup} onClick={restoreSystemBackup}>
                      {restoringBackup ? 'Restaurando...' : 'Restaurar sistema'}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-800">
                  Usa esta opcion cuando necesites recuperar el sistema completo en otra PC o
                  despues de un dano del equipo actual. La restauracion reemplaza los datos
                  locales vigentes por los del backup seleccionado.
                </div>
              </ConfigCard>
            </div>
          </Panel>
          ) : null}
        </div>

        <div className="space-y-6">
          {activeSection === 'general' ? (
          <Panel className="p-5 md:p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Operacion</div>
            <div className="mt-5 grid gap-4">
              <ConfigCard title="Fiscal y ventas" description="Impuesto principal y mensaje impreso al final de cada ticket.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="ITBIS">
                    <Input type="number" step="0.01" value={form.tax_rate} onChange={(event) => updateField('tax_rate', event.target.value)} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Mensaje pie de ticket">
                    <TextArea rows={4} value={form.ticket_footer} onChange={(event) => updateField('ticket_footer', event.target.value)} />
                  </Field>
                </div>
              </ConfigCard>

                <ConfigCard title="Canal de actualizacion" description="Elige si OrbitPOS se actualiza por GitHub Releases o por un servidor generico.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Proveedor de actualizacion">
                      <Select value={form.update_provider} onChange={(event) => updateField('update_provider', event.target.value)}>
                        <option value="generic">Servidor generico</option>
                        <option value="github">GitHub Releases</option>
                      </Select>
                    </Field>
                    <Field label="Canal de actualizacion">
                      <Select value={form.update_channel} onChange={(event) => updateField('update_channel', event.target.value)}>
                        <option value="stable">Estable</option>
                        <option value="beta">Beta</option>
                      </Select>
                    </Field>
                  </div>
                  {form.update_provider === 'github' ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <Field label="Owner GitHub">
                        <Input value={form.update_github_owner} onChange={(event) => updateField('update_github_owner', event.target.value)} placeholder="JRTech o elx19" />
                      </Field>
                      <Field label="Repositorio">
                        <Input value={form.update_github_repo} onChange={(event) => updateField('update_github_repo', event.target.value)} placeholder="OrbitPOS" />
                      </Field>
                      <Field label="Tipo de release">
                        <Select value={form.update_github_release_type} onChange={(event) => updateField('update_github_release_type', event.target.value)}>
                          <option value="release">Release estable</option>
                          <option value="prerelease">Pre-release</option>
                        </Select>
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Field label="Servidor de actualizaciones">
                        <Input value={form.update_feed_url} onChange={(event) => updateField('update_feed_url', event.target.value)} placeholder="https://updates.tudominio.com/orbitpos" />
                      </Field>
                    </div>
                  )}
                </ConfigCard>
            </div>
          </Panel>
          ) : null}

          {activeSection === 'appearance' ? (
          <Panel className="p-5 md:p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Apariencia</div>
            <div className="mt-5 grid gap-4">
              <ConfigCard title="Tema del sistema" description="Selecciona la paleta general que se aplicara a OrbitPOS.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {themeOptions.map((option) => {
                    const active = form.theme === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField('theme', option.value)}
                        className={active
                          ? 'rounded-[24px] border border-amber-400 bg-white px-4 py-4 text-left shadow-soft'
                          : 'rounded-[24px] border border-slate-200 bg-white/70 px-4 py-4 text-left transition hover:bg-white'}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-ink">{option.label}</div>
                            <div className="mt-1 text-xs text-slate-500">{option.description}</div>
                          </div>
                          <div className="flex gap-1.5">
                            {option.preview.map((color) => (
                              <span
                                key={color}
                                className="h-4 w-4 rounded-full border border-white shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ConfigCard>

              <div className="grid gap-4 xl:grid-cols-2">
                <ConfigCard title="Escala y ancho" description="Controla cuanto espacio horizontal usa OrbitPOS en pantalla.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <Field label="Escala de interfaz">
                      <Select value={form.ui_scale} onChange={(event) => updateField('ui_scale', event.target.value)}>
                        {uiScaleOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Ancho del sistema">
                      <Select value={form.workspace_width} onChange={(event) => updateField('workspace_width', event.target.value)}>
                        {workspaceWidthOptions.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </ConfigCard>

                <ConfigCard title="Distribucion de navegacion" description="Permite compactar el lateral cuando quieras maximizar el area de trabajo.">
                  <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={form.sidebar_compact} onChange={(event) => updateField('sidebar_compact', event.target.checked)} />
                    Sidebar compacto
                  </label>

                  <div className="mt-4 rounded-[22px] bg-white/72 p-4 text-sm text-slate-600">
                    Ajusta la escala y el ancho para aprovechar mejor la pantalla del negocio. El modo
                    de pantalla completa deja OrbitPOS mucho menos centrado y con mas area util.
                  </div>
                </ConfigCard>
              </div>
            </div>
          </Panel>
          ) : null}

          {activeSection === 'maintenance' ? (
          <Panel className="p-5 md:p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Acciones rapidas</div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <ConfigCard title="Guardar cambios" description="Aplica toda la configuracion visible en esta pantalla.">
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar configuracion'}
                </Button>
              </ConfigCard>
              <ConfigCard title="Backup inmediato" description="Genera una copia local y, si aplica, la sube a la nube.">
                <Button variant="secondary" className="w-full" disabled={backingUp} onClick={runBackup}>
                  {backingUp ? 'Generando backup...' : 'Crear backup ahora'}
                </Button>
              </ConfigCard>
              <ConfigCard title="Reconfigurar sistema" description="Abre nuevamente el wizard inicial paso a paso.">
                <Button variant="ghost" className="w-full" onClick={onReconfigure}>
                  Lanzar wizard nuevamente
                </Button>
              </ConfigCard>
            </div>
          </Panel>
          ) : null}

          {activeSection === 'updates' ? (
          <Panel className="p-5 md:p-6">
            <h3 className="text-2xl font-bold text-ink">Actualizaciones</h3>
            <div className="mt-5 grid gap-4">
                <ConfigCard title="Estado del actualizador" description="Resumen de la version instalada, version detectada y estado actual.">
                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div>Version instalada: {updaterStatus.currentVersion || meta?.version || APP_VERSION}</div>
                    <div>Version detectada: {updaterStatus.latestVersion || meta?.version || APP_VERSION}</div>
                    <div>Proveedor: {updaterStatus.provider === 'github' ? 'GitHub Releases' : 'Servidor generico'}</div>
                    <div>Canal: {updaterStatus.channel || form.update_channel}</div>
                    <div>Servidor configurado: {updaterStatus.configured ? 'Si' : 'No'}</div>
                    {updaterStatus.provider === 'github' ? (
                      <div>Repositorio: {updaterStatus.githubOwner && updaterStatus.githubRepo ? `${updaterStatus.githubOwner}/${updaterStatus.githubRepo}` : 'Sin definir'}</div>
                    ) : (
                      <div>Feed: {form.update_feed_url || 'Sin definir'}</div>
                    )}
                    <div className="md:col-span-2">Estado: {updaterStatus.notes || meta?.updater?.notes || 'Sin observaciones por el momento.'}</div>
                    {updaterStatus.progress > 0 ? (
                      <div className="md:col-span-2">Descarga: {updaterStatus.progress.toFixed(0)}%</div>
                    ) : null}
                  </div>
                </ConfigCard>

                <ConfigCard title="Origen de actualizacion" description="GitHub Releases funciona con releases publicas; si tu repo principal es privado, usa un repo publico solo para updates o el modo generico.">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] bg-white/75 p-4 text-sm text-slate-600">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Modo actual</div>
                      <div className="mt-2 font-semibold text-ink">
                        {form.update_provider === 'github' ? 'GitHub Releases' : 'Servidor generico'}
                      </div>
                    </div>
                    <div className="rounded-[22px] bg-white/75 p-4 text-sm text-slate-600">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Referencia</div>
                      <div className="mt-2 font-semibold text-ink">
                        {form.update_provider === 'github'
                          ? (form.update_github_owner && form.update_github_repo ? `${form.update_github_owner}/${form.update_github_repo}` : 'Configura owner/repo')
                          : (form.update_feed_url || 'Configura la URL del feed')}
                      </div>
                    </div>
                  </div>
                </ConfigCard>

              <ConfigCard title="Actualizacion en linea" description="Busca, descarga e instala updates desde el servidor configurado.">
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" disabled={checkingUpdate} onClick={checkUpdates}>
                    {checkingUpdate ? 'Buscando...' : 'Buscar actualizaciones'}
                  </Button>
                  <Button variant="secondary" disabled={downloadingUpdate || !updaterStatus.updateAvailable || updaterStatus.downloaded} onClick={downloadUpdate}>
                    {downloadingUpdate ? 'Descargando...' : 'Descargar actualizacion'}
                  </Button>
                  <Button disabled={!updaterStatus.downloaded} onClick={installUpdate}>
                    Instalar y reiniciar
                  </Button>
                </div>
              </ConfigCard>

              <ConfigCard title="Actualizacion local" description="Usa un instalador desde USB o desde una carpeta local del equipo.">
                <div className="text-sm text-slate-600">
                  Si tienes el instalador en un USB o en una carpeta local, puedes cargarlo aqui
                  y ejecutar la actualizacion manualmente.
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={pickLocalUpdatePackage}>
                    Cargar update local
                  </Button>
                  <Button disabled={installingLocalUpdate || !localUpdatePackage?.path} onClick={installLocalUpdate}>
                    {installingLocalUpdate ? 'Iniciando...' : 'Instalar desde archivo'}
                  </Button>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  Archivo: {localUpdatePackage?.name || 'Ninguno seleccionado'}
                </div>
              </ConfigCard>
            </div>
          </Panel>
          ) : null}
        </div>
      </form>
      </div>
    </div>
    </div>
  );
}
