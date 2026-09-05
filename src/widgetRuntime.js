import { toTele } from './time.js';
import { parseSettings, settingsFor, defsToSource } from './widgetSettings.js';
/**
 * Widget API
 * ----------
 * A widget is a JavaScript function written by the user:
 *
 *   function (settings, time, ctx) {
 *     var COLOR = settings.color.value;
 *     return '<div style="color:' + COLOR + '">' + ctx.fmt(ctx.values[0], 1) + '</div>';
 *   }
 *
 *  settings : the widget's settings (see widgetSettings.js): the "Settings definition" tab of
 *             the editor declares them, the app renders a form (Widgets tab, editor) and passes
 *             the chosen values here as { key: { value, name, type, … } }; key = the setting's
 *             name in snake_case ("Label font" -> settings.label_font.value).
 *  time     : telemetry time in integer milliseconds (video time × (1 + drift) + offset, see time.js toTele).
 *  ctx      : helper object
 *     ctx.values      array with the current value of every column listed in the widget's
 *                     "columns" setting, in the same order (comma separated column names of
 *                     the CSV). Numeric columns are linearly interpolated between samples.
 *                     Undefined when the video time is outside the telemetry range.
 *     ctx.videoTime   video time in seconds
 *     ctx.width/height  widget box size in pixels
 *     ctx.columns     the column names array
 *     ctx.get(name)   value of any column by name (interpolated)
 *     ctx.raw(name)   value of any column by name (previous sample, no interpolation)
 *     ctx.range(name, fromMs, toMs, maxPoints)  [{t (ms), v}] history of a column
 *     ctx.state       plain object that persists between calls (per widget)
 *     ctx.fmt(v, digits) number formatter
 *     ctx.exportRange {from, to} — the export range (sync bar in/out points, or the whole
 *                     video) in telemetry ms; null when no video is loaded
 *     ctx.dataVersion changes whenever telemetry files are added/removed/rebuilt — include
 *                     it in ctx.state cache keys, otherwise a widget rendered before the CSV
 *                     finished loading keeps its empty cache forever
 *
 * Returned HTML is placed inside an absolutely positioned box (x, y, width, height
 * are widget properties). Use inline styles / <style> tags inside the returned
 * markup for looks. Inline SVG is fine. External resources (fonts, images from the
 * web) are NOT available during export.
 */

const compiled = new Map();

export function compileWidget(code) {
  if (compiled.has(code)) return compiled.get(code);
  let entry;
  try {
    // Accept "function (...) {...}", "(a,b)=>...", or a bare body using `settings`/`time`/`ctx`.
    let fn;
    const trimmed = code.trim();
    if (/^(async\s+)?function\b/.test(trimmed) || /^\(?[\w\s,]*\)?\s*=>/.test(trimmed)) {
      fn = new Function('"use strict"; return (' + trimmed + ');')();
    } else {
      fn = new Function('settings', 'time', 'ctx', trimmed);
    }
    if (typeof fn !== 'function') throw new Error('Code did not evaluate to a function');
    entry = { fn, error: null };
  } catch (e) {
    entry = { fn: null, error: String(e && e.message ? e.message : e) };
  }
  compiled.set(code, entry);
  return entry;
}

export function parseColumns(text) {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const stateByWidget = new Map();

// ---- image cache: url -> data URL (so map tiles / icons also work inside export) ----
const imgCache = new Map(); // url -> string (data URL) | null (failed)
const imgPending = new Map(); // url -> Promise
export function getImage(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  if (!imgPending.has(url)) {
    const p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
      .then(
        (blob) =>
          new Promise((res) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.onerror = () => res(null);
            fr.readAsDataURL(blob);
          })
      )
      .catch((e) => {
        console.warn('[widget image] failed to load', url, e);
        return null;
      })
      .then((data) => {
        imgCache.set(url, data);
        imgPending.delete(url);
        window.dispatchEvent(new Event('widget-assets-loaded'));
      });
    imgPending.set(url, p);
  }
  return undefined; // loading
}
export function hasPendingImages() {
  return imgPending.size > 0;
}
export function waitForImages() {
  return Promise.all([...imgPending.values()]);
}

/**
 * The export range in telemetry milliseconds: range = {start, end} in video seconds (end null =
 * video end, see exportSpan), duration = video length. null without a video.
 */
export function exportRangeMs(range, duration, sync) {
  if (!(duration > 0)) return null;
  const start = Math.max(0, Math.min(duration, (range && range.start) || 0));
  const end = range && range.end != null ? Math.max(start, Math.min(duration, range.end)) : duration;
  return { from: Math.round(toTele(start, sync) * 1000), to: Math.round(toTele(end, sync) * 1000) };
}

/**
 * Render a widget to an HTML string. Never throws.
 * env: { range, duration } — export range (video seconds) and video duration, for ctx.exportRange.
 * sync: {offset, drift} (or a plain offset in seconds) — see time.js.
 */
export function renderWidget(widget, store, videoTime, sync, env = {}) {
  const { fn, error } = compileWidget(widget.code || '');
  if (error) return { html: errBox('Compile error: ' + error), error };
  const sdef = parseSettings(widget.settings);
  if (sdef.error) return { html: errBox('Settings definition error: ' + sdef.error), error: 'Settings definition: ' + sdef.error };
  const settings = settingsFor(sdef.defs, widget.config);
  const relSec = toTele(videoTime, sync);
  const cols = parseColumns(widget.columns);
  const values = cols.map((c) => store.valueAt(c, relSec, true));
  const timeMs = Math.round(relSec * 1000);
  if (!stateByWidget.has(widget.id)) stateByWidget.set(widget.id, {});
  const ctx = {
    values,
    videoTime,
    width: widget.w,
    height: widget.h,
    columns: cols,
    state: stateByWidget.get(widget.id),
    get: (n) => store.valueAt(n, relSec, true),
    raw: (n) => store.valueAt(n, relSec, false),
    range: (n, fromMs, toMs, max) =>
      store.range(n, (fromMs ?? timeMs - 10000) / 1000, (toMs ?? timeMs) / 1000, max).map((p) => ({ t: Math.round(p.t * 1000), v: p.v })),
    fmt: (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : v == null ? '--' : String(v)),
    image: getImage,
    // whole-flight data: statistics and all samples (for scaling, profiles, tracks)
    stats: (n) => {
      const s = store.stats(n);
      return s ? { ...s, tMin: Math.round(s.tMin * 1000), tMax: Math.round(s.tMax * 1000) } : undefined;
    },
    all: (n, max) => store.all(n, max).map((p) => ({ t: Math.round(p.t * 1000), v: p.v })),
    duration: Math.round(store.duration() * 1000),
    exportRange: exportRangeMs(env.range, env.duration, sync),
    dataVersion: store.revision || 0,
  };
  try {
    const out = fn(settings, timeMs, ctx);
    return { html: out == null ? '' : String(out), error: null };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    return { html: errBox('Runtime error: ' + msg), error: msg };
  }
}

export function widgetDomId(widget) {
  return 'w-' + String(widget.id || 'x').replace(/[^\w-]/g, '');
}

function errBox(msg) {
  return '<div style="font:12px monospace;color:#fff;background:rgba(200,0,0,.8);padding:4px;white-space:pre-wrap">' + escapeHtml(msg) + '</div>';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Convert arbitrary HTML to well-formed XHTML (needed inside SVG foreignObject). */
export function toXhtml(html) {
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  const el = doc.body.firstChild;
  el.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  return new XMLSerializer().serializeToString(el);
}

/**
 * lt = layout transform {sx, sy, k}: widget coordinates are in video pixels; the export can render
 * at another scale (PNG scale), where positions scale by sx/sy and the whole box (content, fonts
 * included) by k. Identity otherwise.
 */
export const IDENTITY_LT = { sx: 1, sy: 1, k: 1 };

/** Size of the stage while no video is loaded — widgets placed there are laid out in this space. */
export const EMPTY_STAGE = { w: 1280, h: 720 };

export function widgetBoxStyle(w, extra = '', lt = IDENTITY_LT) {
  const scale = lt.k !== 1 ? 'transform:scale(' + lt.k + ');transform-origin:0 0;' : '';
  return (
    'position:absolute;left:' + w.x * lt.sx + 'px;top:' + w.y * lt.sy + 'px;width:' + w.w + 'px;height:' + w.h + 'px;overflow:visible;box-sizing:border-box;' + scale + extra
  );
}

/** Compose one SVG string with all widgets for a given time (used for export & snapshots). */
export function composeFrameSvg(widgets, store, videoTime, sync, width, height, region, lt = IDENTITY_LT, env = {}) {
  let inner = '';
  const ox = region ? region.x : 0;
  const oy = region ? region.y : 0;
  for (const w of widgets) {
    if (w.visible === false) continue;
    const { html } = renderWidget(w, store, videoTime, sync, env);
    // shift by the region origin in layout units so that (x - ox/sx) * sx = x*sx - ox
    const shifted = ox || oy ? { ...w, x: w.x - ox / lt.sx, y: w.y - oy / lt.sy } : w;
    inner += '<div id="' + widgetDomId(w) + '" style="' + widgetBoxStyle(shifted, '', lt) + '">' + html + '</div>';
  }
  const body = toXhtml('<div style="position:relative;width:' + width + 'px;height:' + height + 'px;margin:0;color:#fff;font-family:Arial,Helvetica,sans-serif">' + inner + '</div>');
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
    '<foreignObject x="0" y="0" width="' + width + '" height="' + height + '">' + body + '</foreignObject></svg>'
  );
}

/** Draw a frame into a canvas (2d ctx) at full video resolution. Returns RGBA ArrayBuffer. */
export async function renderFrameToCanvas(canvas, widgets, store, videoTime, sync, region, lt = IDENTITY_LT, env = {}) {
  const { width, height } = canvas;
  let svg = composeFrameSvg(widgets, store, videoTime, sync, width, height, region, lt, env);
  // widgets may have requested images (map tiles) – wait for them and re-render so the export frame is complete
  for (let i = 0; i < 5 && hasPendingImages(); i++) {
    await waitForImages();
    svg = composeFrameSvg(widgets, store, videoTime, sync, width, height, region, lt, env);
  }
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  img.src = url;
  await img.decode();
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, width, height);
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, width, height).data.buffer;
}

/** Copy of a list sorted by name, alphabetically and case-insensitively (library, examples, layouts). */
export const byName = (items, key = (x) => x.name) => items.slice().sort((a, b) => (key(a) || '').localeCompare(key(b) || '', undefined, { sensitivity: 'base', numeric: true }));

/** Unique id for widgets, library entries and layouts. */
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * Normalise a widget record coming from storage, a project file, an import or the examples:
 * drops fields of older versions (css, opacity), guarantees settings (string) and config (object).
 * The id is kept as is (callers decide about ids).
 */
export function cleanWidget(w) {
  // eslint-disable-next-line no-unused-vars
  const { css, opacity, ...rest } = w;
  return {
    ...rest,
    settings: typeof rest.settings === 'string' ? rest.settings : '',
    config: rest.config && typeof rest.config === 'object' && !Array.isArray(rest.config) ? rest.config : {},
  };
}

export function newWidget(partial = {}) {
  // Always assign a fresh unique id (callers may pass id: undefined or a library id).
  const rest = cleanWidget(partial);
  return {
    name: 'New widget',
    columns: '',
    x: 40,
    y: 40,
    w: 300,
    h: 80,
    visible: true,
    code: DEFAULT_CODE,
    ...rest,
    // a widget with its own code but no definition (older library entries) simply has no settings
    settings: partial.settings != null ? rest.settings : partial.code == null ? DEFAULT_SETTINGS : '',
    id: uid(),
  };
}

export const DEFAULT_CODE = `function (settings, time, ctx) {
  // ---------- SETTINGS ----------
  var COLOR = settings.color.value;   // text color
  var SIZE  = settings.size.value;    // font size in px
  // -------------------------------
  // ctx.values[i] = current value of the i-th column listed in "Columns"
  return '<div style="font:bold ' + SIZE + 'px sans-serif;color:' + COLOR + ';text-shadow:0 0 6px #000">'
    + ctx.fmt(ctx.values[0], 1) + '</div>';
}`;

/** Settings definition of a new widget (the form for DEFAULT_CODE). */
export const DEFAULT_SETTINGS = defsToSource([
  { name: 'Color', type: 'color_picker', default: '#ffffff', description: 'text color' },
  { name: 'Size', type: 'int', default: 40, min: 8, max: 400, description: 'font size in px' },
]);
