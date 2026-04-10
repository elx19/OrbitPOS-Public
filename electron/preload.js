const { contextBridge, ipcRenderer } = require('electron');
const packageJson = require('../package.json');

contextBridge.exposeInMainWorld('orbit', {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3030',
  version: packageJson.version,
  files: {
    pickLogo: () => ipcRenderer.invoke('dialog:pick-logo'),
    pickBackup: () => ipcRenderer.invoke('dialog:pick-backup')
  },
  updater: {
    getStatus: () => ipcRenderer.invoke('updater:status'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    pickLocalPackage: () => ipcRenderer.invoke('updater:pick-local-package'),
    installLocalPackage: (filePath) => ipcRenderer.invoke('updater:install-local-package', filePath)
  }
});
