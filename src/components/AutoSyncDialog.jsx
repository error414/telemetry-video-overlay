import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtTime } from '../time.js';
import TimeInput from './TimeInput.jsx';
import { SYNC_METHODS } from '../sync/methods.js';
import { rateMagnitude, activeWindows } from '../sync/gyroSignal.js';
import { runSyncInWorker, cancelSync } from '../sync/syncClient.js';

const PREFS_KEY = 'telemetry-overlay.autoSync.v1';
const ANALYSIS_WIDTH = 480; // frames are decoded at this width — plenty for global motion, cheap to track
const MAX_ATTEMPTS = 3; // "strongest motion" tries up to this many candidate windows
const GOOD_SCORE = 0.9; // …and stops early once a window matches this well

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

const scoreClass = (s) => (s >= 0.8 ? 'chip-good' : s >= 0.5 ? 'chip-warn' : 'chip-bad');

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
    // zero line
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
 * Automatic sync dialog: picks the analysis window, runs the selected method and
 * lets the user apply the offset it found. The manual offset controls stay as they
 * are — this is an extra way to get the number.
 */
export default function AutoSyncDialog({ video, store, storeVersion, columnNames, offset, setOffset, time, onClose, setStatus }) {
  const prefs = useMemo(loadPrefs, []);
  const dur = video ? video.duration : 0;
  const [method, setMethod] = useState(SYNC_METHODS[0].id);
  const [axes, setAxes] = useState(() => {
    const saved = Array.isArray(prefs.axes) ? prefs.axes : [];
    return saved.length === 3 && saved.every((a) => columnNames.includes(a)) ? saved : guessAxes(columnNames);
  });
  const [len, setLen] = useState(() => (prefs.len >= 2 && prefs.len <= 20 ? prefs.len : 6));
  const [windowMode, setWindowMode] = useState('auto'); // 'auto' = strongest gyro motion, 'manual' = the start field
  const [manualStart, setManualStart] = useState(() => Math.max(0, Math.min(dur - 6, time)));
  const [searchMode, setSearchMode] = useState(prefs.searchMode === 'near' ? 'near' : 'all');
  const [nearSpan, setNearSpan] = useState(prefs.nearSpan > 0 ? prefs.nearSpan : 30);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(null); // { text, fraction }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ axes, len, searchMode, nearSpan }));
  }, [axes, len, searchMode, nearSpan]);

  const clampStart = (s) => Math.max(0, Math.min(Math.max(0, dur - len), s));

  // where the gyro moves the most, mapped to video time through the current offset
  // (only windows that land inside the video are usable)
  const candidates = useMemo(() => {
    try {
      const mag = rateMagnitude(gyroSeries(store, axes));
      return activeWindows(mag.t, mag.v, len, { count: 8 })
        .map((w) => ({ start: w.start - offset, score: w.score }))
        .filter((w) => w.start >= 0 && w.start + len <= dur);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, storeVersion, axes, len, offset, dur]);

  const autoStart = candidates.length ? candidates[0].start : clampStart(time);
  const shownStart = windowMode === 'auto' ? autoStart : manualStart;

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
    const starts = windowMode === 'auto' && candidates.length ? candidates.slice(0, MAX_ATTEMPTS).map((c) => c.start) : [clampStart(shownStart)];
    const w = ANALYSIS_WIDTH;
    const h = Math.round((video.height * w) / video.width / 2) * 2;
    const search = searchMode === 'near' ? { min: offset - nearSpan, max: offset + nearSpan } : null;
    cancelRef.current = false;
    setRunning(true);
    try {
      let lastErr = null;
      let best = null; // best of the attempted windows (a window right after landing can track fine yet match badly)
      for (const s0 of starts) {
        const start = Math.round(s0 * video.fps) / video.fps;
        setPhase({ text: `Decoding ${fmtTime(start)} – ${fmtTime(start + len)}…`, fraction: 0, decoding: true });
        const fr = await window.api.grayFrames(video.path, start, len, w, h, Math.round(len * video.fps));
        if (cancelRef.current) return;
        if (!fr || fr.frames < 2) {
          lastErr = 'ffmpeg returned no frames for this part of the video';
          continue;
        }
        setPhase({ text: 'Tracking camera motion…', fraction: 0 });
        try {
          const r = await runSyncInWorker({ frames: fr.data, n: fr.frames, w, h, fps: video.fps, start, gyro, search }, (p) =>
            setPhase({ text: p.phase === 'tracking' ? 'Tracking camera motion…' : 'Correlating with the gyro…', fraction: p.fraction })
          );
          if (cancelRef.current) return;
          if (!best || r.score > best.score) best = { ...r, start, len };
          setResult(best);
          if (best.score >= GOOD_SCORE) return;
        } catch (e) {
          if (cancelRef.current) return;
          lastErr = e.message; // this window could not be used (no texture…) → try the next candidate
        }
      }
      if (!best) setError(lastErr || 'No usable part of the video found');
    } catch (e) {
      if (!cancelRef.current) setError(e.message);
    } finally {
      setRunning(false);
      setPhase(null);
    }
  };

  const apply = () => {
    if (!result) return;
    setOffset(+result.offset.toFixed(3));
    setStatus(`Auto sync: offset ${result.offset.toFixed(3)} s (match ${result.score.toFixed(2)}, window ${fmtTime(result.start)} – ${fmtTime(result.start + result.len)})`);
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
  const ambiguous = result && result.second > 0.9 * result.score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && !running && onClose()}>
      <div role="dialog" aria-modal="true" className="rounded-lg p-5 flex flex-col gap-3" style={{ width: 'min(92vw, 640px)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--panel)', border: '1px solid var(--border-strong)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
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
            Analysis window
            <span className="bay-note">{fmtTime(shownStart)} – {fmtTime(shownStart + len)} video</span>
          </header>
          <div className="bay-body flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="bar-label">Start</span>
              <TimeInput
                value={shownStart}
                disabled={running}
                onCommit={(t) => {
                  setManualStart(clampStart(t));
                  setWindowMode('manual');
                }}
                title="Video time where the analysed part begins — m:ss.sss or seconds"
              />
              <span className="bar-label">Length</span>
              <input className="input mono" type="number" min={2} max={20} step={1} value={len} disabled={running} style={{ width: 56, padding: '2px 6px' }} onChange={(e) => setLen(Math.max(2, Math.min(20, Number(e.target.value) || 6)))} />
              <span className="hint">s</span>
              <button className={'btn btn-xs' + (windowMode === 'auto' ? ' btn-primary' : '')} disabled={running} onClick={() => setWindowMode('auto')} title="Analyse where the gyro log shows the strongest rotation (mapped to the video through the current offset); the next-best places are tried if the first cannot be tracked">
                Strongest motion
              </button>
              <button
                className="btn btn-xs"
                disabled={running}
                onClick={() => {
                  setManualStart(clampStart(time));
                  setWindowMode('manual');
                }}
                title="Analyse from the current playhead position"
              >
                At playhead
              </button>
            </div>
            {windowMode === 'auto' && candidates.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="hint">candidates:</span>
                {candidates.slice(0, 5).map((c, i) => (
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
            {windowMode === 'auto' && !candidates.length && <div className="hint">No strong gyro motion lands inside the video with the current offset — the window starts at the playhead instead.</div>}
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
            <span className="hint" style={{ minWidth: 200 }}>{phase.text}</span>
          </div>
        )}
        {error && (
          <div className="text-xs" style={{ color: 'var(--bad)' }}>
            {error}
          </div>
        )}

        {result && (
          <section className="bay bay-mixed" style={{ marginBottom: 0 }}>
            <header className="bay-head">
              <span className="bay-tick" />
              Result
              <span className="bay-note">
                window {fmtTime(result.start)} – {fmtTime(result.start + result.len)} · {result.motions.tracked}/{result.motions.total} frames tracked · lens ≈ {result.hfov}° hfov
              </span>
            </header>
            <div className="bay-body flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)' }}>
                  {result.offset >= 0 ? '+' : ''}
                  {result.offset.toFixed(3)} s
                </span>
                <span className="hint">
                  current {offset.toFixed(3)} s · change {result.offset - offset >= 0 ? '+' : ''}
                  {(result.offset - offset).toFixed(3)} s
                </span>
                <span className={'chip mono ' + scoreClass(result.score)} title="Correlation between the camera rotation seen in the video and the gyro (1 = identical)">
                  match {result.score.toFixed(3)}
                </span>
                {ambiguous && (
                  <span className="chip chip-warn" title={`Another offset scores ${result.second.toFixed(2)} — the flight may repeat the same manoeuvre; check the result on the timeline or analyse a different window`}>
                    ambiguous
                  </span>
                )}
              </div>
              <PairPlot pair={result.pair} />
              <div className="hint">
                <span style={{ color: 'var(--accent)' }}>amber</span> = rotation seen in the video, <span style={{ color: 'var(--tele)' }}>teal</span> = gyro at the found offset. The two should follow the same shape.
              </div>
              <CurvePlot curve={result.curve} offset={result.offset} />
              <div className="hint">Match score over the searched offsets ({result.curve.offsets[0].toFixed(1)} … {result.curve.offsets[result.curve.offsets.length - 1].toFixed(1)} s) — one clear spike means a reliable result.</div>
            </div>
          </section>
        )}

        <div className="flex gap-2 justify-end items-center">
          {result && !running && (
            <button className="btn btn-primary" onClick={apply}>
              Apply offset {result.offset.toFixed(3)} s
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
