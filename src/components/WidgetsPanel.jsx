import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parseColumns, renderWidget } from '../widgetRuntime.js';

/** Comma-separated column list with autocomplete for the item under the caret. */
export function ColumnsInput({ value, onChange, columnNames }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const [caret, setCaret] = useState(value.length);
  const [rect, setRect] = useState(null);

  // split into "before", current token, "after" relative to the caret
  const before = value.slice(0, caret);
  const after = value.slice(caret);
  const start = before.lastIndexOf(',') + 1;
  const endRel = after.indexOf(',');
  const end = endRel < 0 ? value.length : caret + endRel;
  const token = value.slice(start, end).trim().toLowerCase();
  const matches = token ? columnNames.filter((c) => c.toLowerCase().includes(token) && c.toLowerCase() !== token).slice(0, 40) : columnNames.slice(0, 40);

  useEffect(() => setHi(0), [token]);
  // the dropdown is position:fixed so scrolling containers cannot clip it
  useLayoutEffect(() => {
    if (open && ref.current) setRect(ref.current.getBoundingClientRect());
  }, [open, value]);

  const pick = (name) => {
    const head = value.slice(0, start);
    const tail = value.slice(end);
    const nv = (head ? head.replace(/\s*$/, '') + ' ' : '') + name + (tail.trim() ? ',' + tail : '');
    onChange(nv);
    setOpen(false);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = (head ? head.replace(/\s*$/, '').length + 1 : 0) + name.length;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const spaceBelow = rect ? window.innerHeight - rect.bottom - 8 : 200;
  const maxH = Math.max(120, Math.min(260, spaceBelow));

  return (
    <div className="relative">
      <input
        ref={ref}
        className="input mono"
        value={value}
        placeholder="GPS_speed (m/s), BaroAlt (cm)"
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onSelect={(e) => setCaret(e.target.selectionStart)}
        onKeyDown={(e) => {
          if (!open || !matches.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHi((h) => (h + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => (h - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(matches[hi]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && matches.length > 0 && rect && (
        <div
          className="mono text-xs overflow-auto rounded"
          style={{ position: 'fixed', zIndex: 100, left: rect.left, width: rect.width, top: rect.bottom + 2, maxHeight: maxH, background: 'var(--panel-2)', border: '1px solid var(--border-strong)', boxShadow: '0 12px 30px rgba(0,0,0,.5)' }}
        >
          {matches.map((c, i) => (
            <div key={c} className="px-2 py-1 cursor-pointer whitespace-nowrap" style={{ background: i === hi ? 'var(--accent-soft)' : 'transparent', color: i === hi ? 'var(--accent)' : 'var(--text)' }} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(c)}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WidgetsPanel({ widgets, selected, setSelectedId, addWidget, updateWidget, removeWidget, setWidgets, columnNames, store, time, offset, saveToLibrary, openEditor }) {
  const move = (id, dir) =>
    setWidgets((ws) => {
      const i = ws.findIndex((w) => w.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ws.length) return ws;
      const c = ws.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const cols = selected ? parseColumns(selected.columns) : [];
  const missing = cols.filter((c) => !store.columns[c]);
  const out = selected ? renderWidget(selected, store, time, offset) : null;

  return (
    <div>
      <div className="section-title">
        Widgets on video
        <button className="btn btn-xs btn-primary" style={{ marginLeft: 'auto' }} onClick={() => addWidget()}>
          + New widget
        </button>
      </div>
      {widgets.length === 0 && <div className="hint mb-2">No widgets yet. Create one or add from the Library.</div>}
      <ul className="mb-3 flex flex-col gap-0.5">
        {widgets.map((w) => (
          <li key={w.id} className={'row ' + (selected && selected.id === w.id ? 'row-active' : '')} onClick={() => setSelectedId(w.id)} onDoubleClick={() => (setSelectedId(w.id), openEditor())}>
            <input type="checkbox" checked={w.visible !== false} onChange={(e) => updateWidget(w.id, { visible: e.target.checked })} onClick={(e) => e.stopPropagation()} title="Visible" />
            <span className="flex-1 truncate">{w.name}</span>
            <button className="btn btn-xs btn-icon" onClick={(e) => (e.stopPropagation(), move(w.id, -1))} title="Send backward">
              ↑
            </button>
            <button className="btn btn-xs btn-icon" onClick={(e) => (e.stopPropagation(), move(w.id, 1))} title="Bring forward">
              ↓
            </button>
            <button className="btn btn-xs btn-icon" onClick={(e) => (e.stopPropagation(), addWidget({ ...w, id: undefined, name: w.name + ' copy', x: w.x + 20, y: w.y + 20 }))} title="Duplicate">
              ⧉
            </button>
            <button className="btn btn-xs btn-icon btn-danger" onClick={(e) => (e.stopPropagation(), removeWidget(w.id))} title="Delete">
              ✕
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="card">
          <div className="flex items-center gap-2">
            <input className="input font-medium" value={selected.name} onChange={(e) => updateWidget(selected.id, { name: e.target.value })} />
            <button className="btn btn-primary" onClick={openEditor} title="Open the full editor with live preview">
              Edit code
            </button>
          </div>

          <label className="label">Columns → values[0], values[1], …</label>
          <ColumnsInput value={selected.columns} onChange={(v) => updateWidget(selected.id, { columns: v })} columnNames={columnNames} />
          {missing.length > 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
              Not found in loaded CSVs: {missing.join(', ')}
            </div>
          )}
          {cols.length > 0 && (
            <div className="mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {cols.map((c, i) => `[${i}] ${fmt(store.valueAt(c, time + offset))}`).join('   ')}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {['x', 'y', 'w', 'h'].map((k) => (
              <label key={k}>
                <span className="label">{k}</span>
                <input className="input mono" type="number" value={selected[k]} onChange={(e) => updateWidget(selected.id, { [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>

          <label className="label">
            Opacity <span className="mono" style={{ color: 'var(--text)' }}>{selected.opacity}</span>
          </label>
          <input type="range" min={0} max={1} step={0.01} value={selected.opacity} onChange={(e) => updateWidget(selected.id, { opacity: Number(e.target.value) })} />

          <label className="label">Code</label>
          <textarea
            className="input mono text-xs h-56 whitespace-pre"
            spellCheck={false}
            value={selected.code}
            onChange={(e) => updateWidget(selected.id, { code: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const t = e.target;
                const s = t.selectionStart;
                const v = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd);
                updateWidget(selected.id, { code: v });
                requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
              }
            }}
          />
          {out && out.error && (
            <pre className="text-xs whitespace-pre-wrap mt-1" style={{ color: 'var(--bad)' }}>
              {out.error}
            </pre>
          )}

          <label className="label">CSS (scoped to this widget; hover the editor preview for ids/classes)</label>
          <textarea className="input mono text-xs h-24 whitespace-pre" spellCheck={false} value={selected.css || ''} placeholder={'.label { fill: #ffd166; }\n:root { filter: drop-shadow(0 0 6px #000); }'} onChange={(e) => updateWidget(selected.id, { css: e.target.value })} />

          <details className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            <summary className="cursor-pointer">Widget API reference</summary>
            <pre className="mono whitespace-pre-wrap mt-1 p-2 rounded" style={{ background: 'var(--bg)' }}>
              {API_DOC}
            </pre>
          </details>

          <div className="flex gap-2 mt-3">
            <button className="btn" onClick={() => saveToLibrary(selected)}>
              Save to library
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}

const API_DOC = `function (values, time, ctx) { return '<div>…</div>'; }

values   array of current values of the listed columns (interpolated)
time     telemetry time in ms (integer) = video time + offset
ctx.videoTime        video time (s)
ctx.width, ctx.height  widget box size (px)
ctx.columns          array of column names
ctx.get(name)        interpolated value of any column
ctx.raw(name)        last sample (no interpolation), e.g. for flags/strings
ctx.range(name, fromMs, toMs, maxPoints)  -> [{t, v}] history window
ctx.all(name, maxPoints)  -> [{t, v}] the WHOLE flight (profiles, tracks)
ctx.stats(name)      -> {min, max, mean, count, tMin, tMax} whole-flight
                     statistics (use for stable axis scaling)
ctx.duration         telemetry length in ms
ctx.state            object persisting between calls (cache here)
ctx.fmt(v, digits)   number formatting helper
ctx.image(url)       loads an image (map tile, icon) and returns a data: URL
                     once cached; undefined while loading (widget re-renders
                     automatically). Works in export too.

The returned HTML is placed in an absolutely positioned box; style it with
inline CSS or a <style> tag. Inline <svg> works. External URLs (web fonts,
images) are not available in export – embed as data: URIs instead.

CSS field: a stylesheet applied only to this widget (selectors are prefixed
with the widget's box id automatically; ":root" = the box). Give elements
ids/classes in the returned HTML and style them here – works in export too.`;
