import React, { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { githubDark } from '@uiw/codemirror-theme-github';
import { renderWidget, parseColumns } from '../widgetRuntime.js';

/**
 * Full-screen widget editor: CodeMirror on the left, live preview + settings on the right.
 * Edits are applied to the widget immediately (the main preview updates too); "Close" just closes.
 */
export default function CodeEditorModal({ widget, updateWidget, onClose, store, time, offset, columnNames, ColumnsInput }) {
  const [previewTime, setPreviewTime] = useState(time);
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    if (follow) setPreviewTime(time);
  }, [time, follow]);

  const out = useMemo(() => renderWidget(widget, store, previewTime, offset), [widget, store, previewTime, offset]);
  const cols = parseColumns(widget.columns);
  const missing = cols.filter((c) => !store.columns[c]);
  const duration = store.duration();

  // fit the widget into the preview area
  const previewW = 640;
  const previewH = 420;
  const scale = Math.min(1, (previewW - 40) / Math.max(1, widget.w), (previewH - 40) / Math.max(1, widget.h));

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex flex-col rounded-lg overflow-hidden" style={{ width: 'min(96vw, 1500px)', height: 'min(94vh, 960px)', background: 'var(--panel)', border: '1px solid var(--border-strong)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <header className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold">Widget editor</span>
          <input className="input" style={{ width: 260 }} value={widget.name} onChange={(e) => updateWidget(widget.id, { name: e.target.value })} />
          <span className="hint">Changes apply immediately · Esc closes</span>
          <button className="btn ml-auto" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="flex-1 flex min-h-0">
          {/* code */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="mono" style={{ color: 'var(--muted)' }}>function (values, time, ctx) → HTML</span>
              {out.error ? <span className="chip chip-bad ml-auto">error</span> : <span className="chip chip-good ml-auto">ok</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CodeMirror value={widget.code} height="100%" theme={githubDark} extensions={[javascript()]} onChange={(v) => updateWidget(widget.id, { code: v })} basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false, tabSize: 2 }} style={{ height: '100%' }} />
            </div>
            {out.error && (
              <pre className="px-3 py-2 text-xs whitespace-pre-wrap" style={{ color: 'var(--bad)', background: 'rgba(229,100,92,.08)', borderTop: '1px solid var(--border)', maxHeight: 120, overflow: 'auto' }}>
                {out.error}
              </pre>
            )}
          </div>

          {/* preview + settings */}
          <div className="flex flex-col" style={{ width: previewW + 24, minWidth: 420 }}>
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="section-title" style={{ margin: 0 }}>
                Preview
              </span>
              <span className="mono ml-auto" style={{ color: 'var(--muted)' }}>
                {widget.w}×{widget.h} · {Math.round(scale * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-center" style={{ height: previewH, background: 'repeating-conic-gradient(#20262d 0 25%, #191f25 0 50%) 0 0 / 20px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: widget.w * scale, height: widget.h * scale, position: 'relative' }}>
                <div style={{ width: widget.w, height: widget.h, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', opacity: widget.opacity, color: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', outline: '1px dashed rgba(255,255,255,.25)' }} dangerouslySetInnerHTML={{ __html: out.html }} />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow video
              </label>
              <input type="range" min={0} max={duration || 1} step={0.01} value={previewTime + offset} onChange={(e) => { setFollow(false); setPreviewTime(Number(e.target.value) - offset); }} className="flex-1" />
              <span className="mono w-20 text-right" style={{ color: 'var(--muted)' }}>
                t = {(previewTime + offset).toFixed(2)} s
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <label className="label">Columns → values[0], values[1], …</label>
              <ColumnsInput value={widget.columns} onChange={(v) => updateWidget(widget.id, { columns: v })} columnNames={columnNames} />
              {missing.length > 0 && (
                <div className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
                  Not found in loaded CSVs: {missing.join(', ')}
                </div>
              )}
              {cols.length > 0 && (
                <div className="mono text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {cols.map((c, i) => `[${i}] ${fmt(store.valueAt(c, previewTime + offset))}`).join('   ')}
                </div>
              )}
              <div className="grid grid-cols-5 gap-2">
                {['x', 'y', 'w', 'h'].map((k) => (
                  <label key={k}>
                    <span className="label">{k}</span>
                    <input className="input mono" type="number" value={widget[k]} onChange={(e) => updateWidget(widget.id, { [k]: Number(e.target.value) })} />
                  </label>
                ))}
                <label>
                  <span className="label">opacity</span>
                  <input className="input mono" type="number" min={0} max={1} step={0.05} value={widget.opacity} onChange={(e) => updateWidget(widget.id, { opacity: Number(e.target.value) })} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}
