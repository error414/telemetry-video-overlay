import { EditorView, Decoration, WidgetType, ViewPlugin, MatchDecorator } from '@codemirror/view';
import { hexString, rgbaString } from './ColorInput.jsx';

// #rgb / #rgba / #rrggbb / #rrggbbaa (not followed by more word chars, so #badge doesn't match)
// and rgb(r, g, b) / rgba(r, g, b, a)
const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+%?\s*)?\)/gi;

/**
 * Swatch shown before every colour literal in the code. Clicking it dispatches a bubbling
 * `cm-color-pick` DOM event ({view, wrap}); the editor modal opens the in-app colour popover
 * (ColorInput.jsx) at the swatch and writes the picked colour back with replaceSwatchColor().
 */
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
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrap.dispatchEvent(new CustomEvent('cm-color-pick', { bubbles: true, detail: { view, wrap } }));
    });
    wrap.append(fill);
    return wrap;
  }
  // reuse the DOM node on doc changes so the popover keeps pointing at the same swatch while dragging
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

/** The colour literal a swatch currently stands for. */
export function swatchText(wrap) {
  return wrap._text;
}

/** Replace the literal after the swatch in the document. false when the swatch is stale. */
export function replaceSwatchColor(view, wrap, text) {
  let pos;
  try {
    pos = view.posAtDOM(wrap);
  } catch {
    return false;
  }
  const cur = wrap._text;
  if (cur === text) return true;
  if (view.state.doc.sliceString(pos, pos + cur.length) !== cur) return false;
  view.dispatch({ changes: { from: pos, to: pos + cur.length, insert: text } });
  return true;
}

/** Format a picked colour like the literal it replaces: hex stays hex while opaque, everything else rgba(). */
export function formatLike(orig, c) {
  return orig.startsWith('#') && c.a >= 1 ? hexString(c) : rgbaString(c);
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
});

/** CodeMirror extension: shows a clickable colour swatch next to #hex and rgb()/rgba() literals. */
export const colorPicker = [plugin, theme];
