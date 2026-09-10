import React from 'react';
import Icon from './Icon.jsx';
import { fmtTime } from '../time.js';

/** Play deck: previous frame, play/pause, next frame, mute — plus the timecode readout. */
export default function Transport({ player, lockTitle }) {
  const { playing, muted, setMuted, toggle, stepFrame, disabled, time, dur } = player;
  const title = (t) => lockTitle || t;
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        <button className="btn-transport" onClick={() => stepFrame(-1)} disabled={disabled} title={title('Previous frame (←, shift: −1 s)')}>
          <Icon name="stepBack" size={20} />
        </button>
        <button className="btn-transport primary" onClick={toggle} disabled={disabled} title={title('Play / pause (space)')}>
          <Icon name={playing ? 'pause' : 'play'} size={24} />
        </button>
        <button className="btn-transport" onClick={() => stepFrame(1)} disabled={disabled} title={title('Next frame (→, shift: +1 s)')}>
          <Icon name="stepForward" size={20} />
        </button>
        <button className={'btn-transport quiet' + (muted ? ' on' : '')} onClick={() => setMuted((m) => !m)} aria-pressed={muted} title={muted ? 'Unmute video (M)' : 'Mute video (M)'}>
          <Icon name={muted ? 'volumeOff' : 'volume'} size={20} />
        </button>
      </div>
      <div className="timecode">
        <span className="tc-main">{fmtTime(time)}</span>
        <span className="tc-sub">/ {fmtTime(dur)}</span>
      </div>
    </div>
  );
}
