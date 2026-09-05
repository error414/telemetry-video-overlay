import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toTele, toVideo } from '../time.js';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { githubDark } from '@uiw/codemirror-theme-github';
import { renderWidget, parseColumns, widgetDomId } from '../widgetRuntime.js';
import { parseSettings } from '../widgetSettings.js';
import { colorPicker, swatchText, replaceSwatchColor, formatLike } from './cmColorPicker.js';
import { ColorPopover, parseColor } from './ColorInput.jsx';
import SettingsForm from './SettingsForm.jsx';
import ShadowHtml from './ShadowHtml.jsx';

/**
 * Full-screen widget editor: CodeMirror (Code / Settings definition / API tabs) on the left, live
 * preview + columns, box and the generated settings form on the right. Edits apply immediately;
 * "Close" just closes.
 */
export default function CodeEditorModal({ widget, updateWidget, onClose, store, time, sync, columnNames, ColumnsInput, env, title = 'Widget editor' }) {
  const [previewTime, setPreviewTime] = useState(time);
  const [follow, setFollow] = useState(true);
  const [tab, setTab] = useState('code');
  const [pick, setPick] = useState(null); // colour swatch clicked in the code: {view, wrap, rect, color}
  const boxRef = useRef(null);
  const leftRef = useRef(null);
  useEffect(() => {
    if (follow) setPreviewTime(time);
  }, [time, follow]);

  const out = useMemo(() => renderWidget(widget, store, previewTime, sync, env), [widget, store, previewTime, sync, env]);
  const sdef = useMemo(() => parseSettings(widget.settings), [widget.settings]);
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

  // colour swatches in the code editor open the in-app picker (cmColorPicker.js dispatches cm-color-pick)
  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const h = (e) => {
      const { view, wrap } = e.detail;
      setPick({ view, wrap, rect: wrap.getBoundingClientRect(), color: parseColor(swatchText(wrap)) || { r: 255, g: 255, b: 255, a: 1 } });
    };
    el.addEventListener('cm-color-pick', h);
    return () => el.removeEventListener('cm-color-pick', h);
  }, []);
  useEffect(() => setPick(null), [tab]);

  const setConfig = (key, value) => {
    const config = { ...(widget.config || {}) };
    if (value === undefined) delete config[key];
    else config[key] = value;
    updateWidget(widget.id, { config });
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
          {/* code / settings definition / api */}
          <div ref={leftRef} className="flex-1 min-w-0 flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1 px-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className={'tab ' + (tab === 'code' ? 'tab-active' : '')} onClick={() => setTab('code')}>
                Code <span className="mono hint" style={{ whiteSpace: 'nowrap' }}>function (settings, time, ctx)</span>
              </div>
              <div className={'tab ' + (tab === 'settings' ? 'tab-active' : '')} onClick={() => setTab('settings')}>
                Settings definition{' '}
                {sdef.error ? <span className="chip chip-bad ml-1">error</span> : sdef.defs.length ? <span className="chip chip-accent ml-1">{sdef.defs.length}</span> : null}
              </div>
              <div className={'tab ' + (tab === 'api' ? 'tab-active' : '')} onClick={() => setTab('api')}>
                API reference
              </div>
              {out.error ? <span className="chip chip-bad ml-auto">error</span> : <span className="chip chip-good ml-auto">ok</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {tab === 'code' ? (
                <CodeMirror value={widget.code} height="100%" theme={githubDark} extensions={[javascript(), colorPicker]} onChange={(v) => updateWidget(widget.id, { code: v })} basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false, tabSize: 2 }} style={{ height: '100%' }} />
              ) : tab === 'settings' ? (
                <CodeMirror
                  value={widget.settings || ''}
                  height="100%"
                  theme={githubDark}
                  extensions={[javascript(), colorPicker]}
                  placeholder={SETTINGS_PLACEHOLDER}
                  onChange={(v) => updateWidget(widget.id, { settings: v })}
                  basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: false, tabSize: 2 }}
                  style={{ height: '100%' }}
                />
              ) : (
                <pre className="mono text-xs whitespace-pre-wrap p-3 h-full overflow-auto" style={{ color: 'var(--text)', margin: 0 }}>
                  {API_DOC}
                </pre>
              )}
            </div>
            {tab === 'settings' && (
              <div className="px-3 py-1.5 text-xs hint" style={{ borderTop: '1px solid var(--border)' }}>
                A JSON array of settings, optionally in groups (<span className="mono">{'{ "group": { "name", "items": [...] } }'}</span> = a collapsible section); the form is generated from it (right, and in the Widgets tab). Types: <span className="mono">text</span>, <span className="mono">int</span>, <span className="mono">number</span>, <span className="mono">color_picker</span>, <span className="mono">bool</span>, <span className="mono">select</span> (with <span className="mono">values</span>). The code reads a setting as <span className="mono">settings.&lt;name in snake_case&gt;.value</span>.
              </div>
            )}
            {tab === 'settings' && sdef.error && (
              <pre className="px-3 py-2 text-xs whitespace-pre-wrap" style={{ color: 'var(--bad)', background: 'rgba(229,100,92,.08)', borderTop: '1px solid var(--border)', margin: 0 }}>
                {sdef.error}
              </pre>
            )}
            {tab === 'code' && out.error && (
              <pre className="px-3 py-2 text-xs whitespace-pre-wrap" style={{ color: 'var(--bad)', background: 'rgba(229,100,92,.08)', borderTop: '1px solid var(--border)', maxHeight: 120, overflow: 'auto', margin: 0 }}>
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
                <ShadowHtml
                  hostRef={boxRef}
                  id={widgetDomId(widget)}
                  html={out.html}
                  style={{ width: widget.w, height: widget.h, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', color: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', outline: '1px dashed rgba(255,255,255,.25)' }}
                />
              </div>
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
              <label className="label">Columns → ctx.values[0], ctx.values[1], …</label>
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
              <div className="grid grid-cols-4 gap-2">
                {['x', 'y', 'w', 'h'].map((k) => (
                  <label key={k}>
                    <span className="label">{k}</span>
                    <input className="input mono" type="number" value={widget[k]} onChange={(e) => updateWidget(widget.id, { [k]: Number(e.target.value) })} />
                  </label>
                ))}
              </div>
              <label className="label">Settings</label>
              <SettingsForm key={widget.id} defs={sdef.defs} sections={sdef.sections} error={sdef.error} config={widget.config} onChange={setConfig} onReset={() => updateWidget(widget.id, { config: {} })} />
            </div>
          </div>
        </div>
      </div>
      {pick && (
        <ColorPopover
          anchorRect={pick.rect}
          color={pick.color}
          onChange={(c) => {
            if (!replaceSwatchColor(pick.view, pick.wrap, formatLike(swatchText(pick.wrap), c))) return setPick(null);
            setPick((p) => (p ? { ...p, color: c } : p));
          }}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}

const SETTINGS_PLACEHOLDER = `[
  { "name": "Color",  "type": "color_picker", "default": "rgba(255,255,255,.9)", "description": "text color" },
  { "name": "Size",   "type": "int",    "default": 40, "min": 8, "max": 200 },
  { "group": { "name": "Sticks", "items": [
    { "name": "Mode",   "type": "select", "values": { "1": "Mode 1", "2": "Mode 2" }, "default": 2 }
  ] } },
  { "group": { "name": "Labels", "items": [
    { "name": "Labels", "type": "bool",   "default": true },
    { "name": "Label font", "type": "text", "default": "Arial" }
  ] } }
]
// in the code: var MODE = settings.mode.value;  var FONT = settings.label_font.value;
// groups are collapsible sections of the form; keys are unique across the whole definition`;

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}

export const API_DOC = `function (settings, time, ctx) { return '<div>…</div>'; }

settings   the widget's settings, generated from the Settings definition tab:
           settings.<key>.value  (key = the setting's name in snake_case,
           "Label font" -> settings.label_font.value; also .name, .type,
           .label for selects). The user changes them in the form (Widgets
           tab / editor); the definition gives the defaults.
time       telemetry time in ms (integer) = video time × (1 + drift) + offset
ctx.values           array of current values of the listed columns (interpolated)
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
ctx.exportRange      {from, to} in telemetry ms (sync bar in/out points or the
                     whole video); null without a video
ctx.dataVersion      changes when telemetry files change — put it in every
                     ctx.state cache key
ctx.state            object persisting between calls (cache here)
ctx.fmt(v, digits)   number formatting helper
ctx.image(url)       loads an image (map tile, icon) and returns a data: URL
                     once cached; undefined while loading (widget re-renders
                     automatically). Works in export too.

Settings definition (JSON array, one object per setting, or a group
{ "group": { "name": "…", "items": [ …settings… ] } } = collapsible section):
  name         shown in the form; the key is derived from it ("key" overrides)
  type         text | int | number | color_picker | bool | select
  default      value used until the user changes it
  description  help text under the field
  values       select only: { "value": "label", … } or ["a", "b"]
               (numeric keys come back as numbers when default is a number)
  min, max, step   int / number only

The returned HTML is placed in an absolutely positioned box; style it with
inline CSS or a <style> tag. Inline <svg> works. External URLs (web fonts,
images) are not available in export – embed as data: URIs instead.`;
