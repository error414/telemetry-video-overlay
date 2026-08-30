const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Bundled binaries (ffmpeg-static / ffprobe-static ship platform executables in node_modules)
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// webSecurity is intentionally off (local file:// video from the dev server); hide the dev-only warnings.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    backgroundColor: '#171717',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allows the http://localhost renderer to play local file:// videos.
      webSecurity: false,
    },
  });
  win.setMenuBarVisibility(false);
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  win.loadURL(devUrl);
  // Forward renderer errors to the terminal so they are visible without DevTools.
  win.webContents.on('console-message', (_e, level, msg, line, src) => {
    if (level >= 2) console.error('[renderer]', msg, src ? `(${src}:${line})` : '');
  });
  win.webContents.on('did-finish-load', () => console.log('[renderer] loaded'));
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error('[renderer] failed to load:', code, desc));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ---------- Dialogs / files ----------
ipcMain.handle('dialog:openVideo', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'mts', 'ts'] },
      { name: 'All', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:openCsv', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }, { name: 'All', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('dialog:openJson', async (_e, title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:saveJson', async (_e, title, defaultName) => {
  const r = await dialog.showSaveDialog(win, { title, defaultPath: defaultName, filters: [{ name: 'JSON', extensions: ['json'] }] });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('dialog:saveOutput', async (_e, defaultName, ext) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('dialog:openDir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('fs:readText', async (_e, p) => fs.promises.readFile(p, 'utf8'));
ipcMain.handle('fs:writeText', async (_e, p, text) => fs.promises.writeFile(p, text, 'utf8'));

// ---------- ffprobe ----------
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err || 'exit ' + code))));
  });
}

function parseFps(s) {
  if (!s) return 30;
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
}

ipcMain.handle('video:probe', async (_e, file) => {
  const out = await run(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  if (!v) throw new Error('No video stream found');
  let rotation = 0;
  if (v.tags && v.tags.rotate) rotation = Number(v.tags.rotate) || 0;
  if (v.side_data_list) for (const sd of v.side_data_list) if (sd.rotation != null) rotation = Number(sd.rotation) || 0;
  const swap = Math.abs(rotation % 180) === 90;
  return {
    path: file,
    width: swap ? v.height : v.width,
    height: swap ? v.width : v.height,
    fpsStr: v.r_frame_rate || v.avg_frame_rate || '30/1',
    fps: parseFps(v.r_frame_rate || v.avg_frame_rate),
    duration: Number(j.format.duration || v.duration || 0),
    codec: v.codec_name,
    pixFmt: v.pix_fmt,
    bitrate: Number(v.bit_rate || j.format.bit_rate || 0),
    hasAudio: !!a,
    nbFrames: Number(v.nb_frames || 0),
  };
});

// ---------- preview proxy (low-res h264 copy for smooth in-app playback) ----------
let proxyProc = null;
/**
 * kind = 'full'  : same resolution / fps / bit depth, re-encoded with NVENC (plays in Chromium even when the
 *                  camera's original HEVC stream is rejected by the D3D11 decoder, e.g. DJI 4K120 10-bit)
 * kind = 'light' : 1080p / 30 fps H.264 for weak machines
 */
ipcMain.handle('video:makeProxy', async (_e, file, duration, kind = 'light') => {
  if (proxyProc) throw new Error('Proxy already being created');
  const out = file.replace(/\.[^.]+$/, '') + '.preview-proxy.mp4';
  const nvenc = await canNvenc();
  const cuda = await canCudaDecode(file);
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-stats'];
  if (kind === 'full') {
    if (cuda) args.push('-hwaccel', 'cuda');
    if (cuda && nvenc) args.push('-hwaccel_output_format', 'cuda'); // frames stay on the GPU
    args.push('-i', file, '-map', '0:v:0', '-an');
    if (nvenc) args.push('-c:v', 'hevc_nvenc', '-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '22', '-b:v', '0', '-tag:v', 'hvc1');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p');
    args.push('-movflags', '+faststart', out);
  } else {
    if (cuda) args.push('-hwaccel', 'cuda');
    args.push('-i', file, '-map', '0:v:0', '-an', '-vf', 'scale=-2:1080', '-r', '30');
    if (nvenc) args.push('-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '23', '-b:v', '0');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23');
    args.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  }
  proxyProc = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  proxyProc.stderr.on('data', (d) => {
    const s = d.toString();
    err = (err + s).slice(-5000);
    const m = /time=(\d+):(\d+):([\d.]+)/.exec(s);
    if (m && win && duration) win.webContents.send('proxy:progress', Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / duration));
  });
  const code = await new Promise((resolve) => proxyProc.on('close', resolve));
  proxyProc = null;
  if (code !== 0) throw new Error('ffmpeg failed: ' + err);
  return out;
});
ipcMain.handle('video:cancelProxy', () => {
  if (proxyProc) proxyProc.kill();
});
ipcMain.handle('fs:exists', (_e, p) => fs.existsSync(p));

// ---------- INAV blackbox decoder (bundled from iNavFlight/blackbox-tools) ----------
const bbDecodePath = path.join(__dirname, '..', 'bin', 'blackbox-tools', 'bin', process.platform === 'win32' ? 'blackbox_decode.exe' : 'blackbox_decode');

ipcMain.handle('dialog:openBlackbox', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'INAV blackbox log', extensions: ['txt', 'bbl', 'bfl', 'log'] }, { name: 'All', extensions: ['*'] }],
  });
  return r.canceled ? [] : r.filePaths;
});

/**
 * Decodes a blackbox log. Returns the list of CSV files the decoder wrote
 * (<log>.NN.csv and <log>.NN.gps.csv for each log index NN found in the file).
 */
ipcMain.handle('blackbox:decode', async (_e, file, opts = {}) => {
  if (!fs.existsSync(bbDecodePath)) throw new Error('blackbox_decode not found at ' + bbDecodePath);
  const args = [];
  if (opts.mergeGps) args.push('--merge-gps');
  if (opts.simulateImu) args.push('--simulate-imu');
  if (opts.datetime) args.push('--datetime');
  if (opts.unitGpsSpeed) args.push('--unit-gps-speed', opts.unitGpsSpeed);
  if (opts.unitHeight) args.push('--unit-height', opts.unitHeight);
  if (opts.unitRotation) args.push('--unit-rotation', opts.unitRotation);
  if (opts.unitAcceleration) args.push('--unit-acceleration', opts.unitAcceleration);
  if (opts.unitVbat) args.push('--unit-vbat', opts.unitVbat);
  if (opts.unitAmperage) args.push('--unit-amperage', opts.unitAmperage);
  if (opts.index != null && opts.index !== '') args.push('--index', String(opts.index));
  args.push(file);

  const dir = path.dirname(file);
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const started = Date.now() - 2000;
  let log = '';
  const code = await new Promise((resolve, reject) => {
    const p = spawn(bbDecodePath, args, { windowsHide: true, cwd: dir });
    p.stdout.on('data', (d) => (log += d));
    p.stderr.on('data', (d) => (log += d));
    p.on('error', reject);
    p.on('close', resolve);
  });
  // collect CSVs produced for this log (blackbox_decode names them <base>.NN.csv / <base>.NN.gps.csv)
  const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.\\d+(\\.gps)?\\.csv$', 'i');
  const files = (await fs.promises.readdir(dir))
    .filter((n) => re.test(n))
    .map((n) => path.join(dir, n))
    .filter((p) => fs.statSync(p).mtimeMs >= started)
    .sort();
  // blackbox_decode exits 0 even when it finds no log header, so judge by output files.
  if (!files.length) throw new Error('blackbox_decode produced no CSV (exit ' + code + '):\n' + log.trim());
  return { files, log, code };
});

// ---------- ffmpeg export ----------
let exp = null; // { proc, done, error }

// ---- GPU capability check (NVENC encode / CUDA decode), cached per session ----
const gpuCache = { encode: null, decode: {} };
async function canNvenc() {
  if (gpuCache.encode !== null) return gpuCache.encode;
  try {
    await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:r=30:d=0.1', '-c:v', 'hevc_nvenc', '-f', 'null', '-']);
    gpuCache.encode = true;
  } catch {
    gpuCache.encode = false;
  }
  return gpuCache.encode;
}
async function canCudaDecode(file) {
  if (file in gpuCache.decode) return gpuCache.decode[file];
  try {
    await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-hwaccel', 'cuda', '-i', file, '-frames:v', '2', '-f', 'null', '-']);
    gpuCache.decode[file] = true;
  } catch {
    gpuCache.decode[file] = false;
  }
  return gpuCache.decode[file];
}

function buildArgs(opts) {
  const { mode, info, out, width, height, fpsStr, quality, region, gpu } = opts;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-stats'];
  // The overlay stream only covers the region that contains widgets (much less data than full frame).
  const r = region || { x: 0, y: 0, w: width, h: height };
  const rawIn = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', r.w + 'x' + r.h, '-r', fpsStr, '-thread_queue_size', '128', '-i', 'pipe:0'];

  if (mode === 'video') {
    if (gpu && gpu.decode) args.push('-hwaccel', 'cuda');
    args.push('-i', info.path, ...rawIn);
    // eof_action=repeat: overlay may run at a lower fps than the video; keep the last overlay frame until the video ends
    args.push('-filter_complex', `[0:v][1:v]overlay=${r.x}:${r.y}:eof_action=repeat[v]`, '-map', '[v]');
    if (info.hasAudio) args.push('-map', '0:a?', '-c:a', 'copy');
    args.push('-map_metadata', '0');
    const tenBit = info.pixFmt && info.pixFmt.includes('10');
    if (gpu && gpu.encode) {
      // NVIDIA hardware encoder, same codec family as the source
      const enc = info.codec === 'hevc' ? 'hevc_nvenc' : 'h264_nvenc';
      args.push('-c:v', enc, '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-multipass', 'qres', '-spatial_aq', '1', '-temporal_aq', '1');
      if (quality === 'bitrate' && info.bitrate > 0) args.push('-b:v', String(info.bitrate), '-maxrate', String(Math.round(info.bitrate * 1.5)), '-bufsize', String(info.bitrate * 2));
      else args.push('-cq', enc === 'hevc_nvenc' ? '22' : '19', '-b:v', '0');
      args.push('-pix_fmt', tenBit && enc === 'hevc_nvenc' ? 'p010le' : 'yuv420p');
    } else {
      // CPU: match the source codec family; keep the source bitrate so output quality ~= source quality.
      const enc = info.codec === 'hevc' ? 'libx265' : info.codec === 'vp9' ? 'libvpx-vp9' : 'libx264';
      args.push('-c:v', enc);
      if (quality === 'bitrate' && info.bitrate > 0) {
        args.push('-b:v', String(info.bitrate), '-maxrate', String(Math.round(info.bitrate * 1.5)), '-bufsize', String(info.bitrate * 2));
      } else {
        args.push('-crf', enc === 'libx265' ? '20' : enc === 'libvpx-vp9' ? '24' : '17');
        if (enc === 'libvpx-vp9') args.push('-b:v', '0');
      }
      if (enc !== 'libvpx-vp9') args.push('-preset', 'medium');
      args.push('-pix_fmt', tenBit ? 'yuv420p10le' : 'yuv420p');
    }
    const lo = out.toLowerCase();
    if (lo.endsWith('.mp4') || lo.endsWith('.mov')) args.push('-movflags', '+faststart');
    args.push(out);
  } else if (mode === 'prores') {
    args.push(...rawIn, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', out);
  } else if (mode === 'vp9') {
    args.push(...rawIn, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '18', '-row-mt', '1', '-auto-alt-ref', '0', out);
  } else if (mode === 'png') {
    // out is a directory; write a numbered PNG sequence
    args.push(...rawIn, '-c:v', 'png', path.join(out, 'overlay_%06d.png'));
  } else {
    throw new Error('Unknown export mode ' + mode);
  }
  return args;
}

ipcMain.handle('export:start', async (_e, opts) => {
  if (exp) throw new Error('Export already running');
  if (opts.mode === 'png') await fs.promises.mkdir(opts.out, { recursive: true });
  // decide GPU usage: 'auto' probes NVENC / CUDA, 'gpu' forces the probe too (falls back if missing), 'cpu' skips
  const gpu = { encode: false, decode: false };
  if (opts.mode === 'video' && opts.encoder !== 'cpu') {
    gpu.encode = await canNvenc();
    gpu.decode = await canCudaDecode(opts.info.path);
  }
  const args = buildArgs({ ...opts, gpu });
  const proc = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  exp = { proc, error: '', done: new Promise((resolve) => proc.on('close', (code) => resolve(code))) };
  proc.stderr.on('data', (d) => {
    const s = d.toString();
    exp.error += s;
    if (exp.error.length > 20000) exp.error = exp.error.slice(-20000);
    if (win) win.webContents.send('export:log', s);
  });
  proc.stdin.on('error', () => {}); // EPIPE on cancel
  return { args, gpu };
});

ipcMain.handle('export:frame', (_e, buf) => {
  if (!exp) throw new Error('No export running');
  const cur = exp;
  const { proc } = cur;
  if (proc.exitCode !== null) throw new Error('ffmpeg exited: ' + cur.error);
  return new Promise((resolve, reject) => {
    const ok = proc.stdin.write(Buffer.from(buf), (err) => (err ? reject(err) : null));
    if (ok) resolve(true);
    else proc.stdin.once('drain', () => resolve(true));
  });
});

ipcMain.handle('export:finish', async () => {
  if (!exp) return { code: 0, log: '' };
  const cur = exp;
  cur.proc.stdin.end();
  const code = await cur.done;
  exp = null;
  return { code, log: cur.error };
});

ipcMain.handle('export:cancel', async () => {
  if (!exp) return;
  const cur = exp;
  exp = null;
  try {
    cur.proc.stdin.destroy();
    cur.proc.kill();
  } catch {
    /* ignore */
  }
  await cur.done;
});

ipcMain.handle('app:paths', () => ({ ffmpeg: ffmpegPath, ffprobe: ffprobePath }));
