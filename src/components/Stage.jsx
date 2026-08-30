import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderWidget, widgetBoxStyle } from '../widgetRuntime.js';

function toFileUrl(p) {
  return 'file:///' + p.replace(/\\/g, '/').replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
}

export default function Stage({ video, videoRef, widgets, store, storeVersion, offset, time, setTime, selectedId, setSelectedId, updateWidget, editMode, grid, setStatus, onOpenEditor }) {
  const gridSize = grid && grid.size > 1 ? grid.size : 1;
  // snap to grid unless disabled; holding Alt while dragging temporarily disables snapping
  const snap = (v, alt) => (grid && grid.snap && !alt ? Math.round(v / gridSize) * gridSize : Math.round(v));
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const vw = video ? video.width : 1280;
  const vh = video ? video.height : 720;

  // fit video into the available area
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setScale(Math.min((r.width - 16) / vw, (r.height - 16) / vh));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [vw, vh]);

  // rAF loop reading the video clock
  useEffect(() => {
    let raf;
    const loop = () => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) setTime(v.currentTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, setTime]);

  // re-render when async widget assets (map tiles) arrive while paused
  const [assetVersion, setAssetVersion] = useState(0);
  useEffect(() => {
    const h = () => setAssetVersion((v) => v + 1);
    window.addEventListener('widget-assets-loaded', h);
    return () => window.removeEventListener('widget-assets-loaded', h);
  }, []);

  const rendered = useMemo(() => widgets.map((w) => ({ w, out: renderWidget(w, store, time, offset) })), [widgets, store, time, offset, storeVersion, assetVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- drag / resize ----
  const dragRef = useRef(null);
  const onPointerDown = (e, w, mode) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(w.id);
    dragRef.current = { id: w.id, mode, sx: e.clientX, sy: e.clientY, x: w.x, y: w.y, w: w.w, h: w.h };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.sx) / scale;
      const dy = (ev.clientY - d.sy) / scale;
      if (d.mode === 'move') updateWidget(d.id, { x: snap(d.x + dx, ev.altKey), y: snap(d.y + dy, ev.altKey) });
      else updateWidget(d.id, { w: Math.max(gridSize, snap(d.w + dx, ev.altKey)), h: Math.max(gridSize, snap(d.h + dy, ev.altKey)) });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div ref={wrapRef} className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg)] overflow-hidden relative" onPointerDown={() => setSelectedId(null)}>
      <div style={{ width: vw * scale, height: vh * scale, position: 'relative' }}>
        <div
          style={{
            width: vw,
            height: vh,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
            background: '#111',
            overflow: 'hidden',
            color: '#fff',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          {video ? (
            <video
              ref={videoRef}
              src={toFileUrl(video.proxy || video.path)}
              style={{ width: vw, height: vh, display: 'block', objectFit: 'fill' }}
              onSeeked={(e) => setTime(e.target.currentTime)}
              onPause={(e) => setTime(e.target.currentTime)}
              onError={(e) => {
                const err = e.target.error;
                setStatus('Video playback error: ' + (err ? err.message || 'code ' + err.code : 'unknown') + ' — create a preview proxy in the Files tab.');
              }}
              onStalled={() => setStatus('Video decoding is stalling (too heavy for the GPU decoder) — create a preview proxy in the Files tab.')}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-2xl text-[var(--faint)]">Open a video to start</div>
          )}
          {editMode && grid && grid.show && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage: 'linear-gradient(to right, rgba(242,169,59,.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(242,169,59,.22) 1px, transparent 1px)',
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}
          {rendered.map(({ w, out }) =>
            w.visible === false ? null : (
              <div
                key={w.id}
                style={{
                  ...styleObj(widgetBoxStyle(w)),
                  outline: editMode ? (selectedId === w.id ? '2px solid #f2a93b' : '1px dashed rgba(255,255,255,.35)') : 'none',
                  cursor: editMode ? 'move' : 'default',
                }}
                onPointerDown={(e) => onPointerDown(e, w, 'move')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (onOpenEditor) onOpenEditor(w.id);
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: out.html }} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
                {editMode && (
                  <div
                    onPointerDown={(e) => onPointerDown(e, w, 'resize')}
                    style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, background: '#f2a93b', cursor: 'nwse-resize', borderRadius: 2 }}
                  />
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function styleObj(css) {
  const o = {};
  for (const part of css.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[k] = part.slice(i + 1).trim();
  }
  return o;
}
