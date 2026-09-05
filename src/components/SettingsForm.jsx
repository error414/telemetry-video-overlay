import React, { useState } from 'react';
import { settingValue } from '../widgetSettings.js';
import ColorInput from './ColorInput.jsx';

/**
 * Form generated from a widget's settings definition (see widgetSettings.js). Shown in the
 * Widgets tab (Selected widget) and in the editor. sections = parseSettings().sections: groups
 * render as collapsible blocks (collapsed by default), top-level settings as plain rows.
 * onChange(key, value); value undefined = back to the definition default. Rows are top-level
 * components: the app re-renders every animation frame during playback and an inline component
 * would remount each frame (its inputs would lose focus).
 */
export default function SettingsForm({ defs, sections, config, error, onChange, onReset }) {
  const [open, setOpen] = useState({}); // group name -> expanded
  if (error)
    return (
      <div className="text-xs mt-2" style={{ color: 'var(--bad)' }}>
        Settings definition error: {error}
      </div>
    );
  if (!defs.length) return <div className="hint mt-2">No settings. Define them in the editor (Settings definition tab); the form appears here.</div>;
  const isChanged = (d) => !!config && config[d.key] !== undefined;
  const changed = defs.some(isChanged);
  const rows = (list) => list.map((d) => <SettingRow key={d.key} def={d} value={settingValue(d, config)} changed={isChanged(d)} onChange={(v) => onChange(d.key, v)} />);
  return (
    <div className="settings-form">
      {(sections || [{ name: null, defs }]).map((sec, i) =>
        sec.name === null ? (
          <React.Fragment key={'top' + i}>{rows(sec.defs)}</React.Fragment>
        ) : (
          <SettingGroup key={sec.name} name={sec.name} open={!!open[sec.name]} onToggle={() => setOpen((o) => ({ ...o, [sec.name]: !o[sec.name] }))} changedCount={sec.defs.filter(isChanged).length}>
            {rows(sec.defs)}
          </SettingGroup>
        )
      )}
      {onReset && changed && (
        <div className="flex justify-end mt-1">
          <button className="btn btn-xs" onClick={onReset} title="Forget every changed value and use the definition defaults">
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

/** Collapsible group of settings; the header shows how many values inside differ from the defaults. */
function SettingGroup({ name, open, onToggle, changedCount, children }) {
  return (
    <div className={'setting-group' + (open ? ' open' : '')}>
      <div className="setting-group-head" onClick={onToggle} title={open ? 'Collapse' : 'Expand'}>
        <svg className="bay-chev" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M3.5 1.5 7 5l-3.5 3.5" />
        </svg>
        <span className="setting-group-name">{name}</span>
        {changedCount > 0 && <span className="chip chip-accent">{changedCount} changed</span>}
      </div>
      {open && <div className="setting-group-body">{children}</div>}
    </div>
  );
}

function SettingRow({ def, value, changed, onChange }) {
  return (
    <div className="setting">
      <div className="setting-row" title={def.description || undefined}>
        <span className="setting-name" style={changed ? { color: 'var(--accent)' } : undefined}>
          {def.name}
        </span>
        <SettingControl def={def} value={value} onChange={onChange} />
        {changed ? (
          <button className="btn btn-xs btn-icon" onClick={() => onChange(undefined)} title="Back to default">
            ↺
          </button>
        ) : (
          <span style={{ width: 22 }} />
        )}
      </div>
      {def.description && <div className="setting-desc">{def.description}</div>}
    </div>
  );
}

function SettingControl({ def, value, onChange }) {
  switch (def.type) {
    case 'bool':
      return (
        <label className="flex items-center" style={{ height: 24 }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
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
