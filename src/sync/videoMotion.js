/**
 * Camera motion estimated from consecutive video frames — pure JS, no DOM, so it
 * runs unchanged in a worker or in Node.
 *
 * Pipeline per frame pair:
 *   1. image pyramid (2×2 box downsampling) of both frames
 *   2. sparse pyramidal Lucas-Kanade flow on a regular grid of points
 *   3. robust least-squares similarity transform (rotation + translation + scale)
 *      through the tracked points, outliers rejected by iterated residual clipping
 *
 * The result per pair is the image-plane motion of the frame centre (dx, dy in
 * pixels of the analysis resolution) and the in-plane rotation (radians). For a
 * camera rigidly mounted on the airframe these are, up to the focal length, the
 * yaw / pitch / roll increments between the two frames — see angularRates().
 */

const WIN = 5; // LK window radius → (2·WIN+1)² pixels
const MAX_ITER = 12;
const EPS = 0.02; // stop iterating when the update is below this (pixels)
const MIN_EIG = 2; // texture floor on the structure tensor (8-bit intensity units²) — low, the forward-backward check does the real filtering
const FB_MAX = 0.75; // max forward-backward round-trip error (px) for a point to count

/** Uint8 gray frame → Float32 image (values 0..255). */
export function toFloat(gray, offset, w, h) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = gray[offset + i];
  return out;
}

function halve(img, w, h) {
  const w2 = w >> 1;
  const h2 = h >> 1;
  const out = new Float32Array(w2 * h2);
  for (let y = 0; y < h2; y++) {
    const r0 = 2 * y * w;
    const r1 = r0 + w;
    for (let x = 0; x < w2; x++) {
      const c = 2 * x;
      out[y * w2 + x] = 0.25 * (img[r0 + c] + img[r0 + c + 1] + img[r1 + c] + img[r1 + c + 1]);
    }
  }
  return { img: out, w: w2, h: h2 };
}

/** Pyramid levels [full, ½, ¼, …] until the smallest side would drop under 24 px or `levels` is reached. */
export function buildPyramid(img, w, h, levels = 4) {
  const pyr = [{ img, w, h }];
  for (let l = 1; l < levels; l++) {
    const p = pyr[l - 1];
    if (Math.min(p.w, p.h) < 48) break;
    pyr.push(halve(p.img, p.w, p.h));
  }
  return pyr;
}

/** Bilinear sample with edge clamping. */
function sample(img, w, h, x, y) {
  if (x < 0) x = 0;
  else if (x > w - 1.001) x = w - 1.001;
  if (y < 0) y = 0;
  else if (y > h - 1.001) y = h - 1.001;
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  const a = img[i];
  const b = img[i + 1];
  const c = img[i + w];
  const d = img[i + w + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

const N_WIN = (2 * WIN + 1) * (2 * WIN + 1);
const tplI = new Float32Array(N_WIN);
const tplIx = new Float32Array(N_WIN);
const tplIy = new Float32Array(N_WIN);

/**
 * One Lucas-Kanade refinement of the flow (u, v) of the point (px, py) from image P
 * to image C at a single pyramid level. Returns the refined flow and the minimum
 * eigenvalue of the structure tensor (per pixel), or null when the point runs out
 * of the frame or the tensor is singular.
 */
function lkLevel(P, C, px, py, u, v) {
  if (px < WIN + 1 || py < WIN + 1 || px > P.w - WIN - 2 || py > P.h - WIN - 2) return null;
  // template + gradients of the source image around the point (fixed for the level)
  let gxx = 0;
  let gxy = 0;
  let gyy = 0;
  let n = 0;
  for (let dy = -WIN; dy <= WIN; dy++) {
    for (let dx = -WIN; dx <= WIN; dx++) {
      const sx = px + dx;
      const sy = py + dy;
      const ix = 0.5 * (sample(P.img, P.w, P.h, sx + 1, sy) - sample(P.img, P.w, P.h, sx - 1, sy));
      const iy = 0.5 * (sample(P.img, P.w, P.h, sx, sy + 1) - sample(P.img, P.w, P.h, sx, sy - 1));
      tplI[n] = sample(P.img, P.w, P.h, sx, sy);
      tplIx[n] = ix;
      tplIy[n] = iy;
      gxx += ix * ix;
      gxy += ix * iy;
      gyy += iy * iy;
      n++;
    }
  }
  const tr = gxx + gyy;
  const det = gxx * gyy - gxy * gxy;
  if (det <= 1e-6) return null;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const minEig = (tr / 2 - disc) / N_WIN;
  const inv00 = gyy / det;
  const inv01 = -gxy / det;
  const inv11 = gxx / det;
  // Gauss-Newton on the flow
  for (let it = 0; it < MAX_ITER; it++) {
    let bx = 0;
    let by = 0;
    n = 0;
    const cx = px + u;
    const cy = py + v;
    if (cx < 1 || cy < 1 || cx > C.w - 2 || cy > C.h - 2) return null;
    for (let dy = -WIN; dy <= WIN; dy++) {
      for (let dx = -WIN; dx <= WIN; dx++) {
        const e = tplI[n] - sample(C.img, C.w, C.h, cx + dx, cy + dy);
        bx += e * tplIx[n];
        by += e * tplIy[n];
        n++;
      }
    }
    const du = inv00 * bx + inv01 * by;
    const dv = inv01 * bx + inv11 * by;
    u += du;
    v += dv;
    if (du * du + dv * dv < EPS * EPS) break;
  }
  return { u, v, minEig };
}

/**
 * Track one point from `prev` to `cur` through the pyramids (coarse to fine).
 * `guess` is an initial flow at full resolution (e.g. the previous pair's global
 * motion). A point is accepted only when it has some texture and tracking it back
 * from `cur` lands within FB_MAX px of where it started (forward-backward check —
 * this is what rejects sky, blur and points that slid along an edge).
 * Returns {u, v, ok}.
 */
export function trackPoint(pyrPrev, pyrCur, x, y, guess) {
  const top = pyrPrev.length - 1;
  const k = 1 << top;
  let u = guess.u / k;
  let v = guess.v / k;
  let minEig0 = 0;
  for (let l = top; l >= 0; l--) {
    const s = 1 << l;
    const r = lkLevel(pyrPrev[l], pyrCur[l], x / s, y / s, u, v);
    if (!r) return { u: 0, v: 0, ok: false };
    u = r.u;
    v = r.v;
    if (l === 0) minEig0 = r.minEig;
    else {
      u *= 2;
      v *= 2;
    }
  }
  if (!(minEig0 >= MIN_EIG)) return { u, v, ok: false };
  const back = lkLevel(pyrCur[0], pyrPrev[0], x + u, y + v, -u, -v);
  if (!back) return { u, v, ok: false };
  const ex = u + back.u;
  const ey = v + back.v;
  return { u, v, ok: ex * ex + ey * ey <= FB_MAX * FB_MAX };
}

/** Solve the 4×4 normal equations of the similarity fit; returns [a, b, tx, ty] or null. */
function solve4(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-9) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[4] / r[i]);
}

/**
 * Robust similarity transform x' = a·x − b·y + tx, y' = b·x + a·y + ty through
 * point pairs (coordinates relative to the frame centre). Returns
 * {dx, dy, rot, scale, inliers, n} or null when there are too few usable points.
 */
export function fitSimilarity(x, y, u, v, ok, n) {
  let inl = new Uint8Array(n);
  for (let i = 0; i < n; i++) inl[i] = ok[i] ? 1 : 0;
  let p = null;
  let count = 0;
  for (let round = 0; round < 4; round++) {
    const A = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const B = [0, 0, 0, 0];
    count = 0;
    for (let i = 0; i < n; i++) {
      if (!inl[i]) continue;
      const xi = x[i];
      const yi = y[i];
      const xp = xi + u[i];
      const yp = yi + v[i];
      // row 1: [x, -y, 1, 0] → xp ; row 2: [y, x, 0, 1] → yp
      A[0][0] += xi * xi + yi * yi;
      A[0][1] += 0; // x·(−y) + y·x = 0
      A[0][2] += xi;
      A[0][3] += yi;
      A[1][1] += yi * yi + xi * xi;
      A[1][2] += -yi;
      A[1][3] += xi;
      A[2][2] += 1;
      A[3][3] += 1;
      B[0] += xi * xp + yi * yp;
      B[1] += -yi * xp + xi * yp;
      B[2] += xp;
      B[3] += yp;
      count++;
    }
    if (count < 8) return null;
    for (let r = 0; r < 4; r++) for (let c = 0; c < r; c++) A[r][c] = A[c][r];
    const q = solve4(A, B);
    if (!q) return null;
    p = q;
    // residuals → clip outliers (threshold from the median so a bad half does not dominate)
    const res = [];
    const resAll = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!ok[i]) continue;
      const ex = p[0] * x[i] - p[1] * y[i] + p[2] - (x[i] + u[i]);
      const ey = p[1] * x[i] + p[0] * y[i] + p[3] - (y[i] + v[i]);
      resAll[i] = Math.sqrt(ex * ex + ey * ey);
      if (inl[i]) res.push(resAll[i]);
    }
    res.sort((a, b) => a - b);
    const thr = Math.max(0.6, 2.5 * res[res.length >> 1]);
    let changed = false;
    for (let i = 0; i < n; i++) {
      const keep = ok[i] && resAll[i] <= thr ? 1 : 0;
      if (keep !== inl[i]) changed = true;
      inl[i] = keep;
    }
    if (!changed) break;
  }
  return { dx: p[2], dy: p[3], rot: Math.atan2(p[1], p[0]), scale: Math.hypot(p[0], p[1]), inliers: count, n };
}

/**
 * Motion of every consecutive frame pair of a gray frame sequence.
 * frames: Uint8Array of n·w·h bytes (row-major gray). Returns an array of n−1
 * entries {dx, dy, rot, scale, inliers, n}; a pair that could not be fitted
 * (too little texture — sky, blur) yields zeros with inliers = 0.
 */
export function frameMotions(frames, n, w, h, { spacing = 20, margin = 14, onProgress } = {}) {
  const xs = [];
  const ys = [];
  for (let y = margin; y <= h - margin; y += spacing) for (let x = margin; x <= w - margin; x += spacing) xs.push(x), ys.push(y);
  const np = xs.length;
  const cx = w / 2;
  const cy = h / 2;
  const relX = new Float32Array(np);
  const relY = new Float32Array(np);
  for (let i = 0; i < np; i++) relX[i] = xs[i] - cx, relY[i] = ys[i] - cy;
  const u = new Float32Array(np);
  const v = new Float32Array(np);
  const ok = new Uint8Array(np);
  const out = [];
  let pyrPrev = buildPyramid(toFloat(frames, 0, w, h), w, h);
  let guess = { u: 0, v: 0 };
  for (let f = 1; f < n; f++) {
    const pyrCur = buildPyramid(toFloat(frames, f * w * h, w, h), w, h);
    for (let i = 0; i < np; i++) {
      const r = trackPoint(pyrPrev, pyrCur, xs[i], ys[i], guess);
      u[i] = r.u;
      v[i] = r.v;
      ok[i] = r.ok ? 1 : 0;
    }
    const fit = fitSimilarity(relX, relY, u, v, ok, np);
    if (fit) {
      out.push(fit);
      guess = { u: fit.dx, v: fit.dy };
    } else {
      out.push({ dx: 0, dy: 0, rot: 0, scale: 1, inliers: 0, n: np });
      guess = { u: 0, v: 0 };
    }
    pyrPrev = pyrCur;
    if (onProgress && (f % 20 === 0 || f === n - 1)) onProgress(f / (n - 1));
  }
  return out;
}

/**
 * Angular speed (deg/s) of the camera for each frame pair from the image motion,
 * given the focal length in pixels of the analysis resolution. Yaw/pitch come from
 * the centre shift (φ = atan(d / f)), roll from the in-plane rotation; the norm is
 * what gets compared with |gyro| — it does not depend on how the camera is mounted.
 */
export function angularRates(motions, fps, focalPx) {
  const out = new Float32Array(motions.length);
  for (let i = 0; i < motions.length; i++) {
    const m = motions[i];
    if (!m.inliers) {
      out[i] = NaN;
      continue;
    }
    const yaw = Math.atan(m.dx / focalPx);
    const pitch = Math.atan(m.dy / focalPx);
    out[i] = Math.sqrt(yaw * yaw + pitch * pitch + m.rot * m.rot) * fps * (180 / Math.PI);
  }
  return out;
}

/** Focal length in pixels for a horizontal field of view (degrees) at the given frame width. */
export function focalFromHfov(hfovDeg, width) {
  return width / 2 / Math.tan((hfovDeg * Math.PI) / 360);
}
