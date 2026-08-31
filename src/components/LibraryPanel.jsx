import React from 'react';
import { EXAMPLE_WIDGETS } from '../examples.js';

// Top-level component, not defined inside LibraryPanel: an inline component gets a new
// identity every render, so React remounts each row whenever the app re-renders — during
// video playback (re-render per frame) the buttons are replaced mid-click and never fire.
function Item({ w, addWidget, exportLib, removeFromLibrary }) {
  return (
    <div className="card flex items-center gap-2" style={{ padding: '8px 10px' }}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{w.name.replace(/^Example:\s*/, '')}</div>
        <div className="mono text-[11px] truncate" style={{ color: 'var(--muted)' }}>
          {w.columns || '(no columns)'} · {w.w}×{w.h}
        </div>
      </div>
      <button className="btn btn-xs btn-primary" onClick={() => addWidget({ ...w, id: undefined })}>
        Add
      </button>
      <button className="btn btn-xs btn-icon" onClick={() => exportLib([w], w.name.replace(/[^\w.-]+/g, '_') + '.json')} title="Export this widget">
        ⇩
      </button>
      <button className="btn btn-xs btn-icon btn-danger" onClick={() => removeFromLibrary(w.id)} title="Delete from library">
        ✕
      </button>
    </div>
  );
}

export default function LibraryPanel({ library, setLibrary, addWidget, setStatus }) {
  const restoreExamples = () => {
    setLibrary((l) => [...l.filter((w) => !w.name.startsWith('Example:')), ...EXAMPLE_WIDGETS.map((w) => ({ ...w, id: Math.random().toString(36).slice(2, 10) }))]);
    setStatus('Example widgets restored to their current versions');
  };
  const exportLib = async (items, name) => {
    const p = await window.api.saveJson('Export widgets', name);
    if (!p) return;
    await window.api.writeText(p, JSON.stringify({ app: 'telemetry-overlay', type: 'widgets', version: 1, widgets: items.map(({ id, ...w }) => w) }, null, 2));
    setStatus('Exported ' + items.length + ' widget(s) to ' + p);
  };
  const importLib = async () => {
    const p = await window.api.openJson('Import widgets');
    if (!p) return;
    try {
      const j = JSON.parse(await window.api.readText(p));
      const items = Array.isArray(j) ? j : j.widgets || [];
      if (!items.length) throw new Error('No widgets in file');
      setLibrary((l) => [...l, ...items.map((w) => ({ ...w, id: Math.random().toString(36).slice(2, 10) }))]);
      setStatus('Imported ' + items.length + ' widget(s)');
    } catch (e) {
      setStatus('Import error: ' + e.message);
    }
  };

  const examples = library.filter((w) => w.name.startsWith('Example:'));
  const own = library.filter((w) => !w.name.startsWith('Example:'));
  const removeFromLibrary = (id) => setLibrary((l) => l.filter((x) => x.id !== id));

  return (
    <div>
      <div className="section-title">
        Saved widgets
        <span style={{ marginLeft: 'auto' }} className="flex gap-1">
          <button className="btn btn-xs" onClick={importLib}>
            Import…
          </button>
          <button className="btn btn-xs" onClick={() => exportLib(library, 'widgets.json')} disabled={!library.length}>
            Export all…
          </button>
        </span>
      </div>
      <p className="hint mb-2">Widgets saved here stay in the application and can be added to any project. Use Import/Export to share them as JSON.</p>
      <div className="flex flex-col gap-1.5">
        {own.map((w) => (
          <Item key={w.id} w={w} addWidget={addWidget} exportLib={exportLib} removeFromLibrary={removeFromLibrary} />
        ))}
      </div>
      {!own.length && <div className="hint">No own widgets yet — select a widget on the video and click "Save to library".</div>}

      <div className="section-title mt-5">
        Examples
        <button className="btn btn-xs" style={{ marginLeft: 'auto' }} onClick={restoreExamples} title="Re-add the built-in example widgets (replaces existing 'Example:' entries)">
          Restore
        </button>
      </div>
      <p className="hint mb-2">Each example starts with a SETTINGS block — colors, units, sizes. Add one, then "Edit code".</p>
      <div className="flex flex-col gap-1.5">
        {examples.map((w) => (
          <Item key={w.id} w={w} addWidget={addWidget} exportLib={exportLib} removeFromLibrary={removeFromLibrary} />
        ))}
      </div>
    </div>
  );
}
