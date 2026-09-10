import React, { useState } from 'react';
import StepScreen from './StepScreen.jsx';
import Icon, { WidgetIcon } from '../components/Icon.jsx';
import { ColumnsInput } from '../components/ColumnsInput.jsx';
import SettingsForm from '../components/SettingsForm.jsx';
import WidgetPicker from '../components/WidgetPicker.jsx';
import LayoutsDialog from '../components/LayoutsDialog.jsx';
import { parseColumns, renderWidget, uid, cleanWidget } from '../widgetRuntime.js';
import { parseSettings } from '../widgetSettings.js';
import { toTele } from '../time.js';

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}

function Switch({ checked, onChange, title, children }) {
  return (
    <label className={'switch' + (checked ? ' on' : '')} title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {children}
    </label>
  );
}

// Top-level row component (see Stage / lists: an inline component would remount every frame during playback).
function WidgetRow({ w, active, onSelect, onOpen, updateWidget, move, duplicate, remove }) {
  const hidden = w.visible === false;
  return (
    <div className={'list-item' + (active ? ' active' : '') + (hidden ? ' hidden-widget' : '')} onClick={() => onSelect(w.id)} onDoubleClick={onOpen}>
      <span className="li-lead">
        <WidgetIcon widget={w} />
      </span>
      <div className="li-body">
        <div className="li-title">{w.name}</div>
        <div className="li-sub mono">{w.columns || '(no columns)'}</div>
      </div>
      <div className="li-trail">
        <button className="btn btn-icon sm" onClick={(e) => (e.stopPropagation(), updateWidget(w.id, { visible: hidden }))} title={hidden ? 'Show on the video' : 'Hide from the video (and the export)'}>
          <Icon name={hidden ? 'eyeOff' : 'eye'} />
        </button>
        <button className="btn btn-icon sm" onClick={(e) => (e.stopPropagation(), move(w.id, -1))} title="Send backward">
          <Icon name="up" />
        </button>
        <button className="btn btn-icon sm" onClick={(e) => (e.stopPropagation(), move(w.id, 1))} title="Bring forward">
          <Icon name="down" />
        </button>
        <button className="btn btn-icon sm" onClick={(e) => (e.stopPropagation(), duplicate(w))} title="Duplicate">
          <Icon name="copy" />
        </button>
        <button className="btn btn-icon sm btn-danger" onClick={(e) => (e.stopPropagation(), remove(w.id))} title="Delete from the video">
          <Icon name="delete" />
        </button>
      </div>
    </div>
  );
}

/** Step 3 — put widgets on the video, arrange them, tune their settings, manage the library and layouts. */
export default function WidgetsStep({ app }) {
  const { widgets, selected, setSelectedId, addWidget, updateWidget, removeWidget, setWidgets, columnNames, store, time, sync, widgetEnv, openEditorFor, saveToLibrary, library, setLibrary, layouts, setLayouts, applyLayout, saveLayout, layoutName, setLayoutName, setStatus, confirm, grid, setGrid, editMode, setEditMode, setLibEditId } = app;
  const [picker, setPicker] = useState(false);
  const [layoutsOpen, setLayoutsOpen] = useState(false);

  const move = (id, dir) =>
    setWidgets((ws) => {
      const i = ws.findIndex((w) => w.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ws.length) return ws;
      const c = ws.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const duplicate = (w) => addWidget({ ...w, id: undefined, name: w.name + ' copy', x: w.x + 20, y: w.y + 20 });

  const cols = selected ? parseColumns(selected.columns) : [];
  const missing = cols.filter((c) => !store.columns[c]);
  const out = selected ? renderWidget(selected, store, time, sync, widgetEnv) : null;
  const sdef = selected ? parseSettings(selected.settings) : null;
  const setConfig = (key, value) => {
    const config = { ...(selected.config || {}) };
    if (value === undefined) delete config[key];
    else config[key] = value;
    updateWidget(selected.id, { config });
  };

  // ---- library import / export (the picker's header) ----
  const exportLib = async (items, name) => {
    const p = await window.api.saveJson('Export widgets', name);
    if (!p) return;
    await window.api.writeText(p, JSON.stringify({ app: 'telemetry-overlay', type: 'widgets', version: 1, widgets: items.map(({ id, ...w }) => w) }, null, 2));
    setStatus('Exported ' + items.length + ' widget(s) to ' + p);
  };
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
  const removeFromLibrary = async (id) => {
    const w = library.find((x) => x.id === id);
    if (!w) return;
    if (!(await confirm(`Delete "${w.name}" from the library?`))) return;
    setLibrary((l) => l.filter((x) => x.id !== id));
  };

  const tools = (
    <>
      <Switch checked={editMode} onChange={setEditMode} title="Move and resize widgets on the video">
        Edit
      </Switch>
      <Switch checked={grid.snap} onChange={(v) => setGrid((g) => ({ ...g, snap: v }))} title="Snap widget position and size to the grid while dragging (hold Alt to bypass)">
        Snap
      </Switch>
      <Switch checked={grid.show} onChange={(v) => setGrid((g) => ({ ...g, show: v }))} title="Show the layout grid over the video">
        Grid
      </Switch>
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--on-surface-variant)' }} title="Grid size in video pixels">
        <input className="input input-sm mono" type="number" min={2} max={500} step={1} value={grid.size} style={{ width: 64 }} onChange={(e) => setGrid((g) => ({ ...g, size: Math.max(2, Number(e.target.value) || 2) }))} />
        px
      </label>
      <span className="ml-auto" />
      {app.video && (app.video.proxy || app.video.liveProxy) && (
        <span className="chip chip-sm chip-tele" title="The preview plays a re-encoded proxy; export always uses the original file">
          proxy preview
        </span>
      )}
      <span className="hint">double-click a widget to edit its code</span>
    </>
  );

  return (
    <StepScreen
      app={app}
      editMode={editMode}
      tools={tools}
      empty={
        <div className="empty-state">
          <Icon name="widgets" />
          <div className="es-title">Empty stage</div>
          <div className="hint" style={{ maxWidth: 360 }}>
            No video is loaded — widgets can still be placed on a 1280×720 stage and are rescaled when a video is opened.
          </div>
        </div>
      }
    >
      <div className="card">
        <div className="card-head accent">
          <Icon name="widgets" />
          <span className="card-title">Widgets on video</span>
          <span className="card-meta">{widgets.length ? widgets.length + (widgets.length === 1 ? ' widget' : ' widgets') : 'none'}</span>
        </div>
        <div className="flex gap-2 mb-3">
          <button className="btn btn-filled" onClick={() => setPicker(true)}>
            <Icon name="add" />
            Add widget
          </button>
          <button className="btn btn-tonal" onClick={() => setLayoutsOpen(true)} title="Save the current arrangement or load a saved one">
            <Icon name="layouts" />
            Layouts
            {layouts.length > 0 && <span className="card-meta">{layouts.length}</span>}
          </button>
        </div>
        {widgets.length === 0 ? (
          <div className="hint">No widgets yet. Add one from the examples or your library, or load a saved layout.</div>
        ) : (
          <div className="list">
            {widgets.map((w) => (
              <WidgetRow key={w.id} w={w} active={!!selected && selected.id === w.id} onSelect={setSelectedId} onOpen={() => openEditorFor(w.id)} updateWidget={updateWidget} move={move} duplicate={duplicate} remove={removeWidget} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="card">
          <div className="card-head tele">
            <WidgetIcon widget={selected} />
            <span className="card-title">Selected widget</span>
            <span className="card-meta">
              {selected.w}×{selected.h} px
            </span>
          </div>
          <div className="stack">
            <div className="flex items-center gap-2">
              <input className="input" value={selected.name} onChange={(e) => updateWidget(selected.id, { name: e.target.value })} spellCheck={false} />
              <button className="btn btn-tonal" onClick={() => openEditorFor(selected.id)} title="Open the full editor with live preview">
                <Icon name="code" />
                Edit code
              </button>
            </div>
            <div>
              <span className="label mt-0">Columns → ctx.values[0], ctx.values[1], …</span>
              <ColumnsInput value={selected.columns} onChange={(v) => updateWidget(selected.id, { columns: v })} columnNames={columnNames} />
              {missing.length > 0 && <div className="text-xs mt-1 text-[var(--warn)]">Not found in the loaded telemetry: {missing.join(', ')}</div>}
              {cols.length > 0 && (
                <div className="mono text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>
                  {cols.map((c, i) => `[${i}] ${fmt(store.valueAt(c, toTele(time, sync)))}`).join('   ')}
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['x', 'y', 'w', 'h'].map((k) => (
                <label key={k}>
                  <span className="label mt-0">{k}</span>
                  <input className="input input-sm mono" type="number" value={selected[k]} onChange={(e) => updateWidget(selected.id, { [k]: Number(e.target.value) })} />
                </label>
              ))}
            </div>
            <div>
              <span className="label mt-0">Settings</span>
              <SettingsForm key={selected.id} defs={sdef.defs} sections={sdef.sections} error={sdef.error} config={selected.config} onChange={setConfig} onReset={() => updateWidget(selected.id, { config: {} })} />
            </div>
            {out && out.error && (
              <div className="banner error">
                <Icon name="warning" />
                <pre className="whitespace-pre-wrap m-0 text-xs">{out.error}</pre>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-outlined" onClick={() => saveToLibrary(selected)} title="Store a copy of this widget in the library (a library widget with the same name is replaced)">
                <Icon name="library" />
                Save to library
              </button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <WidgetPicker
          library={library}
          onAdd={(w) => {
            addWidget({ ...w, id: undefined, name: w.name });
            setPicker(false);
          }}
          onNew={() => {
            addWidget();
            setPicker(false);
          }}
          onEdit={(id) => {
            setPicker(false);
            setLibEditId(id);
          }}
          onExport={(w) => exportLib([w], w.name.replace(/[^\w.-]+/g, '_') + '.json')}
          onExportAll={() => exportLib(library, 'widgets.json')}
          onImport={importLib}
          onDelete={removeFromLibrary}
          onClose={() => setPicker(false)}
        />
      )}
      {layoutsOpen && (
        <LayoutsDialog layouts={layouts} setLayouts={setLayouts} applyLayout={applyLayout} saveLayout={saveLayout} layoutName={layoutName} setLayoutName={setLayoutName} widgetsCount={widgets.length} setStatus={setStatus} confirm={confirm} onClose={() => setLayoutsOpen(false)} />
      )}
    </StepScreen>
  );
}
