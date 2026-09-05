#!/usr/bin/env node
// Visual check of a widget without the app: renders it at several times (and a small size + no-data
// frame) into preview.html and screenshots that page to preview.png with the project's Electron.
//   node .claude/skills/widget/preview-widgets.mjs my.json [options]
//   node .claude/skills/widget/preview-widgets.mjs my.js --columns "escRPM" --settings my.settings.json [options]
// options:
//   --csv file.csv          real telemetry instead of the synthetic profile (first widget column is read from it)
//   --times 1000,2500,5400  telemetry times (ms) to render (default: a burst-and-decay profile 1000..7400)
//   --config '{"max_rpm":200}'  settings overrides (keys as in the definition, snake_case)
//   --out dir               where preview.html / preview.png go (default: the current directory)
//   --no-png                skip the Electron screenshot
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const { parseSettings, buildSettings } = await import(pathToFileURL(path.join(root, 'src', 'widgetSettings.js')).href);

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const file = argv[0];
if (!file) { console.error('usage: preview-widgets.mjs <widget.json | widget.js --columns "..." --settings defs.json> [--csv f] [--times a,b,c] [--config json] [--out dir] [--no-png]'); process.exit(2); }
let w;
if (file.endsWith('.js')) w = { name: path.basename(file), columns: opt('--columns', ''), settings: opt('--settings') ? readFileSync(opt('--settings'), 'utf8') : '', code: readFileSync(file, 'utf8'), w: 320, h: 320 };
else { const j = JSON.parse(readFileSync(file, 'utf8')); w = (Array.isArray(j) ? j : j.widgets || [])[0]; }
if (opt('--columns')) w.columns = opt('--columns'); // also overrides the columns stored in a JSON
const cols = (w.columns || '').split(',').map((s) => s.trim()).filter(Boolean);
const config = { ...(w.config || {}), ...JSON.parse(opt('--config', '{}')) };
const { defs, error } = parseSettings(w.settings || '');
if (error) { console.error('settings definition does not parse: ' + error); process.exit(1); }
const settings = buildSettings(defs, config);
const fn = new Function('return (' + w.code.trim().replace(/;$/, '') + ')')();
const outDir = opt('--out', process.cwd());
mkdirSync(outDir, { recursive: true });

// ---- telemetry: real CSV column or a synthetic burst-and-decay profile (3000 -> 8400 -> wandering 3000..4500)
let T = [], V = [];
if (opt('--csv')) {
  const lines = readFileSync(opt('--csv'), 'utf8').split(/\r?\n/);
  const hdr = lines[0].split(',');
  const ti = hdr.findIndex((h) => /^time/.test(h)), vi = hdr.indexOf(cols[0]);
  if (vi < 0) { console.error('column "' + cols[0] + '" not in CSV; columns: ' + hdr.join(', ')); process.exit(1); }
  const unit = /\(ms\)/.test(hdr[ti]) ? 1 : /\(s\)/.test(hdr[ti]) ? 1000 : 0.001;
  let t0 = null;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(','); if (c.length <= vi) continue;
    const t = +c[ti] * unit, v = +c[vi]; if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    if (t0 === null) t0 = t; const ms = t - t0;
    if (T.length && ms - T[T.length - 1] < 8) continue; // ~120 Hz like the app's worker
    T.push(ms); V.push(v);
  }
} else {
  const f = (t) => t < 2000 ? 3000 + (t / 2000) * 5400 : t < 3000 ? 8400 : t < 3200 ? 8400 - (t - 3000) / 200 * 5400 : 3000 + 750 * (1 + Math.sin((t - 3200) / 600));
  for (let i = 0; i < 1200; i++) { T.push(i * 10); V.push(f(i * 10)); }
}
const lastLE = (x) => { let a = 0, b = T.length - 1; if (x < T[0]) return -1; while (a < b) { const m = (a + b + 1) >> 1; if (T[m] <= x) a = m; else b = m - 1; } return a; };
const range = (n, from, to, max = 2000) => {
  if (n !== cols[0]) return [];
  let a = Math.max(0, lastLE(from)), b = Math.max(a, lastLE(to)); const out = [];
  let step = 1; while ((b - a + 1) / step > max) step *= 2;
  let last = -1; const push = (i) => { if (i === last) return; out.push({ t: T[i], v: V[i] }); last = i; };
  push(a); for (let i = (Math.floor(a / step) + 1) * step; i < b; i += step) push(i); push(b); return out;
};
const interp = (n, x) => { if (n !== cols[0]) return undefined; const i = lastLE(x); if (i < 0 || i >= T.length - 1) return undefined; const f = (x - T[i]) / (T[i + 1] - T[i]); return V[i] + (V[i + 1] - V[i]) * f; };
let st;
const stats = (n) => { if (n !== cols[0]) return undefined; if (st) return st; let min = Infinity, max = -Infinity, sum = 0; for (const v of V) { if (v < min) min = v; if (v > max) max = v; sum += v; } return (st = { min, max, mean: sum / V.length, count: V.length, tMin: 0, tMax: 0 }); };
const ctxAt = (t, width, height, state) => ({
  values: cols.map((c) => interp(c, t)), videoTime: t / 1000, width, height, columns: cols, state,
  get: (n) => interp(n, t), raw: (n) => interp(n, t), range, all: (n, m) => range(n, -1e12, 1e12, m), stats,
  duration: T[T.length - 1], exportRange: null, dataVersion: 1,
  fmt: (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '--'), image: () => 'data:image/png;base64,iVBORw0KGgo=',
});

const times = opt('--times') ? opt('--times').split(',').map(Number) : [1000, 2500, 3600, 4600, 5400, 6200, 7400];
const W = w.w || 320, H = w.h || 320, state = {};
let page = '<!doctype html><html><body style="background:#3a5a2a;padding:16px;font-family:Arial;color:#fff">';
const cell = (label, html) => '<div style="display:inline-block;vertical-align:top;margin:8px"><div style="font-size:12px;margin-bottom:4px">' + label + '</div><div style="position:relative;width:' + W + 'px;height:' + H + 'px">' + html + '</div></div>';
for (const t of times) page += cell('t=' + t + ' ms', fn(settings, t, ctxAt(t, W, H, state)));
// extremes: the flight minimum and maximum of column 0 — clipping, seams and cap overshoot show up only there
let iMin = 0, iMax = 0;
for (let i = 1; i < V.length; i++) { if (V[i] < V[iMin]) iMin = i; if (V[i] > V[iMax]) iMax = i; }
if (V.length) {
  page += cell('flight min ' + V[iMin] + ' (t=' + Math.round(T[iMin]) + ')', fn(settings, T[iMin], ctxAt(T[iMin], W, H, state)));
  page += cell('flight max ' + V[iMax] + ' (t=' + Math.round(T[iMax]) + ')', fn(settings, T[iMax], ctxAt(T[iMax], W, H, state)));
}
const small = { w: Math.round(W * 0.6), h: Math.round(H * 0.6) };
page += '<div style="display:inline-block;vertical-align:top;margin:8px"><div style="font-size:12px;margin-bottom:4px">' + small.w + 'x' + small.h + '</div><div style="position:relative;width:' + small.w + 'px;height:' + small.h + 'px">' + fn(settings, times[Math.floor(times.length / 2)], ctxAt(times[Math.floor(times.length / 2)], small.w, small.h, {})) + '</div></div>';
page += cell('no data', fn(settings, -1e9, ctxAt(-1e9, W, H, {})));
page += '</body></html>';
const html = path.join(outDir, 'preview.html');
writeFileSync(html, page);
console.log('wrote ' + html);

if (!argv.includes('--no-png')) {
  const shot = path.join(outDir, 'preview-shot.cjs');
  writeFileSync(shot, `const { app, BrowserWindow } = require('electron'); const fs = require('fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 900, show: false, webPreferences: { offscreen: true } });
  await win.loadFile(${JSON.stringify(html)});
  await new Promise((r) => setTimeout(r, 500));
  const h = await win.webContents.executeJavaScript('document.documentElement.scrollHeight');
  win.setContentSize(1600, Math.min(4000, Math.max(300, h + 20)));   // whole page, nothing cut off
  await new Promise((r) => setTimeout(r, 500));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(${JSON.stringify(path.join(outDir, 'preview.png'))}, img.toPNG());
  app.quit();
});`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), [shot], { env, stdio: 'inherit' });
  if (r.status !== 0) { console.error('electron screenshot failed (exit ' + r.status + ')'); process.exit(1); }
  console.log('wrote ' + path.join(outDir, 'preview.png') + ' — open it with the Read tool');
}
