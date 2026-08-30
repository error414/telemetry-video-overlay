#!/usr/bin/env node
// Smoke-test widgets in Node with synthetic telemetry and a fake ctx.
//   node .claude/skills/widget/test-widgets.mjs            -> all EXAMPLE_WIDGETS from src/examples.js
//   node .claude/skills/widget/test-widgets.mjs file.json  -> widgets from an export/import JSON
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');

let widgets;
if (process.argv[2]) {
  const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  widgets = Array.isArray(j) ? j : j.widgets || [];
} else {
  ({ EXAMPLE_WIDGETS: widgets } = await import(pathToFileURL(path.join(root, 'src', 'examples.js')).href));
}

// synthetic telemetry: 200 samples, 100 ms apart (t = 0 … 19900 ms)
const N = 200;
const series = {
  'GPS_coord[0]': (i) => 50.1 + i * 0.0001,
  'GPS_coord[1]': (i) => 14.4 + i * 0.00015,
  'GPS_speed (m/s)': (i) => 10 + (i % 20),
  'GPS_speed (km/h)': (i) => 36 + (i % 20) * 3.6,
  'GPS_numSat': () => 12,
  'GPS_ground_course': (i) => (i * 3) % 360,
  heading: (i) => (i * 3) % 360,
  roll: (i) => Math.sin(i / 7) * 30,
  pitch: (i) => Math.cos(i / 9) * 15,
  'attitude[0]': (i) => Math.sin(i / 7) * 300,
  'attitude[1]': (i) => Math.cos(i / 9) * 150,
  'attitude[2]': (i) => ((i * 30) % 3600),
  'BaroAlt (cm)': (i) => 1000 + Math.sin(i / 10) * 500,
  'BaroAlt (m)': (i) => 10 + Math.sin(i / 10) * 5,
  'rcCommand[0]': (i) => Math.sin(i / 5) * 400,
  'rcCommand[1]': (i) => Math.cos(i / 5) * 400,
  'rcCommand[2]': () => 0,
  'rcCommand[3]': (i) => 1000 + (i % 100) * 10,
  'vbat (V)': (i) => 16.8 - i * 0.01,
  'amperage (A)': (i) => 5 + (i % 30),
  'flightModeFlags (flags)': (i) => (i < 100 ? 'ANGLE' : 'NAV RTH'),
};
const at = (name, i) => (series[name] ? series[name](i) : undefined);
function range(name, from, to, max = 2000) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const t = i * 100;
    if (t >= from && t <= to && series[name]) out.push({ t, v: at(name, i) });
  }
  const step = Math.max(1, Math.floor(out.length / max));
  return step > 1 ? out.filter((_, k) => k % step === 0) : out;
}
function stats(name) {
  const all = range(name, -1e12, 1e12);
  if (!all.length || typeof all[0].v !== 'number') return undefined;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let tMin = 0;
  let tMax = 0;
  for (const p of all) {
    if (p.v < min) (min = p.v), (tMin = p.t);
    if (p.v > max) (max = p.v), (tMax = p.t);
    sum += p.v;
  }
  return { min, max, mean: sum / all.length, count: all.length, tMin, tMax };
}

const failures = [];
const unknownCols = new Set();
for (const w of widgets) {
  const cols = (w.columns || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  cols.forEach((c) => !series[c] && unknownCols.add(c));
  let fn;
  try {
    const code = (w.code || '').trim();
    fn = /^(async\s+)?function\b/.test(code) || /^\(?[\w\s,]*\)?\s*=>/.test(code) ? new Function('return (' + code + ')')() : new Function('values', 'time', 'ctx', code);
  } catch (e) {
    failures.push(`${w.name}: compile error: ${e.message}`);
    continue;
  }
  const state = {};
  const sizes = [
    [w.w || 300, w.h || 100],
    [Math.round((w.w || 300) * 1.7), Math.round((w.h || 100) * 1.3)],
  ];
  for (const [W, H] of sizes) {
    for (const time of [-500, 0, 5000, 19900, 30000]) {
      const i = Math.round(time / 100);
      const inRange = i >= 0 && i < N;
      const values = cols.map((c) => (inRange ? at(c, i) : undefined));
      const ctx = {
        videoTime: time / 1000,
        width: W,
        height: H,
        columns: cols,
        state,
        get: (n) => (inRange ? at(n, i) : undefined),
        raw: (n) => (inRange ? at(n, i) : undefined),
        range,
        all: (n, m) => range(n, -1e12, 1e12, m),
        stats,
        duration: N * 100,
        fmt: (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : v == null ? '--' : String(v)),
        image: (url) => 'data:image/png;base64,iVBORw0KGgo=' + url.length,
      };
      try {
        const html = fn(values, time, ctx);
        if (typeof html !== 'string') throw new Error('did not return a string');
        if (inRange && !html.length) throw new Error('empty output at time ' + time);
        if (/https?:\/\//.test(html) && !/data:/.test(html)) console.warn(`  ! ${w.name}: contains an http(s) URL — will not load in export (use ctx.image)`);
      } catch (e) {
        failures.push(`${w.name} @${time}ms ${W}x${H}: ${e.stack.split('\n').slice(0, 2).join(' ')}`);
      }
    }
  }
  const html = fn(cols.map((c) => at(c, 50)), 5000, { videoTime: 5, width: w.w || 300, height: w.h || 100, columns: cols, state, get: (n) => at(n, 50), raw: (n) => at(n, 50), range, all: (n, m) => range(n, -1e12, 1e12, m), stats, duration: N * 100, fmt: (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '--'), image: () => 'data:image/png;base64,iVBORw0KGgo=' });
  console.log(`ok  ${w.name}  (${String(html).length} chars)`);
}
if (unknownCols.size) console.log('note: columns without synthetic data (values were undefined): ' + [...unknownCols].join(', '));
if (failures.length) {
  console.error('\nFAILED:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`\nall ${widgets.length} widget(s) OK`);
