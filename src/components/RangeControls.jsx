import React from 'react';
import { fmtTime } from '../time.js';
import TimeInput from './TimeInput.jsx';
import Icon from './Icon.jsx';
import { EMPTY_RANGE } from './Timeline.jsx';

/** Export range: in / out points (typed, or "= here" at the playhead), whole-video reset. */
export default function RangeControls({ player, range = EMPTY_RANGE, setRange }) {
  const { dur, limit, frame, time, disabled } = player;
  const inT = Math.max(0, Math.min(dur, range.start || 0));
  const outT = range.end == null ? dur : Math.max(inT, Math.min(dur, range.end));
  const fullRange = inT <= 0 && range.end == null;
  const locked = disabled || !dur;
  const setPoint = (which, t) => {
    if (locked) return;
    t = Math.max(0, Math.min(limit, t));
    setRange((r) => {
      let start = Math.max(0, (r && r.start) || 0);
      let end = r && r.end != null ? Math.min(dur, r.end) : dur;
      if (which === 'in') start = Math.max(0, Math.min(t, end - frame));
      else end = Math.min(dur, Math.max(t, start + frame));
      return { start: +start.toFixed(3), end: end >= dur - frame / 2 ? null : +end.toFixed(3) };
    });
  };
  return (
    <div className="stack">
      <div className="stack" style={{ gap: 8 }}>
        <div className="flex items-center gap-3">
          <span className="label mt-0" style={{ width: 64, margin: 0 }}>In point</span>
          <div className="flex items-center gap-2">
            <TimeInput value={inT} onCommit={(t) => setPoint('in', t)} disabled={locked} title="Export start — m:ss.sss or seconds" width={110} />
            <button className="btn btn-tonal btn-sm" onClick={() => setPoint('in', time)} disabled={locked} title="Export from the current frame (I)">
              <Icon name="in" />
              here
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="label mt-0" style={{ width: 64, margin: 0 }}>Out point</span>
          <div className="flex items-center gap-2">
            <TimeInput value={outT} onCommit={(t) => setPoint('out', t)} disabled={locked} title="Export end — m:ss.sss or seconds" width={110} />
            <button className="btn btn-tonal btn-sm" onClick={() => setPoint('out', time)} disabled={locked} title="Export up to the current frame (O)">
              <Icon name="out" />
              here
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {dur > 0 && (
          <span className={'chip ' + (fullRange ? '' : 'chip-accent')} title="Length of the exported part">
            <Icon name="clock" />
            {fullRange ? 'whole video · ' + fmtTime(dur) : fmtTime(outT - inT) + ' of ' + fmtTime(dur)}
          </span>
        )}
        {!fullRange && (
          <button className="btn btn-text btn-sm" onClick={() => setRange(EMPTY_RANGE)} title="Export the whole video again">
            Whole video
          </button>
        )}
        {limit < dur - 0.5 && !locked && <span className="hint">range limited to the encoded part</span>}
      </div>
      <div className="hint">
        Drag the amber flags on the timeline, or press <span className="kbd">I</span> / <span className="kbd">O</span> at the playhead.
      </div>
    </div>
  );
}
