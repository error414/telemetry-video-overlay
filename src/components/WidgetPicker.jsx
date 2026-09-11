import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXAMPLE_WIDGETS } from '../examples.js';
import { byName, widgetMatches } from '../widgetRuntime.js';
import Dialog from './Dialog.jsx';
import Icon, { WidgetIcon } from './Icon.jsx';

const SOURCE_KEY = 'telemetry-overlay.picker.source';

/**
 * "Add widget" dialog: a grid of cards — the built-in examples and the user's own library — with
 * a text search and tag (category) filter chips. Clicking a card puts a copy on the video. Own
 * widgets carry a menu (edit, export, delete); the header holds import / export / new widget.
 * Card components are top-level (see Stage / lists: the app re-renders every frame while playing).
 */
export default function WidgetPicker({ library, onAdd, onNew, onEdit, onExport, onExportAll, onImport, onDelete, onClose }) {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState([]);
  const [source, setSource] = useState(() => {
    try {
      return localStorage.getItem(SOURCE_KEY) || 'all';
    } catch {
      return 'all';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SOURCE_KEY, source);
    } catch {
      /* ignore */
    }
  }, [source]);
  const searchRef = useRef(null);
  useEffect(() => searchRef.current?.focus(), []);

  const examples = useMemo(() => byName(EXAMPLE_WIDGETS.map((w) => ({ ...w, name: w.name.replace(/^Example:\s*/, ''), example: true }))), []);
  const own = useMemo(() => byName(library), [library]);
  const all = useMemo(() => (source === 'examples' ? examples : source === 'own' ? own : [...own, ...examples]), [source, examples, own]);
  // tag vocabulary of what is currently listed, most used first
  const vocab = useMemo(() => {
    const count = new Map();
    for (const w of all) for (const t of w.tags || []) count.set(t, (count.get(t) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [all]);
  const shown = useMemo(() => all.filter((w) => widgetMatches(w, query, tags)), [all, query, tags]);
  const toggleTag = (t) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <Dialog size="wide" onClose={onClose} bodyClassName="flex flex-col" className="gap-0" zIndex={60}>
      <div className="picker-tools">
        <div className="picker-row">
          <div className="dialog-title" style={{ flex: 'none' }}>
            <Icon name="widgets" />
            Add widget
          </div>
          <div className="seg" role="tablist" style={{ marginLeft: 8 }}>
            <button className={source === 'all' ? 'on' : ''} onClick={() => setSource('all')}>
              All
            </button>
            <button className={source === 'examples' ? 'on' : ''} onClick={() => setSource('examples')}>
              Examples
              <span className="card-meta">{examples.length}</span>
            </button>
            <button className={source === 'own' ? 'on' : ''} onClick={() => setSource('own')}>
              My library
              <span className="card-meta">{own.length}</span>
            </button>
          </div>
          <div className="search flex-1" style={{ minWidth: 220 }}>
            <Icon name="search" />
            <input ref={searchRef} className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, column or #tag…" spellCheck={false} />
            {query && (
              <button className="btn btn-icon sm clear" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="close" />
              </button>
            )}
          </div>
          <button className="btn btn-icon" onClick={onImport} title="Import widgets from a JSON file into my library">
            <Icon name="upload" />
          </button>
          <button className="btn btn-icon" onClick={onExportAll} disabled={!own.length} title="Export my library to a JSON file">
            <Icon name="download" />
          </button>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {vocab.length > 0 && (
          <div className="picker-tags">
            <Icon name="tag" style={{ color: 'var(--on-surface-variant)' }} />
            {vocab.map((t) => (
              <button key={t} className={'chip' + (tags.includes(t) ? ' on' : '')} onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)}>
                {t}
              </button>
            ))}
            {tags.length > 0 && (
              <button className="btn btn-text btn-sm" onClick={() => setTags([])}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="wgrid">
          <button className="wcard wcard-new" onClick={onNew} title="A blank widget with the default code — edit it in the editor">
            <Icon name="add" />
            New blank widget
          </button>
          {shown.map((w) => (
            <Card key={w.example ? 'ex:' + w.name : w.id} w={w} onAdd={onAdd} onEdit={onEdit} onExport={onExport} onDelete={onDelete} />
          ))}
          {!shown.length && (
            <div className="picker-empty">
              {source === 'own' && !own.length ? (
                <>
                  Your library is empty. Select a widget on the video and click <b>Save to library</b>, or import a JSON file.
                </>
              ) : (
                <>Nothing matches — try another word or fewer tags.</>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Card({ w, onAdd, onEdit, onExport, onDelete }) {
  const [menu, setMenu] = useState(null); // {left, top}
  const btnRef = useRef(null);
  const openMenu = (e) => {
    e.stopPropagation();
    const r = btnRef.current.getBoundingClientRect();
    setMenu({ left: Math.min(r.left, window.innerWidth - 200), top: r.bottom + 4 });
  };
  return (
    <div className="wcard" role="button" tabIndex={0} onClick={() => onAdd(w)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onAdd(w))} title={w.example ? 'Built-in example — click to add a copy to the video' : 'Click to add a copy to the video'}>
      <div className="wcard-top">
        <span className={'wcard-icon' + (w.example ? '' : ' own')}>
          <WidgetIcon widget={w} />
        </span>
        <span className="wcard-name">{w.name}</span>
      </div>
      <div className="wcard-cols" title={w.columns || ''}>
        {w.columns || '(no columns)'} · {w.w}×{w.h}
      </div>
      {w.tags && w.tags.length > 0 && (
        <div className="wcard-tags">
          {w.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      )}
      {!w.example && (
        <button ref={btnRef} className={'btn btn-icon sm wcard-more' + (menu ? ' open' : '')} onClick={openMenu} aria-label="Widget actions" aria-haspopup="menu">
          <Icon name="more" />
        </button>
      )}
      {menu && (
        <Menu at={menu} onClose={() => setMenu(null)}>
          <button className="menu-item" onClick={() => (setMenu(null), onEdit(w.id))}>
            <Icon name="code" />
            Edit code and settings
          </button>
          <button className="menu-item" onClick={() => (setMenu(null), onExport(w))}>
            <Icon name="download" />
            Export to JSON…
          </button>
          <div className="menu-sep" />
          <button className="menu-item danger" onClick={() => (setMenu(null), onDelete(w.id))}>
            <Icon name="delete" />
            Delete from library
          </button>
        </Menu>
      )}
    </div>
  );
}

/** Popup menu at a fixed position; closes on outside click / Escape. Portalled so the card's overflow cannot clip it. */
export function Menu({ at, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="menu" role="menu" style={{ left: at.left, top: at.top }} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}
