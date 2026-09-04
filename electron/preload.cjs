const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  openCsv: () => ipcRenderer.invoke('dialog:openCsv'),
  openJson: (title) => ipcRenderer.invoke('dialog:openJson', title),
  openGyroflow: () => ipcRenderer.invoke('dialog:openGyroflow'),
  saveJson: (title, name) => ipcRenderer.invoke('dialog:saveJson', title, name),
  saveOutput: (name, ext) => ipcRenderer.invoke('dialog:saveOutput', name, ext),
  openDir: () => ipcRenderer.invoke('dialog:openDir'),
  readText: (p) => ipcRenderer.invoke('fs:readText', p),
  readBytes: (p) => ipcRenderer.invoke('fs:readBytes', p),
  writeText: (p, t) => ipcRenderer.invoke('fs:writeText', p, t),
  probe: (p) => ipcRenderer.invoke('video:probe', p),
  exportStart: (o) => ipcRenderer.invoke('export:start', o),
  // Frame channel of the export: a MessagePort straight from the page to the main process. Frames go
  // through its structured clone, which skips contextBridge's slow value copy (~30 ms per 1080p frame).
  openFramePort: () => {
    const { port1, port2 } = new MessageChannel();
    ipcRenderer.postMessage('export:port', null, [port1]);
    window.postMessage({ type: 'export:port' }, '*', [port2]);
  },
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
  // auto sync: gray frames of the original video for the motion analysis
  grayFrames: (p, start, len, w, h, total) => ipcRenderer.invoke('video:grayFrames', p, start, len, w, h, total),
  cancelGrayFrames: () => ipcRenderer.invoke('video:cancelGrayFrames'),
  onGrayProgress: (cb) => {
    const h = (_e, f) => cb(f);
    ipcRenderer.on('video:grayProgress', h);
    return () => ipcRenderer.removeListener('video:grayProgress', h);
  },
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
