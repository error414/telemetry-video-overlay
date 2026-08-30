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
 * Render overlay frames and stream RGBA into ffmpeg (main process).
 * mode: 'video' | 'prores' | 'vp9' | 'png'
 * overlayFps: frames per second of the overlay stream (video mode only; default = source fps)
 * encoder: 'auto' | 'cpu'  (auto = NVENC + CUDA decode when available)
 */
export async function runExport({ mode, out, info, widgets, store, offset, quality, onProgress, isCancelled, overlayFps, encoder, onStart, lt = IDENTITY_LT }) {
  const width = info.width;
  const height = info.height;
  const fullFps = info.fps;
  const useLowerFps = mode === 'video' && overlayFps && overlayFps < fullFps;
  const fps = useLowerFps ? overlayFps : fullFps;
  const fpsStr = useLowerFps ? String(overlayFps) : info.fpsStr;
  const totalFrames = Math.max(1, Math.round(info.duration * fps));
  // Only the video mode may crop: transparent overlay-only exports must keep the full frame size.
  const region = mode === 'video' ? widgetRegion(widgets, width, height, 16, lt) : { x: 0, y: 0, w: width, h: height };
  const canvas = document.createElement('canvas');
  canvas.width = region.w;
  canvas.height = region.h;

  const start = await window.api.exportStart({ mode, out, info, width, height, fpsStr, quality, region, encoder });
  if (onStart) onStart({ region, fps, gpu: start.gpu, totalFrames });
  const t0 = performance.now();
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (isCancelled()) {
        await window.api.exportCancel();
        return { cancelled: true };
      }
      const t = i / fps;
      const buf = await renderFrameToCanvas(canvas, widgets, store, t, offset, region, lt);
      await window.api.exportFrame(buf);
      if (i % 5 === 0 || i === totalFrames - 1) {
        const el = (performance.now() - t0) / 1000;
        onProgress({ frame: i + 1, total: totalFrames, fps: (i + 1) / el, eta: (el / (i + 1)) * (totalFrames - i - 1) });
      }
    }
    const res = await window.api.exportFinish();
    if (res.code !== 0) throw new Error('ffmpeg failed (' + res.code + ')\n' + res.log);
    return { ok: true };
  } catch (e) {
    await window.api.exportCancel().catch(() => {});
    throw e;
  }
}
