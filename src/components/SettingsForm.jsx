import React, { useMemo, useState } from 'react';
import { settingValue } from '../widgetSettings.js';
import ColorInput from './ColorInput.jsx';
import Icon, { SvgIcon } from './Icon.jsx';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function highlight(text, q) {
  if (!q || !text) return text;
  const parts = String(text).split(new RegExp('(' + escapeRe(q) + ')', 'gi'));
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

/**
 * Form generated from a widget's settings definition (see widgetSettings.js). Shown in the
 * Widgets step (Selected widget) and in the editor. sections = parseSettings().sections: groups
 * render as collapsible blocks with their icon (collapsed by default), top-level settings as
 * plain rows. A search field filters the settings by name / description and opens the groups
 * that hold a match. onChange(key, value); value undefined = back to the definition default.
 * Rows are top-level components: the app re-renders every animation frame during playback and
 * an inline component would remount each frame (its inputs would lose focus).
 */
export default function SettingsForm({ defs, sections, config, error, onChange, onReset, searchable = true }) {
  const [open, setOpen] = useState({}); // group name -> expanded
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const isChanged = (d) => !!config && config[d.key] !== undefined;
  const matchesQ = (d) => !q || (d.name + ' ' + (d.description || '') + ' ' + d.key).toLowerCase().includes(q);
  const shown = useMemo(() => {
    const secs = sections && sections.length ? sections : [{ name: null, icon: '', defs }];
    return secs.map((s) => ({ ...s, defs: s.defs.filter(matchesQ) })).filter((s) => s.defs.length);
  }, [sections, defs, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error)
    return (
      <div className="banner error">
        <Icon name="warning" />
        <span>Settings definition error: {error}</span>
      </div>
    );
  if (!defs.length) return <div className="hint">No settings. Define them in the editor (Settings definition tab); the form appears here.</div>;
  const changed = defs.some(isChanged);
  const rows = (list) => list.map((d) => <SettingRow key={d.key} def={d} value={settingValue(d, config)} changed={isChanged(d)} q={q} onChange={(v) => onChange(d.key, v)} />);
  return (
    <div className="settings-form">
      {searchable && defs.length > 4 && (
        <div className="search settings-search">
          <Icon name="search" />
          <input className="input input-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings…" spellCheck={false} />
          {query && (
            <button className="btn btn-icon sm clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="close" />
            </button>
          )}
        </div>
      )}
      {shown.length === 0 && <div className="hint">No setting matches “{query.trim()}”.</div>}
      {shown.map((sec, i) =>
        sec.name === null ? (
          <div key={'top' + i} className="setting-group open">
            <div className="setting-group-body" style={{ paddingTop: 2 }}>
              {rows(sec.defs)}
            </div>
          </div>
        ) : (
          <SettingGroup key={sec.name} name={sec.name} icon={sec.icon} open={q ? true : !!open[sec.name]} onToggle={() => !q && setOpen((o) => ({ ...o, [sec.name]: !o[sec.name] }))} changedCount={sec.defs.filter(isChanged).length} q={q}>
            {rows(sec.defs)}
          </SettingGroup>
        )
      )}
      {onReset && changed && (
        <div className="flex justify-end mt-1">
          <button className="btn btn-text btn-sm" onClick={onReset} title="Forget every changed value and use the definition defaults">
            <Icon name="reset" />
            Reset all to defaults
          </button>
        </div>
      )}
    </div>
  );
}

/** Collapsible group of settings with its icon; the header shows how many values inside differ from the defaults. */
function SettingGroup({ name, icon, open, onToggle, changedCount, children, q }) {
  return (
    <div className={'setting-group' + (open ? ' open' : '')}>
      <button type="button" className="setting-group-head" onClick={onToggle} aria-expanded={open}>
        <span className="setting-group-icon">
          <SvgIcon svg={icon} fallback="tune" />
        </span>
        <span className="setting-group-name">{highlight(name, q)}</span>
        {changedCount > 0 && <span className="chip chip-sm chip-accent">{changedCount} changed</span>}
        <Icon name="chevronDown" className="chev" />
      </button>
      {open && <div className="setting-group-body">{children}</div>}
    </div>
  );
}

function SettingRow({ def, value, changed, onChange, q }) {
  return (
    <div className={'setting' + (changed ? ' changed' : '')}>
      <div className="setting-name">
        <span className="setting-name-text">{highlight(def.name, q)}</span>
        {def.description && (
          <span className="setting-desc" title={def.description}>
            {highlight(def.description, q)}
          </span>
        )}
      </div>
      <SettingControl def={def} value={value} onChange={onChange} />
      {changed ? (
        <button className="btn btn-icon sm" onClick={() => onChange(undefined)} title="Back to default">
          <Icon name="undo" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function SettingControl({ def, value, onChange }) {
  switch (def.type) {
    case 'bool':
      return (
        <label className={'switch justify-end' + (value ? ' on' : '')}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="track" />
        </label>
      );
    case 'int':
    case 'number':
      return <NumberInput def={def} value={value} onChange={onChange} />;
    case 'select':
      return (
        <select className="input" value={String(value)} onChange={(e) => onChange(def.options.find((o) => String(o.value) === e.target.value)?.value)}>
          {def.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'color_picker':
      return <ColorInput value={value} onChange={onChange} />;
    default:
      return <input className="input" value={value == null ? '' : String(value)} spellCheck={false} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Number field that tolerates intermediate text ("-", "1.") while typing and commits finite values only. */
function NumberInput({ def, value, onChange }) {
  const [draft, setDraft] = useState(null);
  const step = def.step != null ? def.step : def.type === 'int' ? 1 : 'any';
  return (
    <input
      className="input mono"
      type="number"
      value={draft != null ? draft : value}
      min={def.min}
      max={def.max}
      step={step}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onChange(def.type === 'int' ? Math.round(n) : n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
