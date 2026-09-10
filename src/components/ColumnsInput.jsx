import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parseColumns } from '../widgetRuntime.js';
import { FieldHelpMark, FieldReferenceDialog } from './FieldReference.jsx';

/**
 * Column name input with a suggestion list for the item under the caret and a "?" mark that opens
 * the INAV field reference (searchable table, doubles as a picker for the loaded columns).
 * `single` = one column (no comma-separated tokens).
 */
export function ColumnsInput({ value, onChange, columnNames, single = false, disabled = false, placeholder, title, style, className = '', small = false }) {
  value = value || '';
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const [caret, setCaret] = useState(value.length);
  const [rect, setRect] = useState(null);
  const [refOpen, setRefOpen] = useState(false);

  // chips in the reference: single field = replace and close, list = toggle the column in place
  const pickFromReference = (name, present) => {
    if (single) {
      onChange(name);
      setRefOpen(false);
      return;
    }
    const cols = parseColumns(value);
    const next = present ? cols.filter((c) => c !== name) : [...cols, name];
    onChange(next.join(', '));
  };

  // split into "before", current token, "after" relative to the caret
  const before = value.slice(0, caret);
  const after = value.slice(caret);
  const start = single ? 0 : before.lastIndexOf(',') + 1;
  const endRel = single ? -1 : after.indexOf(',');
  const end = endRel < 0 ? value.length : caret + endRel;
  const token = value.slice(start, end).trim().toLowerCase();
  // a single-column field holding a valid name offers the whole list again (switching columns should not require clearing it first)
  const exact = single && columnNames.some((c) => c.toLowerCase() === token);
  const matches = token && !exact ? columnNames.filter((c) => c.toLowerCase().includes(token) && c.toLowerCase() !== token) : columnNames;

  useEffect(() => setHi(0), [token]);
  // the dropdown is position:fixed so scrolling containers cannot clip it
  useLayoutEffect(() => {
    if (open && ref.current) setRect(ref.current.getBoundingClientRect());
  }, [open, value]);

  const pick = (name) => {
    const head = value.slice(0, start);
    const tail = value.slice(end);
    const nv = single ? name : (head ? head.replace(/\s*$/, '') + ' ' : '') + name + (tail.trim() ? ',' + tail : '');
    onChange(nv);
    setOpen(false);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = single ? name.length : (head ? head.replace(/\s*$/, '').length + 1 : 0) + name.length;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  // open downwards when there is room, otherwise flip above the input (the player sits at the bottom edge)
  const spaceBelow = rect ? window.innerHeight - rect.bottom - 8 : 200;
  const spaceAbove = rect ? rect.top - 8 : 0;
  const flip = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxH = Math.max(80, Math.min(260, flip ? spaceAbove : spaceBelow));

  return (
    <div className={'relative col-field ' + className} style={style?.width != null ? { width: style.width } : undefined}>
      <input
        ref={ref}
        className={'input mono' + (small ? ' input-sm' : '')}
        style={{ ...style, paddingRight: 34 }}
        value={value}
        disabled={disabled}
        title={title}
        placeholder={placeholder ?? (single ? 'column name' : 'GPS_speed (m/s), BaroAlt (cm)')}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setOpen(true);
        }}
        onFocus={(e) => {
          if (single) e.target.select(); // typing replaces the current column
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onSelect={(e) => setCaret(e.target.selectionStart)}
        onKeyDown={(e) => {
          if (!open || !matches.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHi((h) => (h + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => (h - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(matches[hi]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      <FieldHelpMark disabled={disabled} onClick={() => setRefOpen(true)} />
      {refOpen && <FieldReferenceDialog columnNames={columnNames} selected={parseColumns(value)} single={single} onPick={pickFromReference} onClose={() => setRefOpen(false)} />}
      {open && matches.length > 0 && rect && (
        <div
          className="mono text-xs overflow-auto"
          style={{ position: 'fixed', zIndex: 100, left: rect.left, width: rect.width, ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }), maxHeight: maxH, background: 'var(--surface-container-high)', borderRadius: 8, boxShadow: 'var(--shadow-2)', padding: '4px 0' }}
        >
          {matches.map((c, i) => (
            <div key={c} className="px-3 py-1.5 cursor-pointer whitespace-nowrap" style={{ background: i === hi ? 'var(--secondary-container)' : 'transparent', color: i === hi ? 'var(--on-secondary-container)' : 'var(--on-surface)' }} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(c)}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ColumnsInput;
