import React, { useEffect, useRef, useState } from 'react';
import { toTele, toVideo } from '../time.js';
import { ColumnsInput } from './ColumnsInput.jsx';
import Icon from './Icon.jsx';
import { isTyping } from './player.js';

const EMPTY_RANGE = { start: 0, end: null };
const HANDLE_HIT = 7; // px around an in/out marker that grabs it instead of scrubbing
const TRACE_KEY = 'telemetry-overlay.traceColumn';

/**
 * The timeline canvas is the scrubber: click or drag to seek. Optionally draws one telemetry
 * column as a teal trace (trace = true, with the gear to pick the column) and the export range
 * as amber in/out flags (range = 'show' | 'edit'; 'edit' also drags the flags and binds I / O).
 */
export default function Timeline({ player, store, storeVersion, columnNames, sync, range = EMPTY_RANGE, setRange, trace = false, rangeMode = 'none', height = 72 }) {
  const { video, dur, limit, frame, time, seek, pause, disabled } = player;
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState(0);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCanvasSize((n) => n + 1));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const [graphCol, setGraphColState] = useState(() => {
    try {
      return localStorage.getItem(TRACE_KEY) || '';
    } catch {
      return '';
    }
  });
  const setGraphCol = (c) => {
    setGraphColState(c);
    try {
      localStorage.setItem(TRACE_KEY, c);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!columnNames.length) return;
    if (!graphCol || !columnNames.includes(graphCol)) {
      const pick = columnNames.find((c) => /throttle|rcCommand\[3\]/i.test(c)) || columnNames[0];
      setGraphColState(pick);
    }
  }, [columnNames]); // eslint-disable-line react-hooks/exhaustive-deps

  const showRange = rangeMode !== 'none' && dur > 0;
  const editRange = rangeMode === 'edit' && !!setRange;
  const inT = Math.max(0, Math.min(dur, range.start || 0));
  const outT = range.end == null ? dur : Math.max(inT, Math.min(dur, range.end));
  const fullRange = inT <= 0 && range.end == null;
  const rangeLocked = disabled || !dur || !editRange;

  // move the in or out point; both are capped to the encoded part exactly like seeking,
  // and they keep at least one frame between them
  const setPoint = (which, t) => {
    if (rangeLocked) return;
    t = Math.max(0, Math.min(limit, t));
    setRange((r) => {
      let start = Math.max(0, (r && r.start) || 0);
      let end = r && r.end != null ? Math.min(dur, r.end) : dur;
      if (which === 'in') start = Math.max(0, Math.min(t, end - frame));
      else end = Math.min(dur, Math.max(t, start + frame));
      return { start: +start.toFixed(3), end: end >= dur - frame / 2 ? null : +end.toFixed(3) };
    });
  };
  // I / O keys set the in / out point at the playhead (only while the range is editable = export step)
  useEffect(() => {
    if (!editRange) return undefined;
    const h = (e) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'i' || e.key === 'I') setPoint('in', time);
      else if (e.key === 'o' || e.key === 'O') setPoint('out', time);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    const dpr = devicePixelRatio;
    const W = (c.width = c.clientWidth * dpr);
    const H = (c.height = c.clientHeight * dpr);
    g.clearRect(0, 0, W, H);
    const span = dur || store.duration() || 1;
    const pts = trace && graphCol && store.columns[graphCol] ? store.range(graphCol, toTele(0, sync), toTele(span, sync), Math.floor(W)) : [];
    let min = Infinity;
    let max = -Infinity;
    for (const p of pts)
      if (typeof p.v === 'number') {
        if (p.v < min) min = p.v;
        if (p.v > max) max = p.v;
      }
    if (Number.isFinite(min)) {
      if (max === min) max = min + 1;
      // telemetry extent (for finding overlap when offset is way off)
      const tStart = (toVideo(0, sync) / span) * W;
      const tEnd = (toVideo(store.duration(), sync) / span) * W;
      g.fillStyle = 'rgba(95,216,220,.1)';
      g.fillRect(Math.max(0, tStart), 0, Math.min(W, tEnd) - Math.max(0, tStart), H);
      g.strokeStyle = '#5fd8dc';
      g.lineWidth = 1.2 * dpr;
      g.lineJoin = 'round';
      g.beginPath();
      let first = true;
      for (const p of pts) {
        if (typeof p.v !== 'number') continue;
        const x = (toVideo(p.t, sync) / span) * W;
        const y = H - ((p.v - min) / (max - min)) * (H - 8 * dpr) - 4 * dpr;
        if (first) g.moveTo(x, y);
        else g.lineTo(x, y);
        first = false;
      }
      g.stroke();
    }
    if (trace && graphCol) {
      g.fillStyle = Number.isFinite(min) ? 'rgba(95,216,220,.75)' : 'rgba(95,216,220,.35)';
      g.font = `500 ${10.5 * dpr}px "Roboto Mono", ui-monospace, monospace`;
      g.textBaseline = 'top';
      g.fillText(graphCol, 12 * dpr, 5 * dpr);
    }
    // grey out the part a live proxy has not encoded yet (not seekable)
    if (limit < span - 0.5) {
      const lx = (limit / span) * W;
      g.fillStyle = 'rgba(128,128,128,.22)';
      g.fillRect(lx, 0, W - lx, H);
    }
    // export range: dim what will not be exported, amber in/out markers with a flag at the top
    if (showRange) {
      const ix = (inT / span) * W;
      const ox = (outT / span) * W;
      if (!fullRange) {
        g.fillStyle = 'rgba(0,0,0,.5)';
        g.fillRect(0, 0, ix, H);
        g.fillRect(ox, 0, W - ox, H);
      }
      const flagW = 8 * dpr;
      const flagH = 10 * dpr;
      g.fillStyle = fullRange ? 'rgba(255,185,92,.45)' : '#ffb95c';
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
    g.strokeStyle = '#ffb95c';
    g.lineWidth = 2 * dpr;
    const px = (time / span) * W;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
  }, [graphCol, trace, sync, time, dur, limit, inT, outT, fullRange, showRange, store, storeVersion, canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // pointer: scrub, or drag an in/out marker
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
      pause();
      setPoint(dragRef.current, t);
      seek(t);
    }
  };
  const onDown = (e) => {
    if (disabled) return;
    dragRef.current = hitHandle(e) || 'scrub';
    e.currentTarget.setPointerCapture(e.pointerId);
    applyDrag(e);
  };
  const onMove = (e) => {
    if (dragRef.current) applyDrag(e);
    else e.currentTarget.style.cursor = hitHandle(e) ? 'ew-resize' : '';
  };
  const onUp = () => (dragRef.current = null);

  // trace column picker behind the gear
  const [pickerOpen, setPickerOpen] = useState(false);
  const popRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onDocDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setPickerOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setPickerOpen(false);
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const tip = [
    'Click or drag to seek.',
    trace ? 'Teal trace = telemetry column over the video timeline (moves with the offset).' : '',
    editRange ? 'Drag the amber flags to set the export range (I / O keys at the playhead).' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="graph-well flex-1 min-w-0" style={{ height }}>
      <div className="flex-1 min-w-0 h-full" title={tip}>
        <canvas ref={canvasRef} className="timeline" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      </div>
      {trace && (
        <div className="graph-rail" ref={popRef}>
          <button className={'btn btn-icon sm' + (pickerOpen ? ' on' : '')} onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen} aria-label="Trace column" title={'Trace column: ' + (graphCol || 'none')}>
            <Icon name="gear" />
          </button>
          {pickerOpen && (
            <div className="popover" role="dialog" aria-label="Trace column">
              <div className="popover-head">
                <Icon name="telemetry" />
                Trace column
                <span className="card-meta">{columnNames.length ? columnNames.length + ' columns' : 'no telemetry'}</span>
              </div>
              <ColumnsInput single value={graphCol} onChange={setGraphCol} columnNames={columnNames} style={{ width: '100%', '--input-color': 'var(--secondary)' }} title="Telemetry column drawn on the timeline" />
              <div className="hint" style={{ marginTop: 8 }}>
                Pick a column with a visible event — throttle, launch, a hard turn — and line it up with the same moment in the footage.
              </div>
            </div>
          )}
        </div>
      )}
      {video && !fullRange && showRange && null}
    </div>
  );
}

export { EMPTY_RANGE };
