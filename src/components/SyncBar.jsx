import React, { useEffect, useRef, useState } from 'react';

function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00.000';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m + ':' + sec.toFixed(3).padStart(6, '0');
}

export default function SyncBar({ video, videoRef, time, setTime, offset, setOffset, store, storeVersion, columnNames, setStatus, disabled, seekLimit }) {
  const dur = video ? video.duration : 0;
  // while a live proxy is encoding, only the already-written part is seekable
  const limit = seekLimit != null ? Math.min(dur, seekLimit) : dur;
  const [playing, setPlaying] = useState(false);
  const [graphCol, setGraphCol] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!graphCol && columnNames.length) {
      const pick = columnNames.find((c) => /throttle|rcCommand\[3\]/i.test(c)) || columnNames[0];
      setGraphCol(pick);
    }
  }, [columnNames, graphCol]);

  const seek = (t) => {
    if (disabled) return;
    const v = videoRef.current;
    t = Math.max(0, Math.min(limit, t));
    if (v) v.currentTime = t;
    setTime(t);
  };
  // Heavy files (e.g. HEVC 4K/120fps) can fail silently: play() resolves, no error/stalled event fires,
  // but the decoder never outputs a frame. Detect it by checking decoded-frame count shortly after play.
  const stallCheckRef = useRef(0);
  useEffect(() => () => clearTimeout(stallCheckRef.current), []);
  const armStallCheck = (v) => {
    const frames = () => (v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality().totalVideoFrames : -1);
    const f0 = frames();
    const t0 = v.currentTime;
    clearTimeout(stallCheckRef.current);
    stallCheckRef.current = setTimeout(() => {
      if (v !== videoRef.current || v.paused || v.ended) return;
      const dead = f0 >= 0 ? frames() === f0 : v.currentTime - t0 < 0.05;
      if (dead) {
        v.pause();
        setPlaying(false);
        setStatus('The decoder cannot play this video (codec / resolution / frame rate not supported in hardware) — create a preview proxy in the Files tab.');
      }
    }, 1500);
  };
  const toggle = () => {
    const v = videoRef.current;
    if (!v || disabled) return;
    if (v.paused) {
      v.play().then(() => armStallCheck(v)).catch((e) => {
        if (e && e.name === 'AbortError') return; // seek/pause interrupted play – harmless
        setPlaying(false);
        setStatus('Cannot play video: ' + (e && e.message ? e.message : e) + ' — create a preview proxy in the Files tab.');
      });
      setPlaying(true);
    } else {
      clearTimeout(stallCheckRef.current);
      v.pause();
      setPlaying(false);
    }
  };
  const stepFrame = (n) => {
    if (disabled) return;
    const v = videoRef.current;
    if (v) v.pause();
    setPlaying(false);
    seek(time + n / (video ? video.fps : 30));
  };

  // keyboard: space play, arrows frame step, shift+arrows = 1s, [ ] adjust offset
  useEffect(() => {
    const h = (e) => {
      // ignore shortcuts while typing anywhere editable (inputs, textareas, CodeMirror's contenteditable)
      const t = e.target;
      if (t && (t.isContentEditable || (t.closest && t.closest('input, textarea, select, [contenteditable], .cm-editor')))) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowRight') stepFrame(e.shiftKey ? (video ? video.fps : 30) : 1);
      else if (e.code === 'ArrowLeft') stepFrame(e.shiftKey ? -(video ? video.fps : 30) : -1);
      else if (e.key === '[') setOffset((o) => +(o - (e.shiftKey ? 1 : 0.01)).toFixed(3));
      else if (e.key === ']') setOffset((o) => +(o + (e.shiftKey ? 1 : 0.01)).toFixed(3));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // sparkline of one telemetry column against the video timeline (shifted by offset)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    const W = (c.width = c.clientWidth * devicePixelRatio);
    const H = (c.height = c.clientHeight * devicePixelRatio);
    g.clearRect(0, 0, W, H);
    if (!graphCol || !store.columns[graphCol]) return;
    const span = dur || store.duration() || 1;
    const pts = store.range(graphCol, offset, span + offset, Math.floor(W));
    if (!pts.length) return;
    let min = Infinity;
    let max = -Infinity;
    for (const p of pts) if (typeof p.v === 'number') {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
    if (!Number.isFinite(min)) return;
    if (max === min) max = min + 1;
    g.strokeStyle = '#4fc3c7';
    g.lineWidth = devicePixelRatio;
    g.beginPath();
    let first = true;
    for (const p of pts) {
      if (typeof p.v !== 'number') continue;
      const x = ((p.t - offset) / span) * W;
      const y = H - ((p.v - min) / (max - min)) * (H - 4) - 2;
      if (first) g.moveTo(x, y);
      else g.lineTo(x, y);
      first = false;
    }
    g.stroke();
    // telemetry extent (for finding overlap when offset is way off)
    const tStart = ((0 - offset) / span) * W;
    const tEnd = ((store.duration() - offset) / span) * W;
    g.fillStyle = 'rgba(79,195,199,.12)';
    g.fillRect(Math.max(0, tStart), 0, Math.min(W, tEnd) - Math.max(0, tStart), H);
    // grey out the part a live proxy has not encoded yet (not seekable)
    if (limit < span - 0.5) {
      const lx = (limit / span) * W;
      g.fillStyle = 'rgba(128,128,128,.22)';
      g.fillRect(lx, 0, W - lx, H);
    }
    // playhead
    g.strokeStyle = '#f2a93b';
    g.lineWidth = 2 * devicePixelRatio;
    const px = (time / span) * W;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
  }, [graphCol, offset, time, dur, limit, store, storeVersion]);

  const onCanvasClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * (dur || store.duration()));
  };

  return (
    <div className="p-2 flex flex-col gap-1 bg-[var(--panel)] border-t border-[var(--border)]">
      <div className="flex items-center gap-2 text-sm">
        <button className="btn btn-xs" onClick={() => stepFrame(-1)} disabled={disabled} title={disabled ? 'Playback disabled until a preview proxy is created (Files tab)' : 'Previous frame (←)'}>
          ◀|
        </button>
        <button className="btn btn-xs w-16" onClick={toggle} disabled={disabled} title={disabled ? 'Playback disabled until a preview proxy is created (Files tab)' : 'Play/pause (space)'}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="btn btn-xs" onClick={() => stepFrame(1)} disabled={disabled} title={disabled ? 'Playback disabled until a preview proxy is created (Files tab)' : 'Next frame (→)'}>
          |▶
        </button>
        <span className="mono w-28">{fmtTime(time)}</span>
        <input type="range" min={0} max={dur || 0} step={0.001} value={time} onChange={(e) => seek(Number(e.target.value))} className="flex-1" disabled={!video || disabled} />
        {limit < dur - 0.5 && !disabled && <span className="text-xs hint">encoded to {fmtTime(limit)}</span>}
        {disabled && <span className="text-xs" style={{ color: 'var(--accent)' }}>playback locked — create a proxy in Files</span>}
        <span className="mono hint">{fmtTime(dur)}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="hint w-36">Telemetry offset (s)</span>
        {[-1, -0.1, -0.01].map((d) => (
          <button key={d} className="btn btn-xs mono" onClick={() => setOffset((o) => +(o + d).toFixed(3))}>
            {d}
          </button>
        ))}
        <input type="number" step={0.01} value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} className="input mono w-28" style={{ width: 110 }} />
        {[0.01, 0.1, 1].map((d) => (
          <button key={d} className="btn btn-xs mono" onClick={() => setOffset((o) => +(o + d).toFixed(3))}>
            +{d}
          </button>
        ))}
        <button
          className="btn btn-xs"
          title="Set offset so that telemetry starts at the current video frame"
          onClick={() => setOffset(+(-time).toFixed(3))}
        >
          Telemetry start = here
        </button>
        <span className="hint ml-auto">telemetry t = {(time + offset).toFixed(3)} s · keys: space, ←/→ frame, [ ] offset ±0.01 (shift: ±1)</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="hint w-36">Sync graph column</span>
        <input list="cols" className="input" style={{ width: 220 }} value={graphCol} onChange={(e) => setGraphCol(e.target.value)} placeholder="column name" />
        <datalist id="cols">{columnNames.map((c) => <option key={c} value={c} />)}</datalist>
        <span className="hint">Blue = telemetry column over the video timeline (moves with offset). Align a visible event (throttle-up, launch) with the same moment in the video.</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-14 rounded cursor-crosshair bg-[var(--bg)] border border-[var(--border)]" onClick={onCanvasClick} />
    </div>
  );
}
