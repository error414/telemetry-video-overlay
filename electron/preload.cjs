const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  openJson: (title) => ipcRenderer.invoke('dialog:openJson', title),
  saveJson: (title, name) => ipcRenderer.invoke('dialog:saveJson', title, name),
  saveOutput: (name, ext) => ipcRenderer.invoke('dialog:saveOutput', name, ext),
  openDir: () => ipcRenderer.invoke('dialog:openDir'),
  readText: (p) => ipcRenderer.invoke('fs:readText', p),
  writeText: (p, t) => ipcRenderer.invoke('fs:writeText', p, t),
  probe: (p) => ipcRenderer.invoke('video:probe', p),
  exportStart: (o) => ipcRenderer.invoke('export:start', o),
  exportFrame: (buf) => ipcRenderer.invoke('export:frame', buf),
  exportFinish: () => ipcRenderer.invoke('export:finish'),
  exportCancel: () => ipcRenderer.invoke('export:cancel'),
  onExportLog: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('export:log', h);
    return () => ipcRenderer.removeListener('export:log', h);
  },
  paths: () => ipcRenderer.invoke('app:paths'),
  openBlackbox: () => ipcRenderer.invoke('dialog:openBlackbox'),
  decodeBlackbox: (file, opts) => ipcRenderer.invoke('blackbox:decode', file, opts),
  makeProxy: (p, duration, kind) => ipcRenderer.invoke('video:makeProxy', p, duration, kind),
  cancelProxy: () => ipcRenderer.invoke('video:cancelProxy'),
  exists: (p) => ipcRenderer.invoke('fs:exists', p),
  onProxyProgress: (cb) => {
    const h = (_e, f) => cb(f);
    ipcRenderer.on('proxy:progress', h);
    return () => ipcRenderer.removeListener('proxy:progress', h);
  },
});
