import Papa from 'papaparse';

/**
 * Telemetry store.
 * Each CSV file becomes a source with a time column (converted to seconds).
 * All sources share one time base (blackbox_decode writes the same "time (us)" into
 * both the main log CSV and the .gps.csv), so we do NOT normalise per file: we keep
 * raw seconds and subtract one global origin (min first-sample time over all files).
 *
 * Lookup: column name -> {t: Float64Array (seconds, raw), v: Array, numeric: bool}
 */

const TIME_HINTS = [/^time\s*\(us\)$/i, /^time\s*\(ms\)$/i, /^time\s*\(s\)$/i, /^time$/i, /time/i, /^t$/i];

export function guessTimeColumn(columns) {
  for (const re of TIME_HINTS) {
    const c = columns.find((x) => re.test(x.trim()));
    if (c) return c;
  }
  return columns[0];
}

export function guessTimeUnit(colName, sample) {
  const n = colName.toLowerCase();
  if (n.includes('(us)') || n.includes('micro')) return 'us';
  if (n.includes('(ms)') || n.includes('milli')) return 'ms';
  if (n.includes('(s)')) return 's';
  // Heuristic from the magnitude of a sample value
  if (sample > 1e8) return 'us';
  if (sample > 1e5) return 'ms';
  return 's';
}

const UNIT_DIV = { us: 1e6, ms: 1e3, s: 1 };

export function parseCsvText(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false, transformHeader: (h) => h.trim() });
  const columns = res.meta.fields || [];
  return { columns, rows: res.data };
}

/** Build per-column series from parsed rows, using the chosen time column + unit. */
export function buildSeries(parsed, timeColumn, timeUnit) {
  const div = UNIT_DIV[timeUnit] || 1;
  const rows = parsed.rows;
  const n = rows.length;
  const t = new Float64Array(n);
  let valid = 0;
  const idx = [];
  for (let i = 0; i < n; i++) {
    const tv = Number(rows[i][timeColumn]);
    if (!Number.isFinite(tv)) continue;
    t[valid++] = tv / div;
    idx.push(i);
  }
  const tt = t.subarray(0, valid);
  const series = {};
  for (const col of parsed.columns) {
    if (col === timeColumn) continue;
    const v = new Array(valid);
    let numeric = true;
    for (let k = 0; k < valid; k++) {
      const raw = typeof rows[idx[k]][col] === 'string' ? rows[idx[k]][col].trim() : rows[idx[k]][col];
      const num = raw === '' || raw == null ? NaN : Number(raw);
      if (Number.isFinite(num)) v[k] = num;
      else {
        v[k] = raw;
        if (raw !== '' && raw != null) numeric = false;
      }
    }
    series[col] = { t: tt, v, numeric };
  }
  return { series, firstTime: valid ? tt[0] : 0, lastTime: valid ? tt[valid - 1] : 0, count: valid };
}

/** Binary search: index of last sample with t <= x, or -1. */
function lastIndexLE(t, x) {
  let lo = 0;
  let hi = t.length - 1;
  if (hi < 0 || x < t[0]) return -1;
  if (x >= t[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export class TelemetryStore {
  constructor() {
    this.sources = []; // {id, path, name, columns, timeColumn, timeUnit, parsed, series, firstTime, lastTime, count}
    this.columns = {}; // merged column name -> series (first file wins)
    this.origin = 0;
  }

  rebuild() {
    this.columns = {};
    let origin = Infinity;
    for (const s of this.sources) {
      if (!s.series) continue;
      if (s.count) origin = Math.min(origin, s.firstTime);
      for (const [name, ser] of Object.entries(s.series)) {
        if (!(name in this.columns)) this.columns[name] = ser;
        // also expose file-qualified name to disambiguate duplicates: "file.csv:col"
        this.columns[s.name + ':' + name] = ser;
      }
    }
    this.origin = Number.isFinite(origin) ? origin : 0;
  }

  columnNames() {
    return Object.keys(this.columns).filter((c) => !c.includes(':'));
  }

  /** Value at telemetry time (seconds, relative to origin). Interpolates numerics. */
  valueAt(name, relSec, interpolate = true) {
    const ser = this.columns[name];
    if (!ser) return undefined;
    const x = relSec + this.origin;
    const i = lastIndexLE(ser.t, x);
    if (i < 0) return undefined;
    if (!interpolate || !ser.numeric || i >= ser.t.length - 1) return ser.v[i];
    const a = ser.v[i];
    const b = ser.v[i + 1];
    if (typeof a !== 'number' || typeof b !== 'number') return a;
    const t0 = ser.t[i];
    const t1 = ser.t[i + 1];
    if (t1 === t0) return a;
    const f = (x - t0) / (t1 - t0);
    return a + (b - a) * f;
  }

  /** Samples between two relative times: [{t, v}] with t relative to origin. */
  range(name, fromSec, toSec, maxPoints = 2000) {
    const ser = this.columns[name];
    if (!ser) return [];
    const a = Math.max(0, lastIndexLE(ser.t, fromSec + this.origin));
    const b = Math.max(a, lastIndexLE(ser.t, toSec + this.origin));
    // Decimation picks absolute sample indices (multiples of a power-of-two step),
    // not indices relative to the window start: a window sliding over the data then
    // keeps selecting the same samples, so scrolling graphs don't ripple every frame.
    let step = 1;
    while ((b - a + 1) / step > maxPoints) step *= 2;
    const out = [];
    let last = -1;
    const push = (i) => {
      if (i === last) return;
      out.push({ t: ser.t[i] - this.origin, v: ser.v[i] });
      last = i;
    };
    push(a);
    for (let i = (Math.floor(a / step) + 1) * step; i < b; i += step) push(i);
    push(b);
    return out;
  }

  /** Whole-flight statistics of a numeric column (cached): {min, max, mean, count, tMin, tMax}. */
  stats(name) {
    const ser = this.columns[name];
    if (!ser) return undefined;
    if (ser._stats) return ser._stats;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    let tMin = 0;
    let tMax = 0;
    for (let i = 0; i < ser.v.length; i++) {
      const v = ser.v[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (v < min) {
        min = v;
        tMin = ser.t[i] - this.origin;
      }
      if (v > max) {
        max = v;
        tMax = ser.t[i] - this.origin;
      }
      sum += v;
      count++;
    }
    ser._stats = count ? { min, max, mean: sum / count, count, tMin, tMax } : { min: 0, max: 0, mean: 0, count: 0, tMin: 0, tMax: 0 };
    return ser._stats;
  }

  /** All samples of a column, decimated to maxPoints: [{t (s rel. to origin), v}]. */
  all(name, maxPoints = 2000) {
    const ser = this.columns[name];
    if (!ser) return [];
    return this.range(name, ser.t[0] - this.origin, ser.t[ser.t.length - 1] - this.origin, maxPoints);
  }

  duration() {
    let end = 0;
    for (const s of this.sources) if (s.count) end = Math.max(end, s.lastTime - this.origin);
    return end;
  }
}
