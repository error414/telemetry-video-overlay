const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  openJson: (title) => ipcRenderer.invoke('dialog:openJson', title),
  saveJson: (title, name) => ipcRenderer.invoke('dialog:saveJson', title, name),
  saveOutput: (name, ext) => ipcRenderer.invoke('dialog:saveOutput', name, ext),
  openDir: () => ipcRenderer.invoke('dialog:openDir'),
  readText: (p) => ipcRenderer.invoke('fs:readText', p),
  readBytes: (p) => ipcRenderer.invoke('fs:readBytes', p),
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
  makeProxy: (p, duration, kind, fps) => ipcRenderer.invoke('video:makeProxy', p, duration, kind, fps),
  cancelProxy: () => ipcRenderer.invoke('video:cancelProxy'),
  proxyTail: (p, offset, maxLen) => ipcRenderer.invoke('proxy:tail', p, offset, maxLen),
  exists: (p) => ipcRenderer.invoke('fs:exists', p),
  onProxyProgress: (cb) => {
    const h = (_e, f) => cb(f);
    ipcRenderer.on('proxy:progress', h);
    return () => ipcRenderer.removeListener('proxy:progress', h);
  },
  onProxyLive: (cb) => {
    const h = (_e, info) => cb(info);
    ipcRenderer.on('proxy:live', h);
    return () => ipcRenderer.removeListener('proxy:live', h);
  },
});
