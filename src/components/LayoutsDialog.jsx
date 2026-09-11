import React, { useState } from 'react';
import { byName, uid, cleanWidget } from '../widgetRuntime.js';
import Dialog from './Dialog.jsx';
import Icon from './Icon.jsx';

/** Layout file / stored entry: { name, layout: {w, h} (the video size the coordinates are in), widgets: [...] } */
export function layoutFromJson(j, fallbackName) {
  const widgets = (Array.isArray(j) ? j : (j && j.widgets) || []).filter((w) => w && typeof w.code === 'string');
  if (!widgets.length) throw new Error('No widgets in file');
  // a project file works too: it carries the same widgets + layout fields; older ones were designed on 1080p
  const space = j && j.layout && j.layout.w ? { w: j.layout.w, h: j.layout.h } : { w: 1920, h: 1080 };
  return { name: ((j && j.name) || fallbackName || 'Imported layout').trim(), layout: space, widgets: widgets.map(({ id, ...w }) => cleanWidget(w)) };
}

// Top-level row component — an inline one would remount every animation frame during playback.
function Item({ l, applyLayout, exportOne, removeOne }) {
  const n = l.widgets.length;
  return (
    <div className="list-item" onClick={() => applyLayout(l)} title="Replace the widgets on the video with this layout">
      <span className="li-lead">
        <Icon name="layouts" />
      </span>
      <div className="li-body">
        <div className="li-title">{l.name}</div>
        <div className="li-sub mono">
          {n} {n === 1 ? 'widget' : 'widgets'} · {l.layout.w}×{l.layout.h}
          {l.savedAt ? ' · ' + new Date(l.savedAt).toLocaleDateString() : ''}
        </div>
      </div>
      <div className="li-trail">
        <button className="btn btn-tonal btn-sm" onClick={(e) => (e.stopPropagation(), applyLayout(l))}>
          Load
        </button>
        <button className="btn btn-icon sm" onClick={(e) => (e.stopPropagation(), exportOne(l))} title="Export this layout as JSON">
          <Icon name="download" />
        </button>
        <button className="btn btn-icon sm btn-danger" onClick={(e) => (e.stopPropagation(), removeOne(l.id))} title="Delete this layout">
          <Icon name="delete" />
        </button>
      </div>
    </div>
  );
}

/**
 * Layouts: complete copies of all widgets on the video, stored in the app. Save the current
 * arrangement under a name, load a stored one (replaces the widgets on the video), import /
 * export as JSON.
 */
export default function LayoutsDialog({ layouts, setLayouts, applyLayout, saveLayout, layoutName, setLayoutName, widgetsCount, setStatus, confirm, onClose }) {
  const [filter, setFilter] = useState('');
  const exportOne = async (l) => {
    const p = await window.api.saveJson('Export layout', l.name.replace(/[^\w.-]+/g, '_') + '.layout.json');
    if (!p) return;
    const widgets = l.widgets.map(({ id, ...w }) => w);
    await window.api.writeText(p, JSON.stringify({ app: 'telemetry-overlay', type: 'layout', version: 1, name: l.name, layout: l.layout, widgets }, null, 2));
    setStatus('Exported layout "' + l.name + '" (' + widgets.length + ' widgets) to ' + p);
  };
  // names are unique: importing a layout whose name is already stored replaces it (after a confirmation)
  const importOne = async () => {
    const p = await window.api.openJson('Import layout');
    if (!p) return;
    try {
      const base = p.split(/[\\/]/).pop().replace(/(\.layout)?\.json$/i, '');
      const l = layoutFromJson(JSON.parse(await window.api.readText(p)), base);
      const existing = layouts.find((x) => x.name.trim() === l.name);
      if (existing && !(await confirm(`A layout named "${l.name}" is already saved. Overwrite it?`, { title: 'Overwrite layout?' }))) return;
      const entry = { ...l, id: existing ? existing.id : uid(), savedAt: Date.now() };
      setLayouts((ls) => (existing ? ls.map((x) => (x.id === existing.id ? entry : x)) : [...ls, entry]));
      setStatus('Imported layout "' + l.name + '" (' + l.widgets.length + ' widgets)' + (existing ? ', replaced the stored one' : ''));
    } catch (e) {
      setStatus('Import error: ' + e.message);
    }
  };
  const removeOne = async (id) => {
    const l = layouts.find((x) => x.id === id);
    if (!l) return;
    if (!(await confirm(`Delete layout "${l.name}"?`))) return;
    setLayouts((ls) => ls.filter((x) => x.id !== id));
  };
  const load = async (l) => {
    await applyLayout(l);
    onClose();
  };

  const q = filter.trim().toLowerCase();
  const shown = byName(q ? layouts.filter((l) => (l.name + ' ' + l.widgets.map((w) => w.name).join(' ')).toLowerCase().includes(q)) : layouts);
  const canSave = widgetsCount > 0 && layoutName.trim();

  return (
    <Dialog title="Layouts" icon="layouts" onClose={onClose} width={620} zIndex={60}>
      <div className="stack">
        <div className="card card-high">
          <div className="card-head accent" style={{ marginBottom: 8 }}>
            <Icon name="save" />
            <span className="card-title">Save the current arrangement</span>
            <span className="card-meta">{widgetsCount ? widgetsCount + (widgetsCount === 1 ? ' widget' : ' widgets') : 'no widgets on the video'}</span>
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" value={layoutName} onChange={(e) => setLayoutName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canSave && saveLayout(layoutName)} placeholder="Layout name" spellCheck={false} />
            <button className="btn btn-filled" onClick={() => saveLayout(layoutName)} disabled={!canSave} title={widgetsCount ? 'Store all widgets on the video — positions, sizes, code, settings — under this name' : 'No widgets on the video'}>
              Save
            </button>
          </div>
          <div className="hint mt-2">A layout is a complete copy of every widget on the video. A saved layout with the same name is replaced.</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="title flex-1">Saved layouts</span>
          <span className="card-meta">{layouts.length ? layouts.length + (layouts.length === 1 ? ' layout' : ' layouts') : 'none yet'}</span>
          <button className="btn btn-text btn-sm" onClick={importOne}>
            <Icon name="upload" />
            Import…
          </button>
        </div>
        {layouts.length > 3 && (
          <div className="search">
            <Icon name="search" />
            <input className="input input-sm" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by layout or widget name…" spellCheck={false} />
          </div>
        )}
        <div className="list">
          {shown.map((l) => (
            <Item key={l.id} l={l} applyLayout={load} exportOne={exportOne} removeOne={removeOne} />
          ))}
        </div>
        {!layouts.length && <div className="hint">No layouts yet — arrange widgets on the video, then save them above. Loading a layout rescales it to the current video size.</div>}
        {layouts.length > 0 && !shown.length && <div className="hint">Nothing matches “{filter.trim()}”.</div>}
      </div>
    </Dialog>
  );
}
