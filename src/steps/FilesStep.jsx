import React, { useState } from 'react';
import StepScreen from './StepScreen.jsx';
import Icon from '../components/Icon.jsx';

// opts: array of values, or [value, label] pairs when the blackbox_decode CLI value
// (e.g. "kph") should be shown with a nicer label (e.g. "km/h")
const SEL = (label, key, opts, bbOptions, setBbOptions) => (
  <label key={key} className="flex items-center justify-between gap-3">
    <span className="text-sm">{label}</span>
    <select className="input input-sm" style={{ width: 110 }} value={bbOptions[key]} onChange={(e) => setBbOptions((o) => ({ ...o, [key]: e.target.value }))}>
      {opts.map((v) => {
        const [value, text] = Array.isArray(v) ? v : [v, v];
        return (
          <option key={value} value={value}>
            {text}
          </option>
        );
      })}
    </select>
  </label>
);

const baseName = (p) => String(p || '').split(/[\\/]/).pop();

// Top-level row component (an inline one would remount every animation frame during playback).
function SourceItem({ s, store, updateSource, removeSource }) {
  const [cols, setCols] = useState(false);
  return (
    <div className="card card-high" style={{ padding: 12 }}>
      <div className="flex items-start gap-2">
        <span className="li-lead" style={{ background: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}>
          <Icon name="telemetry" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="title truncate" title={s.path}>
            {s.name}
          </div>
          <div className="hint">
            {s.count} rows · {s.columns.length} columns · {s.count ? (s.lastTime - s.firstTime).toFixed(1) : 0} s · starts at {(s.firstTime - store.origin).toFixed(3)} s
          </div>
          {s.step > 1 && (
            <div className="hint" title={`The file has ${s.totalRows} rows sampled at ~${Math.round(s.sourceRate)} Hz; widgets render at most 120 fps, so only every ${s.step}. sample was kept to save memory and load time.`}>
              {Math.round(s.sourceRate)} Hz log → every {s.step}. sample kept ({Math.round(s.sourceRate / s.step)} Hz)
            </div>
          )}
        </div>
        <button className="btn btn-icon sm btn-danger" onClick={() => removeSource(s.id)} title="Remove this file from the project (the file stays on disk)">
          <Icon name="delete" />
        </button>
      </div>
      <div className="flex gap-3 mt-3">
        <label className="flex-1 min-w-0">
          <span className="label mt-0">Time column</span>
          <select className="input input-sm" value={s.timeColumn} onChange={(e) => updateSource(s.id, { timeColumn: e.target.value })}>
            {s.columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ width: 90 }}>
          <span className="label mt-0">Unit</span>
          <select className="input input-sm" value={s.timeUnit} onChange={(e) => updateSource(s.id, { timeUnit: e.target.value })}>
            <option value="us">µs</option>
            <option value="ms">ms</option>
            <option value="s">s</option>
          </select>
        </label>
      </div>
      <button className="btn btn-text btn-sm mt-2" style={{ marginLeft: -12 }} onClick={() => setCols((c) => !c)}>
        <Icon name={cols ? 'chevronDown' : 'chevronRight'} />
        Columns ({s.columns.length})
      </button>
      {cols && (
        <div className="mt-1 max-h-48 overflow-auto mono text-xs leading-5" style={{ color: 'var(--on-surface-variant)' }}>
          {s.columns.map((c) => (
            <div key={c} className="cursor-pointer hover:text-[var(--secondary)] truncate" title="Click to copy" onClick={() => navigator.clipboard.writeText(c)}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Step 1 — open the video and the blackbox log(s). The stage shows the plain video (no widgets) so the file can be checked and a proxy made when playback fails. */
export default function FilesStep({ app }) {
  const { video, openVideo, removeVideo, makeProxy, proxyProgress, decodeBlackbox, decoding, busy, bbOptions, setBbOptions, store, addCsvFiles, updateSource, removeSource, removeAllSources } = app;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const heavy = video && (video.codec === 'hevc' || video.width > 1920 || video.fps > 60);
  return (
    <StepScreen
      app={app}
      showWidgets={false}
      empty={
        <div className="empty-state">
          <Icon name="film" />
          <div className="es-title">No video yet</div>
          <div className="hint" style={{ maxWidth: 360 }}>
            Open the flight footage first, then add the blackbox log. The overlay is rendered on top of this video.
          </div>
          <button className="btn btn-filled mt-2" onClick={openVideo}>
            <Icon name="open" />
            Open video…
          </button>
        </div>
      }
    >
      <div className="card">
        <div className="card-head accent">
          <Icon name="video" />
          <span className="card-title">Video</span>
          <span className="card-meta">{video ? `${video.width}×${video.height} · ${video.fps.toFixed(2)} fps` : 'none'}</span>
        </div>
        {video ? (
          <div className="stack">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="title truncate" title={video.path}>
                  {baseName(video.path)}
                </div>
                <div className="hint break-all">{video.path}</div>
                <div className="hint mt-1">
                  {video.codec} · {video.duration.toFixed(2)} s · {video.bitrate ? (video.bitrate / 1e6).toFixed(1) + ' Mbit/s' : 'bitrate n/a'} · {video.hasAudio ? 'audio' : 'no audio'}
                </div>
              </div>
              <button className="btn btn-icon sm btn-danger" onClick={removeVideo} title="Remove the video from the project (the file stays on disk)">
                <Icon name="delete" />
              </button>
            </div>
            <div className="card card-high" style={{ padding: 12 }}>
              <div className="flex items-center gap-2">
                <span className="title flex-1">Preview proxy</span>
                {video.proxy && <span className="chip chip-sm chip-good">in use</span>}
              </div>
              {video.proxy ? (
                <div className="hint mt-1 break-all">{video.proxy}</div>
              ) : (
                <div className={'hint mt-1' + (heavy ? ' text-[var(--warn)]' : '')}>
                  {heavy ? 'Camera HEVC streams (e.g. DJI 4K/120 10-bit) are often rejected by the built-in player. ' : ''}A proxy is a re-encoded copy used only for the in-app preview; the export always uses the original file.
                </div>
              )}
              {proxyProgress != null ? (
                <div className="mt-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 progress">
                      <div style={{ width: proxyProgress * 100 + '%' }} />
                    </div>
                    <span className="mono text-xs">{Math.round(proxyProgress * 100)}%</span>
                    <button className="btn btn-danger btn-xs" onClick={() => window.api.cancelProxy()}>
                      Cancel
                    </button>
                  </div>
                  {video.liveProxy && !video.proxy && <div className="hint mt-2">The preview already plays while the proxy is being created — parts not encoded yet buffer until ffmpeg reaches them.</div>}
                </div>
              ) : (
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button className={'btn btn-xs ' + (heavy && !video.proxy ? 'btn-filled' : 'btn-tonal')} onClick={() => makeProxy('full')} title="Same resolution, frame rate and bit depth, re-encoded on the GPU (NVENC). ~1.5 min for 3.5 min of 4K/120; the preview plays during creation.">
                    {video.proxy ? 'Re-create' : 'Create'} full-quality proxy
                  </button>
                  <button className="btn btn-xs btn-outlined" onClick={() => makeProxy('light')} title="1080p / 30 fps H.264 — small and fast, for weaker machines">
                    Light proxy (1080p/30)
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-outlined self-start" onClick={openVideo}>
              <Icon name="open" />
              Open another video…
            </button>
          </div>
        ) : (
          <div className="stack">
            <div className="hint">Any common format. The overlay is rendered on top of this footage; the export keeps its codec, resolution and frame rate.</div>
            <button className="btn btn-filled self-start" onClick={openVideo}>
              <Icon name="open" />
              Open video…
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head tele">
          <Icon name="telemetry" />
          <span className="card-title">Blackbox log</span>
          <span className="card-meta">{store.sources.length ? store.sources.length + (store.sources.length === 1 ? ' file' : ' files') : 'none'}</span>
        </div>
        <div className="stack">
          <div className="hint">
            A raw <code>.TXT</code> / <code>.BBL</code> log is decoded with the bundled <code>blackbox_decode</code>; the CSV is written next to it and loaded. A log with several flights gives one file per flight — remove the ones you don't need. An already decoded CSV can be added directly.
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className={'btn ' + (store.sources.length ? 'btn-tonal' : 'btn-filled')} onClick={decodeBlackbox} disabled={decoding || busy != null}>
              <Icon name="open" />
              {decoding ? 'Decoding…' : 'Decode blackbox log…'}
            </button>
            <button className="btn btn-outlined" onClick={async () => addCsvFiles(await window.api.openCsv())} disabled={busy != null}>
              Add CSV…
            </button>
          </div>
          {busy && (
            <div>
              <div className="progress">
                <div className="indet" />
              </div>
              <div className="hint mt-1">{busy}</div>
            </div>
          )}
          <button className="btn btn-text btn-sm self-start" style={{ marginLeft: -12 }} onClick={() => setOptionsOpen((o) => !o)}>
            <Icon name={optionsOpen ? 'chevronDown' : 'chevronRight'} />
            Decoder options
          </button>
          {optionsOpen && (
            <div className="card card-high stack" style={{ padding: 12, gap: 8 }}>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={bbOptions.mergeGps} onChange={(e) => setBbOptions((o) => ({ ...o, mergeGps: e.target.checked }))} /> Merge GPS into the main CSV (one file, recommended)
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={bbOptions.simulateImu} onChange={(e) => setBbOptions((o) => ({ ...o, simulateImu: e.target.checked }))} /> Simulate IMU (adds roll / pitch / heading columns)
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={bbOptions.datetime} onChange={(e) => setBbOptions((o) => ({ ...o, datetime: e.target.checked }))} /> Add dateTime column (UTC)
              </label>
              {SEL('GPS speed', 'unitGpsSpeed', [['mps', 'm/s'], ['kph', 'km/h'], ['mph', 'mph']], bbOptions, setBbOptions)}
              {SEL('Height', 'unitHeight', ['m', 'cm', 'ft'], bbOptions, setBbOptions)}
              {SEL('Rotation', 'unitRotation', ['raw', 'deg/s', 'rad/s'], bbOptions, setBbOptions)}
              {SEL('Acceleration', 'unitAcceleration', ['raw', 'g', 'm/s2'], bbOptions, setBbOptions)}
              {SEL('Vbat', 'unitVbat', ['raw', 'mV', 'V'], bbOptions, setBbOptions)}
              {SEL('Current', 'unitAmperage', ['raw', 'mA', 'A'], bbOptions, setBbOptions)}
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm">Log index (empty = all)</span>
                <input className="input input-sm" style={{ width: 110 }} type="number" min={1} value={bbOptions.index} onChange={(e) => setBbOptions((o) => ({ ...o, index: e.target.value }))} />
              </label>
            </div>
          )}
          {store.sources.length > 0 && (
            <div className="stack">
              {store.sources.map((s) => (
                <SourceItem key={s.id} s={s} store={store} updateSource={updateSource} removeSource={removeSource} />
              ))}
              <div className="hint">
                Several files (e.g. <code>LOG.01.csv</code> + <code>LOG.01.gps.csv</code>) share the same time base. Widgets reference columns by their exact header name; a name that exists in two files is prefixed with the file name: <code>LOG.01.gps.csv:GPS_speed (m/s)</code>.
              </div>
              {store.sources.length > 1 && (
                <button className="btn btn-text btn-sm btn-danger self-start" onClick={removeAllSources} title="Remove all telemetry files from the project (the files stay on disk)">
                  <Icon name="delete" />
                  Remove all files
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </StepScreen>
  );
}
