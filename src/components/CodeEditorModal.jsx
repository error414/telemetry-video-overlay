import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toTele, toVideo } from '../time.js';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { css as cssLang } from '@codemirror/lang-css';
import { githubDark } from '@uiw/codemirror-theme-github';
import { renderWidget, parseColumns, widgetDomId } from '../widgetRuntime.js';
import { colorPicker } from './cmColorPicker.js';
import ShadowHtml from './ShadowHtml.jsx';

/** Build a readable selector for an element: tag#id.class1.class2 */
function describe(el) {
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  const cls = typeof el.className === 'string' ? el.className : el.className && el.className.baseVal;
  if (cls) s += '.' + cls.trim().split(/\s+/).join('.');
  return s;
}

/**
 * Full-screen widget editor: CodeMirror (Code / CSS tabs) on the left, live preview + settings on
 * the right. Hovering the preview shows the element under the cursor (selector for the CSS tab);
 * clicking copies it. Edits apply immediately; "Close" just closes.
 */
export default function CodeEditorModal({ widget, updateWidget, onClose, store, time, sync, columnNames, ColumnsInput, env, title = 'Widget editor' }) {
  const [previewTime, setPreviewTime] = useState(time);
  const [follow, setFollow] = useState(true);
  const [tab, setTab] = useState('code');
  const [hover, setHover] = useState(null); // {selector, path, rect}
  const [copied, setCopied] = useState('');
  const previewRef = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => {
    if (follow) setPreviewTime(time);
  }, [time, follow]);

  const out = useMemo(() => renderWidget(widget, store, previewTime, sync, 'shadow', env), [widget, store, previewTime, sync, env]);
  const cols = parseColumns(widget.columns);
  const missing = cols.filter((c) => !store.columns[c]);
  const duration = store.duration();

  // fit the widget into the preview area
  const previewW = 640;
  const previewH = 400;
  const scale = Math.min(1, (previewW - 40) / Math.max(1, widget.w), (previewH - 40) / Math.max(1, widget.h));

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ---- hover inspector ----
  const onPreviewMove = (e) => {
    const box = boxRef.current;
    const root = box && box.shadowRoot;
    if (!root) return setHover(null);
    // widget HTML lives in a shadow root → ask the shadow root for the element under the cursor
    const el = root.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === box) return setHover(null);
    const path = [];
    for (let n = el; n && n !== root && n !== box; n = n.parentElement) path.unshift(describe(n));
    const r = el.getBoundingClientRect();
    const pr = previewRef.current.getBoundingClientRect();
    setHover({ selector: describe(el), path: path.join(' > '), rect: { left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height } });
  };
  const copySelector = () => {
    if (!hover) return;
    navigator.clipboard.writeText(hover.selector);
    setCopied(hover.selector);
    setTimeout(() => setCopied(''), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex flex-col rounded-lg overflow-hidden" style={{ width: 'min(96vw, 1500px)', height: 'min(94vh, 960px)', background: 'var(--panel)', border: '1px solid var(--border-strong)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <header className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold">{title}</span>
          <input className="input" style={{ width: 260 }} value={widget.name} onChange={(e) => updateWidget(widget.id, { name: e.target.value })} />
          <span className="hint">Changes apply immediately · Esc closes</span>
          <button className="btn ml-auto" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="flex-1 flex min-h-0">
          {/* code / css */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1 px-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className={'tab ' + (tab === 'code' ? 'tab-active' : '')} onClick={() => setTab('code')}>
                Code <span className="mono hint">function (values, time, ctx)</span>
              </div>
              <div className={'tab ' + (tab === 'css' ? 'tab-active' : '')} onClick={() => setTab('css')}>
                CSS {widget.css && widget.css.trim() ? <span className="chip chip-accent ml-1">on</span> : null}
              </div>
              {out.error ? <span className="chip chip-bad ml-auto">error</span> : <span className="chip chip-good ml-auto">ok</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {tab === 'code' ? (
                <CodeMirror value={widget.code} height="100%" theme={githubDark} extensions={[javascript(), colorPicker]} onChange={(v) => updateWidget(widget.id, { code: v })} basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false, tabSize: 2 }} style={{ height: '100%' }} />
              ) : (
                <CodeMirror
                  value={widget.css || ''}
                  height="100%"
                  theme={githubDark}
                  extensions={[cssLang(), colorPicker]}
                  placeholder={CSS_PLACEHOLDER}
                  onChange={(v) => updateWidget(widget.id, { css: v })}
                  basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false, tabSize: 2 }}
                  style={{ height: '100%' }}
                />
              )}
            </div>
            {tab === 'css' && (
              <div className="px-3 py-1.5 text-xs hint" style={{ borderTop: '1px solid var(--border)' }}>
                Rules are scoped to this widget automatically; <span className="mono">:root</span> targets the widget box. Hover the preview to find ids/classes; click to copy. SVG text/shapes use <span className="mono">fill</span>/<span className="mono">stroke</span> and are moved with <span className="mono">transform: translate(10px, -4px)</span> (margin/left/top have no effect inside &lt;svg&gt;).
              </div>
            )}
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
            <div
              ref={previewRef}
              className="flex items-center justify-center"
              style={{ height: previewH, background: 'repeating-conic-gradient(#20262d 0 25%, #191f25 0 50%) 0 0 / 20px 20px', position: 'relative', overflow: 'hidden', cursor: hover ? 'copy' : 'default' }}
              onMouseMove={onPreviewMove}
              onMouseLeave={() => setHover(null)}
              onClick={copySelector}
            >
              <div style={{ width: widget.w * scale, height: widget.h * scale, position: 'relative' }}>
                <ShadowHtml
                  hostRef={boxRef}
                  id={widgetDomId(widget)}
                  html={out.html}
                  style={{ width: widget.w, height: widget.h, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', opacity: widget.opacity, color: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', outline: '1px dashed rgba(255,255,255,.25)' }}
                />
              </div>
              {hover && (
                <>
                  <div style={{ position: 'absolute', pointerEvents: 'none', left: hover.rect.left, top: hover.rect.top, width: hover.rect.width, height: hover.rect.height, outline: '1.5px solid var(--accent)', background: 'rgba(242,169,59,.12)' }} />
                  <div className="mono" style={{ position: 'absolute', pointerEvents: 'none', left: 8, bottom: 8, right: 8, padding: '4px 8px', borderRadius: 4, background: 'rgba(15,19,23,.92)', border: '1px solid var(--border-strong)', fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: 'var(--accent)' }}>{hover.selector}</span>
                    <span className="hint"> — {hover.path}</span>
                    {copied === hover.selector && <span style={{ color: 'var(--good)' }}> · copied</span>}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow video
              </label>
              <input type="range" min={0} max={duration || 1} step={0.01} value={toTele(previewTime, sync)} onChange={(e) => { setFollow(false); setPreviewTime(toVideo(Number(e.target.value), sync)); }} className="flex-1" />
              <span className="mono w-20 text-right" style={{ color: 'var(--muted)' }}>
                t = {toTele(previewTime, sync).toFixed(2)} s
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
                  {cols.map((c, i) => `[${i}] ${fmt(store.valueAt(c, toTele(previewTime, sync)))}`).join('   ')}
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

const CSS_PLACEHOLDER = `/* Styles for this widget only. Examples: */
:root { filter: drop-shadow(0 0 6px #000); }   /* the widget box */
.label { font-weight: bold; fill: #ffd166; }    /* SVG text uses fill, not color */
#box-left .stick { fill: #4fc3c7; }
text.value { transform: translate(10px, -4px); } /* move SVG elements with transform (px units) */
`;

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}
