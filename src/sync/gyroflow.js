/**
 * Reader for Gyroflow projects (.gyroflow, JSON). What the auto sync wants from
 * them is the camera's own motion on the video clock: DJI O3/O4 air units, GoPros
 * etc. record an IMU into the video and Gyroflow keeps it in the project as
 * `gyro_source.file_metadata` — a basE91 string of a zlib-compressed CBOR
 * `FileMetadata` (Gyroflow ≥ 1.5; `util::compress_to_base91_cbor`). Of that we use:
 *
 *   raw_imu      [{timestamp_ms, gyro: [x, y, z] deg/s, …}]   when the source gives rates
 *   quaternions  Map<timestamp_us, [x, y, z, w]>              orientation, always present
 *
 * Both are on the video's time base (plus Gyroflow's own sync offsets when the gyro
 * came from a separate file). Only |ω| is needed here, so the axes and the mounting
 * are irrelevant, and it is the same for the two representations: the angle between
 * consecutive orientations divided by their spacing.
 *
 * No DOM — runs in the sync worker or in Node (DecompressionStream is global in both).
 */
import { decodeBase91 } from './base91.js';
import { decodeCbor } from './cbor.js';

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate'); // zlib-wrapped deflate (RFC 1950), what flate2's ZlibEncoder writes
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Parse the project text; returns {project, metadata} — metadata as a Map (or plain object for thin projects), null when absent. */
export async function readGyroflowProject(text) {
  let project;
  try {
    project = JSON.parse(text);
  } catch {
    throw new Error('Not a Gyroflow project (invalid JSON)');
  }
  if (!project || project.title !== 'Gyroflow data file') throw new Error('Not a Gyroflow project file');
  const fm = project.gyro_source && project.gyro_source.file_metadata;
  let metadata = null;
  if (typeof fm === 'string' && fm.length) {
    const raw = await inflate(decodeBase91(fm));
    metadata = decodeCbor(raw);
  } else if (fm && typeof fm === 'object') {
    metadata = fm; // "thin" export: plain JSON, usually without the samples
  }
  return { project, metadata };
}

const get = (m, k) => (m instanceof Map ? m.get(k) : m ? m[k] : undefined);

/**
 * Gyroflow's sync offsets: {video_us: offset_ms}. gyro time = video time + offset,
 * linearly interpolated between the sync points, held constant outside them.
 * Returns a function video seconds → gyro seconds (identity without offsets).
 */
function offsetMapper(offsets) {
  const pts = Object.entries(offsets || {})
    .map(([k, v]) => ({ t: Number(k) / 1e6, o: Number(v) / 1000 }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.o))
    .sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  return (t) => {
    if (t <= pts[0].t) return pts[0].o;
    if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].o;
    let i = 0;
    while (pts[i + 1].t < t) i++;
    const a = pts[i];
    const b = pts[i + 1];
    return a.o + ((b.o - a.o) * (t - a.t)) / (b.t - a.t);
  };
}

/**
 * |ω| of the camera in deg/s over video seconds from the project's metadata:
 * {t: Float64Array, v: Float64Array, kind: 'imu' | 'quaternions', rate} —
 * `rate` is the mean sample rate in Hz.
 */
export function cameraRates(metadata, offsets) {
  const mapVideo = offsetMapper(offsets);
  // gyro timestamps → video time (the inverse of Gyroflow's video → gyro mapping; the
  // offsets vary slowly, so one fixed-point step is accurate to microseconds)
  const toVideo = mapVideo ? (tg) => tg - mapVideo(tg - mapVideo(tg)) : (tg) => tg;

  const imu = get(metadata, 'raw_imu');
  if (Array.isArray(imu) && imu.length > 1 && imu.some((s) => Array.isArray(get(s, 'gyro')))) {
    const t = [];
    const v = [];
    for (const s of imu) {
      const g = get(s, 'gyro');
      const ts = get(s, 'timestamp_ms');
      if (!Array.isArray(g) || g.length < 3 || !Number.isFinite(ts)) continue;
      t.push(toVideo(ts / 1000));
      v.push(Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]));
    }
    return finish(t, v, 'imu');
  }

  const quats = get(metadata, 'quaternions');
  const entries = quats instanceof Map ? [...quats] : quats && typeof quats === 'object' ? Object.entries(quats).map(([k, q]) => [Number(k), q]) : [];
  if (entries.length < 2) throw new Error('The Gyroflow project holds no motion data (open the video in Gyroflow and save the project again)');
  entries.sort((a, b) => a[0] - b[0]);
  const t = [];
  const v = [];
  for (let i = 1; i < entries.length; i++) {
    const [t0, a] = entries[i - 1];
    const [t1, b] = entries[i];
    const dt = (t1 - t0) / 1e6;
    if (!(dt > 0) || dt > 0.1 || !Array.isArray(a) || !Array.isArray(b) || a.length < 4 || b.length < 4) continue;
    // angle of the relative rotation a⁻¹·b — the same whichever side the frame is on
    const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    const angle = 2 * Math.acos(Math.min(1, dot));
    t.push(toVideo((t0 + t1) / 2e6));
    v.push((angle * 180) / Math.PI / dt);
  }
  return finish(t, v, 'quaternions');
}

function finish(t, v, kind) {
  if (t.length < 2) throw new Error('The Gyroflow project holds too little motion data');
  const T = Float64Array.from(t);
  const V = Float64Array.from(v);
  return { t: T, v: V, kind, rate: (T.length - 1) / (T[T.length - 1] - T[0]) };
}

/**
 * Everything the dialog needs from a .gyroflow file:
 * {camera: {t, v, kind, rate}, videofile, source, fps, duration (s), syncPoints}
 */
export async function loadGyroflow(text) {
  const { project, metadata } = await readGyroflowProject(text);
  if (!metadata) throw new Error('The Gyroflow project has no embedded motion data (export it from Gyroflow with the gyro data included)');
  const camera = cameraRates(metadata, project.offsets);
  const info = project.video_info || {};
  const videofile = String(project.videofile || '')
    .replace(/^file:\/\/\/?/, '')
    .replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return {
    camera,
    videofile,
    source: get(metadata, 'detected_source') || (project.gyro_source && project.gyro_source.detected_source) || '',
    fps: Number(info.fps) || 0,
    duration: (Number(info.duration_ms) || 0) / 1000,
    syncPoints: Object.keys(project.offsets || {}).length,
  };
}
