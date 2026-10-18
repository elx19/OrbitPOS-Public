import { Suspense, lazy, useEffect, useMemo, useState, useTransition } from 'react';
import { classNames } from '../../lib/format';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import orbitposLogoUrl from '../../assets/orbitpos-logo.png';
import { getBusinessProfile } from '../../lib/businessProfile';

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
const BranchesPanel = lazy(() => import('../Branches/BranchesPanel'));

const APP_VERSION = window.orbit?.version || '2.1.0-alpha.48';

const moduleGroups = [
  { key: 'overview', label: 'Resumen', icon: 'spark' },
  { key: 'system', label: 'Sistema', icon: 'settings' },
  { key: 'sales', label: 'Ventas', icon: 'cart' },
  { key: 'operations', label: 'Operacion', icon: 'warehouse' }
];

const moduleDefinitions = [
  { key: 'dashboard', label: 'Inicio', group: 'overview', icon: 'dashboard', description: 'Resumen de ventas, inventario, caja y actividad.', keywords: ['panel', 'inicio', 'resumen', 'ventas'] },
  { key: 'notifications', label: 'Notificaciones', group: 'overview', icon: 'bell', description: 'Centro de alertas del sistema, stock y licencia.', keywords: ['alertas', 'avisos', 'centro'] },
  { key: 'license', label: 'Licencia', group: 'system', icon: 'key', adminOnly: true, description: 'Activa, renueva y diagnostica tu licencia OrbitPOS.', keywords: ['activar', 'renovar', 'demo'] },
  { key: 'config', label: 'Configuracion', group: 'system', icon: 'settings', adminOnly: true, description: 'Negocio, dispositivos, apariencia, backups y tickets.', keywords: ['ajustes', 'parametros', 'dispositivos'] },
  { key: 'branches', label: 'Sucursales', group: 'system', icon: 'warehouse', adminOnly: true, description: 'Administra las sedes operativas del negocio.', keywords: ['sedes', 'tiendas', 'locales'] },
  { key: 'users', label: 'Usuarios y permisos', group: 'system', icon: 'users', adminOnly: true, description: 'Administra usuarios, roles y permisos de acceso.', keywords: ['empleados', 'roles', 'seguridad'] },
  { key: 'help', label: 'Ayuda y soporte', group: 'system', icon: 'help', description: 'Guía, manual, soporte JRTech y diagnósticos.', keywords: ['manual', 'soporte', 'faq'] },
  { key: 'pos', label: 'Ventas', group: 'sales', icon: 'cart', description: 'Registra ventas, cobra y emite comprobantes.', keywords: ['venta', 'cobro', 'carrito', 'caja rapida'] },
  { key: 'cash', label: 'Caja', group: 'sales', icon: 'cash', description: 'Apertura, cierre e historial de movimientos de caja.', keywords: ['apertura', 'cierre', 'arqueo'] },
  { key: 'credits', label: 'Creditos y cuentas por cobrar', group: 'sales', icon: 'credit', description: 'Administra ventas a crédito, abonos y saldos.', keywords: ['abonos', 'cuentas por cobrar', 'deuda'] },
  { key: 'returns', label: 'Devoluciones', group: 'sales', icon: 'return', description: 'Registro de devoluciones totales o parciales.', keywords: ['reembolso', 'nota de devolucion'] },
  { key: 'quotes', label: 'Cotizaciones', group: 'sales', icon: 'quotes', description: 'Presupuestos, vigencia y conversion a venta.', keywords: ['presupuesto', 'propuesta'] },
  { key: 'customers', label: 'Clientes', group: 'sales', icon: 'customer', description: 'Ficha del cliente, historial y balance pendiente.', keywords: ['contactos', 'estado de cuenta'] },
  { key: 'products', label: 'Productos e inventario', group: 'operations', icon: 'box', adminOnly: true, description: 'Gestiona catálogo, precios, existencias y categorías.', keywords: ['inventario', 'articulos', 'stock'] },
  { key: 'suppliers', label: 'Proveedores', group: 'operations', icon: 'truck', adminOnly: true, description: 'Contactos de compra y relacion con inventario.', keywords: ['suplidores', 'compras'] },
  { key: 'purchases', label: 'Compras', group: 'operations', icon: 'clipboard', adminOnly: true, description: 'Entradas de inventario e historial por proveedor.', keywords: ['entrada', 'recepcion', 'orden'] },
  { key: 'discounts', label: 'Descuentos y promociones', group: 'operations', icon: 'tag', adminOnly: true, description: 'Crea promociones y reglas comerciales.', keywords: ['promociones', 'ofertas'] },
  { key: 'reports', label: 'Reportes', group: 'operations', icon: 'report', description: 'Analisis de ventas, caja, inventario y creditos.', keywords: ['estadisticas', 'analitica', 'informes'] }
];

const navigationOrder = [
  'dashboard', 'pos', 'products', 'purchases', 'customers', 'suppliers', 'reports',
  'cash', 'credits', 'returns', 'quotes', 'discounts', 'notifications', 'branches', 'users', 'config', 'help', 'license'
];

const commonUserModules = new Set([
  'dashboard',
  'pos',
  'cash',
  'customers',
  'credits',
  'returns',
  'notifications',
  'help'
]);

// A common user keeps the four daily workflows visible. The rest remains
// available from the compact secondary menu, so the sidebar does not become
// a long operational checklist on small screens.
const commonPrimaryModules = new Set([
  'dashboard',
  'pos',
  'cash',
  'customers'
]);

const primaryAdminModules = new Set([
  'dashboard',
  'pos',
  'products',
  'purchases',
  'customers',
  'cash',
  'reports',
  'suppliers',
  'credits',
  'returns',
  'quotes',
  'discounts',
  'notifications',
  'branches',
  'users',
  'config',
  'help',
  'license'
]);

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
        'orbit-icon transition',
        large ? 'h-12 w-12' : 'h-9 w-9',
        active
          ? 'bg-white/12 text-white'
          : 'text-current'
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
  const [logoVisible, setLogoVisible] = useState(true);
  const [showAdvancedModules, setShowAdvancedModules] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isPending, startTransition] = useTransition();
  const businessName = config.business_name || 'Mi Negocio';
  const businessType = config.business_type || 'colmado';
  const businessProfile = getBusinessProfile(businessType);
  const compactSidebar = String(config.sidebar_compact || '0') === '1';
  const businessLogoUrl = resolveAssetUrl(config.business_logo);
  const businessInitials = getInitials(businessName);

  const visibleModules = useMemo(
    () => moduleDefinitions
      .filter((module) => (businessProfile.modules || []).includes(module.key))
      .filter((module) => !module.adminOnly || user.role === 'admin')
      .filter((module) => user.role === 'admin' || commonUserModules.has(module.key))
      .sort((left, right) => navigationOrder.indexOf(left.key) - navigationOrder.indexOf(right.key)),
    [businessProfile.modules, user.role]
  );

  const activeModuleDefinition = useMemo(
    () => visibleModules.find((module) => module.key === activeModule) || visibleModules[0],
    [activeModule, visibleModules]
  );

  const primaryModules = useMemo(
    () => user.role === 'admin'
      ? visibleModules.filter((module) => primaryAdminModules.has(module.key))
      : visibleModules.filter((module) => commonPrimaryModules.has(module.key)),
    [user.role, visibleModules]
  );

  const advancedModules = useMemo(
    () => visibleModules.filter((module) => user.role === 'admin'
      ? !primaryAdminModules.has(module.key)
      : !commonPrimaryModules.has(module.key)),
    [user.role, visibleModules]
  );

  const modulesToRender = primaryModules;

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

  useEffect(() => {
    if (activeModule && !primaryModules.some((module) => module.key === activeModule)) {
      setShowAdvancedModules(true);
    }
  }, [activeModule, primaryModules]);

  function handleActivity() {
    setActivityVersion((current) => current + 1);
  }

  function selectModule(moduleKey) {
    setShowProfileMenu(false);
    startTransition(() => {
      setActiveModule(moduleKey);
    });
  }

  function renderContent() {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardHome token={token} refreshKey={activityVersion} onNavigate={selectModule} />;
      case 'pos':
        return (
          <POSPanel
            token={token}
            taxRate={Number(config.tax_rate || 18)}
            businessName={businessName}
            businessType={businessType}
            sellsByWeight={String(config.business_sells_weight) === '1'}
            scannerPort={config.scanner_port || ''}
            scannerBaudRate={Number(config.scanner_baud_rate || 9600)}
            scaleEnabled={String(config.scale_enabled) === '1'}
            scalePort={config.scale_port || ''}
            scaleBaudRate={Number(config.scale_baud_rate || 9600)}
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
        return <ProductsPanel token={token} businessType={businessType} onActivity={handleActivity} />;
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
      case 'branches':
        return <BranchesPanel token={token} onActivity={handleActivity} />;
      case 'help':
        return <HelpPanel license={license} machineId={machineId} token={token} onReconfigure={onReconfigure} />;
      case 'license':
        return <LicensePanel token={token} license={license} machineId={machineId} onActivated={onLicenseUpdated} />;
      default:
        return <DashboardHome token={token} refreshKey={activityVersion} onNavigate={selectModule} />;
    }
  }

  return (
    <div className="app-surface orbit-shell min-h-screen">
      <div className={classNames(
        'app-frame grid min-h-screen w-full gap-4 p-4',
        compactSidebar ? 'xl:grid-cols-[270px,minmax(0,1fr)]' : 'xl:grid-cols-[292px,minmax(0,1fr)]'
      )}>
        <aside className="orbit-sidebar flex min-h-[260px] flex-col xl:h-screen">
          <div className="orbit-sidebar-brand">
            <div className="orbit-brand-lockup">
              <img src={orbitposLogoUrl} alt="OrbitPOS" className="orbit-brand-mark" />
              <div className="orbit-brand-name">Orbit<span>POS</span></div>
            </div>
            <div className="orbit-business-meta">
              <div className="orbit-business-name">{businessName}</div>
              <div className="orbit-business-subtitle">{businessProfile.subtitle}</div>
            </div>
          </div>

          <nav className="orbit-sidebar-nav soft-scrollbar flex-1 overflow-auto">
            {modulesToRender.map((module) => {
              const isActive = activeModule === module.key;
              return (
                <button
                  key={module.key}
                  type="button"
                  onClick={() => selectModule(module.key)}
                  aria-label={`${module.label}: ${module.description}`}
                  className="orbit-nav-item w-full text-left transition"
                  data-active={isActive}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <NavIcon name={module.icon} active={isActive} />
                      <span className="text-sm font-semibold">{module.label}</span>
                    </span>
                    {module.key === 'notifications' && notificationSummary.unread > 0 ? (
                      <span className="orbit-notification-count">{notificationSummary.unread}</span>
                    ) : null}
                  </span>
                  <span className="hidden">{module.description}</span>
                </button>
              );
            })}
            {advancedModules.length ? (
              <button
                type="button"
                className="orbit-nav-more"
                onClick={() => setShowAdvancedModules((current) => !current)}
                aria-expanded={showAdvancedModules}
                aria-controls="orbit-advanced-modules"
              >
                <span className="orbit-nav-more-label">{showAdvancedModules ? 'Ocultar módulos' : 'Más módulos'}</span>
                <span className="orbit-nav-more-count">{advancedModules.length}</span>
                <span className={classNames('orbit-nav-more-chevron', showAdvancedModules && 'is-open')} aria-hidden="true">⌄</span>
              </button>
            ) : null}
            {showAdvancedModules ? (
              <div id="orbit-advanced-modules" className="orbit-nav-advanced" aria-label="Más módulos">
                {advancedModules.map((module) => {
                  const isActive = activeModule === module.key;
                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => selectModule(module.key)}
                      aria-label={`${module.label}: ${module.description}`}
                      className="orbit-nav-item orbit-nav-item-advanced w-full text-left transition"
                      data-active={isActive}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3">
                          <NavIcon name={module.icon} active={isActive} />
                          <span className="text-sm font-semibold">{module.label}</span>
                        </span>
                        {module.key === 'notifications' && notificationSummary.unread > 0 ? (
                          <span className="orbit-notification-count">{notificationSummary.unread}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </nav>

          <div className="orbit-sidebar-footer">
            <div className="orbit-store-switcher">
              <span className="orbit-store-icon"><NavIcon name="warehouse" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{businessName}</span>
                <span className="block truncate text-xs text-slate-400">Santo Domingo, RD · En linea</span>
              </span>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen min-w-0 flex-col" data-module={activeModule}>
          <header className="orbit-app-header">
            <label className="orbit-global-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 20-4.5-4.5m2-5.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
              <input aria-label="Buscar en OrbitPOS" placeholder="Buscar productos, clientes o facturas..." />
            </label>
            <div className="orbit-header-actions">
              <div className="orbit-header-business" title="Sucursal activa">
                <NavIcon name="warehouse" />
                <span className="min-w-0">
                  <strong className="block truncate">{businessName}</strong>
                  <small className="block truncate">Santo Domingo, RD</small>
                </span>
                <span className="orbit-header-chevron">⌄</span>
              </div>
              <button type="button" className="orbit-icon-button" aria-label="Notificaciones" onClick={() => selectModule('notifications')}>
                <NavIcon name="bell" />
                {notificationSummary.unread > 0 ? <span className="orbit-header-badge">{notificationSummary.unread}</span> : null}
              </button>
              <div className="orbit-profile-wrap">
                <button
                  type="button"
                  className="orbit-user-menu"
                  onClick={() => setShowProfileMenu((current) => !current)}
                  aria-expanded={showProfileMenu}
                  aria-haspopup="menu"
                >
                  <span className="orbit-user-avatar">
                    {businessLogoUrl && logoVisible ? (
                      <img src={businessLogoUrl} alt={`Logo de ${businessName}`} onError={() => setLogoVisible(false)} />
                    ) : businessInitials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{user.name}</span>
                    <span className="block truncate text-xs text-slate-500">{user.role === 'admin' ? 'Administrador' : 'Cajero'}</span>
                  </span>
                  <span className="orbit-profile-chevron" aria-hidden="true">⌄</span>
                </button>
                {showProfileMenu ? (
                  <div className="orbit-profile-menu" role="menu" aria-label="Perfil del usuario">
                    <div className="orbit-profile-menu-brand">
                      <span className="orbit-profile-menu-logo">
                        {businessLogoUrl && logoVisible ? (
                          <img src={businessLogoUrl} alt={`Logo de ${businessName}`} onError={() => setLogoVisible(false)} />
                        ) : <NavIcon name="warehouse" />}
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate">{businessName}</strong>
                        <small className="block truncate">{businessProfile.subtitle}</small>
                      </span>
                    </div>
                    <div className="orbit-profile-menu-user">
                      <strong className="block truncate">{user.name}</strong>
                      <small>{user.role === 'admin' ? 'Administrador' : 'Cajero'}</small>
                    </div>
                    {user.role === 'admin' ? (
                      <button type="button" role="menuitem" onClick={() => selectModule('config')}>
                        <NavIcon name="settings" />
                        <span>Configuración del negocio</span>
                      </button>
                    ) : null}
                    <button type="button" role="menuitem" onClick={() => { setShowProfileMenu(false); onLogout(); }}>
                      <NavIcon name="return" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="orbit-page-heading" aria-hidden="true">
            <div>
              <div className="orbit-breadcrumb">OrbitPOS <span>/</span> {activeGroupDefinition?.label || 'Sistema'}</div>
              <h1>{activeModuleDefinition?.label || 'Panel'}</h1>
              <p>{activeModuleDefinition?.description || 'Modulo activo del sistema.'}</p>
            </div>
            <div className="orbit-page-status">
              {isPending ? <span className="orbit-status-chip">Cargando...</span> : null}
              {license?.isDemo ? <span className="orbit-status-chip orbit-status-chip-warning">DEMO</span> : null}
              <span className="orbit-status-chip orbit-status-chip-success">
                {license?.isActive ? 'Licencia activa' : license?.isDemo ? 'Demo activa' : 'Pendiente'}
              </span>
            </div>
          </div>

          {banner ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {banner}
            </div>
          ) : null}

          <div className="soft-scrollbar orbit-content flex-1 overflow-auto">
            <Suspense fallback={<ModuleLoadingCard label={activeModuleDefinition?.label} />}>
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
