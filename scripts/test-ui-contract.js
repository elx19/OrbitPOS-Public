#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`Falta ${relativePath}.`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${relativePath} no es JSON valido: ${error.message}`);
    return null;
  }
}

function extractModuleKeys() {
  const source = fs.readFileSync(absolute('frontend/src/components/Layout/AppShell.jsx'), 'utf8');
  const section = source.match(/const moduleDefinitions = \[(.*?)\n\];/s)?.[1] || '';
  return [...section.matchAll(/\{ key: '([^']+)'/g)].map((match) => match[1]);
}

function checkReference(relativePath, label) {
  if (!relativePath) {
    fail(`La referencia de ${label} esta vacia.`);
    return;
  }
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`La referencia de ${label} no existe: ${relativePath}.`);
  }
}

const manifest = readJson('shared/ui-reference-manifest.json');
if (manifest) {
  Object.entries(manifest.flows || {}).forEach(([key, reference]) => checkReference(reference, `flujo ${key}`));
  Object.entries(manifest.modules || {}).forEach(([key, reference]) => checkReference(reference, `modulo ${key}`));
  (manifest.alternateReferences || []).forEach((reference) => checkReference(reference, 'referencia alternativa'));

  const moduleKeys = extractModuleKeys();
  const manifestKeys = Object.keys(manifest.modules || {}).sort();
  const missing = moduleKeys.filter((key) => !manifestKeys.includes(key));
  const stale = manifestKeys.filter((key) => !moduleKeys.includes(key));
  if (missing.length) fail(`Modulos sin referencia declarada: ${missing.join(', ')}.`);
  if (stale.length) fail(`Referencias de modulos que no existen en AppShell: ${stale.join(', ')}.`);
  if (moduleKeys.length !== manifestKeys.length) {
    fail(`La cantidad de modulos de AppShell (${moduleKeys.length}) no coincide con el manifiesto (${manifestKeys.length}).`);
  }

  if (!fs.readFileSync(absolute('frontend/src/components/Layout/AppShell.jsx'), 'utf8').includes('data-module={activeModule}')) {
    fail('AppShell no expone data-module para identificar la pantalla activa en QA visual.');
  }

  const shellSource = fs.readFileSync(absolute('frontend/src/components/Layout/AppShell.jsx'), 'utf8');
  const styleSource = fs.readFileSync(absolute('frontend/src/index.css'), 'utf8');
  if (!shellSource.includes('businessLogoUrl') || !shellSource.includes('orbit-profile-menu-logo')) {
    fail('El logo del negocio debe mostrarse dentro del menu de perfil.');
  }
  if (!styleSource.includes('height: 100dvh !important') || !styleSource.includes('height: min(800px, calc(100dvh - 40px)) !important')) {
    fail('El login debe calcular su altura con el viewport dinamico en pantallas de escritorio.');
  }
  if (!styleSource.includes('max-height: 100dvh') || !styleSource.includes('overscroll-behavior: contain')) {
    fail('El shell autenticado debe contenerse en el viewport dinamico y reservar el scroll para el modulo activo.');
  }
  if (!fs.readFileSync(absolute('frontend/src/components/Config/ConfigPanel.jsx'), 'utf8').includes('window.orbit.files.pickLogo')) {
    fail('Configuracion debe conservar el selector de logo de escritorio.');
  }
  if (!fs.readFileSync(absolute('electron/main.js'), 'utf8').includes('imageFileToDataUrl')) {
    fail('Electron debe convertir el logo elegido a un asset portable.');
  }
  if (!shellSource.includes('Cerrar sesión') || !shellSource.includes('onLogout()')) {
    fail('Cerrar sesión debe permanecer disponible desde el perfil del usuario.');
  }
  if (/orbit-sidebar-footer[\s\S]*orbit-logout/.test(shellSource)) {
    fail('El sidebar no debe contener el control de cerrar sesión.');
  }
  if (!shellSource.includes('businessProfile.adminPrimaryModules') || !shellSource.includes('businessProfile.commonModules') || !shellSource.includes('Más módulos')) {
    fail('La navegación no separa los módulos administrativos, comunes y secundarios.');
  }
  ['DashboardHome', 'POSPanel', 'ProductsPanel', 'PurchasesPanel', 'ReportsPanel'].forEach((componentName) => {
    const componentPattern = new RegExp(`<${componentName}\\s+key=\\{businessType\\}`);
    if (!componentPattern.test(shellSource)) {
      fail(`${componentName} no se reinicia al cambiar el tipo de negocio.`);
    }
  });
  const posSource = fs.readFileSync(absolute('frontend/src/components/POS/POSPanel.jsx'), 'utf8');
  if (!posSource.includes('handleBarcodeSubmit') || !posSource.includes('Escanear código de barras') || !posSource.includes('orbit-pos-charge-button')) {
    fail('Ventas debe conservar el flujo de escaneo, cliente y accion Cobrar de la referencia.');
  }
  const dashboardSource = fs.readFileSync(absolute('frontend/src/components/Dashboard/DashboardHome.jsx'), 'utf8');
  if (!dashboardSource.includes('businessType') || !dashboardSource.includes('orbit-dashboard-catalog-grid') || !dashboardSource.includes('orbit-dashboard-charge')) {
    fail('Inicio debe conservar el tablero operativo contextual por negocio de la referencia.');
  }
  const productsSource = fs.readFileSync(absolute('frontend/src/components/Products/ProductsPanel.jsx'), 'utf8');
  if (!productsSource.includes('orbit-products-table') || !productsSource.includes('orbit-low-stock-panel') || !productsSource.includes('orbit-inventory-summary')) {
    fail('Productos e inventario debe conservar la tabla, alertas y resumen de la referencia.');
  }
}

const profiles = readJson('shared/business-profiles.json');
if (profiles) {
  Object.entries(profiles).forEach(([profileKey, profile]) => {
    const modules = new Set(profile.modules || []);
    const primaryModules = profile.primaryModules || [];
    const adminPrimaryModules = profile.adminPrimaryModules || primaryModules;
    const commonModules = profile.commonModules || primaryModules;
    if (!primaryModules.length || primaryModules.length > 5) {
      fail(`El perfil ${profileKey} debe declarar entre 1 y 5 modulos primarios.`);
    }
    if (new Set(primaryModules).size !== primaryModules.length) {
      fail(`El perfil ${profileKey} repite modulos primarios.`);
    }
    primaryModules.forEach((moduleKey) => {
      if (!modules.has(moduleKey)) {
        fail(`El perfil ${profileKey} expone ${moduleKey} como primario pero no lo permite en modules.`);
      }
    });

    if (adminPrimaryModules.length > 18 || new Set(adminPrimaryModules).size !== adminPrimaryModules.length) {
      fail(`El perfil ${profileKey} tiene modulos primarios administrativos invalidos.`);
    }
    adminPrimaryModules.forEach((moduleKey) => {
      if (!modules.has(moduleKey)) {
        fail(`El perfil ${profileKey} expone ${moduleKey} como primario administrativo pero no lo permite en modules.`);
      }
    });
    if (commonModules.length > 6 || new Set(commonModules).size !== commonModules.length) {
      fail(`El perfil ${profileKey} tiene demasiados módulos comunes o repetidos.`);
    }
    commonModules.forEach((moduleKey) => {
      if (!modules.has(moduleKey)) {
        fail(`El perfil ${profileKey} expone ${moduleKey} como común pero no lo permite en modules.`);
      }
    });
  });
}

if (failures.length) {
  console.error('UI contract QA: FALLO');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('UI contract QA: OK (login, wizard y todos los modulos declarados)');
}
