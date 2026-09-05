#!/usr/bin/env node
// Behaviour check on real telemetry: runs a widget frame by frame over a whole CSV (like playback does)
// and prints, per frame, the telemetry time and the visible text of the returned HTML (tags stripped).
// Pipe / grep / diff the output to find stalls, jumps or wrong values that a single-frame test can't show.
//   node .claude/skills/widget/replay-csv.mjs my.json --csv LOG.csv [--fps 30] [--from ms] [--to ms] [--config '{...}'] [--size 320x320]
//   node .claude/skills/widget/replay-csv.mjs my.js --columns "BaroAlt (m)" --settings my.settings.json --csv LOG.csv
// Add --stalls to also report intervals where the text stayed identical for >= 300 ms while the first
// column kept changing (typical symptom of an indicator that got stuck).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const { parseSettings, buildSettings } = await import(pathToFileURL(path.join(root, 'src', 'widgetSettings.js')).href);

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const file = argv[0], csv = opt('--csv');
if (!file || !csv) { console.error('usage: replay-csv.mjs <widget.json | widget.js --columns "..." --settings defs.json> --csv LOG.csv [--fps 30] [--from ms] [--to ms] [--config json] [--size WxH] [--stalls]'); process.exit(2); }
let w;
if (file.endsWith('.js')) w = { columns: opt('--columns', ''), settings: opt('--settings') ? readFileSync(opt('--settings'), 'utf8') : '', code: readFileSync(file, 'utf8') };
else { const j = JSON.parse(readFileSync(file, 'utf8')); w = (Array.isArray(j) ? j : j.widgets || [])[0]; }
if (opt('--columns')) w.columns = opt('--columns'); // also overrides the columns stored in a JSON (the pilot's real column)
const cols = (w.columns || '').split(',').map((s) => s.trim()).filter(Boolean);
const { defs, error } = parseSettings(w.settings || '');
if (error) { console.error('settings definition does not parse: ' + error); process.exit(1); }
const settings = buildSettings(defs, { ...(w.config || {}), ...JSON.parse(opt('--config', '{}')) });
const fn = new Function('return (' + w.code.trim().replace(/;$/, '') + ')')();
const [W, H] = opt('--size', (w.w || 320) + 'x' + (w.h || 320)).split('x').map(Number);

// ---- CSV -> per-column series decimated to ~120 Hz (as the app's worker does)
const lines = readFileSync(csv, 'utf8').split(/\r?\n/);
const hdr = lines[0].split(',');
const ti = hdr.findIndex((h) => /^time/.test(h));
const unit = /\(ms\)/.test(hdr[ti]) ? 1 : /\(s\)/.test(hdr[ti]) ? 1000 : 0.001;
const idx = cols.map((c) => hdr.indexOf(c));
idx.forEach((i, k) => { if (i < 0) { console.error('column "' + cols[k] + '" not in CSV'); process.exit(1); } });
const T = [], S = cols.map(() => []);
let t0 = null;
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(','); if (c.length <= Math.max(...idx, ti)) continue;
  const t = +c[ti] * unit; if (!Number.isFinite(t)) continue;
  if (t0 === null) t0 = t; const ms = t - t0;
  if (T.length && ms - T[T.length - 1] < 8) continue;
  T.push(ms); idx.forEach((ci, k) => { const v = +c[ci]; S[k].push(Number.isFinite(v) ? v : c[ci]); });
}
const lastLE = (x) => { let a = 0, b = T.length - 1; if (x < T[0]) return -1; while (a < b) { const m = (a + b + 1) >> 1; if (T[m] <= x) a = m; else b = m - 1; } return a; };
const series = (n) => { const k = cols.indexOf(n); return k < 0 ? null : S[k]; };
const range = (n, from, to, max = 2000) => {
  const V = series(n); if (!V) return [];
  let a = Math.max(0, lastLE(from)), b = Math.max(a, lastLE(to)); const out = [];
  let step = 1; while ((b - a + 1) / step > max) step *= 2;
  let last = -1; const push = (i) => { if (i === last) return; out.push({ t: T[i], v: V[i] }); last = i; };
  push(a); for (let i = (Math.floor(a / step) + 1) * step; i < b; i += step) push(i); push(b); return out;
};
const interp = (n, x) => { const V = series(n); if (!V) return undefined; const i = lastLE(x); if (i < 0 || i >= T.length - 1) return undefined; if (typeof V[i] !== 'number' || typeof V[i + 1] !== 'number') return V[i]; const f = (x - T[i]) / (T[i + 1] - T[i]); return V[i] + (V[i + 1] - V[i]) * f; };
const rawAt = (n, x) => { const V = series(n); if (!V) return undefined; const i = lastLE(x); return i < 0 ? undefined : V[i]; };
const statsCache = {};
const stats = (n) => { const V = series(n); if (!V) return undefined; if (statsCache[n]) return statsCache[n]; let min = Infinity, max = -Infinity, sum = 0, cnt = 0, tMin = 0, tMax = 0; V.forEach((v, i) => { if (typeof v !== 'number') return; if (v < min) { min = v; tMin = T[i]; } if (v > max) { max = v; tMax = T[i]; } sum += v; cnt++; }); return (statsCache[n] = cnt ? { min, max, mean: sum / cnt, count: cnt, tMin, tMax } : undefined); };
const state = {};
const ctxAt = (t) => ({ values: cols.map((c) => interp(c, t)), videoTime: t / 1000, width: W, height: H, columns: cols, state, get: (n) => interp(n, t), raw: (n) => rawAt(n, t), range, all: (n, m) => range(n, -1e12, 1e12, m), stats, duration: T[T.length - 1], exportRange: null, dataVersion: 1, fmt: (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '--'), image: () => 'data:image/png;base64,iVBORw0KGgo=' });

const fps = +opt('--fps', 30), from = +opt('--from', 0), to = +opt('--to', T[T.length - 1]);
const fmt = (ms) => { const s = ms / 1000; return Math.floor(s / 60) + ':' + (s % 60).toFixed(3).padStart(6, '0'); };
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const frames = [];
const t1 = performance.now();
for (let t = from; t <= to; t += 1000 / fps) {
  const html = fn(settings, t, ctxAt(t));
  if (typeof html !== 'string') { console.error('non-string output at ' + fmt(t)); process.exit(1); }
  const txt = text(html), v0 = interp(cols[0], t);
  frames.push({ t, txt, v0 });
  if (!argv.includes('--stalls')) console.log(fmt(t) + '\t' + (typeof v0 === 'number' ? v0.toFixed(2) : v0) + '\t' + txt);
}
console.error('frames ' + frames.length + ', ' + ((performance.now() - t1) / frames.length).toFixed(3) + ' ms/frame in Node');
if (argv.includes('--stalls')) {
  // what must stay constant: the whole visible text, or the first capture group of --watch (e.g. "MAX ([\d.]+)")
  const watch = opt('--watch') ? new RegExp(opt('--watch')) : null;
  const key = (f) => { if (!watch) return f.txt; const m = watch.exec(f.txt); return m ? m[1] : null; };
  const st0 = stats(cols[0]);
  const minMove = st0 ? (st0.max - st0.min) * 0.01 : 0;   // column 0 must move >= 1 % of its whole-log range
  let run = null; const stalls = [];
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i], p = frames[i - 1], k = key(f);
    if (k !== null && k === key(p)) { if (!run) run = { from: p.t, key: k, v0: p.v0, txt: f.txt }; run.to = f.t; run.v1 = f.v0; }
    else { if (run) stalls.push(run); run = null; }
  }
  if (run) stalls.push(run);
  const bad = stalls.filter((s) => s.to - s.from >= 300 && typeof s.v0 === 'number' && typeof s.v1 === 'number' && Math.abs(s.v1 - s.v0) >= minMove);
  console.log((watch ? 'watched value' : 'text') + ' unchanged >= 300 ms while column 0 moved >= ' + minMove.toFixed(3) + ': ' + bad.length + ' interval(s)');
  for (const s of bad) console.log(fmt(s.from) + ' -> ' + fmt(s.to) + '  ' + (watch ? 'watched ' + s.key + '  value ' + s.v0.toFixed(2) + ' -> ' + s.v1.toFixed(2) : s.txt.slice(0, 120)));
}
