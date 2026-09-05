import React, { useState } from 'react';
import { EXAMPLE_WIDGETS } from '../examples.js';
import { byName, uid, cleanWidget } from '../widgetRuntime.js';

const EXAMPLES_OPEN_KEY = 'telemetry-overlay.library.examplesOpen';

// Row components live at the top level, not inside LibraryPanel: an inline component gets a new
// identity every render, so React remounts each row whenever the app re-renders — during
// video playback (re-render per frame) the buttons are replaced mid-click and never fire.
function Meta({ w }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="font-medium truncate">{w.name}</div>
      <div className="mono text-[11px] truncate" style={{ color: 'var(--muted)' }}>
        {w.columns || '(no columns)'} · {w.w}×{w.h}
      </div>
    </div>
  );
}

function OwnItem({ w, addWidget, editWidget, exportOne, removeOne }) {
  return (
    <div className="card flex items-center gap-2" style={{ padding: '8px 10px' }}>
      <Meta w={w} />
      <button className="btn btn-xs btn-primary" onClick={() => addWidget({ ...w, id: undefined })}>
        Add
      </button>
      <button className="btn btn-xs" onClick={() => editWidget(w.id)} title="Edit this library widget (code, settings, columns, size)">
        Edit
      </button>
      <button className="btn btn-xs btn-icon" onClick={() => exportOne(w)} title="Export this widget">
        ⇩
      </button>
      <button className="btn btn-xs btn-icon btn-danger" onClick={() => removeOne(w.id)} title="Delete from library">
        ✕
      </button>
    </div>
  );
}

function ExampleItem({ w, addWidget }) {
  return (
    <div className="card flex items-center gap-2" style={{ padding: '8px 10px' }}>
      <Meta w={{ ...w, name: w.name.replace(/^Example:\s*/, '') }} />
      <button className="btn btn-xs btn-primary" onClick={() => addWidget({ ...w, id: undefined })}>
        Add
      </button>
    </div>
  );
}

/** Library = the user's own widgets (stored in the app, editable, import/export) + the read-only built-in examples. */
export default function LibraryPanel({ library, setLibrary, addWidget, editWidget, setStatus, confirm }) {
  const [filter, setFilter] = useState('');
  const [examplesOpen, setExamplesOpen] = useState(() => {
    try {
      return localStorage.getItem(EXAMPLES_OPEN_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const toggleExamples = () => {
    setExamplesOpen((o) => {
      try {
        localStorage.setItem(EXAMPLES_OPEN_KEY, o ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !o;
    });
  };

  const exportLib = async (items, name) => {
    const p = await window.api.saveJson('Export widgets', name);
    if (!p) return;
    await window.api.writeText(p, JSON.stringify({ app: 'telemetry-overlay', type: 'widgets', version: 1, widgets: items.map(({ id, ...w }) => w) }, null, 2));
    setStatus('Exported ' + items.length + ' widget(s) to ' + p);
  };
  const exportOne = (w) => exportLib([w], w.name.replace(/[^\w.-]+/g, '_') + '.json');
  // names are unique in the library: importing a widget whose name is already there replaces it (after a confirmation)
  const importLib = async () => {
    const p = await window.api.openJson('Import widgets');
    if (!p) return;
    try {
      const j = JSON.parse(await window.api.readText(p));
      const items = (Array.isArray(j) ? j : j.widgets || []).filter((w) => w && typeof w.code === 'string');
      if (!items.length) throw new Error('No widgets in file');
      const byName = new Map(library.map((w) => [w.name.trim(), w]));
      const clashes = items.filter((w) => byName.has((w.name || '').trim()));
      if (clashes.length) {
        const list = clashes.map((w) => `"${(w.name || '').trim()}"`).join(', ');
        if (!(await confirm(`${clashes.length === 1 ? 'A widget named ' + list + ' is' : clashes.length + ' widgets are'} already in the library (${list}). Overwrite?`, { title: 'Overwrite widgets?' }))) return;
      }
      setLibrary((l) => {
        const next = l.slice();
        for (const w of items) {
          const name = (w.name || 'Imported widget').trim();
          const copy = cleanWidget({ ...w, name, visible: true });
          const i = next.findIndex((x) => x.name.trim() === name);
          if (i >= 0) next[i] = { ...copy, id: next[i].id };
          else next.push({ ...copy, id: uid() });
        }
        return next;
      });
      setStatus('Imported ' + items.length + ' widget(s)' + (clashes.length ? ', ' + clashes.length + ' replaced' : ''));
    } catch (e) {
      setStatus('Import error: ' + e.message);
    }
  };
  const removeOne = async (id) => {
    const w = library.find((x) => x.id === id);
    if (!w) return;
    if (!(await confirm(`Delete "${w.name}" from the library?`))) return;
    setLibrary((l) => l.filter((x) => x.id !== id));
  };

  const q = filter.trim().toLowerCase();
  const shown = byName(q ? library.filter((w) => (w.name + ' ' + (w.columns || '')).toLowerCase().includes(q)) : library);
  const examples = byName(EXAMPLE_WIDGETS, (w) => w.name.replace(/^Example:\s*/, ''));

  return (
    <div>
      <section className="bay bay-amber">
        <header className="bay-head">
          <span className="bay-tick" />
          Saved widgets
          <span className="bay-note">{library.length ? library.length + (library.length === 1 ? ' widget' : ' widgets') : 'empty'}</span>
          <button className="btn btn-xs" onClick={importLib}>
            Import…
          </button>
          <button className="btn btn-xs" onClick={() => exportLib(library, 'widgets.json')} disabled={!library.length}>
            Export all…
          </button>
        </header>
        <div className="bay-body">
          <p className="hint mb-2">Widgets saved here stay in the application and can be added to any project. Edit changes the stored copy only, not the widgets on the video.</p>
          {library.length > 0 && <input className="input mb-2" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or column…" spellCheck={false} />}
          <div className="flex flex-col gap-1.5">
            {shown.map((w) => (
              <OwnItem key={w.id} w={w} addWidget={addWidget} editWidget={editWidget} exportOne={exportOne} removeOne={removeOne} />
            ))}
          </div>
          {!library.length && <div className="hint">No own widgets yet — select a widget on the video and click "Save to library".</div>}
          {library.length > 0 && !shown.length && <div className="hint">Nothing matches "{filter.trim()}".</div>}
        </div>
      </section>

      <section className="bay bay-tele">
        <header className={'bay-head bay-toggle' + (examplesOpen ? ' open' : '')} onClick={toggleExamples} title={examplesOpen ? 'Collapse the examples' : 'Show the examples'}>
          <svg className="bay-chev" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3.5 1.5 7 5l-3.5 3.5" />
          </svg>
          <span className="bay-tick" />
          Examples
          <span className="bay-note">{EXAMPLE_WIDGETS.length} built-in</span>
        </header>
        <div className={'bay-drawer' + (examplesOpen ? ' open' : '')}>
          <div>
            <div className="bay-body">
              <p className="hint mb-2">Built-in, always current. Each has settings (colors, units, sizes) you change in the Widgets tab after adding one to the video; "Edit code" opens its code and the settings definition, "Save to library" keeps your version.</p>
              <div className="flex flex-col gap-1.5">
                {examples.map((w) => (
                  <ExampleItem key={w.name} w={w} addWidget={addWidget} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
