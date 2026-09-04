import React, { useState } from 'react';
import { byName, uid } from '../widgetRuntime.js';

/** Layout file / stored entry: { name, layout: {w, h} (the video size the coordinates are in), widgets: [...] } */
export function layoutFromJson(j, fallbackName) {
  const widgets = (Array.isArray(j) ? j : (j && j.widgets) || []).filter((w) => w && typeof w.code === 'string');
  if (!widgets.length) throw new Error('No widgets in file');
  // a project file works too: it carries the same widgets + layout fields; older ones were designed on 1080p
  const space = j && j.layout && j.layout.w ? { w: j.layout.w, h: j.layout.h } : { w: 1920, h: 1080 };
  return { name: ((j && j.name) || fallbackName || 'Imported layout').trim(), layout: space, widgets: widgets.map(({ id, ...w }) => w) };
}

// Top-level row component — see LibraryPanel for why it must not be defined inside the panel.
function Item({ l, applyLayout, exportOne, removeOne }) {
  const n = l.widgets.length;
  return (
    <div className="card flex items-center gap-2" style={{ padding: '8px 10px' }}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{l.name}</div>
        <div className="mono text-[11px] truncate" style={{ color: 'var(--muted)' }}>
          {n} {n === 1 ? 'widget' : 'widgets'} · {l.layout.w}×{l.layout.h}
          {l.savedAt ? ' · ' + new Date(l.savedAt).toLocaleDateString() : ''}
        </div>
      </div>
      <button className="btn btn-xs btn-primary" onClick={() => applyLayout(l)} title="Replace the widgets on the video with this layout">
        Load
      </button>
      <button className="btn btn-xs btn-icon" onClick={() => exportOne(l)} title="Export this layout as JSON">
        ⇩
      </button>
      <button className="btn btn-xs btn-icon btn-danger" onClick={() => removeOne(l.id)} title="Delete this layout">
        ✕
      </button>
    </div>
  );
}

/** Saved layouts: complete copies of all widgets on the video, stored in the app; import/export as JSON. */
export default function LayoutsPanel({ layouts, setLayouts, applyLayout, setStatus, confirm }) {
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

  const q = filter.trim().toLowerCase();
  const shown = byName(q ? layouts.filter((l) => (l.name + ' ' + l.widgets.map((w) => w.name).join(' ')).toLowerCase().includes(q)) : layouts);

  return (
    <div>
      <section className="bay bay-amber">
        <header className="bay-head">
          <span className="bay-tick" />
          Saved layouts
          <span className="bay-note">{layouts.length ? layouts.length + (layouts.length === 1 ? ' layout' : ' layouts') : 'empty'}</span>
          <button className="btn btn-xs" onClick={importOne}>
            Import…
          </button>
        </header>
        <div className="bay-body">
          <p className="hint mb-2">A layout is a complete copy of all widgets on the video — positions, sizes, code and CSS. Save the current one in the Widgets tab ("Save to layout"); Load replaces the widgets on the video and rescales them to the current video size.</p>
          {layouts.length > 0 && <input className="input mb-2" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by layout or widget name…" spellCheck={false} />}
          <div className="flex flex-col gap-1.5">
            {shown.map((l) => (
              <Item key={l.id} l={l} applyLayout={applyLayout} exportOne={exportOne} removeOne={removeOne} />
            ))}
          </div>
          {!layouts.length && <div className="hint">No layouts yet — arrange widgets on the video, then use "Save to layout" in the Widgets tab.</div>}
          {layouts.length > 0 && !shown.length && <div className="hint">Nothing matches "{filter.trim()}".</div>}
        </div>
      </section>
    </div>
  );
}
