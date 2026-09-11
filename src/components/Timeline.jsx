import React, { useEffect, useRef, useState } from 'react';
import { fmtTime, toTele, toVideo } from '../time.js';
import { uid } from '../widgetRuntime.js';
import { ColumnsInput } from './ColumnsInput.jsx';
import Icon from './Icon.jsx';
import { isTyping } from './player.js';

const EMPTY_RANGE = { start: 0, end: null };
const HANDLE_HIT = 7; // px around an in/out marker that grabs it instead of scrubbing
const SNAP_PX = 9; // px around a named marker that pulls the playhead / a range flag onto it
const TRACE_KEY = 'telemetry-overlay.traceColumn';
const SNAP_KEY = 'telemetry-overlay.snapMarkers';

/**
 * The timeline canvas is the scrubber: click or drag to seek. Optionally draws one telemetry
 * column as a teal trace (trace = true, with the gear to pick the column) and the export range
 * as amber in/out flags (rangeMode = 'show' | 'edit'; 'edit' also drags the flags and binds I / O).
 * Named markers (green, `markers` = [{id, t, name}] in video seconds) sit on top; the flag button
 * adds one at the playhead, its chip renames / deletes it, and with the magnet on, dragging the
 * playhead or a range flag close to a marker snaps onto it.
 */
export default function Timeline({ player, store, storeVersion, columnNames, sync, range = EMPTY_RANGE, setRange, trace = false, rangeMode = 'none', markers = [], setMarkers, height = 72 }) {
  const { video, dur, limit, frame, time, seek, pause, disabled } = player;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
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

  // snap to markers: remembered between sessions
  const [snap, setSnapState] = useState(() => {
    try {
      return localStorage.getItem(SNAP_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const setSnap = (v) => {
    setSnapState(v);
    try {
      localStorage.setItem(SNAP_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const showRange = rangeMode !== 'none' && dur > 0;
  const editRange = rangeMode === 'edit' && !!setRange;
  const inT = Math.max(0, Math.min(dur, range.start || 0));
  const outT = range.end == null ? dur : Math.max(inT, Math.min(dur, range.end));
  const fullRange = inT <= 0 && range.end == null;
  const rangeLocked = disabled || !dur || !editRange;
  const span = dur || store.duration() || 1;
  const canMark = !!setMarkers && dur > 0 && !disabled;

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

  // ---- markers ----
  const [editId, setEditId] = useState(null); // marker whose popover is open
  const nameRef = useRef(null);
  const addMarker = () => {
    if (!canMark) return;
    const m = { id: uid(), t: +time.toFixed(3), name: 'Marker ' + (markers.length + 1) };
    setMarkers((ms) => [...(ms || []), m].sort((a, b) => a.t - b.t));
    setEditId(m.id);
  };
  const updateMarker = (id, patch) => setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMarker = (id) => {
    setMarkers((ms) => ms.filter((m) => m.id !== id));
    setEditId(null);
  };
  useEffect(() => {
    if (!editId) return undefined;
    const el = nameRef.current;
    if (el) {
      el.focus();
      el.select();
    }
    const onDown = (e) => {
      const pop = wrapRef.current && wrapRef.current.querySelector('.marker-pop');
      if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest('.tl-chip'))) setEditId(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setEditId(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [editId]);
  // pull a time onto the nearest marker when it is within SNAP_PX on screen
  const snapTime = (t, widthPx) => {
    if (!snap || !markers.length || !widthPx) return t;
    const tol = (SNAP_PX / widthPx) * span;
    let best = null;
    for (const m of markers) {
      const d = Math.abs(m.t - t);
      if (d <= tol && (!best || d < best.d)) best = { d, t: m.t };
    }
    return best ? best.t : t;
  };

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    const dpr = devicePixelRatio;
    const W = (c.width = c.clientWidth * dpr);
    const H = (c.height = c.clientHeight * dpr);
    g.clearRect(0, 0, W, H);
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
      g.textBaseline = 'bottom';
      g.fillText(graphCol, 12 * dpr, H - 5 * dpr);
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
    // named markers: thin green lines (the label chips are HTML over the canvas)
    g.strokeStyle = 'rgba(142,215,162,.8)';
    g.lineWidth = dpr;
    for (const m of markers) {
      const x = Math.round((m.t / span) * W) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    // playhead
    g.strokeStyle = '#ffb95c';
    g.lineWidth = 2 * dpr;
    const px = (time / span) * W;
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, H);
    g.stroke();
  }, [graphCol, trace, sync, time, dur, limit, inT, outT, fullRange, showRange, markers, store, storeVersion, canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // pointer: scrub, or drag an in/out marker
  const dragRef = useRef(null); // null | 'scrub' | 'in' | 'out'
  const timeFromEvent = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return snapTime(((e.clientX - r.left) / r.width) * span, r.width);
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
    markers.length ? 'Green lines = your markers; click a label to rename or delete it.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const editing = editId ? markers.find((m) => m.id === editId) : null;
  const wrapW = wrapRef.current ? wrapRef.current.clientWidth : 0;

  return (
    <div className="graph-well flex-1 min-w-0" style={{ height }}>
      <div ref={wrapRef} className="tl-wrap flex-1 min-w-0" title={tip}>
        <canvas ref={canvasRef} className="timeline" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {markers.map((m) => (
          <div key={m.id} className="tl-marker" style={{ left: `${(m.t / span) * 100}%` }}>
            <span
              className={'tl-chip' + (editId === m.id ? ' on' : '')}
              title={`${m.name || 'Marker'} · ${fmtTime(m.t)} — click to jump here and rename`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                pause();
                seek(m.t);
                setEditId(m.id);
              }}
            >
              {m.name || fmtTime(m.t)}
            </span>
          </div>
        ))}
        {editing && (
          <div className="marker-pop" style={{ left: Math.max(0, Math.min((editing.t / span) * wrapW - 130, Math.max(0, wrapW - 260))) }} onPointerDown={(e) => e.stopPropagation()}>
            <div className="popover-head">
              <Icon name="flag" />
              Marker
              <span className="card-meta">{fmtTime(editing.t)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={nameRef}
                className="input input-sm flex-1"
                value={editing.name}
                placeholder="name"
                spellCheck={false}
                onChange={(e) => updateMarker(editing.id, { name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditId(null);
                }}
              />
              <button className="btn btn-icon sm" onClick={() => updateMarker(editing.id, { t: +time.toFixed(3) })} title="Move the marker to the playhead">
                <Icon name="in" />
              </button>
              <button className="btn btn-icon sm btn-danger" onClick={() => removeMarker(editing.id)} title="Delete this marker">
                <Icon name="delete" />
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="graph-rail" ref={popRef}>
        {trace && (
          <button className={'btn btn-icon sm' + (pickerOpen ? ' on' : '')} onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen} aria-label="Trace column" title={'Trace column: ' + (graphCol || 'none')}>
            <Icon name="gear" />
          </button>
        )}
        {setMarkers && (
          <>
            <button className="btn btn-icon sm" onClick={addMarker} disabled={!canMark} title="Add a named marker at the playhead">
              <Icon name="flag" />
            </button>
            <button className={'btn btn-icon sm' + (snap ? ' on' : '')} onClick={() => setSnap(!snap)} aria-pressed={snap} disabled={!markers.length} title={snap ? 'Snap to markers: on — dragging the playhead or a range flag near a marker lands on it' : 'Snap to markers: off'}>
              <Icon name="magnet" />
            </button>
          </>
        )}
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
    </div>
  );
}

export { EMPTY_RANGE };
