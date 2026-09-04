import React, { useEffect, useRef, useState } from 'react';
import { fmtTime, toTele, toVideo } from '../time.js';
import TimeInput from './TimeInput.jsx';
import { ColumnsInput } from './WidgetsPanel.jsx';

const EMPTY_RANGE = { start: 0, end: null };
const HANDLE_HIT = 7; // px around an in/out marker that grabs it instead of scrubbing

export default function SyncBar({ video, videoRef, time, setTime, offset, setOffset, drift = 0, setDrift, store, storeVersion, columnNames, setStatus, disabled, seekLimit, range = EMPTY_RANGE, setRange, onAutoSync }) {
  const dur = video ? video.duration : 0;
  // while a live proxy is encoding, only the already-written part is seekable (and selectable for export)
  const limit = seekLimit != null ? Math.min(dur, seekLimit) : dur;
  const frame = 1 / (video && video.fps ? video.fps : 30);
  const sync = { offset, drift };
  const [playing, setPlaying] = useState(false);
  const [graphCol, setGraphCol] = useState('');
  const canvasRef = useRef(null);
  // bumped whenever the canvas changes size, so the sparkline effect below re-renders the bitmap at the
  // new resolution (otherwise the browser just scales the stale bitmap and the graph goes blurry)
  const [canvasSize, setCanvasSize] = useState(0);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCanvasSize((n) => n + 1));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // export range in video seconds; end === null means "to the end of the video"
  const inT = Math.max(0, Math.min(dur, range.start || 0));
  const outT = range.end == null ? dur : Math.max(inT, Math.min(dur, range.end));
  const fullRange = inT <= 0 && range.end == null;
  const rangeLocked = disabled || !dur;

  useEffect(() => {
    if (!graphCol && columnNames.length) {
      const pick = columnNames.find((c) => /throttle|rcCommand\[3\]/i.test(c)) || columnNames[0];
      setGraphCol(pick);
    }
  }, [columnNames, graphCol]);

  // keep the play/pause button in sync with what the element actually does — a source swap
  // (proxy finished, live proxy started) implicitly stops playback without a 'pause' event
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    v.addEventListener('play', on);
    v.addEventListener('pause', off);
    v.addEventListener('emptied', off); // fires when the src attribute is swapped
    return () => {
      v.removeEventListener('play', on);
      v.removeEventListener('pause', off);
      v.removeEventListener('emptied', off);
    };
  }, [videoRef, video]);

  const seek = (t) => {
    if (disabled) return;
    const v = videoRef.current;
    t = Math.max(0, Math.min(limit, t));
    if (v) v.currentTime = t;
    setTime(t);
  };

  // move the in or out point; both are capped to the encoded part exactly like seeking,
  // and they keep at least one frame between them
  const setPoint = (which, t) => {
    if (rangeLocked || !setRange) return;
    t = Math.max(0, Math.min(limit, t));
    setRange((r) => {
      let start = Math.max(0, (r && r.start) || 0);
      let end = r && r.end != null ? Math.min(dur, r.end) : dur;
      if (which === 'in') start = Math.max(0, Math.min(t, end - frame));
      else end = Math.min(dur, Math.max(t, start + frame));
      return { start: +start.toFixed(3), end: end >= dur - frame / 2 ? null : +end.toFixed(3) };
    });
  };
  const resetRange = () => setRange && setRange(EMPTY_RANGE);

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

  // keyboard: space play, arrows frame step, shift+arrows = 1s, [ ] adjust offset, I / O export in/out point
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
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'i' || e.key === 'I')) setPoint('in', time);
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'o' || e.key === 'O')) setPoint('out', time);
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
    const span = dur || store.duration() || 1;
    // the trace needs telemetry; the range markers and the playhead below are drawn even without it
    const pts = graphCol && store.columns[graphCol] ? store.range(graphCol, toTele(0, sync), toTele(span, sync), Math.floor(W)) : [];
    let min = Infinity;
    let max = -Infinity;
    for (const p of pts) if (typeof p.v === 'number') {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
    if (Number.isFinite(min)) {
      if (max === min) max = min + 1;
      g.strokeStyle = '#4fc3c7';
      g.lineWidth = devicePixelRatio;
      g.beginPath();
      let first = true;
      for (const p of pts) {
        if (typeof p.v !== 'number') continue;
        const x = (toVideo(p.t, sync) / span) * W;
        const y = H - ((p.v - min) / (max - min)) * (H - 4) - 2;
        if (first) g.moveTo(x, y);
        else g.lineTo(x, y);
        first = false;
      }
      g.stroke();
      // telemetry extent (for finding overlap when offset is way off)
      const tStart = (toVideo(0, sync) / span) * W;
      const tEnd = (toVideo(store.duration(), sync) / span) * W;
      g.fillStyle = 'rgba(79,195,199,.12)';
      g.fillRect(Math.max(0, tStart), 0, Math.min(W, tEnd) - Math.max(0, tStart), H);
    }
    // legend: which column the trace is (faint teal, clear of the in-flag in the corner)
    if (graphCol) {
      g.fillStyle = Number.isFinite(min) ? 'rgba(79,195,199,.7)' : 'rgba(79,195,199,.35)';
      g.font = `500 ${10 * devicePixelRatio}px "IBM Plex Mono", ui-monospace, monospace`;
      g.textBaseline = 'top';
      g.fillText(graphCol, 11 * devicePixelRatio, 3 * devicePixelRatio);
    }
    // grey out the part a live proxy has not encoded yet (not seekable)
    if (limit < span - 0.5) {
      const lx = (limit / span) * W;
      g.fillStyle = 'rgba(128,128,128,.22)';
      g.fillRect(lx, 0, W - lx, H);
    }
    // export range: dim what will not be exported, amber in/out markers with a flag at the top
    if (dur) {
      const ix = (inT / span) * W;
      const ox = (outT / span) * W;
      if (!fullRange) {
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.fillRect(0, 0, ix, H);
        g.fillRect(ox, 0, W - ox, H);
      }
      const dpr = devicePixelRatio;
      const flagW = 7 * dpr;
      const flagH = 9 * dpr;
      g.fillStyle = fullRange ? 'rgba(242,169,59,.55)' : '#f2a93b';
      g.fillRect(Math.max(0, ix - dpr), 0, 2 * dpr, H);
      g.fillRect(Math.min(W - 2 * dpr, ox - dpr), 0, 2 * dpr, H);
      g.beginPath();
      g.moveTo(ix, 0);
      g.lineTo(ix + flagW, 0);
      g.lineTo(ix, flagH);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(ox, 0);
      g.lineTo(ox - flagW, 0);
      g.lineTo(ox, flagH);
      g.closePath();
      g.fill();
    }
    // playhead
    g.strokeStyle = '#f2a93b';
    g.lineWidth = 2 * devicePixelRatio;
    const px = (time / span) * W;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
  }, [graphCol, offset, drift, time, dur, limit, inT, outT, fullRange, store, storeVersion, canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // the timeline canvas is the scrubber: click or drag anywhere to seek, drag an in/out marker to move it
  const dragRef = useRef(null); // null | 'scrub' | 'in' | 'out'
  const timeFromEvent = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * (dur || store.duration());
  };
  const hitHandle = (e) => {
    if (rangeLocked) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const dIn = Math.abs(px - (inT / dur) * r.width);
    const dOut = Math.abs(px - (outT / dur) * r.width);
    if (dIn <= HANDLE_HIT && dIn <= dOut) return 'in';
    if (dOut <= HANDLE_HIT) return 'out';
    return null;
  };
  const applyDrag = (e) => {
    const t = timeFromEvent(e);
    if (dragRef.current === 'scrub') seek(t);
    else {
      // moving a marker also parks the playhead on it so the exact frame is visible in the preview
      const v = videoRef.current;
      if (v) v.pause();
      setPlaying(false);
      setPoint(dragRef.current, t);
      seek(t);
    }
  };
  const onTimelineDown = (e) => {
    if (disabled) return;
    dragRef.current = hitHandle(e) || 'scrub';
    e.currentTarget.setPointerCapture(e.pointerId);
    applyDrag(e);
  };
  const onTimelineMove = (e) => {
    if (dragRef.current) applyDrag(e);
    else e.currentTarget.style.cursor = hitHandle(e) ? 'ew-resize' : '';
  };
  const onTimelineUp = () => (dragRef.current = null);

  const lockTitle = disabled ? 'Playback disabled until a preview proxy is created (Files tab)' : undefined;
  const stepOffset = (d) => setOffset((o) => +(o + d).toFixed(3));
  const stepDrift = (d) => setDrift && setDrift((x) => +(x + d).toFixed(3));

  // the two drawers under the timeline are closed by default; opening one closes the other so that
  // whoever is syncing never has to look at the export range and vice versa
  const [drawer, setDrawer] = useState(null); // null | 'sync' | 'range'
  const toggleDrawer = (k) => setDrawer((d) => (d === k ? null : k));

  // trace column picker lives behind the gear in the graph corner
  const [tracePickerOpen, setTracePickerOpen] = useState(false);
  const tracePopRef = useRef(null);
  useEffect(() => {
    if (!tracePickerOpen) return;
    const onDown = (e) => {
      if (tracePopRef.current && !tracePopRef.current.contains(e.target)) setTracePickerOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setTracePickerOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [tracePickerOpen]);

  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(n === 0 ? 0 : 2);
  const syncNote = `${sign(offset)} s` + (drift ? ` · ${sign(drift)} ms/s` : '');
  const rangeNote = !dur ? '—' : fullRange ? 'whole video' : fmtTime(inT) + ' → ' + fmtTime(outT) + ' · ' + fmtTime(outT - inT);

  return (
    <div className="p-2 flex flex-col gap-2 bg-[var(--panel)] border-t border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-transport" onClick={() => stepFrame(-1)} disabled={disabled} title={lockTitle || 'Previous frame (←, shift: −1 s)'}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="2" y="2.5" width="2" height="11" />
              <path d="M13.5 2.5v11L5 8z" />
            </svg>
          </button>
          <button className="btn-transport primary" onClick={toggle} disabled={disabled} title={lockTitle || 'Play / pause (space)'}>
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2.5" width="3.5" height="11" />
                <rect x="9.5" y="2.5" width="3.5" height="11" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M4 2.5v11l9.5-5.5z" />
              </svg>
            )}
          </button>
          <button className="btn-transport" onClick={() => stepFrame(1)} disabled={disabled} title={lockTitle || 'Next frame (→, shift: +1 s)'}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M2.5 2.5v11L11 8z" />
              <rect x="12" y="2.5" width="2" height="11" />
            </svg>
          </button>
        </div>
        <div className="timecode">
          <span className="tc-main">{fmtTime(time)}</span>
          <span className="tc-sub">/ {fmtTime(dur)}</span>
        </div>
        <div className="graph-well flex-1 min-w-0" style={{ height: 64 }}>
          <div className="flex-1 min-w-0 h-full" title="Teal trace = telemetry column over the video timeline (moves with offset). Click or drag to seek; drag the amber markers to set the export range.">
            <canvas ref={canvasRef} className="timeline" onPointerDown={onTimelineDown} onPointerMove={onTimelineMove} onPointerUp={onTimelineUp} onPointerCancel={onTimelineUp} />
          </div>
          <div className="graph-rail" ref={tracePopRef}>
            <button className={'gear' + (tracePickerOpen ? ' on' : '')} onClick={() => setTracePickerOpen((o) => !o)} aria-expanded={tracePickerOpen} aria-label="Trace column" title={'Trace column: ' + (graphCol || 'none')}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="8" cy="8" r="2.4" />
                <path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
              </svg>
            </button>
            {tracePickerOpen && (
              <div className="popover" role="dialog" aria-label="Trace column">
                <div className="popover-head">
                  <span className="bay-tick" style={{ background: 'var(--tele)' }} />
                  Trace
                  <span className="bay-note">{columnNames.length ? columnNames.length + ' columns' : 'no telemetry'}</span>
                </div>
                <ColumnsInput single value={graphCol} onChange={setGraphCol} columnNames={columnNames} style={{ width: '100%', padding: '3px 8px', '--input-color': 'var(--tele)' }} title="Telemetry column drawn on the timeline" />
                <div className="hint" style={{ marginTop: 6 }}>
                  Pick a column with a visible event — throttle, launch, a hard turn — and line it up with the same moment in the footage.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* rack strip: two drawers, headers side by side, at most one open */}
      <div className="rack">
        <div className="rack-heads">
          <button className={'rack-tab rack-mixed' + (drawer === 'sync' ? ' open' : '')} onClick={() => toggleDrawer('sync')} aria-expanded={drawer === 'sync'}>
            <span className="bay-tick" />
            <svg className="rack-chev" width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5l4 3.5-4 3.5z" />
            </svg>
            Sync
            <span className="rack-note" title="Telemetry offset · clock drift">{syncNote}</span>
          </button>
          <button className={'rack-tab rack-amber' + (drawer === 'range' ? ' open' : '')} onClick={() => toggleDrawer('range')} aria-expanded={drawer === 'range'}>
            <span className="bay-tick" />
            <svg className="rack-chev" width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5l4 3.5-4 3.5z" />
            </svg>
            Export range
            <span className={'rack-note' + (fullRange ? '' : ' lit')} title="Exported part of the video">{rangeNote}</span>
          </button>
          <div className="rack-tail">
            {limit < dur - 0.5 && !disabled && <span className="hint" style={{ whiteSpace: 'nowrap' }}>encoded to {fmtTime(limit)}</span>}
            {disabled && (
              <span className="chip chip-warn" style={{ whiteSpace: 'nowrap' }}>
                playback locked — create a proxy in Files
              </span>
            )}
            <span className="hint rack-keys" style={{ color: 'var(--faint)', whiteSpace: 'nowrap' }}>space · ←/→ · [ ] · I/O</span>
          </div>
        </div>

        {drawer === 'sync' && (
          <div className="rack-body flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-3">
              <span className="bar-label">Offset</span>
              <div className="seg" style={{ flex: 'none' }}>
                {[-1, -0.1, -0.01].map((d) => (
                  <button key={d} onClick={() => stepOffset(d)} title={`Shift telemetry ${d} s`}>
                    {d}
                  </button>
                ))}
                <input type="number" step={0.01} value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} title="Telemetry offset in seconds (added to video time)" />
                {[0.01, 0.1, 1].map((d) => (
                  <button key={d} onClick={() => stepOffset(d)} title={`Shift telemetry +${d} s`}>
                    +{d}
                  </button>
                ))}
              </div>
              <button className="btn btn-xs" title="Set offset so that telemetry starts at the current video frame" onClick={() => setOffset(+(-time).toFixed(3))}>
                Start = here
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="bar-label" title="Clock drift between camera and flight controller: milliseconds of telemetry gained per second of video (telemetry = video × (1 + drift/1000) + offset)">
                Drift
              </span>
              <div className="seg" style={{ flex: 'none' }} title="ms of telemetry per second of video — 0.5 means the log runs ahead by half a millisecond every second">
                {[-0.1, -0.01].map((d) => (
                  <button key={d} onClick={() => stepDrift(d)} title={`Drift ${d} ms/s`}>
                    {d}
                  </button>
                ))}
                <input type="number" step={0.01} value={drift} style={{ width: 72 }} onChange={(e) => setDrift && setDrift(Number(e.target.value) || 0)} title="Clock drift in ms/s (Auto sync measures it from several windows)" />
                {[0.01, 0.1].map((d) => (
                  <button key={d} onClick={() => stepDrift(d)} title={`Drift +${d} ms/s`}>
                    +{d}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-xs btn-primary ml-auto" onClick={onAutoSync} disabled={!video || !columnNames.length} title="Find offset and drift automatically: the camera rotation seen in a few seconds of footage is matched against the gyro log">
              Auto sync…
            </button>
          </div>
        )}

        {drawer === 'range' && (
          <div className="rack-body flex items-center gap-3 text-xs flex-wrap">
            <button className="btn btn-xs" onClick={() => setPoint('in', time)} disabled={rangeLocked} title="Export from the current frame (I)">
              In = here
            </button>
            <TimeInput value={inT} onCommit={(t) => setPoint('in', t)} disabled={rangeLocked} title="Export start — m:ss.sss or seconds" />
            <span className="hint">to</span>
            <TimeInput value={outT} onCommit={(t) => setPoint('out', t)} disabled={rangeLocked} title="Export end — m:ss.sss or seconds" />
            <button className="btn btn-xs" onClick={() => setPoint('out', time)} disabled={rangeLocked} title="Export up to the current frame (O)">
              Out = here
            </button>
            {dur > 0 && (
              <span className={'chip mono ' + (fullRange ? '' : 'chip-accent')} style={{ whiteSpace: 'nowrap' }} title="Length of the exported part">
                {fullRange ? 'whole video' : fmtTime(outT - inT) + ' of ' + fmtTime(dur)}
              </span>
            )}
            {!fullRange && (
              <button className="btn btn-xs" onClick={resetRange} title="Export the whole video again">
                Whole video
              </button>
            )}
            {limit < dur - 0.5 && !rangeLocked && <span className="hint">range limited to the encoded part</span>}
            <span className="hint ml-auto" style={{ color: 'var(--faint)' }}>drag the amber flags on the timeline</span>
          </div>
        )}
      </div>
    </div>
  );
}
