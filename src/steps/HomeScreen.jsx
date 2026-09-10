import React, { useEffect } from 'react';
import Icon from '../components/Icon.jsx';

const baseName = (p) => (p || '').split(/[\\/]/).pop();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Short description of what a project holds, for the "continue" option. */
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
 * First screen: continue the previous (autosaved or currently open) project, start a new one or
 * open a project file. Escape / Enter take the first option.
 */
export default function HomeScreen({ project, current, onContinue, onNew, onOpen, version }) {
  const first = current || project;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Escape' || e.key === 'Enter') && first) {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onContinue, first]);

  return (
    <div className="home">
      <div className="home-brand">
        <Icon name="widgets" />
        <div className="headline">Blackbox overlay for INAV</div>
        <div className="hint">Telemetry widgets from an INAV blackbox log, drawn over your flight video.</div>
      </div>
      <div className="home-choices">
        {current ? (
          <button className="choice" onClick={onContinue} autoFocus>
            <Icon name="forward" />
            <span>
              <span className="choice-title">Back to the open project</span>
              <span className="choice-sub">{describeProject(current) || 'Empty project'} · same as Escape</span>
            </span>
          </button>
        ) : project ? (
          <button className="choice" onClick={onContinue} autoFocus>
            <Icon name="history" />
            <span>
              <span className="choice-title">Continue previous session</span>
              <span className="choice-sub">Restores the last autosaved project: {describeProject(project) || 'empty stage'}. Same as Escape.</span>
            </span>
          </button>
        ) : null}
        <button className="choice" onClick={onNew}>
          <Icon name="newFile" />
          <span>
            <span className="choice-title">New project</span>
            <span className="choice-sub">Start with an empty stage — no video, telemetry or widgets. {current || project ? 'The previous session is discarded; a project saved to a file stays untouched.' : ''}</span>
          </span>
        </button>
        <button className="choice tele" onClick={onOpen}>
          <Icon name="open" />
          <span>
            <span className="choice-title">Open project file…</span>
            <span className="choice-sub">A project saved earlier with “Save project” (video path, telemetry files, sync, widgets).</span>
          </span>
        </button>
      </div>
      <div className="hint">
        Workflow: <b>Files</b> → <b>Sync</b> → <b>Widgets</b> → <b>Export</b>. You can step back and forth at any time.{version ? ` · v${version}` : ''}
      </div>
    </div>
  );
}
