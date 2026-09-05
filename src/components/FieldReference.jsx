import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FIELDS, FRAMES, NOTES, filterFields, matchColumns } from '../fieldReference.js';

/**
 * INAV blackbox field reference behind the "?" of every column input: a searchable table of all
 * fields (unit in the log, unit in the Blackbox Explorer, meaning) that doubles as a picker —
 * the fields present in the loaded log carry their concrete column names as chips, clicking a
 * chip puts the column into the input.
 *
 * Reads the field vocabulary the pilot already knows from the Explorer; teal = telemetry data
 * throughout, amber only for what is selected in the input right now.
 */

/** `**bold**` and `` `code` `` -> React nodes; the only markup the reference uses. */
function rich(text, words) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{highlight(p.slice(2, -2), words)}</strong>;
    if (p.startsWith('`')) return <code key={i}>{highlight(p.slice(1, -1), words)}</code>;
    return <React.Fragment key={i}>{highlight(p, words)}</React.Fragment>;
  });
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps every occurrence of the search words in <mark>. */
function highlight(text, words) {
  if (!words.length || !text) return text;
  const re = new RegExp('(' + words.map(escapeRe).join('|') + ')', 'gi');
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

export function FieldReferenceDialog({ columnNames = [], selected = [], onPick, onClose, single = false }) {
  const [query, setQuery] = useState('');
  const [frame, setFrame] = useState('all');
  const [onlyLoaded, setOnlyLoaded] = useState(false);
  const searchRef = useRef(null);

  const loaded = useMemo(() => matchColumns(columnNames), [columnNames]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const visible = useMemo(() => {
    let list = filterFields(FIELDS, query);
    if (frame !== 'all') list = list.filter((f) => f.frame === frame);
    if (onlyLoaded) list = list.filter((f) => loaded.has(f));
    return list;
  }, [query, frame, onlyLoaded, loaded]);

  const perFrame = useMemo(() => {
    const m = {};
    for (const fr of FRAMES) m[fr.id] = FIELDS.filter((f) => f.frame === fr.id).length;
    return m;
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const hasLog = columnNames.length > 0;
  const groups = FRAMES.map((fr) => ({ ...fr, rows: visible.filter((f) => f.frame === fr.id) })).filter((g) => g.rows.length);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 120, background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="INAV blackbox field reference" className="fr-dialog">
        <header className="fr-head">
          <span className="bay-tick" />
          INAV blackbox fields
          <span className="fr-head-note">
            {FIELDS.length} fields · {hasLog ? `${loaded.size} in this log` : 'no telemetry loaded'}
          </span>
          <button className="btn btn-xs ml-auto" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="fr-tools">
          <div className="fr-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input ref={searchRef} className="input mono" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search name, unit or description" spellCheck={false} aria-label="Search fields" />
            {query && (
              <button className="fr-clear" onClick={() => (setQuery(''), searchRef.current?.focus())} aria-label="Clear search">
                ×
              </button>
            )}
          </div>
          <div className="fr-frames" role="tablist" aria-label="Frame type">
            <button className={'fr-frame' + (frame === 'all' ? ' fr-frame-on' : '')} onClick={() => setFrame('all')}>
              All
            </button>
            {FRAMES.map((fr) => (
              <button key={fr.id} className={'fr-frame' + (frame === fr.id ? ' fr-frame-on' : '')} onClick={() => setFrame(fr.id)} title={`${fr.label}: ${fr.note}`}>
                <span className="fr-letter">{fr.letter}</span>
                {fr.label.replace(' frame', '')}
                <span className="fr-count">{perFrame[fr.id]}</span>
              </button>
            ))}
          </div>
          <label className={'fr-only' + (hasLog ? '' : ' fr-only-off')} title={hasLog ? 'Show only the fields that exist in the loaded CSVs' : 'Load a blackbox first'}>
            <input type="checkbox" checked={onlyLoaded && hasLog} disabled={!hasLog} onChange={(e) => setOnlyLoaded(e.target.checked)} />
            in this log
          </label>
        </div>

        <div className="fr-scroll">
          {groups.length === 0 ? (
            <div className="fr-empty">
              No field matches <span className="mono">“{query.trim()}”</span>
              {onlyLoaded ? ' among the loaded columns' : ''}.<br />
              <span className="hint">Try a shorter word, a unit like “cm/s” or a frame letter above.</span>
            </div>
          ) : (
            <table className="fr-table">
              <thead>
                <tr>
                  <th className="fr-th-key">Field</th>
                  <th>In log</th>
                  <th>Viewer</th>
                  <th className="fr-th-desc">Description / source</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.id}>
                  <tr className="fr-group">
                    <td colSpan={4}>
                      <span className="fr-letter fr-letter-lg">{g.letter}</span>
                      {g.label}
                      <span className="fr-group-note">{g.note}</span>
                      <span className="fr-group-count">{g.rows.length}</span>
                    </td>
                  </tr>
                  {g.rows.map((f) => {
                    const hits = loaded.get(f);
                    return (
                      <tr key={g.id + ':' + f.key} className={'fr-row' + (hits ? ' fr-row-loaded' : '')}>
                        <td className="fr-key">
                          <span className="fr-dot" aria-hidden="true" />
                          <span className="mono fr-key-text">{highlight(f.key, words)}</span>
                          {hits && (
                            <span className="fr-cols">
                              {hits.map((c) => {
                                const on = selected.includes(c);
                                return (
                                  <button
                                    key={c}
                                    className={'fr-col' + (on ? ' fr-col-on' : '')}
                                    disabled={!onPick}
                                    onClick={() => onPick && onPick(c, on)}
                                    title={onPick ? (on ? (single ? 'Current column' : 'Remove from the field') : single ? 'Use this column' : 'Add to the field') : 'Column in the loaded log'}
                                  >
                                    {c}
                                  </button>
                                );
                              })}
                            </span>
                          )}
                        </td>
                        <td className="fr-unit mono">{rich(f.log, words)}</td>
                        <td className="fr-unit mono">{rich(f.viewer, words)}</td>
                        <td className="fr-desc">{rich(f.desc, words)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          )}
        </div>

        <footer className="fr-foot">
          <details className="fr-notes">
            <summary>Notes on axes, units and conditional fields</summary>
            <ul>
              {NOTES.map((n, i) => (
                <li key={i}>{rich(n, [])}</li>
              ))}
            </ul>
          </details>
          <span className="fr-foot-hint">
            {hasLog
              ? onPick
                ? single
                  ? 'Click a column chip to use it · Esc closes'
                  : 'Click a column chip to add it to the field, click again to remove · Esc closes'
                : 'Column chips are the names in the loaded log · Esc closes'
              : 'Units as written by the firmware (“In log”) and as shown by the INAV Blackbox Explorer (“Viewer”) · Esc closes'}
          </span>
        </footer>
      </div>
    </div>,
    document.body
  );
}

/** The "?" mark placed inside a column input; opens the reference. */
export function FieldHelpMark({ onClick, disabled }) {
  return (
    <button type="button" className="col-help" onClick={onClick} disabled={disabled} title="INAV blackbox field reference: what each column holds and in which unit" aria-label="Field reference">
      ?
    </button>
  );
}
