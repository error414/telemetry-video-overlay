import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtTime, toVideo } from '../time.js';
import { SYNC_METHODS } from '../sync/methods.js';
import { rateMagnitude, activeWindows, planWindows } from '../sync/gyroSignal.js';
import { runSyncInWorker, runSyncJob, cancelSync } from '../sync/syncClient.js';
import { ColumnsInput } from './ColumnsInput.jsx';
import Icon from './Icon.jsx';

const PREFS_KEY = 'telemetry-overlay.autoSync.v1';
const ANALYSIS_WIDTH = 480; // frames are decoded at this width — plenty for global motion, cheap to track
// Fixed analysis plan of the video method: six 6-second windows spread over the video,
// strongest gyro motion in each sixth, whole log searched. The configurable version
// (window count, length, manual start, search band) is documented in
// docs/auto-sync-window-options.md.
const N_WINDOWS = 6;
const WINDOW_LEN = 6;
// The Gyroflow method costs nothing per window, so it takes more and longer ones:
// longer windows leave fewer competing peaks, more windows pin the drift line down.
const N_WINDOWS_GF = 10;
const WINDOW_LEN_GF = 10;
const ATTEMPTS_PER_WINDOW = 2; // candidates tried per window slot before the best attempt is kept
const GOOD_SCORE = 0.9; // …a slot stops early once a candidate matches this well
const USABLE_SCORE = 0.8; // windows below this do not take part in the offset/drift fit
const MAX_DEVIATION = 0.03; // s — windows further from the fitted line than this are flagged

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

/** Default gyro axes: gyroADC[0..2] with any unit suffix (INAV blackbox_decode naming). */
function guessAxes(columnNames) {
  return [0, 1, 2].map((k) => columnNames.find((c) => c.startsWith(`gyroADC[${k}]`)) || '');
}

/** Store series → {t (seconds relative to the store origin), v} copies the worker can take. */
function gyroSeries(store, names) {
  return names.map((name) => {
    const ser = store.columns[name];
    if (!ser) throw new Error(name ? `Column "${name}" is not in the loaded telemetry` : 'Pick all three gyro columns');
    if (!ser.numeric) throw new Error(`Column "${name}" is not numeric`);
    const t = new Float64Array(ser.t.length);
    for (let i = 0; i < t.length; i++) t[i] = ser.t[i] - store.origin;
    const v = ser.v instanceof Float64Array ? ser.v : Float64Array.from(ser.v, (x) => (typeof x === 'number' ? x : NaN));
    return { t, v };
  });
}

/**
 * offset(t) = offset0 + drift/1000 · t through the measured windows (t = window
 * centre in video seconds, offset = local offset there), weighted by match score.
 * With a single usable window the current drift is kept and only the offset moves.
 */
function fitDrift(points, currentDrift) {
  const good = points.filter((p) => p.score >= USABLE_SCORE);
  const use = good.length ? good : [points.reduce((a, b) => (b.score > a.score ? b : a))];
  if (use.length < 2) {
    const p = use[0];
    return { offset0: p.offset - (currentDrift / 1000) * p.t, drift: currentDrift, n: 1, deviation: 0 };
  }
  let sw = 0;
  let st = 0;
  let so = 0;
  let stt = 0;
  let sto = 0;
  for (const p of use) {
    const w = p.score;
    sw += w;
    st += w * p.t;
    so += w * p.offset;
    stt += w * p.t * p.t;
    sto += w * p.t * p.offset;
  }
  const denom = sw * stt - st * st;
  const b = denom > 1e-9 ? (sw * sto - st * so) / denom : 0;
  const a = (so - b * st) / sw;
  let deviation = 0;
  for (const p of use) deviation = Math.max(deviation, Math.abs(a + b * p.t - p.offset));
  return { offset0: a, drift: b * 1000, n: use.length, deviation };
}

const scoreClass = (s) => (s >= USABLE_SCORE ? 'chip-good' : s >= 0.5 ? 'chip-warn' : 'chip-bad');
const baseName = (p) => String(p || '').split(/[\\/]/).pop();
const stripExt = (name) => name.replace(/\.[^.]+$/, '');

/** Two normalised traces (camera amber, gyro teal) over the analysed window. */
function PairPlot({ pair }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !pair) return;
    const g = c.getContext('2d');
    const dpr = devicePixelRatio;
    const W = (c.width = c.clientWidth * dpr);
    const H = (c.height = c.clientHeight * dpr);
    g.clearRect(0, 0, W, H);
    const trace = (v, color) => {
      let max = 0;
      for (const x of v) if (x === x && x > max) max = x;
      if (!max) return;
      g.strokeStyle = color;
      g.lineWidth = 1.2 * dpr;
      g.beginPath();
      let pen = false;
      for (let k = 0; k < v.length; k++) {
        const x = (k / (v.length - 1)) * W;
        if (v[k] !== v[k]) {
          pen = false;
          continue;
        }
        const y = H - 2 * dpr - (v[k] / max) * (H - 4 * dpr);
        if (pen) g.lineTo(x, y);
        else g.moveTo(x, y);
        pen = true;
      }
      g.stroke();
    };
    trace(pair.gyro, '#5fd8dc');
    trace(pair.video, '#ffb95c');
  }, [pair]);
  return <canvas ref={ref} className="timeline" style={{ width: '100%', height: 84, display: 'block' }} />;
}

/** Correlation score over the searched offsets with the winner marked. */
function CurvePlot({ curve, offset }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !curve) return;
    const g = c.getContext('2d');
    const dpr = devicePixelRatio;
    const W = (c.width = c.clientWidth * dpr);
    const H = (c.height = c.clientHeight * dpr);
    g.clearRect(0, 0, W, H);
    const { offsets, scores } = curve;
    const o0 = offsets[0];
    const o1 = offsets[offsets.length - 1];
    const span = o1 - o0 || 1;
    g.strokeStyle = 'rgba(255,255,255,.12)';
    g.lineWidth = dpr;
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
    g.strokeStyle = '#8b98a6';
    g.beginPath();
    for (let k = 0; k < offsets.length; k++) {
      const x = ((offsets[k] - o0) / span) * W;
      const y = H / 2 - Math.max(-1, Math.min(1, scores[k])) * (H / 2 - 2 * dpr);
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.strokeStyle = '#ffb95c';
    g.lineWidth = 2 * dpr;
    const px = ((offset - o0) / span) * W;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
  }, [curve, offset]);
  return <canvas ref={ref} className="timeline" style={{ width: '100%', height: 48, display: 'block' }} />;
}

/**
 * Automatic sync panel of the Sync step, for one method:
 *   - "video" analyses six windows spread over the video (optical flow × gyro);
 *   - "gyroflow" takes the camera's own IMU from a .gyroflow project file.
 * Both yield local offsets per window; a line through them gives offset + drift and the user
 * applies the result. The manual controls stay as they are — this is an extra way to get the numbers.
 */
export default function AutoSync({ method, video, store, storeVersion, columnNames, sync, setOffset, setDrift, time, setStatus, onApplied }) {
  const prefs = useMemo(loadPrefs, []);
  const dur = video ? video.duration : 0;
  const isGf = method === 'gyroflow';
  const len = isGf ? WINDOW_LEN_GF : WINDOW_LEN;
  const nWindows = isGf ? N_WINDOWS_GF : N_WINDOWS;
  const [axes, setAxes] = useState(() => {
    const saved = Array.isArray(prefs.axes) ? prefs.axes : [];
    return saved.length === 3 && saved.every((a) => columnNames.includes(a)) ? saved : guessAxes(columnNames);
  });
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(null); // { text, fraction }
  const [result, setResult] = useState(null); // { windows: [...], fit }
  const [plotIdx, setPlotIdx] = useState(0);
  const [error, setError] = useState(null);
  const [gf, setGf] = useState(null); // { path, camera, source, videofile, fps, duration, syncPoints }
  const [gfLoading, setGfLoading] = useState(null); // file name being read
  const cancelRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ axes }));
  }, [axes]);
  // switching the method drops the previous result
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [method]);

  const clampStart = (s) => Math.max(0, Math.min(Math.max(0, dur - len), s));

  // Candidate windows in video time, strongest motion first.
  // Video method: where the *gyro* moves the most, mapped through the current sync (only
  // windows that land inside the video are usable). Gyroflow method: where the *camera*
  // moves the most — already on the video clock, no sync needed.
  const candidates = useMemo(() => {
    try {
      if (isGf) {
        if (!gf) return [];
        return activeWindows(gf.camera.t, gf.camera.v, len, { count: 3 * nWindows }).filter((w) => w.start >= 0 && w.start + len <= dur);
      }
      const mag = rateMagnitude(gyroSeries(store, axes));
      return activeWindows(mag.t, mag.v, len, { count: 3 * nWindows })
        .map((w) => ({ start: toVideo(w.start, sync), score: w.score }))
        .filter((w) => w.start >= 0 && w.start + len <= dur);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, storeVersion, axes, sync, dur, isGf, gf, len, nWindows]);

  const plan = useMemo(() => planWindows(candidates, nWindows, dur, len, ATTEMPTS_PER_WINDOW), [candidates, nWindows, dur, len]);

  // decode progress of the frame extraction comes from the main process
  useEffect(() => window.api.onGrayProgress((f) => setPhase((p) => (p && p.decoding ? { ...p, fraction: f } : p))), []);

  const cancel = () => {
    cancelRef.current = true;
    window.api.cancelGrayFrames();
    cancelSync();
  };
  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Gyroflow project file ----
  const loadGyroflowFile = async (path) => {
    setGfLoading(baseName(path));
    setError(null);
    setResult(null);
    try {
      const text = await window.api.readText(path);
      const info = await runSyncJob('gyroflow:load', { text });
      setGf({ ...info, path });
    } catch (e) {
      if (!cancelRef.current) setError(`${baseName(path)}: ${e.message}`);
    } finally {
      setGfLoading(null);
    }
  };
  const pickGyroflow = async () => {
    const p = await window.api.openGyroflow();
    if (p) loadGyroflowFile(p);
  };
  // Gyroflow saves its project next to the video as <video>.gyroflow — take it when it is there
  useEffect(() => {
    if (!isGf || gf || gfLoading || !video) return;
    const guess = video.path.replace(/\.[^.\\/]+$/, '') + '.gyroflow';
    let alive = true;
    window.api.exists(guess).then((yes) => alive && yes && loadGyroflowFile(guess));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGf, video]);

  const run = async () => {
    setResult(null);
    setError(null);
    let gyro;
    try {
      gyro = gyroSeries(store, axes);
    } catch (e) {
      setError(e.message);
      return;
    }
    cancelRef.current = false;
    setRunning(true);
    try {
      if (isGf) await runGyroflow(gyro);
      else await runVideo(gyro);
    } catch (e) {
      if (!cancelRef.current) setError(e.message);
    } finally {
      setRunning(false);
      setPhase(null);
    }
  };

  const runGyroflow = async (gyro) => {
    if (!gf) throw new Error('Open the Gyroflow project of this video first');
    if (!plan.length) throw new Error('The Gyroflow project holds no camera motion inside this video');
    setPhase({ text: `matching ${plan.length} windows against the gyro log…`, fraction: 0 });
    const windows = await runSyncJob('gyroflow', { camera: { t: gf.camera.t, v: gf.camera.v }, gyro, slots: plan, len, goodScore: GOOD_SCORE, search: null }, (p) =>
      setPhase({ text: `matching window ${Math.min(plan.length, Math.round(p.fraction * plan.length) + 1)}/${plan.length} against the gyro log…`, fraction: p.fraction })
    );
    if (cancelRef.current) return;
    if (!windows.length) throw new Error('None of the windows lies inside both the video and the telemetry');
    setResult({ windows, fit: fitDrift(windows, sync.drift || 0) });
    setPlotIdx(windows.reduce((bi, w, i, a) => (w.score > a[bi].score ? i : bi), 0));
  };

  const runVideo = async (gyro) => {
    // no gyro motion lands inside the video with the current offset → one window at the playhead
    const slots = plan.length ? plan : [[{ start: clampStart(time) }]];
    const w = ANALYSIS_WIDTH;
    const h = Math.round((video.height * w) / video.width / 2) * 2;
    const measured = [];
    let lastErr = null;
    for (let si = 0; si < slots.length; si++) {
      const label = slots.length > 1 ? `Window ${si + 1}/${slots.length} — ` : '';
      let best = null;
      for (const cand of slots[si]) {
        const start = Math.round(cand.start * video.fps) / video.fps;
        setPhase({ text: `${label}decoding ${fmtTime(start)} – ${fmtTime(start + len)}…`, fraction: 0, decoding: true });
        const fr = await window.api.grayFrames(video.path, start, len, w, h, Math.round(len * video.fps));
        if (cancelRef.current) return;
        if (!fr || fr.frames < 2) {
          lastErr = 'ffmpeg returned no frames for this part of the video';
          continue;
        }
        setPhase({ text: `${label}tracking camera motion…`, fraction: 0 });
        try {
          const r = await runSyncInWorker({ frames: fr.data, n: fr.frames, w, h, fps: video.fps, start, gyro, search: null }, (p) =>
            setPhase({ text: `${label}${p.phase === 'tracking' ? 'tracking camera motion…' : 'correlating with the gyro…'}`, fraction: p.fraction })
          );
          if (cancelRef.current) return;
          if (!best || r.score > best.score) best = { ...r, start, len, t: start + len / 2 };
          if (best.score >= GOOD_SCORE) break;
        } catch (e) {
          if (cancelRef.current) return;
          lastErr = e.message; // this window could not be used (no texture…) → next candidate of the slot
        }
      }
      if (best) {
        measured.push(best);
        // show what is there so far
        setResult({ windows: [...measured], fit: fitDrift(measured, sync.drift || 0) });
        setPlotIdx(measured.length - 1);
      }
    }
    if (!measured.length) setError(lastErr || 'No usable part of the video found');
  };

  const apply = () => {
    if (!result) return;
    const { fit } = result;
    setOffset(+fit.offset0.toFixed(3));
    if (fit.n >= 2) setDrift(+fit.drift.toFixed(3));
    setStatus(`Auto sync: offset ${fit.offset0.toFixed(3)} s` + (fit.n >= 2 ? `, drift ${fit.drift.toFixed(3)} ms/s from ${fit.n} windows` : ` from one window (drift unchanged)`));
    onApplied && onApplied();
  };

  const methodInfo = SYNC_METHODS.find((m) => m.id === method) || SYNC_METHODS[0];
  const fit = result && result.fit;
  const plotted = result && result.windows[Math.min(plotIdx, result.windows.length - 1)];
  const ambiguous = plotted && plotted.second > 0.9 * plotted.score;
  const videoName = video ? baseName(video.path) : '';
  const gfMismatch = gf && gf.videofile && stripExt(baseName(gf.videofile)).toLowerCase() !== stripExt(videoName).toLowerCase();
  const gfDurationOff = gf && gf.duration && dur && Math.abs(gf.duration - dur) > 1;
  const canRun = !!video && columnNames.length > 0 && (!isGf || (!!gf && !gfLoading));

  return (
    <div className="stack">
      <div className="hint">{methodInfo.hint}</div>
      {!methodInfo.available && (
        <div className="banner warn">
          <Icon name="warning" />
          <span>This method is not available yet.</span>
        </div>
      )}

      {isGf && (
        <div className="card card-high">
          <div className="card-head accent" style={{ marginBottom: 8 }}>
            <Icon name="gyro" />
            <span className="card-title">Gyroflow project</span>
            <span className="card-meta">.gyroflow with gyro data</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn btn-tonal btn-sm" onClick={pickGyroflow} disabled={running || !!gfLoading}>
              <Icon name="open" />
              Open…
            </button>
            {gfLoading ? (
              <span className="hint">reading {gfLoading}…</span>
            ) : gf ? (
              <span className="mono text-xs" style={{ color: 'var(--primary)' }} title={gf.path}>
                {baseName(gf.path)}
              </span>
            ) : (
              <span className="hint">Open the video in Gyroflow (it reads the camera's gyro from the file), save the project — File → Export project — and pick it here.</span>
            )}
          </div>
          {gf && (
            <div className="hint mt-2">
              {gf.source || 'camera'} · {gf.camera.kind === 'imu' ? 'gyro rates' : 'orientation'} at {Math.round(gf.camera.rate)} Hz · {fmtTime(gf.camera.t[0])} – {fmtTime(gf.camera.t[gf.camera.t.length - 1])}
              {gf.syncPoints ? ` · ${gf.syncPoints} Gyroflow sync point${gf.syncPoints > 1 ? 's' : ''} applied` : ''}
            </div>
          )}
          {gfMismatch && (
            <span className="chip chip-warn mt-2" title={`Project video: ${gf.videofile}\nLoaded video: ${video.path}`}>
              project is for {baseName(gf.videofile)}, not {videoName}
            </span>
          )}
          {gf && !gfMismatch && gfDurationOff && <span className="chip chip-warn mt-2">project video lasts {fmtTime(gf.duration)}, this one {fmtTime(dur)}</span>}
        </div>
      )}

      <div>
        <span className="label mt-0" style={{ color: 'var(--secondary)' }}>
          Gyro rate columns — any order, any unit
        </span>
        <div className="grid grid-cols-3 gap-2">
          {axes.map((a, i) => (
            <ColumnsInput key={i} single small value={a} onChange={(v) => setAxes((ax) => ax.map((x, k) => (k === i ? v : x)))} columnNames={columnNames} style={{ '--input-color': 'var(--secondary)' }} disabled={running} placeholder={`axis ${i + 1}`} />
          ))}
        </div>
        <div className="hint mt-2">Three angular-rate columns of the same sensor (INAV: gyroADC[0..2]). Only the magnitude of the rotation is compared, so the axis order and the camera mounting do not matter.</div>
        <div className="hint mt-1">
          Windows to analyse:{' '}
          {plan.length
            ? plan.map((p) => fmtTime(p[0].start)).join(' · ')
            : isGf
              ? gf
                ? 'none — the project holds no camera motion inside this video'
                : 'open the Gyroflow project first'
              : columnNames.length
                ? `${fmtTime(clampStart(time))} (playhead — no strong gyro motion lands inside the video with the current offset)`
                : 'load telemetry first'}
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        {!running ? (
          <button className={'btn ' + (result || error ? 'btn-tonal' : 'btn-filled')} onClick={run} disabled={!canRun || !methodInfo.available}>
            <Icon name="auto" />
            {result || error ? 'Analyse again' : 'Analyse'}
          </button>
        ) : (
          <button className="btn btn-danger" onClick={cancel}>
            Cancel
          </button>
        )}
        {phase && (
          <div className="flex items-center gap-3 flex-1" style={{ minWidth: 200 }}>
            <div className="progress" style={{ flex: 1 }}>
              <div style={{ width: `${Math.round((phase.fraction || 0) * 100)}%` }} />
            </div>
            <span className="hint">{phase.text}</span>
          </div>
        )}
      </div>
      {error && (
        <div className="banner error">
          <Icon name="warning" />
          <span>{error}</span>
        </div>
      )}

      {result && fit && plotted && (
        <div className="card card-high">
          <div className="card-head" style={{ marginBottom: 8 }}>
            <Icon name="circleCheck" />
            <span className="card-title">Result</span>
            <span className="card-meta">
              {result.windows.length} window{result.windows.length > 1 ? 's' : ''}
              {plotted.hfov ? ` · lens ≈ ${plotted.hfov}° hfov` : ''}
            </span>
          </div>
          <div className="stack">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="mono" style={{ fontSize: 24, fontWeight: 500, color: 'var(--primary)' }} title="Offset at the start of the video">
                {fit.offset0 >= 0 ? '+' : ''}
                {fit.offset0.toFixed(3)} s
              </span>
              {fit.n >= 2 && (
                <span className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--primary)' }} title="Clock drift — milliseconds of telemetry gained per second of video">
                  drift {fit.drift >= 0 ? '+' : ''}
                  {fit.drift.toFixed(3)} ms/s
                </span>
              )}
              <span className="hint">
                current {sync.offset.toFixed(3)} s{sync.drift ? ` · ${sync.drift.toFixed(3)} ms/s` : ''}
                {fit.n < 2 ? ' · drift unchanged' : ''}
              </span>
              {fit.n >= 2 && fit.deviation > MAX_DEVIATION && (
                <span className="chip chip-warn" title="The windows do not lie on one line — one of them probably matched a wrong place; click the rows below to inspect them">
                  windows disagree by {Math.round(fit.deviation * 1000)} ms
                </span>
              )}
            </div>
            <div className="list">
              {result.windows.map((w, i) => (
                <div key={i} className={'list-item' + (i === plotIdx ? ' active' : '')} style={{ minHeight: 40, padding: '4px 10px' }} onClick={() => setPlotIdx(i)} title="Show this window's traces below">
                  <span className="mono text-xs" style={{ width: 118 }}>
                    {fmtTime(w.start)} – {fmtTime(w.start + w.len)}
                  </span>
                  <span className="mono text-xs" style={{ color: 'var(--primary)', width: 110 }}>
                    offset {w.offset.toFixed(3)} s
                  </span>
                  <span className={'chip chip-sm mono ' + scoreClass(w.score)}>match {w.score.toFixed(3)}</span>
                  <span className="hint">
                    {w.motions ? `${w.motions.tracked}/${w.motions.total} frames` : `runner-up ${w.second.toFixed(2)}`}
                    {w.score < USABLE_SCORE ? ' · not used in the fit' : ''}
                  </span>
                </div>
              ))}
            </div>
            {ambiguous && (
              <span className="chip chip-warn self-start" title={`Another offset scores ${plotted.second.toFixed(2)} for this window — the flight may repeat the same manoeuvre`}>
                this window is ambiguous
              </span>
            )}
            <PairPlot pair={plotted.pair} />
            <div className="hint">
              <span style={{ color: 'var(--primary)' }}>amber</span> = {isGf ? 'camera gyro from the Gyroflow project' : 'rotation seen in the video'}, <span style={{ color: 'var(--secondary)' }}>teal</span> = blackbox gyro at the found offset. The two should follow the same shape.
            </div>
            <CurvePlot curve={plotted.curve} offset={plotted.offset} />
            <div className="hint">Match score over the searched offsets ({plotted.curve.offsets[0].toFixed(1)} … {plotted.curve.offsets[plotted.curve.offsets.length - 1].toFixed(1)} s) — one clear spike means a reliable result.</div>
            {!running && (
              <button className="btn btn-filled self-start" onClick={apply}>
                <Icon name="check" />
                {fit.n >= 2 ? `Apply offset ${fit.offset0.toFixed(3)} s + drift ${fit.drift.toFixed(3)} ms/s` : `Apply offset ${fit.offset0.toFixed(3)} s`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
