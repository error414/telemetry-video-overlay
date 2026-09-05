// Widget settings
// ---------------
// A widget declares its adjustable settings as a JSON array (the "Settings definition" tab of
// the editor). The app renders a form from it (Widgets tab, editor) and hands the chosen values
// to the widget function as its first argument:
//
//   [
//     { "group": { "name": "Sticks", "items": [
//       { "name": "Mode",       "type": "select", "values": { "1": "Mode 1", "2": "Mode 2" }, "default": 2,
//         "description": "Mode 2: left stick = throttle/yaw, right = pitch/roll" },
//       { "name": "Min",        "type": "int",    "default": -500, "description": "stick range" }
//     ] } },
//     { "group": { "name": "Labels", "items": [
//       { "name": "Labels",     "type": "bool",   "default": true },
//       { "name": "Label font", "type": "text",   "default": "Arial" }
//     ] } },
//     { "name": "Background", "type": "color_picker", "default": "rgba(255,255,255,.7)" }
//   ]
//
// Settings may sit at the top level or inside groups ({ "group": { "name", "items": [...] } });
// the form shows groups as collapsible sections (collapsed by default). Keys are unique across
// the whole definition.
//
//   function (settings, time, ctx) {
//     var MODE = settings.mode.value;          // key = name in snake_case ("Label font" -> label_font)
//     var FONT = settings.label_font.value;    // or an explicit "key" in the definition
//   }
//
// Types: text (input), int (whole number), number (decimal), color_picker (any CSS colour, the
// picker writes rgba(r,g,b,a)), bool (checkbox), select ("values": {value: label} map or an
// array of values / {value, label} objects). Optional: default, description, key, min/max/step.
// The definition may be written as JSON or as a JavaScript array literal (comments, unquoted keys).
//
// Pure module (no DOM) so the skill test runner can use it from Node.

const TYPE_DEFAULTS = { text: '', int: 0, number: 0, color_picker: 'rgba(255,255,255,1)', bool: false, select: '' };
export const SETTING_TYPES = Object.keys(TYPE_DEFAULTS);

/** The key a setting is accessed by in the widget code: explicit "key", otherwise the name in snake_case. */
export function settingKey(def) {
  if (def && typeof def.key === 'string' && def.key.trim()) return def.key.trim();
  return String((def && def.name) || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeOptions(values, dflt) {
  const numeric = typeof dflt === 'number';
  if (Array.isArray(values)) return values.map((o) => (o && typeof o === 'object' ? { value: o.value, label: o.label != null ? String(o.label) : String(o.value) } : { value: o, label: String(o) }));
  if (values && typeof values === 'object') {
    // object keys are always strings: a numeric default means the widget wants numbers back
    return Object.keys(values).map((k) => ({ value: numeric && /^-?\d+(\.\d+)?$/.test(k) ? Number(k) : k, label: String(values[k]) }));
  }
  return [];
}

/** Convert a stored / typed value to the setting's type. */
export function coerce(def, v) {
  switch (def.type) {
    case 'bool':
      return v === true || v === 'true' || v === 1;
    case 'int': {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? n : 0;
    }
    case 'number': {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    case 'select': {
      const o = def.options.find((x) => x.value === v) || def.options.find((x) => String(x.value) === String(v));
      return o ? o.value : def.default !== undefined ? def.default : def.options[0].value;
    }
    default:
      return v == null ? '' : String(v);
  }
}

export function normalizeDef(raw, index) {
  if (!raw || typeof raw !== 'object') throw new Error('setting #' + (index + 1) + ' is not an object');
  const name = String(raw.name == null ? '' : raw.name).trim();
  const key = settingKey(raw);
  if (!key) throw new Error('setting #' + (index + 1) + ' has no name');
  const type = String(raw.type || 'text');
  if (!Object.prototype.hasOwnProperty.call(TYPE_DEFAULTS, type)) throw new Error('"' + name + '": unknown type "' + type + '" (use ' + SETTING_TYPES.join(', ') + ')');
  const options = type === 'select' ? normalizeOptions(raw.values, raw.default) : [];
  if (type === 'select' && !options.length) throw new Error('"' + name + '": a select needs "values"');
  const def = { key, name: name || key, type, description: raw.description ? String(raw.description) : '', options };
  for (const k of ['min', 'max', 'step']) if (typeof raw[k] === 'number') def[k] = raw[k];
  def.default = raw.default !== undefined ? coerce(def, raw.default) : type === 'select' ? options[0].value : TYPE_DEFAULTS[type];
  return def;
}

const cache = new Map();

/**
 * Parse a settings definition (JSON or a JS array literal). Never throws:
 * returns { defs: [all normalized definitions, flat], sections: [{ name: null | group name, defs }],
 * error: null | message }. Cached per source string.
 */
export function parseSettings(src) {
  src = src || '';
  if (cache.has(src)) return cache.get(src);
  let out;
  if (!src.trim()) out = { defs: [], sections: [], error: null };
  else {
    try {
      let arr;
      try {
        arr = JSON.parse(src);
      } catch {
        arr = new Function('"use strict"; return (' + src + ');')();
      }
      if (!Array.isArray(arr)) throw new Error('the definition must be an array: [ { "name": …, "type": … }, … ]');
      const defs = [];
      const sections = [];
      const seen = new Set();
      const add = (raw, index, section) => {
        const d = normalizeDef(raw, index);
        if (seen.has(d.key)) throw new Error('two settings share the key "' + d.key + '"');
        seen.add(d.key);
        defs.push(d);
        section.defs.push(d);
      };
      arr.forEach((raw, i) => {
        if (raw && typeof raw === 'object' && raw.group !== undefined) {
          // { group: { name, items } } (or { group: "name", items })
          const g = raw.group && typeof raw.group === 'object' ? raw.group : { name: raw.group, items: raw.items };
          const name = String(g.name == null ? '' : g.name).trim();
          if (!name) throw new Error('group #' + (i + 1) + ' has no name');
          if (!Array.isArray(g.items)) throw new Error('group "' + name + '" needs an "items" array');
          const section = { name, defs: [] };
          sections.push(section);
          g.items.forEach((item, j) => add(item, j, section));
        } else {
          let section = sections[sections.length - 1];
          if (!section || section.name !== null) sections.push((section = { name: null, defs: [] }));
          add(raw, i, section);
        }
      });
      out = { defs, sections, error: null };
    } catch (e) {
      out = { defs: [], sections: [], error: String(e && e.message ? e.message : e) };
    }
  }
  cache.set(src, out);
  return out;
}

/** Current value of one setting: the stored config value (coerced) or the definition default. */
export function settingValue(def, config) {
  const v = config ? config[def.key] : undefined;
  return v === undefined ? def.default : coerce(def, v);
}

/** The object handed to the widget function: { key: { key, name, type, value, label, description, options } }. */
export function buildSettings(defs, config) {
  const out = {};
  for (const d of defs) {
    const value = settingValue(d, config);
    const entry = { key: d.key, name: d.name, type: d.type, value, description: d.description };
    if (d.type === 'select') {
      entry.options = d.options;
      const o = d.options.find((x) => x.value === value);
      entry.label = o ? o.label : String(value);
    }
    out[d.key] = entry;
  }
  return out;
}

const settingsMemo = new WeakMap(); // defs array -> { config, settings }

/** buildSettings memoised on the (defs, config) pair so a frame render does not rebuild it. */
export function settingsFor(defs, config) {
  const m = settingsMemo.get(defs);
  if (m && m.config === config) return m.settings;
  const settings = buildSettings(defs, config);
  settingsMemo.set(defs, { config, settings });
  return settings;
}

/** Definition source for the examples / new widgets: pretty JSON the user can read in the editor tab. */
export function defsToSource(defs) {
  return JSON.stringify(defs, null, 2);
}
