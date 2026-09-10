import React, { useEffect } from 'react';
import Icon from './Icon.jsx';
import { isTyping } from './player.js';

/** Manual sync: offset and drift steppers, "Start = here"; [ and ] nudge the offset. */
export default function SyncControls({ offset, setOffset, drift, setDrift, time, disabled }) {
  const stepOffset = (d) => setOffset((o) => +(o + d).toFixed(3));
  const stepDrift = (d) => setDrift((x) => +(x + d).toFixed(3));
  useEffect(() => {
    const h = (e) => {
      if (isTyping(e)) return;
      if (e.key === '[') stepOffset(e.shiftKey ? -1 : -0.01);
      else if (e.key === ']') stepOffset(e.shiftKey ? 1 : 0.01);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="stack">
      <div>
        <span className="label mt-0">Offset — seconds of telemetry at the first video frame</span>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="seg stepper">
            {[-1, -0.1, -0.01].map((d) => (
              <button key={d} onClick={() => stepOffset(d)} disabled={disabled} title={`Shift telemetry ${d} s`}>
                {d}
              </button>
            ))}
            <input type="number" step={0.01} value={offset} disabled={disabled} onChange={(e) => setOffset(Number(e.target.value) || 0)} title="Telemetry offset in seconds (added to video time)" />
            {[0.01, 0.1, 1].map((d) => (
              <button key={d} onClick={() => stepOffset(d)} disabled={disabled} title={`Shift telemetry +${d} s`}>
                +{d}
              </button>
            ))}
          </div>
          <button className="btn btn-tonal btn-sm" disabled={disabled} title="Set the offset so that the telemetry starts at the current video frame" onClick={() => setOffset(+(-time).toFixed(3))}>
            <Icon name="flag" />
            Start = here
          </button>
        </div>
        <div className="hint mt-2">
          Seek to a moment you can see in both — arming, take-off, a sharp turn — and nudge the offset until the widgets match the picture. Keys <span className="kbd">[</span> <span className="kbd">]</span> step 0.01 s (with shift 1 s).
        </div>
      </div>
      <div>
        <span className="label mt-0" title="Clock drift between camera and flight controller: milliseconds of telemetry gained per second of video (telemetry = video × (1 + drift/1000) + offset)">
          Drift — ms of telemetry per second of video
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="seg stepper" title="0.5 means the log runs ahead by half a millisecond every second">
            {[-0.1, -0.01].map((d) => (
              <button key={d} onClick={() => stepDrift(d)} disabled={disabled} title={`Drift ${d} ms/s`}>
                {d}
              </button>
            ))}
            <input type="number" step={0.01} value={drift} disabled={disabled} style={{ width: 76 }} onChange={(e) => setDrift(Number(e.target.value) || 0)} title="Clock drift in ms/s (auto sync measures it from several windows)" />
            {[0.01, 0.1].map((d) => (
              <button key={d} onClick={() => stepDrift(d)} disabled={disabled} title={`Drift +${d} ms/s`}>
                +{d}
              </button>
            ))}
          </div>
        </div>
        <div className="hint mt-2">Check a moment near the end of the video: if the widgets lag or lead there, adjust the drift until both ends match.</div>
      </div>
    </div>
  );
}
