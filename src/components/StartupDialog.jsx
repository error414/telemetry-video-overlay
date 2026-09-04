import React, { useEffect } from 'react';
import { Frame, ChoiceButton } from './AutoSyncDialog.jsx';

const baseName = (p) => (p || '').split(/[\/]/).pop();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Short description of what the autosaved project holds, for the "continue" option. */
export function describeProject(j) {
  const parts = [];
  if (j.video) parts.push(baseName(j.video));
  const n = (j.sources || []).length;
  if (n) parts.push(plural(n, 'telemetry file'));
  const w = (j.widgets || []).length;
  if (w) parts.push(plural(w, 'widget'));
  return parts.join(', ');
}

/**
 * Asked once on launch when an autosaved project exists: pick up where the last
 * session ended, or start with an empty stage. Same look as the Auto sync method
 * choice — title, question, one tall button per option.
 */
export default function StartupDialog({ project, onContinue, onNew }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onContinue]);

  return (
    <Frame width={520}>
      <div className="font-semibold text-base">Welcome back</div>
      <div className="hint">Continue the previous session or start a new one?</div>
      <div className="flex flex-col gap-2">
        <ChoiceButton label="Continue previous session" hint={`Restores the last autosaved project: ${describeProject(project) || 'empty stage'}. Same as pressing Escape.`} onClick={onContinue} />
        <ChoiceButton label="Start new session" hint="Opens an empty stage — no video, telemetry or widgets. The previous session is discarded; a project saved to a file stays untouched." onClick={onNew} />
      </div>
    </Frame>
  );
}
