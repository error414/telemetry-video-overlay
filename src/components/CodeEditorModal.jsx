import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toTele, toVideo } from '../time.js';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { githubDark } from '@uiw/codemirror-theme-github';
import { renderWidget, parseColumns, widgetDomId, normalizeTags } from '../widgetRuntime.js';
import { parseSettings } from '../widgetSettings.js';
import { colorPicker, swatchText, replaceSwatchColor, formatLike } from './cmColorPicker.js';
import { ColorPopover, parseColor } from './ColorInput.jsx';
import SettingsForm from './SettingsForm.jsx';
import ShadowHtml from './ShadowHtml.jsx';
import Dialog from './Dialog.jsx';
import Icon, { WidgetIcon } from './Icon.jsx';
import { ColumnsInput } from './ColumnsInput.jsx';

/**
 * Full-screen widget editor: CodeMirror (Code / Settings definition / Icon & tags / API tabs) on
 * the left, live preview + columns, box and the generated settings form on the right. Edits
 * apply immediately; "Close" just closes.
 */
export default function CodeEditorModal({ widget, updateWidget, onClose, store, time, sync, columnNames, env, title = 'Widget editor' }) {
  const [previewTime, setPreviewTime] = useState(time);
  const [follow, setFollow] = useState(true);
  const [tab, setTab] = useState('code');
  const [pick, setPick] = useState(null); // colour swatch clicked in the code: {view, wrap, rect, color}
  const [tagsText, setTagsText] = useState((widget.tags || []).join(', '));
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
  const previewH = 380;
  const scale = Math.min(1, (previewW - 40) / Math.max(1, widget.w), (previewH - 40) / Math.max(1, widget.h));

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

  const TABS = [
    ['code', 'Code'],
    ['settings', 'Settings definition'],
    ['meta', 'Icon & tags'],
    ['api', 'API reference'],
  ];

  return (
    <Dialog size="full" onClose={onClose} className="gap-0" bodyClassName="flex flex-col" zIndex={70} closeOnBackdrop={false}>
      <header className="editor-head">
        <span className="dialog-title" style={{ fontSize: 20 }}>
          <WidgetIcon widget={widget} />
          {title}
        </span>
        <input className="input" style={{ width: 280 }} value={widget.name} onChange={(e) => updateWidget(widget.id, { name: e.target.value })} spellCheck={false} />
        <span className="hint">Changes apply immediately · Esc closes</span>
        <button className="btn btn-tonal ml-auto" onClick={onClose}>
          <Icon name="check" />
          Done
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* code / settings definition / meta / api */}
        <div ref={leftRef} className="flex-1 min-w-0 flex flex-col">
          <div className="tabs px-3">
            {TABS.map(([k, l]) => (
              <div key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
                {l}
                {k === 'code' && <span className="mono hint">(settings, time, ctx)</span>}
                {k === 'settings' && (sdef.error ? <span className="chip chip-sm chip-bad">error</span> : sdef.defs.length ? <span className="chip chip-sm chip-accent">{sdef.defs.length}</span> : null)}
              </div>
            ))}
            <span className="ml-auto self-center">{out.error ? <span className="chip chip-sm chip-bad">error</span> : <span className="chip chip-sm chip-good">ok</span>}</span>
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
            ) : tab === 'meta' ? (
              <div className="p-6 stack overflow-y-auto h-full" style={{ maxWidth: 720 }}>
                <div>
                  <span className="label mt-0">Tags (categories) — comma separated, used by the search and the tag filter in “Add widget”</span>
                  <input
                    className="input"
                    value={tagsText}
                    spellCheck={false}
                    placeholder="gauge, speed, my flights"
                    onChange={(e) => {
                      setTagsText(e.target.value);
                      updateWidget(widget.id, { tags: normalizeTags(e.target.value) });
                    }}
                  />
                  {widget.tags && widget.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {widget.tags.map((t) => (
                        <span key={t} className="chip chip-sm">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <span className="label mt-0">Icon — one inline SVG, single colour (currentColor), 24×24 viewBox</span>
                  <div className="flex gap-4 items-start">
                    <span className="wcard-icon own" style={{ width: 64, height: 64 }}>
                      <WidgetIcon widget={widget} size={40} />
                    </span>
                    <textarea className="input mono flex-1" rows={6} value={widget.icon || ''} spellCheck={false} placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="…"/></svg>' onChange={(e) => updateWidget(widget.id, { icon: e.target.value })} />
                  </div>
                  <div className="hint mt-2">Shown in the widget list and the “Add widget” grid. Keep it a simple line drawing; scripts, event handlers and external references are rejected and the generic icon is shown instead.</div>
                </div>
              </div>
            ) : (
              <pre className="mono text-xs whitespace-pre-wrap p-4 h-full overflow-auto m-0" style={{ color: 'var(--on-surface)' }}>
                {API_DOC}
              </pre>
            )}
          </div>
          {tab === 'settings' && (
            <div className="px-4 py-2 hint" style={{ borderTop: '1px solid var(--outline-variant)' }}>
              A JSON array of settings, in groups (<span className="mono">{'{ "group": { "name", "icon", "items": [...] } }'}</span> = a collapsible section with its icon); the form is generated from it (right, and in the Widgets step). Types: <span className="mono">text</span>, <span className="mono">int</span>, <span className="mono">number</span>, <span className="mono">color_picker</span>, <span className="mono">bool</span>, <span className="mono">select</span> (with <span className="mono">values</span>). The code reads a setting as <span className="mono">settings.&lt;name in snake_case&gt;.value</span>.
            </div>
          )}
          {tab === 'settings' && sdef.error && (
            <pre className="px-4 py-2 text-xs whitespace-pre-wrap m-0" style={{ color: 'var(--error)', background: 'rgba(147,0,10,.25)' }}>
              {sdef.error}
            </pre>
          )}
          {tab === 'code' && out.error && (
            <pre className="px-4 py-2 text-xs whitespace-pre-wrap m-0" style={{ color: 'var(--error)', background: 'rgba(147,0,10,.25)', maxHeight: 120, overflow: 'auto' }}>
              {out.error}
            </pre>
          )}
        </div>

        {/* preview + settings */}
        <div className="editor-side" style={{ width: previewW + 32, minWidth: 440 }}>
          <div className="flex items-center gap-2 px-4" style={{ height: 44 }}>
            <span className="title">Preview</span>
            <span className="mono ml-auto hint">
              {widget.w}×{widget.h} · {Math.round(scale * 100)}%
            </span>
          </div>
          <div className="preview-ground mx-4 rounded-xl" style={{ height: previewH }}>
            <div style={{ width: widget.w * scale, height: widget.h * scale, position: 'relative' }}>
              <ShadowHtml hostRef={boxRef} id={widgetDomId(widget)} html={out.html} style={{ width: widget.w, height: widget.h, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', color: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', outline: '1px dashed rgba(255,255,255,.25)' }} />
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 text-xs">
            <label className={'switch' + (follow ? ' on' : '')}>
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              <span className="track" />
              follow video
            </label>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={toTele(previewTime, sync)}
              onChange={(e) => {
                setFollow(false);
                setPreviewTime(toVideo(Number(e.target.value), sync));
              }}
              className="flex-1"
            />
            <span className="mono text-right hint whitespace-nowrap" style={{ minWidth: 88 }}>t = {toTele(previewTime, sync).toFixed(2)} s</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 stack">
            <div>
              <span className="label mt-0">Columns → ctx.values[0], ctx.values[1], …</span>
              <ColumnsInput value={widget.columns} onChange={(v) => updateWidget(widget.id, { columns: v })} columnNames={columnNames} />
              {missing.length > 0 && <div className="text-xs mt-1 text-[var(--warn)]">Not found in the loaded telemetry: {missing.join(', ')}</div>}
              {cols.length > 0 && (
                <div className="mono text-xs mt-1 hint">
                  {cols.map((c, i) => `[${i}] ${fmt(store.valueAt(c, toTele(previewTime, sync)))}`).join('   ')}
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['x', 'y', 'w', 'h'].map((k) => (
                <label key={k}>
                  <span className="label mt-0">{k}</span>
                  <input className="input input-sm mono" type="number" value={widget[k]} onChange={(e) => updateWidget(widget.id, { [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
            <div>
              <span className="label mt-0">Settings</span>
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
    </Dialog>
  );
}

const SETTINGS_PLACEHOLDER = `[
  { "group": { "name": "Sticks", "icon": "<svg viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"1.8\\"><circle cx=\\"7\\" cy=\\"12\\" r=\\"4\\"/><circle cx=\\"17\\" cy=\\"12\\" r=\\"4\\"/></svg>", "items": [
    { "name": "Mode",   "type": "select", "values": { "1": "Mode 1", "2": "Mode 2" }, "default": 2 }
  ] } },
  { "group": { "name": "Labels", "icon": "<svg viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"1.8\\"><path d=\\"M3 12V4h8l10 10-8 8z\\"/></svg>", "items": [
    { "name": "Labels", "type": "bool",   "default": true },
    { "name": "Label font", "type": "text", "default": "Arial" },
    { "name": "Color",  "type": "color_picker", "default": "rgba(255,255,255,.9)", "description": "text color" },
    { "name": "Size",   "type": "int",    "default": 40, "min": 8, "max": 200 }
  ] } }
]
// in the code: var MODE = settings.mode.value;  var FONT = settings.label_font.value;
// every group is a collapsible section of the form with its icon; keys are unique across the whole definition`;

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}

export const API_DOC = `function (settings, time, ctx) { return '<div>…</div>'; }

settings   the widget's settings, generated from the Settings definition tab:
           settings.<key>.value  (key = the setting's name in snake_case,
           "Label font" -> settings.label_font.value; also .name, .type,
           .label for selects). The user changes them in the form (Widgets
           step / editor); the definition gives the defaults.
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
ctx.exportRange      {from, to} in telemetry ms (export step in/out points or the
                     whole video); null without a video
ctx.dataVersion      changes when telemetry files change — put it in every
                     ctx.state cache key
ctx.state            object persisting between calls (cache here)
ctx.fmt(v, digits)   number formatting helper
ctx.image(url)       loads an image (map tile, icon) and returns a data: URL
                     once cached; undefined while loading (widget re-renders
                     automatically). Works in export too.

Settings definition (JSON array of groups; a group
{ "group": { "name": "…", "icon": "<svg…>", "items": [ …settings… ] } } is a
collapsible section of the form with its icon):
  name         shown in the form; the key is derived from it ("key" overrides)
  type         text | int | number | color_picker | bool | select
  default      value used until the user changes it
  description  help text under the field name
  values       select only: { "value": "label", … } or ["a", "b"]
               (numeric keys come back as numbers when default is a number)
  min, max, step   int / number only

Widget record: name, icon (inline SVG string, single colour), tags (array of
categories for the "Add widget" search), columns, x, y, w, h, settings, config, code.

The returned HTML is placed in an absolutely positioned box; style it with
inline CSS or a <style> tag. Inline <svg> works. External URLs (web fonts,
images) are not available in export – embed as data: URIs instead.`;
