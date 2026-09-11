import React from 'react';
import Icon from './Icon.jsx';

/**
 * Horizontal stepper in the top app bar: numbered circles joined by lines. Every step is
 * clickable (the workflow is linear but never locked), the current one is amber, finished ones
 * teal with a check. `locked` (an export is running) keeps the user on the current step.
 */
export default function Stepper({ steps, current, onSelect, locked }) {
  return (
    <nav className="stepper" aria-label="Workflow steps">
      {steps.map((s, i) => {
        const active = s.id === current;
        const disabled = locked && !active;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <span className={'step-line' + (steps[i - 1].done ? ' done' : '')} />}
            <button className={'step' + (active ? ' active' : '') + (s.done ? ' done' : '')} onClick={() => !disabled && onSelect(s.id)} disabled={disabled} title={disabled ? 'Locked while exporting' : s.hint} aria-current={active ? 'step' : undefined}>
              <span className="step-num">{s.done && !active ? <Icon name="check" /> : i + 1}</span>
              {s.label}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
