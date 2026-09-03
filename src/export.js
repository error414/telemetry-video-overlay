import { renderFrameToCanvas, IDENTITY_LT } from './widgetRuntime.js';

/** Union bounding box of visible widgets in VIDEO pixels, padded, clamped, even-aligned (yuv420 overlay). */
export function widgetRegion(widgets, width, height, pad = 16, lt = IDENTITY_LT) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const w of widgets) {
    if (w.visible === false) continue;
    const wx = w.x * lt.sx;
    const wy = w.y * lt.sy;
    x0 = Math.min(x0, wx - pad);
    y0 = Math.min(y0, wy - pad);
    x1 = Math.max(x1, wx + w.w * lt.k + pad);
    y1 = Math.max(y1, wy + w.h * lt.k + pad);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: width, h: height };
  x0 = Math.max(0, Math.floor(x0 / 2) * 2);
  y0 = Math.max(0, Math.floor(y0 / 2) * 2);
  x1 = Math.min(width, Math.ceil(x1 / 2) * 2);
  y1 = Math.min(height, Math.ceil(y1 / 2) * 2);
  const w = Math.max(2, x1 - x0);
  const h = Math.max(2, y1 - y0);
  return { x: x0, y: y0, w, h };
}

/**
 * Resolve the export range ({ start, end } in video seconds, end === null = to the end) against the
 * video duration. Both ends are snapped to the source frame grid so the overlay and the cut video line up.
 */
export function exportSpan(range, duration, fps = 0) {
  const snap = (t) => (fps > 0 ? Math.round(t * fps) / fps : t);
  let start = Math.max(0, Math.min(duration, (range && range.start) || 0));
  let end = range && range.end != null ? Math.max(start, Math.min(duration, range.end)) : duration;
  start = snap(start);
  end = Math.min(duration, snap(end));
  const full = start <= 0 && end >= duration;
  return { start, end, full };
}

/** Folder-safe name for a widget (Windows-reserved characters replaced, trailing dots/spaces dropped). */
export function safeFolderName(name) {
  const n = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .replace(/[. ]+$/, '');
  return n || 'widget';
}

/**
 * Sub-folder name per widget for the per-widget PNG export. Unique names are used as they are;
 * widgets that share a name (after sanitising) get _1, _2, _3 … appended in layout order.
 */
export function widgetFolderNames(widgets) {
  const counts = new Map();
  for (const w of widgets) {
    const n = safeFolderName(w.name);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const seen = new Map();
  return widgets.map((w) => {
    const n = safeFolderName(w.name);
    if (counts.get(n) === 1) return n;
    const i = (seen.get(n) || 0) + 1;
    seen.set(n, i);
    return n + '_' + i;
  });
}

/** Largest "common" output the PNG export offers: UHD 4K. */
export const PNG_MAX = { w: 3840, h: 2160 };

/** Frames handed to the main process (and ffmpeg) that may still be in flight while the next one renders. */
const PIPELINE_DEPTH = 3;

/**
 * Channel that carries the rendered frames to ffmpeg: a MessagePort straight from this page to the
 * main process (see preload openFramePort). ipcRenderer.invoke through the contextBridge copies a
 * large buffer value by value and blocked the renderer for ~30 ms per 1080p frame (~110 ms at 4K);
 * the port's structured clone is 3x cheaper, and the main process replies once the pipe took the frame.
 * send(buf) resolves on that reply (rejects with ffmpeg's error); close() releases the port.
 */
function openFrameChannel() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Export frame channel did not open')), 5000);
    const onMessage = (ev) => {
      if (ev.source !== window || !ev.data || ev.data.type !== 'export:port' || !ev.ports.length) return;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      const port = ev.ports[0];
      const waiters = []; // replies arrive in send order
      port.onmessage = (e) => {
        const w = waiters.shift();
        if (!w) return;
        if (e.data && e.data.error) w.reject(new Error(e.data.error));
        else w.resolve();
      };
      resolve({
        send: (buf) =>
          new Promise((res, rej) => {
            waiters.push({ resolve: res, reject: rej });
            port.postMessage(buf);
          }),
        close: () => port.close(),
      });
    };
    window.addEventListener('message', onMessage);
    window.api.openFramePort();
  });
}

/**
 * Integer multiples of the video size the PNG export can render at: 1× (always) and every
 * further multiple that still fits into 4K UHD. 1080p → [1, 2], 720p → [1, 2, 3], 4K → [1].
 */
export function pngScaleOptions(info) {
  const out = [1];
  if (!info || !info.width || !info.height) return out;
  for (let k = 2; info.width * k <= PNG_MAX.w && info.height * k <= PNG_MAX.h; k++) out.push(k);
  return out;
}

/**
 * Render overlay frames and stream RGBA into ffmpeg (main process).
 * mode: 'video' | 'png'
 * overlayFps: frames per second of the overlay stream (video mode only; default = source fps)
 * encoder: 'auto' | 'cpu'  (auto = NVENC + CUDA decode when available)
 * range: { start, end } in video seconds (end null = video end) — only this part is exported
 * perWidget: PNG mode only — one pass per visible widget into out/<widget folder>/
 * pngScale: PNG mode only — integer multiple of the video size (see pngScaleOptions); widgets are
 *   rendered natively at that size (no upscaling), 8-bit RGBA PNG
 *
 * PNG sequences always run at the source frame rate and are numbered by the source frame index
 * (frame 0 = video start), so a cut export starts at the index of the in point.
 */
export async function runExport({ mode, out, info, widgets, store, sync, quality, onProgress, isCancelled, overlayFps, encoder, onStart, lt = IDENTITY_LT, range, perWidget, pngScale = 1 }) {
  const scale = mode === 'png' && pngScaleOptions(info).includes(pngScale) ? pngScale : 1;
  const width = Math.round(info.width * scale);
  const height = Math.round(info.height * scale);
  // the layout transform maps widget layout units to output pixels; a bigger PNG just scales it further
  if (scale !== 1) lt = { sx: lt.sx * scale, sy: lt.sy * scale, k: lt.k * scale };
  const fullFps = info.fps;
  const useLowerFps = mode === 'video' && overlayFps && overlayFps < fullFps;
  const fps = useLowerFps ? overlayFps : fullFps;
  const fpsStr = useLowerFps ? String(overlayFps) : info.fpsStr;
  const span = exportSpan(range, info.duration, fullFps);
  const totalFrames = Math.max(1, Math.round((span.end - span.start) * fps));
  const startNumber = mode === 'png' ? Math.round(span.start * fullFps) : 0;
  // Only the video mode may crop: transparent overlay-only exports must keep the full frame size.
  const region = mode === 'video' ? widgetRegion(widgets, width, height, 16, lt) : { x: 0, y: 0, w: width, h: height };
  const canvas = document.createElement('canvas');
  canvas.width = region.w;
  canvas.height = region.h;

  // one pass = one ffmpeg run; the per-widget PNG export runs a pass per visible widget into its own folder
  let passes;
  if (mode === 'png' && perWidget) {
    const vis = widgets.filter((w) => w.visible !== false);
    const names = widgetFolderNames(vis);
    passes = vis.map((w, i) => ({ widgets: [w], out: joinPath(out, names[i]), filePrefix: names[i] }));
    if (!passes.length) throw new Error('No visible widgets to export');
  } else {
    passes = [{ widgets, out, filePrefix: 'overlay' }];
  }
  const grandTotal = totalFrames * passes.length;
  let done = 0;
  const t0 = performance.now();
  const report = (force) => {
    if (!force && done % 5 !== 0) return;
    const el = (performance.now() - t0) / 1000;
    onProgress({ frame: done, total: grandTotal, fps: done / el, eta: (el / Math.max(1, done)) * (grandTotal - done) });
  };

  const channel = await openFrameChannel();
  try {
    for (let p = 0; p < passes.length; p++) if (await runPass(passes[p], p)) return { cancelled: true };
  } finally {
    channel.close();
  }
  return { ok: true };

  /** One ffmpeg run; resolves true when the user cancelled. */
  async function runPass(pass, p) {
    // the main process cuts the source video to the range; the overlay stream starts at the range start
    const start = await window.api.exportStart({
      mode,
      out: pass.out,
      filePrefix: pass.filePrefix,
      startNumber,
      info,
      width,
      height,
      fpsStr,
      quality,
      region,
      encoder,
      range: span.full ? null : { start: span.start, end: span.end },
    });
    if (p === 0 && onStart) onStart({ region, fps, gpu: start.gpu, totalFrames: grandTotal, span, passes: passes.length, startNumber });
    // Frames are handed to ffmpeg without waiting for the write to land: while the main process
    // copies a frame into the pipe and ffmpeg encodes it, the renderer already rasterises the next
    // one. At most PIPELINE_DEPTH frames are in flight (each is a full RGBA frame — up to 33 MB at 4K),
    // and the oldest is awaited before another is queued, so a slow encoder still throttles rendering.
    // Sends are issued in order, so ffmpeg receives frames in order.
    const pending = [];
    let sendError = null;
    const send = (buf) => {
      pending.push(channel.send(buf).catch((e) => (sendError = sendError || e)));
    };
    try {
      for (let i = 0; i < totalFrames; i++) {
        if (isCancelled()) {
          await Promise.allSettled(pending);
          await window.api.exportCancel();
          return true;
        }
        if (sendError) throw sendError;
        const t = span.start + i / fps;
        const buf = await renderFrameToCanvas(canvas, pass.widgets, store, t, sync, region, lt, { range: span, duration: info.duration });
        if (pending.length >= PIPELINE_DEPTH) await pending.shift();
        send(buf);
        done++;
        report(done === grandTotal);
      }
      await Promise.all(pending);
      if (sendError) throw sendError;
      const res = await window.api.exportFinish();
      if (res.code !== 0) throw new Error('ffmpeg failed (' + res.code + ')\n' + res.log);
    } catch (e) {
      await window.api.exportCancel().catch(() => {});
      throw e;
    }
    return false;
  }
}

/**
 * First non-existing folder for a new export: dir/name, or dir/name_1, dir/name_2 … when an earlier
 * export already lives there (never writes into an existing sequence).
 */
export async function freeFolder(dir, name) {
  let p = joinPath(dir, name);
  for (let i = 1; await window.api.exists(p); i++) p = joinPath(dir, name + '_' + i);
  return p;
}

/** Join a directory and a name with the separator the directory already uses (renderer has no `path`). */
export function joinPath(dir, name) {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.replace(/[\\/]+$/, '') + sep + name;
}
