import { Suspense, lazy, useEffect, useMemo, useState, useTransition } from 'react';
import ModulePlaceholder from './ModulePlaceholder';
import Button from '../ui/Button';
import { classNames } from '../../lib/format';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';

const DashboardHome = lazy(() => import('../Dashboard/DashboardHome'));
const ConfigPanel = lazy(() => import('../Config/ConfigPanel'));
const HelpPanel = lazy(() => import('../Help/HelpPanel'));
const LicensePanel = lazy(() => import('../License/LicensePanel'));
const POSPanel = lazy(() => import('../POS/POSPanel'));
const CreditsPanel = lazy(() => import('../Credits/CreditsPanel'));
const CashPanel = lazy(() => import('../Cash/CashPanel'));
const ProductsPanel = lazy(() => import('../Products/ProductsPanel'));
const SuppliersPanel = lazy(() => import('../Suppliers/SuppliersPanel'));
const PurchasesPanel = lazy(() => import('../Purchases/PurchasesPanel'));
const ReturnsPanel = lazy(() => import('../Returns/ReturnsPanel'));
const CustomersPanel = lazy(() => import('../Customers/CustomersPanel'));
const QuotesPanel = lazy(() => import('../Quotes/QuotesPanel'));
const DiscountsPanel = lazy(() => import('../Discounts/DiscountsPanel'));
const NotificationsPanel = lazy(() => import('../Notifications/NotificationsPanel'));
const ReportsPanel = lazy(() => import('../Reports/ReportsPanel'));
const UsersPanel = lazy(() => import('../Users/UsersPanel'));

const rdDateFormatter = new Intl.DateTimeFormat('es-DO', {
  timeZone: 'America/Santo_Domingo',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const rdTimeFormatter = new Intl.DateTimeFormat('es-DO', {
  timeZone: 'America/Santo_Domingo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
});

const moduleGroups = [
  { key: 'overview', label: 'Resumen', icon: 'spark' },
  { key: 'system', label: 'Sistema', icon: 'settings' },
  { key: 'sales', label: 'Ventas', icon: 'cart' },
  { key: 'operations', label: 'Operacion', icon: 'warehouse' }
];

const moduleDefinitions = [
  { key: 'dashboard', label: 'Dashboard', group: 'overview', icon: 'dashboard', description: 'Resumen general de ventas, alertas y actividad.', keywords: ['panel', 'inicio', 'resumen', 'ventas'] },
  { key: 'notifications', label: 'Notificaciones', group: 'overview', icon: 'bell', description: 'Centro de alertas del sistema, stock y licencia.', keywords: ['alertas', 'avisos', 'centro'] },
  { key: 'license', label: 'Licencia', group: 'system', icon: 'key', adminOnly: true, description: 'Activacion, renovacion y estado comercial del sistema.', keywords: ['activar', 'renovar', 'demo'] },
  { key: 'config', label: 'Configuracion', group: 'system', icon: 'settings', adminOnly: true, description: 'Negocio, dispositivos, apariencia, backups y tickets.', keywords: ['ajustes', 'parametros', 'dispositivos'] },
  { key: 'users', label: 'Usuarios', group: 'system', icon: 'users', adminOnly: true, description: 'Cuentas, roles, accesos y seguridad local.', keywords: ['empleados', 'roles', 'seguridad'] },
  { key: 'help', label: 'Ayuda', group: 'system', icon: 'help', description: 'Manual, soporte JRTech y datos tecnicos.', keywords: ['manual', 'soporte', 'faq'] },
  { key: 'pos', label: 'POS', group: 'sales', icon: 'cart', description: 'Venta rapida, carrito, cobro y emision de ticket.', keywords: ['venta', 'cobro', 'carrito', 'caja rapida'] },
  { key: 'cash', label: 'Caja', group: 'sales', icon: 'cash', description: 'Apertura, cierre e historial de movimientos de caja.', keywords: ['apertura', 'cierre', 'arqueo'] },
  { key: 'credits', label: 'Creditos', group: 'sales', icon: 'credit', description: 'Control de ventas a credito, abonos y saldos.', keywords: ['abonos', 'cuentas por cobrar', 'deuda'] },
  { key: 'returns', label: 'Devoluciones', group: 'sales', icon: 'return', description: 'Registro de devoluciones totales o parciales.', keywords: ['reembolso', 'nota de devolucion'] },
  { key: 'quotes', label: 'Cotizaciones', group: 'sales', icon: 'quotes', description: 'Presupuestos, vigencia y conversion a venta.', keywords: ['presupuesto', 'propuesta'] },
  { key: 'customers', label: 'Clientes', group: 'sales', icon: 'customer', description: 'Ficha del cliente, historial y balance pendiente.', keywords: ['contactos', 'estado de cuenta'] },
  { key: 'products', label: 'Productos', group: 'operations', icon: 'box', adminOnly: true, description: 'Catalogo, precios, stock e inventario base.', keywords: ['inventario', 'articulos', 'stock'] },
  { key: 'suppliers', label: 'Proveedores', group: 'operations', icon: 'truck', adminOnly: true, description: 'Contactos de compra y relacion con inventario.', keywords: ['suplidores', 'compras'] },
  { key: 'purchases', label: 'Compras', group: 'operations', icon: 'clipboard', adminOnly: true, description: 'Entradas de inventario e historial por proveedor.', keywords: ['entrada', 'recepcion', 'orden'] },
  { key: 'discounts', label: 'Descuentos', group: 'operations', icon: 'tag', adminOnly: true, description: 'Promociones automaticas y reglas comerciales.', keywords: ['promociones', 'ofertas'] },
  { key: 'reports', label: 'Reportes', group: 'operations', icon: 'report', description: 'Analisis de ventas, caja, inventario y creditos.', keywords: ['estadisticas', 'analitica', 'informes'] }
];

const iconPaths = {
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z',
  settings: 'M12 8.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zm8.2 3.2l-1.8.6a6.7 6.7 0 00-.4 1l.8 1.8-1.8 1.8-1.8-.8c-.3.2-.7.3-1 .4l-.6 1.8h-2.6l-.6-1.8a6.7 6.7 0 01-1-.4l-1.8.8-1.8-1.8.8-1.8c-.2-.3-.3-.7-.4-1l-1.8-.6V10l1.8-.6c.1-.3.2-.7.4-1l-.8-1.8 1.8-1.8 1.8.8c.3-.2.7-.3 1-.4l.6-1.8h2.6l.6 1.8c.3.1.7.2 1 .4l1.8-.8 1.8 1.8-.8 1.8c.2.3.3.7.4 1l1.8.6V12z',
  cart: 'M3 4h2l1.4 8.2a1 1 0 001 .8h8.8a1 1 0 001-.7L20 7H7.2M9 19a1.2 1.2 0 110 2.4A1.2 1.2 0 019 19zm8 0a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z',
  warehouse: 'M4 10l8-6 8 6v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z',
  dashboard: 'M4 4h7v7H4V4zm9 0h7v4h-7V4zM4 13h4v7H4v-7zm6 0h10v7H10v-7z',
  bell: 'M12 4a4 4 0 00-4 4v2.4c0 .7-.2 1.4-.6 2L6 14h12l-1.4-1.6a3.8 3.8 0 01-.6-2V8a4 4 0 00-4-4zm0 16a2.2 2.2 0 002.1-1.6H9.9A2.2 2.2 0 0012 20z',
  key: 'M14 6a4 4 0 10-3.5 6l-4.5 4.5V19h2.5v-2.5H11V14h2.5l1-1A4 4 0 0014 6z',
  users: 'M8.5 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm7 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM4.5 19a4 4 0 018 0M11.5 19a4 4 0 018 0',
  help: 'M12 18h.01M9.3 9a2.7 2.7 0 115.1 1.3c-.6.4-1.4 1-1.4 2.2v.3',
  cash: 'M4 7h16a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm8 2.5A2.5 2.5 0 1012 14a2.5 2.5 0 000-5z',
  credit: 'M3 7h18v10H3V7zm2 2v2h6V9H5zm0 4h10v2H5v-2z',
  return: 'M7 7V4L2 8l5 4V9h5a4 4 0 010 8H7',
  quotes: 'M7 7h10M7 12h10M7 17h7M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z',
  customer: 'M12 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-6 8a6 6 0 1112 0H6z',
  box: 'M12 3l8 4.5-8 4.5-8-4.5L12 3zm-7 7.4l7 4v6.1l-7-4v-6.1zm9 10.1v-6.1l7-4v6.1l-7 4z',
  truck: 'M3 7h10v7H3V7zm10 2h3l2 2v3h-5V9zm-6 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm9 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
  clipboard: 'M9 4h6a1 1 0 011 1v1h2a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h2V5a1 1 0 011-1zm1 2v1h4V6h-4zm-1 5h6M9 15h6',
  tag: 'M11 3H5a2 2 0 00-2 2v6l8 8 8-8-8-8zm-4 4a1 1 0 110 2 1 1 0 010-2z',
  report: 'M6 4h12a1 1 0 011 1v14l-4-3-4 3-4-3-4 3V5a1 1 0 011-1h2zm2 4h8M8 12h8'
};

function NavIcon({ name, active = false, large = false }) {
  return (
    <span
      className={classNames(
        'flex items-center justify-center rounded-2xl border transition',
        large ? 'h-12 w-12' : 'h-10 w-10',
        active
          ? 'border-white/18 bg-white/16 text-white'
          : 'border-slate-200 bg-white/82 text-slate-700'
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={large ? 'h-6 w-6' : 'h-5 w-5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={iconPaths[name] || iconPaths.dashboard} />
      </svg>
    </span>
  );
}

function ModuleLoadingCard({ label }) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white/72 p-7 text-sm text-slate-600 shadow-[0_16px_30px_-24px_rgba(23,32,51,0.42)]">
      Cargando {label?.toLowerCase() || 'modulo'}...
    </div>
  );
}

function formatRDDate(date) {
  return rdDateFormatter.format(date).replace('.', '');
}

function formatRDTime(date) {
  return rdTimeFormatter.format(date).toLowerCase();
}

export default function AppShell({
  user,
  meta,
  license,
  config,
  machineId,
  token,
  onLogout,
  onReconfigure,
  onConfigSaved,
  onLicenseUpdated
}) {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [activityVersion, setActivityVersion] = useState(0);
  const [notificationSummary, setNotificationSummary] = useState({ total: 0, unread: 0 });
  const [expandedGroups, setExpandedGroups] = useState(() => ({
    overview: true,
    system: true,
    sales: true,
    operations: true
  }));
  const [logoVisible, setLogoVisible] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [rdNow, setRdNow] = useState(() => new Date());
  const businessName = config.business_name || 'Mi Negocio';
  const businessLogoUrl = resolveAssetUrl(config.business_logo);
  const businessInitials = getInitials(businessName);
  const compactSidebar = String(config.sidebar_compact || '0') === '1';
  const sidebarLicenseLabel = license?.isDemo
    ? 'Demo activa'
    : license?.isActive
      ? 'Licencia activa'
      : license?.isExpired
        ? 'Licencia vencida'
        : 'Pendiente';

  const visibleModules = useMemo(
    () => moduleDefinitions.filter((module) => !module.adminOnly || user.role === 'admin'),
    [user.role]
  );

  const visibleGroups = useMemo(() => (
    moduleGroups
      .map((group) => ({
        ...group,
        modules: visibleModules.filter((module) => module.group === group.key)
      }))
      .filter((group) => group.modules.length)
  ), [visibleModules]);

  const activeModuleDefinition = useMemo(
    () => visibleModules.find((module) => module.key === activeModule) || visibleModules[0],
    [activeModule, visibleModules]
  );

  const activeGroupDefinition = useMemo(
    () => moduleGroups.find((group) => group.key === activeModuleDefinition?.group) || null,
    [activeModuleDefinition]
  );

  const banner = useMemo(() => {
    if (license?.isDemo && license?.daysRemaining !== null) {
      return `Modo DEMO activo. Restan ${license.daysRemaining} dia(s).`;
    }
    if (license?.reminder) {
      return license.reminder;
    }
    return null;
  }, [license]);

  useEffect(() => {
    let ignore = false;

    async function loadNotificationSummary() {
      try {
        const result = await apiRequest('/api/notifications?summaryOnly=1', {
          token,
          cacheMs: activityVersion > 0 ? 0 : 5000,
          cacheKey: 'notifications-summary',
          forceFresh: activityVersion > 0
        });
        if (!ignore) {
          setNotificationSummary(result.summary || { total: 0, unread: 0 });
        }
      } catch (error) {
        if (!ignore) {
          setNotificationSummary({ total: 0, unread: 0 });
        }
      }
    }

    loadNotificationSummary();

    return () => {
      ignore = true;
    };
  }, [activityVersion, token]);

  useEffect(() => {
    setLogoVisible(true);
  }, [businessLogoUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRdNow(new Date());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeModuleDefinition?.group) {
      return;
    }

    setExpandedGroups((current) => ({
      ...current,
      [activeModuleDefinition.group]: true
    }));
  }, [activeModuleDefinition]);

  useEffect(() => {
    if (!activeModuleDefinition && visibleModules[0]) {
      setActiveModule(visibleModules[0].key);
    }
  }, [activeModuleDefinition, visibleModules]);

  useEffect(() => {
    if (!visibleModules.length) {
      return;
    }

    if (!visibleModules.some((module) => module.key === activeModule)) {
      setActiveModule(visibleModules[0].key);
    }
  }, [activeModule, visibleModules]);

  function handleActivity() {
    setActivityVersion((current) => current + 1);
  }

  function toggleGroup(groupKey) {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey]
    }));
  }

  function selectModule(moduleKey) {
    startTransition(() => {
      setActiveModule(moduleKey);
    });
  }

  function renderContent() {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardHome token={token} refreshKey={activityVersion} />;
      case 'pos':
        return (
          <POSPanel
            token={token}
            taxRate={Number(config.tax_rate || 18)}
            businessName={businessName}
            onActivity={handleActivity}
          />
        );
      case 'credits':
        return <CreditsPanel token={token} onActivity={handleActivity} />;
      case 'returns':
        return <ReturnsPanel token={token} onActivity={handleActivity} />;
      case 'cash':
        return <CashPanel token={token} onActivity={handleActivity} />;
      case 'products':
        return <ProductsPanel token={token} onActivity={handleActivity} />;
      case 'suppliers':
        return <SuppliersPanel token={token} onActivity={handleActivity} />;
      case 'purchases':
        return <PurchasesPanel token={token} onActivity={handleActivity} />;
      case 'customers':
        return <CustomersPanel token={token} onActivity={handleActivity} />;
      case 'quotes':
        return <QuotesPanel token={token} onActivity={handleActivity} />;
      case 'discounts':
        return <DiscountsPanel token={token} onActivity={handleActivity} />;
      case 'notifications':
        return (
          <NotificationsPanel
            token={token}
            onActivity={handleActivity}
            onUnreadChange={(unread) => setNotificationSummary((current) => ({ ...current, unread }))}
          />
        );
      case 'reports':
        return <ReportsPanel token={token} />;
      case 'config':
        return (
          <ConfigPanel
            token={token}
            meta={meta}
            config={config}
            onReconfigure={onReconfigure}
            onConfigSaved={onConfigSaved}
            onActivity={handleActivity}
          />
        );
      case 'users':
        return <UsersPanel token={token} onActivity={handleActivity} />;
      case 'help':
        return <HelpPanel license={license} machineId={machineId} token={token} onReconfigure={onReconfigure} />;
      case 'license':
        return <LicensePanel token={token} license={license} machineId={machineId} onActivated={onLicenseUpdated} />;
      default:
        return (
          <ModulePlaceholder
            title={activeModuleDefinition?.label || 'Modulo'}
            description="Este modulo esta listo para conectarse al flujo completo del sistema."
          />
        );
    }
  }

  return (
    <div className="app-surface min-h-screen">
      <div className={classNames(
        'app-frame grid min-h-screen w-full gap-2 p-2',
        compactSidebar ? 'xl:grid-cols-[270px,minmax(0,1fr)]' : 'xl:grid-cols-[292px,minmax(0,1fr)]'
      )}>
        <aside className={classNames(
          'glass-panel flex min-h-[260px] flex-col rounded-[30px] xl:h-[calc(100vh-1rem)]',
          compactSidebar ? 'p-3' : 'p-4'
        )}>
          <div className={classNames(
            'theme-brand-panel rounded-[28px] text-white',
            compactSidebar ? 'p-4' : 'p-5'
          )}>
            <div className="flex items-center gap-4">
              {businessLogoUrl && logoVisible ? (
                <img
                  src={businessLogoUrl}
                  alt={`Logo de ${businessName}`}
                  className="h-16 w-16 rounded-[22px] border border-white/14 bg-white/92 object-cover p-2"
                  onError={() => setLogoVisible(false)}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/14 bg-white/12 text-lg font-bold">
                  {businessInitials}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-white/66">OrbitPOS</div>
                <div className={classNames('mt-1 truncate font-bold', compactSidebar ? 'text-xl' : 'text-2xl')}>
                  {businessName}
                </div>
                <div className="mt-1 text-sm text-white/72">Version {meta?.version || '2.0.0'}</div>
              </div>
            </div>

            <div className={classNames('mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1', compactSidebar ? 'text-xs' : 'text-sm')}>
              <div className="rounded-[22px] bg-white/10 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/58">Sesion</div>
                <div className="mt-2 font-semibold">{user.name}</div>
              </div>
              <div className="rounded-[22px] bg-white/10 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/58">Estado</div>
                <div className="mt-2 font-semibold">{sidebarLicenseLabel}</div>
              </div>
            </div>

          </div>

          <nav className="soft-scrollbar mt-4 flex-1 space-y-3 overflow-auto pr-1">
            {visibleGroups.map((group) => {
              const open = expandedGroups[group.key] !== false;

              return (
                <section
                  key={group.key}
                  className="rounded-[24px] border border-slate-200/70 bg-white/56 p-2 shadow-[0_12px_28px_-22px_rgba(23,32,51,0.45)]"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between gap-3 rounded-[20px] px-3 py-2 text-left transition hover:bg-white/70"
                  >
                    <span className="flex items-center gap-3">
                      <NavIcon name={group.icon} />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{group.label}</span>
                      </span>
                    </span>
                    <span className="text-xs font-bold uppercase text-slate-400">{open ? 'Ocultar' : 'Abrir'}</span>
                  </button>

                  {open ? (
                    <div className="mt-2 space-y-2 px-1 pb-1">
                      {group.modules.map((module) => {
                        const isActive = activeModule === module.key;

                        return (
                          <button
                            key={module.key}
                            type="button"
                            onClick={() => selectModule(module.key)}
                            className={classNames(
                              'w-full rounded-[20px] px-3 py-3 text-left transition',
                              isActive
                                ? 'bg-ink text-white shadow-soft ring-1 ring-white/18'
                                : 'bg-white/78 text-slate-700 hover:bg-white'
                            )}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-3">
                                <NavIcon name={module.icon} active={isActive} />
                                <span className="text-sm font-semibold">{module.label}</span>
                              </span>
                              {module.key === 'notifications' && notificationSummary.unread > 0 ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                                  {notificationSummary.unread}
                                </span>
                              ) : null}
                            </span>
                            <span className={classNames(
                              'mt-2 block text-xs leading-5',
                              isActive ? 'text-white/72' : 'text-slate-500'
                            )}>
                              {module.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center gap-3 rounded-[24px] border border-slate-200/70 bg-white/68 p-3">
            <NavIcon name="help" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">Soporte JRTech</div>
              <div className="truncate text-xs text-slate-500">Actualizacion, licencia y asistencia</div>
            </div>
            <Button variant="secondary" onClick={onLogout}>
              Salir
            </Button>
          </div>
        </aside>

        <main className="glass-panel flex min-h-[calc(100vh-1rem)] min-w-0 flex-col rounded-[30px] p-4 md:p-5 xl:h-[calc(100vh-1rem)]">
          <header className="flex flex-col gap-3 border-b border-slate-200/80 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200/80 bg-white/64 px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  {activeModuleDefinition?.label || 'Panel'}
                </span>
                <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                <span>{formatRDDate(rdNow)}</span>
                <span className="hidden text-slate-300 sm:inline">|</span>
                <span>Hora RD {formatRDTime(rdNow)}</span>
                <span className="hidden text-slate-300 sm:inline">|</span>
                <span>Rol: {user.role}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {isPending ? (
                  <div className="rounded-full bg-white/82 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Cargando modulo...
                  </div>
                ) : null}
                {notificationSummary.unread > 0 ? (
                  <div className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                    Alertas {notificationSummary.unread}
                  </div>
                ) : null}
                {license?.isDemo ? (
                  <div className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    DEMO
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr),auto]">
              <div className="rounded-[24px] border border-slate-200/70 bg-white/58 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {activeGroupDefinition ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {activeGroupDefinition.label}
                    </span>
                  ) : null}
                  <span className="text-sm font-semibold text-ink">{activeModuleDefinition?.label}</span>
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  {activeModuleDefinition?.description || 'Modulo activo del sistema.'}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/70 bg-white/58 px-4 py-4 text-sm text-slate-600">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Estado general</div>
                <div className="mt-2 font-semibold text-ink">
                  {license?.isDemo
                    ? 'Sistema en demo operativa'
                    : license?.isActive
                      ? 'Sistema con licencia activa'
                      : 'Sistema pendiente de activacion'}
                </div>
              </div>
            </div>
          </header>

          {banner ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {banner}
            </div>
          ) : null}

          <div className="soft-scrollbar mt-5 flex-1 overflow-auto pr-1">
            <Suspense fallback={<ModuleLoadingCard label={activeModuleDefinition?.label} />}>
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
