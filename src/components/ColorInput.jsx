import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RgbaColorPicker } from 'react-colorful';

/**
 * Colour picking for widget settings and the code editor: an in-app popover (react-colorful,
 * saturation square + hue + alpha) instead of the native OS dialog, which is slow to open and has
 * no alpha channel. Values are CSS colour strings; the picker writes rgba(r,g,b,a).
 */

const NAMED = { transparent: { r: 0, g: 0, b: 0, a: 0 }, white: { r: 255, g: 255, b: 255, a: 1 }, black: { r: 0, g: 0, b: 0, a: 1 }, red: { r: 255, g: 0, b: 0, a: 1 }, none: { r: 0, g: 0, b: 0, a: 0 } };

/** Parse #rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba() / a few names → {r,g,b,a}; null when not a colour. */
export function parseColor(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();
  if (NAMED[s]) return { ...NAMED[s] };
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1 };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)$/);
  if (m) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(parseFloat(v))));
    let a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (m[5]) a /= 100;
    return { r: c(m[1]), g: c(m[2]), b: c(m[3]), a: Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1)) };
  }
  return null;
}

/** rgba(255,255,255,.7): compact, the house format in widget settings. */
export function rgbaString({ r, g, b, a }) {
  const al = a >= 1 ? '1' : String(Math.round(a * 100) / 100).replace(/^0\./, '.');
  return 'rgba(' + r + ',' + g + ',' + b + ',' + al + ')';
}

export function hexString({ r, g, b }) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

/** Position a fixed popover next to an anchor rect, flipping above when there is no room below. */
function popoverStyle(anchor, size) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = Math.max(8, Math.min(anchor.left, vw - size.w - 8));
  let top = anchor.bottom + 4;
  if (top + size.h > vh - 8 && anchor.top - size.h - 4 > 8) top = anchor.top - size.h - 4;
  top = Math.max(8, Math.min(top, vh - size.h - 8));
  return { left, top };
}

/**
 * The popover itself (portal to body). color: {r,g,b,a}; onChange(color) fires while dragging;
 * onClose on outside click / Escape.
 */
export function ColorPopover({ anchorRect, color, onChange, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: anchorRect.left, top: anchorRect.bottom + 4 });
  const [text, setText] = useState(() => rgbaString(color));
  const [editing, setEditing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(popoverStyle(anchorRect, { w: el.offsetWidth, h: el.offsetHeight }));
  }, [anchorRect]);

  useEffect(() => {
    if (!editing) setText(rgbaString(color));
  }, [color, editing]);

  useEffect(() => {
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    // capture phase: CodeMirror and the modal stop propagation of their own events
    document.addEventListener('mousedown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="color-pop" style={pos} onMouseDown={(e) => e.stopPropagation()}>
      <RgbaColorPicker color={color} onChange={onChange} />
      <div className="flex items-center gap-2 mt-2">
        <span className="color-swatch" title="current">
          <span style={{ background: rgbaString(color) }} />
        </span>
        <input
          className="input mono flex-1"
          value={text}
          spellCheck={false}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(e) => {
            setText(e.target.value);
            const c = parseColor(e.target.value);
            if (c) onChange(c);
          }}
          onKeyDown={(e) => e.key === 'Enter' && onClose()}
        />
      </div>
    </div>,
    document.body
  );
}

/** Swatch + text field. value: CSS colour string; onChange(string). */
export default function ColorInput({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const swatchRef = useRef(null);
  const parsed = parseColor(value);
  const openPicker = () => {
    setRect(swatchRef.current.getBoundingClientRect());
    setOpen(true);
  };
  return (
    <div className={'color-input ' + className}>
      <button ref={swatchRef} type="button" className="color-swatch" title={parsed ? 'Pick colour' : 'Not a colour value'} onClick={openPicker}>
        <span style={parsed ? { background: rgbaString(parsed) } : { background: 'repeating-linear-gradient(45deg, transparent 0 4px, rgba(229,100,92,.6) 4px 6px)' }} />
      </button>
      <input className="input mono" value={value == null ? '' : String(value)} spellCheck={false} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
      {open && rect && <ColorPopover anchorRect={rect} color={parsed || { r: 255, g: 255, b: 255, a: 1 }} onChange={(c) => onChange(rgbaString(c))} onClose={() => setOpen(false)} />}
    </div>
  );
}
