import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderWidget, widgetBoxStyle, widgetDomId } from '../widgetRuntime.js';
import { startLiveProxy } from '../liveProxy.js';
import ShadowHtml from './ShadowHtml.jsx';

function toFileUrl(p) {
  return 'file:///' + p.replace(/\\/g, '/').replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
}

// codec string for the live-proxy SourceBuffer; Chromium matches the codec family, not the exact profile
function liveProxyMime(video) {
  if (video.liveCodec === 'hevc') {
    const tenBit = video.pixFmt && video.pixFmt.includes('10');
    return `video/mp4; codecs="${tenBit ? 'hvc1.2.4.L186.B0' : 'hvc1.1.6.L186.B0'}"`;
  }
  return 'video/mp4; codecs="avc1.640033"';
}

export default function Stage({ video, videoRef, widgets, store, storeVersion, sync, time, setTime, selectedId, setSelectedId, updateWidget, editMode, grid, lt, setStatus, onOpenEditor, empty, range }) {
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

  // ---- live proxy: play the proxy through MSE while ffmpeg is still writing it ----
  const live = !!(video && video.liveProxy && !video.proxy);
  const timeKeepRef = useRef(0); // last playhead position, survives source swaps
  timeKeepRef.current = time;
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !live) return;
    const h = startLiveProxy(v, video.liveProxy, liveProxyMime(video), video.duration, timeKeepRef.current);
    if (resumeRef.current) {
      resumeRef.current = false;
      v.play().catch(() => {});
    }
    return () => h.stop();
  }, [live, video && video.liveProxy]); // eslint-disable-line react-hooks/exhaustive-deps
  // restore the playhead when the source swaps for the same video (original → live proxy → finished proxy)
  const srcUrl = video && !live ? toFileUrl(video.proxy || video.path) : null;
  const lastSrcRef = useRef({ path: video && video.path, src: srcUrl });
  const resumeRef = useRef(false);
  {
    // render phase = before the src attribute changes in the DOM: remember whether the video
    // was playing, so the swap (which implicitly pauses the element) can resume it
    const v = videoRef.current;
    const prev = lastSrcRef.current;
    if (v && video && prev.path === video.path && prev.src !== srcUrl) resumeRef.current = !v.paused && !v.ended;
  }
  useEffect(() => {
    const v = videoRef.current;
    const prev = lastSrcRef.current;
    const path = video && video.path;
    if (v && srcUrl && path && prev.path === path && prev.src !== srcUrl) {
      v.currentTime = timeKeepRef.current;
      if (resumeRef.current) {
        resumeRef.current = false;
        v.play().catch(() => {});
      }
    }
    lastSrcRef.current = { path, src: srcUrl };
  }, [srcUrl, video && video.path]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const env = useMemo(() => ({ range, duration: video ? video.duration : 0 }), [range, video]);
  const rendered = useMemo(() => widgets.map((w) => ({ w, out: renderWidget(w, store, time, sync, 'shadow', env) })), [widgets, store, time, sync, storeVersion, assetVersion, env]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // screen px → video px (stage scale) → layout units (lt)
      const dx = (ev.clientX - d.sx) / scale;
      const dy = (ev.clientY - d.sy) / scale;
      if (d.mode === 'move') updateWidget(d.id, { x: snap(d.x + dx / lt.sx, ev.altKey), y: snap(d.y + dy / lt.sy, ev.altKey) });
      else updateWidget(d.id, { w: Math.max(gridSize, snap(d.w + dx / lt.k, ev.altKey)), h: Math.max(gridSize, snap(d.h + dy / lt.k, ev.altKey)) });
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
    <div ref={wrapRef} className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-deep)] overflow-hidden relative" onPointerDown={() => setSelectedId(null)}>
      <div style={{ width: vw * scale, height: vh * scale, position: 'relative' }}>
        {video && editMode && (
          <>
            <span className="vf-corner tl" />
            <span className="vf-corner tr" />
            <span className="vf-corner bl" />
            <span className="vf-corner br" />
          </>
        )}
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
              src={srcUrl || undefined}
              style={{ width: vw, height: vh, display: 'block', objectFit: 'fill' }}
              onSeeked={(e) => setTime(e.target.currentTime)}
              onPause={(e) => setTime(e.target.currentTime)}
              onError={(e) => {
                const err = e.target.error;
                setStatus('Video playback error: ' + (err ? err.message || 'code ' + err.code : 'unknown') + ' — create a preview proxy in the Files tab.');
              }}
              onStalled={() => setStatus('Video decoding is stalling (too heavy for the GPU decoder) — create a preview proxy in the Files tab.')}
            />
          ) : null}
          {editMode && grid && grid.show && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage: 'linear-gradient(to right, rgba(242,169,59,.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(242,169,59,.15) 1px, transparent 1px)',
                backgroundSize: `${gridSize * lt.sx}px ${gridSize * lt.sy}px`,
              }}
            />
          )}
          {rendered.map(({ w, out }) =>
            w.visible === false ? null : (
              <div
                key={w.id}
                id={widgetDomId(w)}
                style={{
                  ...styleObj(widgetBoxStyle(w, '', lt)),
                  outline: editMode ? (selectedId === w.id ? '2px solid #f2a93b' : '1px dashed rgba(255,255,255,.35)') : 'none',
                  cursor: editMode ? 'move' : 'default',
                }}
                onPointerDown={(e) => onPointerDown(e, w, 'move')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (onOpenEditor) onOpenEditor(w.id);
                }}
              >
                <ShadowHtml html={out.html} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
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
      {!video && empty && (
        <div className="absolute inset-0 flex items-center justify-center" onPointerDown={(e) => e.stopPropagation()}>
          {empty}
        </div>
      )}
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
