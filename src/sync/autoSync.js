/**
 * Auto sync computations — pure (no DOM, no IPC) so they run in a worker or in Node.
 *
 * Two methods share one core: a camera-side |ω| signal on the video clock is
 * cross-correlated with |gyro| from the blackbox (`correlate.js`) and every analysed
 * window yields a local offset with a match score; the dialog fits offset + drift
 * through the windows.
 *
 *   runVideoGyroSync  — the camera signal comes from optical flow over decoded frames
 *   runGyroflowSync   — the camera signal is the camera's own IMU, read from a
 *                       Gyroflow project (`gyroflow.js`)
 *
 * see methods.js for the registry.
 */
import { frameMotions, angularRates, focalFromHfov } from './videoMotion.js';
import { rateMagnitude, resampleUniform, boxFilter } from './gyroSignal.js';
import { findOffset, SUB } from './correlate.js';

/** Max-pool the coarse correlation curve into at most `maxPoints` bins (Float32Arrays, cheap to clone out of the worker). */
function downsampleCurve(coarse, maxPoints) {
  const bin = Math.max(1, Math.ceil(coarse.length / maxPoints));
  const n = Math.ceil(coarse.length / bin);
  const offsets = new Float32Array(n);
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let best = -Infinity;
    let at = coarse[i * bin].offset;
    for (let k = i * bin; k < Math.min(coarse.length, (i + 1) * bin); k++) {
      if (coarse[k].score > best) {
        best = coarse[k].score;
        at = coarse[k].offset;
      }
    }
    offsets[i] = at;
    scores[i] = best;
  }
  return { offsets, scores };
}

/**
 * |gyro| on a fine uniform grid (step = dt / SUB), box-averaged over one camera
 * sample interval dt — both optical flow and a resampled IMU trace stand for the
 * mean rate over their interval. `gyro` = the three rate columns [{t, v}].
 */
function gyroGrid(gyro, dt, minSamples) {
  const mag = rateMagnitude(gyro);
  const gt0 = mag.t[0];
  const gt1 = mag.t[mag.t.length - 1];
  const step = dt / SUB;
  const gn = Math.floor((gt1 - gt0) / step) + 1;
  if (gn < SUB * minSamples) throw new Error('The telemetry is shorter than the analysis window');
  return { t0: gt0, step, v: boxFilter(resampleUniform(mag.t, mag.v, gt0, step, gn), SUB) };
}

/** Gyro grid samples facing the camera samples at `offset` (NaN outside the grid) — for the result plot. */
function gyroPair(cam, grid, offset) {
  const j0 = Math.round((cam.t0 + offset - grid.t0) / grid.step);
  const out = new Float32Array(cam.v.length);
  for (let k = 0; k < out.length; k++) {
    const j = j0 + SUB * k;
    out[k] = j >= 0 && j < grid.v.length ? grid.v[j] : NaN;
  }
  return out;
}

/** findOffset + the plot data: {offset, score, second, curve, pair} or null. */
function correlate(cam, grid, search) {
  const r = findOffset(cam, grid, search || {});
  if (!r) return null;
  return {
    offset: r.offset,
    score: r.score,
    second: r.second,
    curve: downsampleCurve(r.coarse, 1500),
    pair: { t0: cam.t0, dt: cam.dt, video: Float32Array.from(cam.v), gyro: gyroPair(cam, grid, r.offset) },
  };
}

/** Horizontal fields of view tried when the lens is unknown (action / FPV cameras are wide). */
export const HFOV_CANDIDATES = [60, 80, 100, 120, 140, 160];

/**
 * input:
 *   frames  Uint8Array, n gray frames of w×h, decoded from the ORIGINAL video starting at video time `start`
 *   n, w, h, fps
 *   start   video time (s) of the first frame
 *   gyro    [{t, v}, {t, v}, {t, v}] — the three rate columns in deg/s, t in telemetry seconds (store-relative)
 *   search  {min, max} offset bounds in seconds, or null for the whole log
 *   hfovs   optional list of horizontal FOVs (deg) to try
 *   onProgress(fraction, phase)
 * result:
 *   {offset, score, second, hfov, curve: {offsets, scores}, pair: {t0, dt, video, gyro}, motions: {tracked, total}}
 *   pair holds the two magnitude signals at the winning offset, curve the match
 *   score over the searched offsets (max-pooled to ≤ 1500 points) — both for plotting.
 */
export function runVideoGyroSync(input) {
  const { frames, n, w, h, fps, start, gyro, search, onProgress } = input;
  const hfovs = input.hfovs || HFOV_CANDIDATES;
  const dt = 1 / fps;
  if (n < 2) throw new Error('Not enough video frames to analyse');

  const grid = gyroGrid(gyro, dt, n);

  // camera motion per frame pair
  const motions = frameMotions(frames, n, w, h, { onProgress: onProgress ? (f) => onProgress(f, 'tracking') : undefined });
  let tracked = 0;
  for (const m of motions) if (m.inliers) tracked++;
  if (tracked < motions.length * 0.5) throw new Error(`Camera motion could not be tracked in most frames (${tracked} of ${motions.length}) — too little texture or motion blur; try another part of the video`);

  // best offset over the focal length candidates
  let best = null;
  const t0 = start + dt / 2; // motion k is centred between frames k and k+1
  hfovs.forEach((hfov, i) => {
    const r = correlate({ t0, dt, v: angularRates(motions, fps, focalFromHfov(hfov, w)) }, grid, search);
    if (r && (!best || r.score > best.score)) best = { ...r, hfov };
    if (onProgress) onProgress((i + 1) / hfovs.length, 'correlating');
  });
  if (!best) throw new Error('No offset in the search range keeps the analysed part of the video inside the telemetry');
  return { ...best, motions: { tracked, total: motions.length } };
}

/** Camera sample interval used for the Gyroflow method (the blackbox side is ~120 Hz after decimation; 100 Hz keeps the search cheap and the offset exact to a few ms before refinement). */
export const GYROFLOW_DT = 0.01;

/**
 * input:
 *   camera  {t, v} — |ω| of the camera in deg/s over video seconds (gyroflow.js cameraRates)
 *   gyro    [{t, v}, {t, v}, {t, v}] — blackbox rate columns, t in telemetry seconds
 *   slots   [[{start}, …], …] — windows to analyse; each slot's candidates are tried in
 *           order until one matches ≥ goodScore (see planWindows in gyroSignal.js)
 *   len     window length (s)
 *   goodScore, search, onProgress(fraction, phase)
 * result: [{start, len, t, offset, score, second, curve, pair}] — one per slot that
 *   produced a correlation (t = window centre in video seconds).
 */
export function runGyroflowSync(input) {
  const { camera, gyro, slots, len, search, onProgress } = input;
  const dt = input.dt || GYROFLOW_DT;
  const goodScore = input.goodScore ?? 0.9;
  const n = Math.round(len / dt);
  if (n < 2) throw new Error('The analysis window is too short');
  const grid = gyroGrid(gyro, dt, n);
  // camera |ω| box-averaged over dt, then sampled at the window grid — same smoothing as the gyro side
  const fine = dt / SUB;
  const camT0 = camera.t[0];
  const camN = Math.floor((camera.t[camera.t.length - 1] - camT0) / fine) + 1;
  const camFine = boxFilter(resampleUniform(camera.t, camera.v, camT0, fine, camN), SUB);

  const out = [];
  slots.forEach((slot, si) => {
    let best = null;
    for (const cand of slot) {
      const start = cand.start;
      const j0 = Math.round((start - camT0) / fine);
      const v = new Float32Array(n);
      let valid = 0;
      for (let k = 0; k < n; k++) {
        const j = j0 + SUB * k;
        v[k] = j >= 0 && j < camFine.length ? camFine[j] : NaN;
        if (v[k] === v[k]) valid++;
      }
      if (valid < n * 0.6) continue;
      const r = correlate({ t0: start, dt, v }, grid, search);
      if (r && (!best || r.score > best.score)) best = { ...r, start, len, t: start + len / 2 };
      if (best && best.score >= goodScore) break;
    }
    if (best) out.push(best);
    if (onProgress) onProgress((si + 1) / slots.length, 'correlating');
  });
  return out;
}
