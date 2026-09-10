import React, { useEffect, useState } from 'react';
import StepScreen from './StepScreen.jsx';
import SyncControls from '../components/SyncControls.jsx';
import AutoSync from '../components/AutoSync.jsx';
import Icon from '../components/Icon.jsx';
import { SYNC_METHODS } from '../sync/methods.js';

const METHOD_KEY = 'telemetry-overlay.syncMethod';
const SHORT = { 'video-gyro': 'Video motion', gyroflow: 'Gyroflow' };
const METHODS = [{ id: 'manual', label: 'Manual', icon: 'hand', hint: 'Offset and drift by hand, watching the widgets against the picture.' }, ...SYNC_METHODS.map((m) => ({ ...m, label: SHORT[m.id] || m.label, icon: m.id === 'gyroflow' ? 'gyro' : 'motion' }))];

/** Step 2 — line the telemetry up with the video: by hand, from the camera motion in the footage, or from a Gyroflow project. */
export default function SyncStep({ app }) {
  const { video, store, storeVersion, columnNames, sync, offset, setOffset, drift, setDrift, time, setStatus } = app;
  const [method, setMethod] = useState(() => {
    try {
      return localStorage.getItem(METHOD_KEY) || 'manual';
    } catch {
      return 'manual';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(METHOD_KEY, method);
    } catch {
      /* ignore */
    }
  }, [method]);
  const ready = !!video && columnNames.length > 0;
  const current = METHODS.find((m) => m.id === method) || METHODS[0];
  return (
    <StepScreen app={app} trace tail={null}>
      {!ready && (
        <div className="banner warn" style={{ marginBottom: 16 }}>
          <Icon name="warning" />
          <span>
            {!video && !columnNames.length ? 'Open a video and a blackbox log in the Files step first.' : !video ? 'Open a video in the Files step first.' : 'Add a blackbox log in the Files step first — there is no telemetry to align yet.'}
          </span>
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <Icon name="sync" />
          <span className="card-title">Method</span>
          <span className="card-meta">
            {sync.offset >= 0 ? '+' : ''}
            {sync.offset.toFixed(3)} s{sync.drift ? ` · ${sync.drift >= 0 ? '+' : ''}${sync.drift.toFixed(2)} ms/s` : ''}
          </span>
        </div>
        <div className="stack">
          <div className="seg seg-primary seg-fill" role="tablist">
            {METHODS.map((m) => (
              <button key={m.id} className={method === m.id ? 'on' : ''} onClick={() => setMethod(m.id)} title={m.hint} role="tab" aria-selected={method === m.id}>
                <Icon name={m.icon} />
                {m.label}
              </button>
            ))}
          </div>
          {method === 'manual' ? (
            <SyncControls offset={offset} setOffset={setOffset} drift={drift} setDrift={setDrift} time={time} disabled={!video} />
          ) : (
            <AutoSync key={method} method={method} video={video} store={store} storeVersion={storeVersion} columnNames={columnNames} sync={sync} setOffset={setOffset} setDrift={setDrift} time={time} setStatus={setStatus} />
          )}
        </div>
      </div>
      <div className="card card-low">
        <div className="card-head">
          <Icon name="info" />
          <span className="card-title">How the numbers are used</span>
        </div>
        <div className="hint">
          telemetry time = video time × (1 + drift / 1000) + offset. The teal trace on the timeline is one telemetry column drawn on the video clock — it moves with the offset, so a visible event (throttle, launch, a turn) should sit under the same moment in the footage. Widgets on the video follow the current sync, so scrub to a manoeuvre and compare. {current.id !== 'manual' ? 'Auto sync writes both numbers; fine-tune them afterwards in Manual if needed.' : ''}
        </div>
      </div>
    </StepScreen>
  );
}
