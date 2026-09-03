/**
 * Offset search by normalised cross-correlation.
 *
 * video: {t0, dt, v}   — one value per frame pair, centred at t0 + k·dt (video seconds)
 * gyro:  {t0, step, v} — |ω| on a uniform grid t0 + j·step (telemetry seconds), with
 *                        step = dt / SUB so a frame interval is exactly SUB grid cells
 *
 * The offset is what the app adds to video time to get telemetry time. For an
 * offset of m grid cells the k-th video sample is compared with gyro[j0 + SUB·k + m].
 */
export const SUB = 4;

/** Pearson correlation of video against gyro shifted by m cells (NaN pairs skipped). */
function ncc(video, gyro, j0, m, minPairs) {
  const n = video.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let c = 0;
  const gn = gyro.length;
  for (let k = 0; k < n; k++) {
    const x = video[k];
    const j = j0 + SUB * k + m;
    if (j < 0 || j >= gn) continue;
    const y = gyro[j];
    if (x !== x || y !== y) continue;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    c++;
  }
  if (c < minPairs) return NaN;
  const vx = sxx - (sx * sx) / c;
  const vy = syy - (sy * sy) / c;
  if (vx <= 0 || vy <= 0) return NaN;
  return (sxy - (sx * sy) / c) / Math.sqrt(vx * vy);
}

/**
 * Find the offset (seconds) that best aligns the two signals.
 * search: {min, max} bounds of the offset in seconds (default: every offset that
 * keeps at least 60 % of the video window inside the gyro data).
 * Returns {offset, score, coarse: [{offset, score}], second} — `second` is the best
 * score of a peak at least 1 s away from the winner (peak ambiguity).
 */
export function findOffset(video, gyro, search = {}) {
  const n = video.v.length;
  const step = gyro.step;
  const j0 = Math.round((video.t0 - gyro.t0) / step);
  // the video window may hang over either end of the telemetry by up to 40 % (minPairs below)
  const slack = Math.floor(SUB * (n - 1) * 0.4);
  const mMinAll = -j0 - slack;
  const mMaxAll = gyro.v.length - 1 - j0 - SUB * (n - 1) + slack;
  let mMin = mMinAll;
  let mMax = mMaxAll;
  if (Number.isFinite(search.min)) mMin = Math.max(mMin, Math.round(search.min / step));
  if (Number.isFinite(search.max)) mMax = Math.min(mMax, Math.round(search.max / step));
  if (mMax < mMin) return null;
  // frames whose motion could not be tracked are NaN and never count as pairs
  let valid = 0;
  for (let k = 0; k < n; k++) if (video.v[k] === video.v[k]) valid++;
  const minPairs = Math.max(8, Math.floor(valid * 0.6));

  // coarse pass: one frame at a time
  const coarse = [];
  let best = -Infinity;
  let bestM = mMin;
  for (let m = mMin; m <= mMax; m += SUB) {
    const s = ncc(video.v, gyro.v, j0, m, minPairs);
    coarse.push({ offset: m * step, score: s === s ? s : 0 });
    if (s > best) (best = s), (bestM = m);
  }
  if (!Number.isFinite(best)) return null;

  // fine pass around the winner: every grid cell within ±2 frames
  let fineBest = best;
  let fineM = bestM;
  const lo = Math.max(mMin, bestM - 2 * SUB);
  const hi = Math.min(mMax, bestM + 2 * SUB);
  const fine = new Map();
  for (let m = lo; m <= hi; m++) {
    const s = ncc(video.v, gyro.v, j0, m, minPairs);
    fine.set(m, s);
    if (s > fineBest) (fineBest = s), (fineM = m);
  }
  // sub-cell refinement by a parabola through the three best neighbours
  let offset = fineM * step;
  const a = fine.get(fineM - 1);
  const c = fine.get(fineM + 1);
  if (Number.isFinite(a) && Number.isFinite(c)) {
    const denom = a - 2 * fineBest + c;
    if (denom < 0) offset += (0.5 * (a - c)) / denom * step;
  }

  // strongest competing peak at least 1 s away
  let second = -Infinity;
  const far = Math.round(1 / step);
  for (const p of coarse) {
    const m = Math.round(p.offset / step);
    if (Math.abs(m - bestM) >= far && p.score > second) second = p.score;
  }
  return { offset, score: fineBest, coarse, second: Number.isFinite(second) ? second : 0 };
}
