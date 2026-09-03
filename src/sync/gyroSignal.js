/**
 * Gyro-side helpers of the auto sync — pure functions over {t, v} arrays
 * (t in seconds, ascending; v numeric), usable in a worker or in Node.
 */

/** Linear interpolation of a series at time x (NaN outside the series). */
function interp(t, v, x, hint) {
  const n = t.length;
  if (!n || x < t[0] || x > t[n - 1]) return NaN;
  let i = hint.i;
  if (i < 0 || i >= n - 1 || t[i] > x) i = 0;
  while (i < n - 2 && t[i + 1] < x) i++;
  hint.i = i;
  const t0 = t[i];
  const t1 = t[i + 1];
  const a = v[i];
  const b = v[i + 1];
  if (!(t1 > t0)) return a;
  return a + ((b - a) * (x - t0)) / (t1 - t0);
}

/**
 * |ω| = sqrt(x² + y² + z²) of three rate columns. The first column's time base is
 * used; the others are interpolated onto it when their times differ. Returns
 * {t, v} with NaN where a value is missing.
 */
export function rateMagnitude(cols) {
  const [a, b, c] = cols;
  const n = a.t.length;
  const t = a.t;
  const v = new Float64Array(n);
  const same = (s) => s.t === a.t || (s.t.length === n && s.t[0] === t[0] && s.t[n - 1] === t[n - 1]);
  const hb = { i: 0 };
  const hc = { i: 0 };
  const sb = same(b);
  const sc = same(c);
  for (let i = 0; i < n; i++) {
    const x = a.v[i];
    const y = sb ? b.v[i] : interp(b.t, b.v, t[i], hb);
    const z = sc ? c.v[i] : interp(c.t, c.v, t[i], hc);
    v[i] = typeof x === 'number' && typeof y === 'number' && typeof z === 'number' ? Math.sqrt(x * x + y * y + z * z) : NaN;
  }
  return { t, v };
}

/**
 * Resample a series onto a uniform grid t0 + k·step (k < n) by linear
 * interpolation; NaN outside the series or across NaN samples.
 */
export function resampleUniform(t, v, t0, step, n) {
  const out = new Float32Array(n);
  const hint = { i: 0 };
  for (let k = 0; k < n; k++) out[k] = interp(t, v, t0 + k * step, hint);
  return out;
}

/** Moving average of width `width` samples (centred, NaN-aware: a window with any NaN is NaN). */
export function boxFilter(v, width) {
  if (width <= 1) return Float32Array.from(v);
  const n = v.length;
  const out = new Float32Array(n);
  const half = width >> 1;
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    let bad = false;
    for (let k = i - half; k < i - half + width; k++) {
      if (k < 0 || k >= n) continue;
      const x = v[k];
      if (x !== x) {
        bad = true;
        break;
      }
      s += x;
      c++;
    }
    out[i] = bad || !c ? NaN : s / c;
  }
  return out;
}

/**
 * Where does the aircraft move the most? Scores every window of `winLen` seconds
 * by the standard deviation of |ω| inside it (a distinctive, non-constant burst of
 * rotation is what correlates well) and returns the best non-overlapping windows:
 * [{start, score}] in the time base of `t`, best first.
 */
export function activeWindows(t, v, winLen, { count = 6, rate = 25 } = {}) {
  if (!t.length || !(winLen > 0)) return [];
  const t0 = t[0];
  const span = t[t.length - 1] - t0;
  const step = 1 / rate;
  const n = Math.floor(span / step) + 1;
  const r = resampleUniform(t, v, t0, step, n);
  const w = Math.max(2, Math.round(winLen * rate));
  if (n < w) return [];
  // prefix sums for O(1) window mean / variance
  const s1 = new Float64Array(n + 1);
  const s2 = new Float64Array(n + 1);
  const bad = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    const x = r[i] === r[i] ? r[i] : 0;
    s1[i + 1] = s1[i] + x;
    s2[i + 1] = s2[i] + x * x;
    bad[i + 1] = bad[i] + (r[i] === r[i] ? 0 : 1);
  }
  const scores = new Float32Array(n - w + 1);
  for (let i = 0; i + w <= n; i++) {
    if (bad[i + w] - bad[i] > w * 0.05) {
      scores[i] = -1;
      continue;
    }
    const mean = (s1[i + w] - s1[i]) / w;
    const varc = (s2[i + w] - s2[i]) / w - mean * mean;
    scores[i] = Math.sqrt(Math.max(0, varc));
  }
  // greedy non-maximum suppression over whole windows
  const used = new Uint8Array(scores.length);
  const out = [];
  for (let k = 0; k < count; k++) {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < scores.length; i++) if (!used[i] && scores[i] > bestScore) (best = i), (bestScore = scores[i]);
    if (best < 0) break;
    out.push({ start: t0 + best * step, score: bestScore });
    for (let i = Math.max(0, best - w + 1); i < Math.min(scores.length, best + w); i++) used[i] = 1;
  }
  return out;
}
