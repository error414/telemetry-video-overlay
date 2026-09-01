import { EditorView, Decoration, WidgetType, ViewPlugin, MatchDecorator } from '@codemirror/view';

// #rgb / #rgba / #rrggbb / #rrggbbaa (not followed by more word chars, so #badge doesn't match)
// and rgb(r, g, b) / rgba(r, g, b, a)
const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+%?\s*)?\)/gi;

/** Normalize any supported color text to a #rrggbb value for <input type="color"> (alpha dropped). */
function toHex6(text) {
  if (text.startsWith('#')) {
    let b = text.slice(1);
    if (b.length <= 4) b = b.slice(0, 3).split('').map((ch) => ch + ch).join('');
    return '#' + b.slice(0, 6).toLowerCase();
  }
  const m = text.match(/([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return '#000000';
  const h = (n) => Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, '0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}

/** Rewrite the picked #rrggbb into the original color's format, preserving any alpha. */
function applyHex(orig, hex) {
  if (orig.startsWith('#')) {
    const b = orig.slice(1);
    if (b.length === 4) return hex + b[3] + b[3]; // #rgba → #rrggbbaa
    if (b.length === 8) return hex + b.slice(6); // keep aa
    return hex;
  }
  const m = orig.match(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([^)\s]+)\s*)?\)/i);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const alpha = m && m[1];
  return alpha !== undefined && alpha !== null ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
}

class ColorSwatch extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }
  eq(other) {
    return other.text === this.text;
  }
  toDOM(view) {
    const wrap = document.createElement('span');
    wrap.className = 'cm-color-swatch';
    wrap.title = 'Pick colour';
    wrap._text = this.text;
    const fill = document.createElement('span');
    fill.className = 'cm-color-swatch-fill';
    fill.style.backgroundColor = this.text;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = toHex6(this.text);
    input.addEventListener('input', () => {
      let pos;
      try {
        pos = view.posAtDOM(wrap);
      } catch {
        return;
      }
      const cur = wrap._text;
      // only replace if the document still holds the color right after the swatch
      if (view.state.doc.sliceString(pos, pos + cur.length) !== cur) return;
      view.dispatch({ changes: { from: pos, to: pos + cur.length, insert: applyHex(cur, input.value) } });
    });
    wrap.append(fill, input);
    return wrap;
  }
  // reuse the DOM node on doc changes so the native picker dialog keeps working while dragging
  updateDOM(dom) {
    if (!dom.classList || !dom.classList.contains('cm-color-swatch')) return false;
    dom._text = this.text;
    const fill = dom.querySelector('.cm-color-swatch-fill');
    if (fill) fill.style.backgroundColor = this.text;
    return true;
  }
  ignoreEvent() {
    return true;
  }
}

const matcher = new MatchDecorator({
  regexp: COLOR_RE,
  decorate: (add, from, _to, m) => add(from, from, Decoration.widget({ widget: new ColorSwatch(m[0]), side: -1 })),
});

const plugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = matcher.createDeco(view);
    }
    update(update) {
      this.decorations = matcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

const theme = EditorView.baseTheme({
  '.cm-color-swatch': {
    display: 'inline-block',
    position: 'relative',
    width: '0.85em',
    height: '0.85em',
    marginRight: '0.35em',
    borderRadius: '3px',
    border: '1px solid rgba(255,255,255,.45)',
    verticalAlign: 'middle',
    cursor: 'pointer',
    overflow: 'hidden',
    // checkerboard shows through semi-transparent rgba() colors
    background: 'repeating-conic-gradient(#777 0 25%, #bbb 0 50%) 0 0 / 8px 8px',
  },
  '.cm-color-swatch-fill': {
    position: 'absolute',
    inset: '0',
  },
  '.cm-color-swatch input[type=color]': {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    padding: '0',
    border: 'none',
    opacity: '0',
    cursor: 'pointer',
  },
});

/** CodeMirror extension: shows a clickable colour swatch next to #hex and rgb()/rgba() literals. */
export const colorPicker = [plugin, theme];
