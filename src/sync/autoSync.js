/**
 * Auto sync, method "video motion × gyro": estimates the offset between the video
 * and the blackbox by comparing the camera rotation seen in the footage with the
 * rotation the gyro measured. Pure computation (no DOM, no IPC) so it can run in
 * a worker — the caller decodes the frames and hands over the gyro columns.
 *
 * Other sync methods (e.g. reading the offset from a Gyroflow project) are meant
 * to live next to this file and plug into the same {offset, score} result shape;
 * see methods.js.
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

  // 1. gyro |ω| on a fine uniform grid, box-averaged over one frame interval
  //    (optical flow measures the mean rate between two frames)
  const mag = rateMagnitude(gyro);
  const gt0 = mag.t[0];
  const gt1 = mag.t[mag.t.length - 1];
  const step = dt / SUB;
  const gn = Math.floor((gt1 - gt0) / step) + 1;
  if (gn < SUB * n) throw new Error('The telemetry is shorter than the analysis window');
  const gyroGrid = { t0: gt0, step, v: boxFilter(resampleUniform(mag.t, mag.v, gt0, step, gn), SUB) };

  // 2. camera motion per frame pair
  const motions = frameMotions(frames, n, w, h, { onProgress: onProgress ? (f) => onProgress(f, 'tracking') : undefined });
  let tracked = 0;
  for (const m of motions) if (m.inliers) tracked++;
  if (tracked < motions.length * 0.5) throw new Error(`Camera motion could not be tracked in most frames (${tracked} of ${motions.length}) — too little texture or motion blur; try another part of the video`);

  // 3. best offset over the focal length candidates
  let best = null;
  const t0 = start + dt / 2; // motion k is centred between frames k and k+1
  hfovs.forEach((hfov, i) => {
    const v = angularRates(motions, fps, focalFromHfov(hfov, w));
    const r = findOffset({ t0, dt, v }, gyroGrid, search || {});
    if (r && (!best || r.score > best.score)) best = { ...r, hfov, video: v };
    if (onProgress) onProgress((i + 1) / hfovs.length, 'correlating');
  });
  if (!best) throw new Error('No offset in the search range keeps the analysed part of the video inside the telemetry');

  // gyro samples that face the video samples at the winning offset (for the result plot)
  const j0 = Math.round((t0 + best.offset - gt0) / step);
  const gyroPair = new Float32Array(motions.length);
  for (let k = 0; k < motions.length; k++) {
    const j = j0 + SUB * k;
    gyroPair[k] = j >= 0 && j < gyroGrid.v.length ? gyroGrid.v[j] : NaN;
  }
  return {
    offset: best.offset,
    score: best.score,
    second: best.second,
    hfov: best.hfov,
    curve: downsampleCurve(best.coarse, 1500),
    pair: { t0, dt, video: best.video, gyro: gyroPair },
    motions: { tracked, total: motions.length },
  };
}
