import React from 'react';

// opts: array of values, or [value, label] pairs when the blackbox_decode CLI value
// (e.g. "kph") should be shown with a nicer label (e.g. "km/h")
const SEL = (label, key, opts, bbOptions, setBbOptions) => (
  <label key={key} className="flex items-center justify-between gap-2">
    <span className="hint">{label}</span>
    <select className="input" style={{ width: 90 }} value={bbOptions[key]} onChange={(e) => setBbOptions((o) => ({ ...o, [key]: e.target.value }))}>
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

export default function FilesPanel({ video, openVideo, removeVideo, layout, setLayout, lt, rebaseLayout, makeProxy, proxyProgress, cancelProxy, decodeBlackbox, decoding, busy, bbOptions, setBbOptions, store, storeVersion, addCsvFiles, updateSource, removeSource, removeAllSources }) {
  void storeVersion;
  const heavy = video && (video.codec === 'hevc' || video.width > 1920 || video.fps > 60);
  return (
    <div className="text-sm">
      <section className="bay bay-amber">
        <header className="bay-head">
          <span className="bay-tick" />
          Video
          <span className="bay-note">{video ? `${video.width}×${video.height} · ${video.fps.toFixed(2)} fps` : 'empty'}</span>
        </header>
        <div className="bay-body">
          {video ? (
            <div className="card text-xs break-all">
              <div className="flex items-start gap-2">
                <div className="flex-1">{video.path}</div>
                <button className="btn btn-xs btn-danger" onClick={removeVideo} title="Remove the video from the project (the file stays on disk)">
                  ✕
                </button>
              </div>
              <div className="hint mt-1">
                {video.width}×{video.height} · {video.fps.toFixed(3)} fps · {video.codec} · {video.duration.toFixed(2)} s · {video.bitrate ? (video.bitrate / 1e6).toFixed(1) + ' Mbit/s' : 'bitrate n/a'} · {video.hasAudio ? 'audio' : 'no audio'}
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border)]">
                <div className="font-medium text-sm">Widget layout reference</div>
                <div className="hint mt-1">The resolution the widgets were designed for; on other videos the whole layout (positions, sizes, fonts) scales automatically.</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <select
                    className="input"
                    style={{ width: 190 }}
                    value={layout ? layout.w + 'x' + layout.h : ''}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setLayout({ w, h });
                    }}
                  >
                    {[[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]]
                      .concat(layout && ![720, 1080, 1440, 2160].includes(layout.h) ? [[layout.w, layout.h]] : [])
                      .map(([w, h]) => (
                        <option key={w + 'x' + h} value={w + 'x' + h}>
                          {w}×{h}{video && video.width === w && video.height === h ? ' (this video)' : ''}
                        </option>
                      ))}
                  </select>
                  {lt && lt.k !== 1 && (
                    <>
                      <span className="chip chip-warn">scaled ×{lt.k.toFixed(2)}</span>
                      <button className="btn btn-xs" onClick={rebaseLayout} title="Convert widget coordinates to this video's resolution and make it the new reference">
                        Rebase to {video.width}×{video.height}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--border)]">
                <div className="font-medium text-sm">Preview proxy</div>
                {video.proxy ? (
                  <div className="text-[var(--good)] mt-1">Using proxy for preview: {video.proxy}</div>
                ) : (
                  <div className={'mt-1 ' + (heavy ? 'text-[var(--warn)]' : 'hint')}>
                    {heavy ? 'Camera HEVC streams (e.g. DJI 4K/120 10-bit) are often rejected by the built-in player. ' : ''}
                    A proxy is a re-encoded copy used only for the in-app preview; export always uses the original file.
                  </div>
                )}
                {proxyProgress != null ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 progress">
                        <div className="" style={{ width: proxyProgress * 100 + '%' }} />
                      </div>
                      <span className="font-mono">{Math.round(proxyProgress * 100)}%</span>
                      <button className="btn btn-xs btn-danger" onClick={cancelProxy}>
                        Cancel
                      </button>
                    </div>
                    {video.liveProxy && !video.proxy && <div className="hint mt-1">The preview already plays while the proxy is being created — parts not encoded yet buffer until ffmpeg reaches them.</div>}
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button className={'btn btn-xs ' + (heavy && !video.proxy ? 'btn-primary' : '')} onClick={() => makeProxy('full')} title="Same resolution, frame rate and bit depth, re-encoded on the GPU (NVENC). ~1.5 min for 3.5 min of 4K/120; the preview plays during creation.">
                      {video.proxy ? 'Re-create' : 'Create'} full-quality proxy (GPU)
                    </button>
                    <button className="btn btn-xs" onClick={() => makeProxy('light')} title="1080p / 30 fps H.264 — small and fast, for weaker machines">
                      Light proxy (1080p/30)
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="hint mb-2">No video loaded. The overlay is rendered on top of this footage.</p>
          )}
          <button className={'btn mt-2' + (video ? '' : ' btn-primary')} onClick={openVideo}>
            Open video…
          </button>
        </div>
      </section>

      <section className="bay bay-mixed">
        <header className="bay-head">
          <span className="bay-tick" />
          INAV blackbox log
          <span className="bay-note">blackbox_decode</span>
        </header>
        <div className="bay-body">
          <p className="hint mb-2">
            Decode a raw <code>.TXT</code>/<code>.BBL</code> log with the bundled <code>blackbox_decode</code> (iNavFlight/blackbox-tools). CSV files are written next to the log and loaded automatically. A log file containing several flights produces one CSV per flight — remove the ones you don't need below.
          </p>
          <details className="card mb-2 text-xs">
            <summary className="cursor-pointer">Decoder options</summary>
            <div className="grid grid-cols-1 gap-1 mt-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bbOptions.mergeGps} onChange={(e) => setBbOptions((o) => ({ ...o, mergeGps: e.target.checked }))} /> Merge GPS into the main CSV (one file, recommended)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bbOptions.simulateImu} onChange={(e) => setBbOptions((o) => ({ ...o, simulateImu: e.target.checked }))} /> Simulate IMU (adds roll / pitch / heading columns)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bbOptions.datetime} onChange={(e) => setBbOptions((o) => ({ ...o, datetime: e.target.checked }))} /> Add dateTime column (UTC)
              </label>
              {SEL('GPS speed', 'unitGpsSpeed', [['mps', 'm/s'], ['kph', 'km/h'], ['mph', 'mph']], bbOptions, setBbOptions)}
              {SEL('Height', 'unitHeight', ['m', 'cm', 'ft'], bbOptions, setBbOptions)}
              {SEL('Rotation', 'unitRotation', ['raw', 'deg/s', 'rad/s'], bbOptions, setBbOptions)}
              {SEL('Acceleration', 'unitAcceleration', ['raw', 'g', 'm/s2'], bbOptions, setBbOptions)}
              {SEL('Vbat', 'unitVbat', ['raw', 'mV', 'V'], bbOptions, setBbOptions)}
              {SEL('Current', 'unitAmperage', ['raw', 'mA', 'A'], bbOptions, setBbOptions)}
              <label className="flex items-center justify-between gap-2">
                <span className="hint">Log index (empty = all)</span>
                <input className="input" style={{ width: 90 }} type="number" min={1} value={bbOptions.index} onChange={(e) => setBbOptions((o) => ({ ...o, index: e.target.value }))} />
              </label>
            </div>
          </details>
          <button className="btn btn-primary" onClick={decodeBlackbox} disabled={decoding || busy != null}>
            {decoding ? 'Decoding…' : 'Decode blackbox log…'}
          </button>
          {busy && (
            <div className="mt-2">
              <div className="progress">
                <div className="indet" />
              </div>
              <div className="hint mt-1">{busy}</div>
            </div>
          )}
        </div>
      </section>

      <section className="bay bay-tele">
        <header className="bay-head">
          <span className="bay-tick" />
          Telemetry CSV files
          <span className="bay-note">{store.sources.length ? store.sources.length + (store.sources.length === 1 ? ' file' : ' files') : 'empty'}</span>
        </header>
        <div className="bay-body">
          <p className="hint mb-2">
            Decoded or externally exported CSV files. Several files (e.g. <code>LOG.01.csv</code> + <code>LOG.01.gps.csv</code>) share the same time base. Columns are referenced by their exact header name in widgets; if a name exists in two files, prefix it with the file name: <code>LOG.01.gps.csv:GPS_speed (m/s)</code>.
          </p>
          {store.sources.map((s) => (
            <div key={s.id} className="card mb-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="flex-1 break-all">
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="hint">{s.path}</div>
                  <div className="hint mt-1">
                    {s.count} rows · {s.columns.length} columns · {s.count ? (s.lastTime - s.firstTime).toFixed(1) : 0} s · starts at {(s.firstTime - store.origin).toFixed(3)} s
                  </div>
                  {s.step > 1 && (
                    <div className="hint" title={`The file has ${s.totalRows} rows sampled at ~${Math.round(s.sourceRate)} Hz; widgets render at most 120 fps, so only every ${s.step}. sample was kept to save memory and load time.`}>
                      {Math.round(s.sourceRate)} Hz log → every {s.step}. sample kept ({Math.round(s.sourceRate / s.step)} Hz)
                    </div>
                  )}
                </div>
                <button className="btn btn-xs btn-danger" onClick={() => removeSource(s.id)}>
                  ✕
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <label className="flex-1">
                  <span className="label mt-0">Time column</span>
                  <select className="input" value={s.timeColumn} onChange={(e) => updateSource(s.id, { timeColumn: e.target.value })}>
                    {s.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label mt-0">Unit</span>
                  <select className="input" value={s.timeUnit} onChange={(e) => updateSource(s.id, { timeUnit: e.target.value })}>
                    <option value="us">µs</option>
                    <option value="ms">ms</option>
                    <option value="s">s</option>
                  </select>
                </label>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer hint">Columns ({s.columns.length})</summary>
                <div className="mt-1 max-h-48 overflow-auto font-mono text-[11px] leading-4">
                  {s.columns.map((c) => (
                    <div key={c} className="cursor-pointer hover:text-sky-400" title="Click to copy" onClick={() => navigator.clipboard.writeText(c)}>
                      {c}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn" onClick={async () => addCsvFiles(await window.api.openCsv())} disabled={busy != null}>
              Add CSV…
            </button>
            {store.sources.length > 0 && (
              <button className="btn btn-danger" onClick={removeAllSources} title="Remove all telemetry files from the project (the files stay on disk)">
                Remove all
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
