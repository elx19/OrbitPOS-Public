const path = require('path');
const fs = require('fs');
const { fork, spawn } = require('child_process');
const { app, BrowserWindow, ipcMain, screen, shell, dialog } = require('electron');
const {
  initializeUpdater,
  getUpdaterState,
  checkForOrbitUpdates,
  downloadOrbitUpdate,
  installOrbitUpdate
} = require('./updater');

let mainWindow;
let customerDisplayWindow;
let backendProcess;
let backendServer;
let customerDisplayState = {
  businessName: 'OrbitPOS',
  saleType: 'cash',
  customerName: 'Consumidor final',
  statusText: 'Esperando venta',
  cart: [],
  payments: [],
  totals: {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    change: 0,
    balance: 0
  },
  updatedAt: new Date().toISOString()
};

const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const externalBackendUrl = process.env.BACKEND_URL;
const backendPort = process.env.PORT || '3030';
const backendUrl = externalBackendUrl || `http://localhost:${backendPort}`;
const mainAppIcon = path.join(__dirname, '..', 'assets', 'OrbitPOS.ico');

app.disableHardwareAcceleration();

function isPortableFolderMode() {
  return app.isPackaged && fs.existsSync(path.join(path.dirname(process.execPath), '.portable'));
}

function appendStartupLog(message) {
  try {
    const baseDir = process.env.PORTABLE_EXECUTABLE_DIR
      ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
      : isPortableFolderMode()
        ? path.join(path.dirname(process.execPath), 'data')
      : path.join(app.getPath('appData'), 'OrbitPOSData');
    fs.mkdirSync(baseDir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(path.join(baseDir, 'startup.log'), line);
  } catch (error) {
    // Ignora errores de logging para no afectar el arranque.
  }
}

function resolveBackendEntry() {
  return path.join(__dirname, '..', 'backend', 'server.js');
}

function resolveWritableDataDir() {
  if (process.env.ORBITPOS_DATA_DIR) {
    return process.env.ORBITPOS_DATA_DIR;
  }

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
  }

  if (isPortableFolderMode()) {
    return path.join(path.dirname(process.execPath), 'data');
  }

  return path.join(app.getPath('appData'), 'OrbitPOSData');
}

function startBackendIfNeeded() {
  if (externalBackendUrl || backendProcess || backendServer) {
    appendStartupLog(`Backend externo o ya iniciado. externalBackendUrl=${externalBackendUrl || ''}`);
    return;
  }

  process.env.ORBITPOS_DATA_DIR = resolveWritableDataDir();
  appendStartupLog(`Iniciando backend local. dataDir=${process.env.ORBITPOS_DATA_DIR}`);

  if (isDev) {
    backendProcess = fork(resolveBackendEntry(), [], {
      env: {
        ...process.env,
        PORT: backendPort
      },
      stdio: 'ignore'
    });

    backendProcess.unref();
    appendStartupLog(`Backend en modo desarrollo via fork. port=${backendPort}`);
    return;
  }

  try {
    const { startServer } = require(resolveBackendEntry());
    backendServer = startServer(Number(backendPort));
    appendStartupLog(`Backend empaquetado iniciado. port=${backendPort}`);
  } catch (error) {
    appendStartupLog(`Error iniciando backend empaquetado: ${error.stack || error.message}`);
    throw error;
  }
}

function getRendererUrl(search = '') {
  if (isDev && devServerUrl) {
    return `${devServerUrl}${search}`;
  }

  return null;
}

function loadRenderer(windowInstance, search = '') {
  const url = getRendererUrl(search);
  if (url) {
    return windowInstance.loadURL(url);
  }

  return windowInstance.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'), {
    search
  });
}

function isSupportedLocalUpdate(filePath) {
  return ['.exe', '.msi'].includes(path.extname(String(filePath || '')).toLowerCase());
}

async function pickLocalUpdatePackage() {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: 'Seleccionar actualizacion local',
    properties: ['openFile'],
    filters: [
      {
        name: 'Instaladores de Windows',
        extensions: ['exe', 'msi']
      }
    ]
  });

  if (result.canceled || !result.filePaths?.length) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  return {
    path: selectedPath,
    name: path.basename(selectedPath)
  };
}

async function installLocalUpdatePackage(filePath) {
  const rawPath = String(filePath || '').trim();
  if (!rawPath) {
    throw new Error('Debes seleccionar un archivo de actualizacion.');
  }
  const resolvedPath = path.resolve(rawPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('No se encontro el archivo de actualizacion seleccionado.');
  }

  if (!isSupportedLocalUpdate(resolvedPath)) {
    throw new Error('Solo se admiten actualizaciones locales en formato .exe o .msi.');
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  let child;

  if (extension === '.msi') {
    child = spawn('msiexec', ['/i', resolvedPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
  } else {
    child = spawn(resolvedPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
  }

  child.unref();
  appendStartupLog(`Actualizacion local iniciada desde ${resolvedPath}`);

  setTimeout(() => {
    app.quit();
  }, 300);

  return {
    ok: true,
    path: resolvedPath,
    message: 'Actualizacion local iniciada. OrbitPOS se cerrara para continuar la instalacion.'
  };
}

function broadcastCustomerDisplayState() {
  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.webContents.send('customer-display:state', customerDisplayState);
  }
}

function createMainWindow() {
  appendStartupLog('Creando ventana principal.');
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1240,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7efe1',
    icon: mainAppIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    appendStartupLog('Renderer principal cargado.');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    appendStartupLog(`Fallo cargando renderer principal: ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    appendStartupLog(`Renderer principal finalizado: ${JSON.stringify(details)}`);
  });

  mainWindow.on('closed', () => {
    appendStartupLog('Ventana principal cerrada.');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }
}

function createCustomerDisplayWindow() {
  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.focus();
    broadcastCustomerDisplayState();
    return customerDisplayWindow;
  }

  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const externalDisplay = displays.find((display) => display.id !== primaryDisplay.id);
  const targetBounds = externalDisplay?.bounds || {
    x: undefined,
    y: undefined,
    width: 1280,
    height: 720
  };

  customerDisplayWindow = new BrowserWindow({
    x: targetBounds.x,
    y: targetBounds.y,
    width: Math.max(targetBounds.width || 1280, 1100),
    height: Math.max(targetBounds.height || 720, 680),
    backgroundColor: '#0c1420',
    icon: mainAppIcon,
    show: false,
    autoHideMenuBar: true,
    title: 'OrbitPOS - Pantalla cliente',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  customerDisplayWindow.on('closed', () => {
    customerDisplayWindow = null;
  });

  customerDisplayWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  customerDisplayWindow.webContents.on('did-finish-load', () => {
    broadcastCustomerDisplayState();
  });

  customerDisplayWindow.once('ready-to-show', () => {
    customerDisplayWindow.maximize();
    customerDisplayWindow.show();
  });

  loadRenderer(customerDisplayWindow, '?display=customer');
  return customerDisplayWindow;
}

ipcMain.handle('dialog:pick-logo', async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: 'Seleccionar logo del negocio',
    properties: ['openFile'],
    filters: [
      {
        name: 'Imagenes',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico']
      }
    ]
  });

  if (result.canceled || !result.filePaths?.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('dialog:pick-backup', async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: 'Seleccionar backup de OrbitPOS',
    properties: ['openFile'],
    filters: [
      {
        name: 'Backups de OrbitPOS',
        extensions: ['zip']
      }
    ]
  });

  if (result.canceled || !result.filePaths?.length) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('customer-display:open', () => {
  createCustomerDisplayWindow();
  return {
    open: true
  };
});

ipcMain.handle('customer-display:close', () => {
  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.close();
  }

  return {
    open: false
  };
});

ipcMain.handle('customer-display:status', () => ({
  open: Boolean(customerDisplayWindow && !customerDisplayWindow.isDestroyed())
}));

ipcMain.handle('customer-display:get-state', () => customerDisplayState);

ipcMain.on('customer-display:update', (event, payload) => {
  customerDisplayState = {
    ...customerDisplayState,
    ...(payload || {}),
    updatedAt: payload?.updatedAt || new Date().toISOString()
  };
  broadcastCustomerDisplayState();
});

ipcMain.handle('updater:status', () => getUpdaterState());
ipcMain.handle('updater:check', async () => checkForOrbitUpdates());
ipcMain.handle('updater:download', async () => downloadOrbitUpdate());
ipcMain.handle('updater:install', () => installOrbitUpdate());
ipcMain.handle('updater:pick-local-package', async () => pickLocalUpdatePackage());
ipcMain.handle('updater:install-local-package', async (event, filePath) => installLocalUpdatePackage(filePath));

app.whenReady().then(() => {
  appendStartupLog(`App lista. isPackaged=${app.isPackaged} portableDir=${process.env.PORTABLE_EXECUTABLE_DIR || ''}`);
  startBackendIfNeeded();
  try {
    appendStartupLog('Inicializando updater.');
    initializeUpdater();
    appendStartupLog('Updater inicializado.');
  } catch (error) {
    appendStartupLog(`Error inicializando updater: ${error.stack || error.message}`);
    throw error;
  }
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  appendStartupLog('Evento window-all-closed.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  appendStartupLog('Cerrando aplicacion.');
  if (backendProcess) {
    backendProcess.kill();
  }

  if (backendServer) {
    backendServer.close();
    backendServer = null;
  }
});

process.on('uncaughtException', (error) => {
  appendStartupLog(`uncaughtException: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (error) => {
  appendStartupLog(`unhandledRejection: ${error?.stack || error?.message || error}`);
});
