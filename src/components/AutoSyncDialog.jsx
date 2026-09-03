import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtTime, toVideo } from '../time.js';
import TimeInput from './TimeInput.jsx';
import { SYNC_METHODS } from '../sync/methods.js';
import { rateMagnitude, activeWindows } from '../sync/gyroSignal.js';
import { runSyncInWorker, cancelSync } from '../sync/syncClient.js';

const PREFS_KEY = 'telemetry-overlay.autoSync.v1';
const ANALYSIS_WIDTH = 480; // frames are decoded at this width — plenty for global motion, cheap to track
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
 * Which windows to analyse. One slot = a list of candidate starts tried in order.
 * n = 1: the strongest candidates, tried until one matches.
 * n ≥ 2: the video is split into n equal parts and each part gets its strongest
 * candidates, so the windows are spread out (that is what makes the drift measurable);
 * empty parts borrow the strongest unused candidates.
 */
function planWindows(candidates, n, dur, len) {
  if (!candidates.length) return [];
  if (n <= 1) return [candidates.slice(0, ATTEMPTS_PER_WINDOW + 1)];
  const bins = Array.from({ length: n }, () => []);
  for (const c of candidates) bins[Math.max(0, Math.min(n - 1, Math.floor(((c.start + len / 2) / dur) * n)))].push(c);
  const plan = bins.map((b) => b.slice(0, ATTEMPTS_PER_WINDOW));
  const planned = new Set(plan.flat());
  const spare = candidates.filter((c) => !planned.has(c));
  for (const p of plan) if (!p.length && spare.length) p.push(spare.shift());
  return plan.filter((p) => p.length);
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

/** Two normalised traces (video amber, gyro teal) over the analysed window. */
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
    trace(pair.gyro, '#4fc3c7');
    trace(pair.video, '#f2a93b');
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
    g.strokeStyle = '#f2a93b';
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
 * Automatic sync dialog: picks the analysis windows, runs the selected method and
 * lets the user apply what it found. With two or more windows spread over the
 * video it also measures the clock drift. The manual controls stay as they are —
 * this is an extra way to get the numbers.
 */
export default function AutoSyncDialog({ video, store, storeVersion, columnNames, sync, setOffset, setDrift, time, onClose, setStatus }) {
  const prefs = useMemo(loadPrefs, []);
  const dur = video ? video.duration : 0;
  const [method, setMethod] = useState(SYNC_METHODS[0].id);
  const [axes, setAxes] = useState(() => {
    const saved = Array.isArray(prefs.axes) ? prefs.axes : [];
    return saved.length === 3 && saved.every((a) => columnNames.includes(a)) ? saved : guessAxes(columnNames);
  });
  const [len, setLen] = useState(() => (prefs.len >= 2 && prefs.len <= 20 ? prefs.len : 6));
  const [nWindows, setNWindows] = useState(() => (prefs.windows >= 1 && prefs.windows <= 6 ? prefs.windows : 3));
  const [windowMode, setWindowMode] = useState('auto'); // 'auto' = strongest gyro motion, 'manual' = the start field
  const [manualStart, setManualStart] = useState(() => Math.max(0, Math.min(dur - 6, time)));
  const [searchMode, setSearchMode] = useState(prefs.searchMode === 'near' ? 'near' : 'all');
  const [nearSpan, setNearSpan] = useState(prefs.nearSpan > 0 ? prefs.nearSpan : 30);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(null); // { text, fraction }
  const [result, setResult] = useState(null); // { windows: [...], fit }
  const [plotIdx, setPlotIdx] = useState(0);
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ axes, len, windows: nWindows, searchMode, nearSpan }));
  }, [axes, len, nWindows, searchMode, nearSpan]);

  const clampStart = (s) => Math.max(0, Math.min(Math.max(0, dur - len), s));
  const localOffset = (t) => sync.offset + ((sync.drift || 0) / 1000) * t; // current offset as seen at video time t

  // where the gyro moves the most, mapped to video time through the current sync
  // (only windows that land inside the video are usable)
  const candidates = useMemo(() => {
    try {
      const mag = rateMagnitude(gyroSeries(store, axes));
      return activeWindows(mag.t, mag.v, len, { count: 12 })
        .map((w) => ({ start: toVideo(w.start, sync), score: w.score }))
        .filter((w) => w.start >= 0 && w.start + len <= dur);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, storeVersion, axes, len, sync, dur]);

  const plan = useMemo(() => (windowMode === 'auto' ? planWindows(candidates, nWindows, dur, len) : [[{ start: clampStart(manualStart) }]]), [windowMode, candidates, nWindows, dur, len, manualStart]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownStart = windowMode === 'auto' ? (plan.length ? plan[0][0].start : clampStart(time)) : manualStart;

  // decode progress of the frame extraction comes from the main process
  useEffect(() => window.api.onGrayProgress((f) => setPhase((p) => (p && p.decoding ? { ...p, fraction: f } : p))), []);

  const cancel = () => {
    cancelRef.current = true;
    window.api.cancelGrayFrames();
    cancelSync();
  };
  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const slots = plan.length ? plan : [[{ start: clampStart(time) }]];
    const w = ANALYSIS_WIDTH;
    const h = Math.round((video.height * w) / video.width / 2) * 2;
    cancelRef.current = false;
    setRunning(true);
    try {
      const measured = [];
      let lastErr = null;
      for (let si = 0; si < slots.length; si++) {
        const label = slots.length > 1 ? `Window ${si + 1}/${slots.length} — ` : '';
        let best = null;
        for (const cand of slots[si]) {
          const start = Math.round(cand.start * video.fps) / video.fps;
          const search = searchMode === 'near' ? { min: localOffset(start) - nearSpan, max: localOffset(start) + nearSpan } : null;
          setPhase({ text: `${label}decoding ${fmtTime(start)} – ${fmtTime(start + len)}…`, fraction: 0, decoding: true });
          const fr = await window.api.grayFrames(video.path, start, len, w, h, Math.round(len * video.fps));
          if (cancelRef.current) return;
          if (!fr || fr.frames < 2) {
            lastErr = 'ffmpeg returned no frames for this part of the video';
            continue;
          }
          setPhase({ text: `${label}tracking camera motion…`, fraction: 0 });
          try {
            const r = await runSyncInWorker({ frames: fr.data, n: fr.frames, w, h, fps: video.fps, start, gyro, search }, (p) =>
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
    } catch (e) {
      if (!cancelRef.current) setError(e.message);
    } finally {
      setRunning(false);
      setPhase(null);
    }
  };

  const apply = () => {
    if (!result) return;
    const { fit } = result;
    setOffset(+fit.offset0.toFixed(3));
    if (fit.n >= 2) setDrift(+fit.drift.toFixed(3));
    setStatus(
      `Auto sync: offset ${fit.offset0.toFixed(3)} s` +
        (fit.n >= 2 ? `, drift ${fit.drift.toFixed(3)} ms/s from ${fit.n} windows` : ` (window ${fmtTime(result.windows[0].start)} – ${fmtTime(result.windows[0].start + result.windows[0].len)}, drift unchanged)`)
    );
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (running) cancel();
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const methodInfo = SYNC_METHODS.find((m) => m.id === method) || SYNC_METHODS[0];
  const fit = result && result.fit;
  const plotted = result && result.windows[Math.min(plotIdx, result.windows.length - 1)];
  const ambiguous = plotted && plotted.second > 0.9 * plotted.score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div role="dialog" aria-modal="true" className="rounded-lg p-5 flex flex-col gap-3" style={{ width: 'min(92vw, 660px)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--panel)', border: '1px solid var(--border-strong)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div className="flex items-center gap-3">
          <div className="font-semibold text-base">Auto sync</div>
          <div className="seg ml-auto">
            {SYNC_METHODS.map((m) => (
              <button key={m.id} onClick={() => setMethod(m.id)} disabled={running} style={method === m.id ? { color: 'var(--accent)', background: 'var(--raise)' } : undefined} title={m.hint}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hint">{methodInfo.hint}</div>

        <section className="bay bay-tele" style={{ marginBottom: 0 }}>
          <header className="bay-head">
            <span className="bay-tick" />
            Gyro rate columns
            <span className="bay-note">any order · any unit</span>
          </header>
          <div className="bay-body flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              {axes.map((a, i) => (
                <input
                  key={i}
                  list="autosync-cols"
                  className="input mono"
                  style={{ color: 'var(--tele)', padding: '3px 8px' }}
                  value={a}
                  disabled={running}
                  placeholder={`axis ${i + 1}`}
                  onChange={(e) => setAxes((ax) => ax.map((x, k) => (k === i ? e.target.value : x)))}
                />
              ))}
            </div>
            <datalist id="autosync-cols">{columnNames.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="hint">Three angular-rate columns of the same sensor (INAV: gyroADC[0..2]). Only the magnitude of the rotation is compared, so the axis order and the camera mounting do not matter.</div>
          </div>
        </section>

        <section className="bay bay-amber" style={{ marginBottom: 0 }}>
          <header className="bay-head">
            <span className="bay-tick" />
            Analysis windows
            <span className="bay-note">
              {windowMode === 'auto' && plan.length > 1 ? plan.map((p) => fmtTime(p[0].start)).join(' · ') : `${fmtTime(shownStart)} – ${fmtTime(shownStart + len)}`} video
            </span>
          </header>
          <div className="bay-body flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button className={'btn btn-xs' + (windowMode === 'auto' ? ' btn-primary' : '')} disabled={running} onClick={() => setWindowMode('auto')} title="Analyse where the gyro log shows the strongest rotation (mapped to the video through the current offset); with several windows the video is split into equal parts and each part gets its strongest place, so the clock drift can be measured too">
                Strongest motion
              </button>
              <span className="bar-label">Windows</span>
              <input className="input mono" type="number" min={1} max={6} step={1} value={nWindows} disabled={running || windowMode !== 'auto'} style={{ width: 48, padding: '2px 6px' }} onChange={(e) => setNWindows(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} title="How many windows to analyse — 2 or more spread over the video also measure the drift" />
              <span className="bar-label ml-1">Length</span>
              <input className="input mono" type="number" min={2} max={20} step={1} value={len} disabled={running} style={{ width: 56, padding: '2px 6px' }} onChange={(e) => setLen(Math.max(2, Math.min(20, Number(e.target.value) || 6)))} />
              <span className="hint">s</span>
              <span className="bar-label ml-2">Start</span>
              <TimeInput
                value={shownStart}
                disabled={running}
                onCommit={(t) => {
                  setManualStart(clampStart(t));
                  setWindowMode('manual');
                }}
                title="Video time where a single analysed window begins — typing a value switches to one manual window"
              />
              <button
                className="btn btn-xs"
                disabled={running}
                onClick={() => {
                  setManualStart(clampStart(time));
                  setWindowMode('manual');
                }}
                title="Analyse one window from the current playhead position (offset only, drift unchanged)"
              >
                At playhead
              </button>
            </div>
            {windowMode === 'auto' && candidates.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="hint">candidates:</span>
                {candidates.slice(0, 6).map((c, i) => (
                  <button
                    key={i}
                    className="chip mono"
                    style={{ cursor: 'pointer' }}
                    disabled={running}
                    onClick={() => {
                      setManualStart(c.start);
                      setWindowMode('manual');
                    }}
                    title={`Rotation activity ${c.score.toFixed(0)} — click to analyse only this window`}
                  >
                    {fmtTime(c.start)}
                  </button>
                ))}
              </div>
            )}
            {windowMode === 'auto' && !candidates.length && <div className="hint">No strong gyro motion lands inside the video with the current offset — one window at the playhead is analysed instead.</div>}
            {windowMode === 'manual' && <div className="hint">One manual window measures the offset at that place only; the drift is left as it is.</div>}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="bar-label">Search</span>
              <label className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <input type="radio" name="autosync-search" checked={searchMode === 'all'} disabled={running} onChange={() => setSearchMode('all')} />
                whole log
              </label>
              <label className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <input type="radio" name="autosync-search" checked={searchMode === 'near'} disabled={running} onChange={() => setSearchMode('near')} />
                near the current offset ±
                <input className="input mono" type="number" min={1} max={600} step={1} value={nearSpan} disabled={running} style={{ width: 56, padding: '1px 6px' }} onChange={(e) => setNearSpan(Math.max(1, Number(e.target.value) || 30))} />
                s
              </label>
            </div>
          </div>
        </section>

        {phase && (
          <div className="flex items-center gap-3 text-xs">
            <div className="progress" style={{ flex: 1 }}>
              <div style={{ width: `${Math.round((phase.fraction || 0) * 100)}%` }} />
            </div>
            <span className="hint" style={{ minWidth: 240 }}>{phase.text}</span>
          </div>
        )}
        {error && (
          <div className="text-xs" style={{ color: 'var(--bad)' }}>
            {error}
          </div>
        )}

        {result && fit && plotted && (
          <section className="bay bay-mixed" style={{ marginBottom: 0 }}>
            <header className="bay-head">
              <span className="bay-tick" />
              Result
              <span className="bay-note">{result.windows.length} window{result.windows.length > 1 ? 's' : ''} · lens ≈ {plotted.hfov}° hfov</span>
            </header>
            <div className="bay-body flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)' }} title="Offset at the start of the video">
                  {fit.offset0 >= 0 ? '+' : ''}
                  {fit.offset0.toFixed(3)} s
                </span>
                {fit.n >= 2 && (
                  <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }} title="Clock drift — milliseconds of telemetry gained per second of video">
                    drift {fit.drift >= 0 ? '+' : ''}
                    {fit.drift.toFixed(3)} ms/s
                  </span>
                )}
                <span className="hint">
                  current {sync.offset.toFixed(3)} s{sync.drift ? ` · ${sync.drift.toFixed(3)} ms/s` : ''}
                  {fit.n < 2 && result.windows.length > 0 ? ' · drift unchanged' : ''}
                </span>
                {fit.n >= 2 && fit.deviation > MAX_DEVIATION && (
                  <span className="chip chip-warn" title="The windows do not lie on one line — one of them probably matched a wrong place; click the rows below to inspect them">
                    windows disagree by {Math.round(fit.deviation * 1000)} ms
                  </span>
                )}
              </div>
              <table className="text-xs" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {result.windows.map((w, i) => (
                    <tr key={i} className={'row' + (i === plotIdx ? ' row-active' : '')} style={{ cursor: 'pointer' }} onClick={() => setPlotIdx(i)} title="Show this window's traces below">
                      <td className="mono" style={{ padding: '2px 8px' }}>
                        {fmtTime(w.start)} – {fmtTime(w.start + w.len)}
                      </td>
                      <td className="mono" style={{ padding: '2px 8px', color: 'var(--accent)' }}>
                        offset {w.offset.toFixed(3)} s
                      </td>
                      <td style={{ padding: '2px 8px' }}>
                        <span className={'chip mono ' + scoreClass(w.score)}>match {w.score.toFixed(3)}</span>
                      </td>
                      <td className="hint" style={{ padding: '2px 8px' }}>
                        {w.motions.tracked}/{w.motions.total} frames{w.score < USABLE_SCORE ? ' · not used in the fit' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ambiguous && (
                <span className="chip chip-warn" style={{ alignSelf: 'flex-start' }} title={`Another offset scores ${plotted.second.toFixed(2)} for this window — the flight may repeat the same manoeuvre`}>
                  this window is ambiguous
                </span>
              )}
              <PairPlot pair={plotted.pair} />
              <div className="hint">
                <span style={{ color: 'var(--accent)' }}>amber</span> = rotation seen in the video, <span style={{ color: 'var(--tele)' }}>teal</span> = gyro at the found offset. The two should follow the same shape.
              </div>
              <CurvePlot curve={plotted.curve} offset={plotted.offset} />
              <div className="hint">Match score over the searched offsets ({plotted.curve.offsets[0].toFixed(1)} … {plotted.curve.offsets[plotted.curve.offsets.length - 1].toFixed(1)} s) — one clear spike means a reliable result.</div>
            </div>
          </section>
        )}

        <div className="flex gap-2 justify-end items-center">
          {result && fit && !running && (
            <button className="btn btn-primary" onClick={apply}>
              {fit.n >= 2 ? `Apply offset ${fit.offset0.toFixed(3)} s + drift ${fit.drift.toFixed(3)} ms/s` : `Apply offset ${fit.offset0.toFixed(3)} s`}
            </button>
          )}
          {!running ? (
            <button className="btn" onClick={run} disabled={!video}>
              {result || error ? 'Analyse again' : 'Analyse'}
            </button>
          ) : (
            <button className="btn btn-danger" onClick={cancel}>
              Cancel
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose} disabled={running}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
