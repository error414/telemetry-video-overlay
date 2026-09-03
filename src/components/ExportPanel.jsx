import React from 'react';
import { exportSpan, pngScaleOptions } from '../export.js';
import { fmtTime } from '../time.js';

export const EXPORT_MODES = [
  { id: 'video', label: 'Video + overlay', sub: 'Same codec, resolution and frame rate as the source', ext: 'mp4' },
  { id: 'png', label: 'Overlay only · PNG sequence', sub: 'Transparent PNG per frame into a [video]_overlay folder — works everywhere', ext: '' },
];

/** Presentational: the export job itself lives in App so it survives tab switches. */
export default function ExportPanel({ video, widgets, job, setJobOption, startExport, cancelExport, range }) {
  const { mode, quality, running, progress, log, result } = job;
  const modeExt = (EXPORT_MODES.find((m) => m.id === mode) || {}).ext || 'png seq';
  const span = video ? exportSpan(range, video.duration, video.fps) : null;
  const scaleOptions = pngScaleOptions(video);
  return (
    <div>
      <section className="bay bay-amber">
        <header className="bay-head">
          <span className="bay-tick" />
          Output format
          <span className="bay-note">{modeExt}</span>
        </header>
        <div className="bay-body">
          {!video && <div className="hint mb-2">Load a video first.</div>}

          <div className="flex flex-col gap-1.5">
            {EXPORT_MODES.map((m) => (
              <label key={m.id} className={'card flex items-start gap-3 cursor-pointer ' + (mode === m.id ? 'row-active' : '')} style={{ padding: '8px 10px', opacity: running ? 0.6 : 1 }}>
                <input type="radio" name="mode" checked={mode === m.id} disabled={running} onChange={() => setJobOption({ mode: m.id })} className="mt-1" />
                <span>
                  <span className="font-medium">{m.label}</span>
                  <span className="hint block">{m.sub}</span>
                </span>
              </label>
            ))}
      </div>

          {mode === 'video' && (
            <div className="mt-3 text-xs flex flex-col gap-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={quality === 'bitrate'} disabled={running} onChange={() => setJobOption({ quality: 'bitrate' })} />
                Match source bitrate {video && video.bitrate ? <span className="mono hint">({(video.bitrate / 1e6).toFixed(1)} Mbit/s)</span> : <span className="hint">(unknown → uses CRF)</span>}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={quality === 'crf'} disabled={running} onChange={() => setJobOption({ quality: 'crf' })} />
                Constant quality (CRF 17 / x265 20) — visually lossless, larger file
              </label>
              <div className="hint">Audio and metadata are copied from the source without re-encoding.</div>
            </div>
          )}
          {mode === 'video' && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <label>
                <span className="label mt-0">Encoder</span>
                <select className="input" value={job.encoder} disabled={running} onChange={(e) => setJobOption({ encoder: e.target.value })}>
                  <option value="auto">GPU when available (NVENC + CUDA)</option>
                  <option value="cpu">CPU only (libx264 / libx265)</option>
                </select>
              </label>
              <label>
                <span className="label mt-0">Overlay frame rate</span>
                <select className="input" value={job.overlayFps} disabled={running} onChange={(e) => setJobOption({ overlayFps: Number(e.target.value) })}>
                  <option value={0}>Same as video{video ? ` (${video.fps.toFixed(2)})` : ''}</option>
                  <option value={60}>60 fps</option>
                  <option value={30}>30 fps</option>
                  <option value={25}>25 fps</option>
                </select>
              </label>
              <div className="hint col-span-2">
                Widgets are rendered only for the area they cover and at the overlay frame rate; the video itself keeps its full resolution and frame rate. 30 fps is plenty for telemetry and renders ~4× faster on 120 fps footage.
              </div>
            </div>
          )}
          {mode === 'png' && (
            <div className="mt-3 text-xs flex flex-col gap-1">
              <label className="block">
                <span className="label mt-0">Image size</span>
                <select className="input" value={scaleOptions.includes(job.pngScale) ? job.pngScale : 1} disabled={running || !video} onChange={(e) => setJobOption({ pngScale: Number(e.target.value) })}>
                  {scaleOptions.map((k) => (
                    <option key={k} value={k}>
                      {video ? `${video.width * k}×${video.height * k}` : 'video size'}
                      {k === 1 ? ' (same as video)' : ` (${k}×)`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={!!job.perWidget} disabled={running} onChange={(e) => setJobOption({ perWidget: e.target.checked })} />
                Each widget separately (a sub-folder per widget)
              </label>
              <div className="hint">
                8-bit RGBA PNG @ {video ? `${video.fps.toFixed(3)} fps` : 'source frame rate'}; widgets are rendered natively at the chosen size (multiples of the video up to 4K UHD). Files are
                numbered by the source frame index (frame 0 = video start), so a cut export starts at the in point's frame number. Widgets sharing a name get _1, _2, _3 folders.
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bay bay-mixed">
        <header className="bay-head">
          <span className="bay-tick" />
          Render
          <span className="bay-note">{running ? (progress ? Math.round((100 * progress.frame) / progress.total) + '%' : 'starting…') : result === 'ok' ? 'finished' : result === 'cancelled' ? 'cancelled' : result ? 'failed' : 'idle'}</span>
        </header>
        <div className="bay-body">
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!video || running || !widgets.length} onClick={startExport}>
              Export…
            </button>
            {running && (
              <button className="btn btn-danger" onClick={cancelExport}>
                Cancel
              </button>
            )}
          </div>
          {!widgets.length && video && (
            <div className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
              Add at least one widget.
            </div>
          )}
          {span && (
            <div className="text-xs mt-2 flex items-center gap-2 flex-wrap">
              <span className="bar-label">Range</span>
              {span.full ? (
                <span className="chip">whole video · {fmtTime(video.duration)}</span>
              ) : (
                <span className="chip chip-accent mono">
                  {fmtTime(span.start)} to {fmtTime(span.end)} · {fmtTime(span.end - span.start)}
                </span>
              )}
              <span className="hint">set in the bar under the video (I / O keys, amber markers)</span>
            </div>
          )}

          {(running || progress) && progress && (
            <div className="card mt-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium">{running ? 'Rendering…' : result === 'ok' ? 'Finished' : result === 'cancelled' ? 'Cancelled' : 'Failed'}</span>
                <span className={'chip ' + (running ? 'chip-accent' : result === 'ok' ? 'chip-good' : result === 'cancelled' ? '' : 'chip-bad')}>{Math.round((100 * progress.frame) / progress.total)}%</span>
              </div>
              <div className="progress">
                <div style={{ width: (100 * progress.frame) / progress.total + '%' }} />
              </div>
              <div className="mono text-xs mt-2" style={{ color: 'var(--muted)' }}>
                frame {progress.frame} / {progress.total} · {progress.fps.toFixed(1)} fps · {running ? 'ETA ' + fmtEta(progress.eta) : 'done'}
              </div>
              {job.out && <div className="text-xs mt-1 break-all hint">{job.out}</div>}
              {job.setup && (
                <div className="text-xs mt-1 flex gap-1 flex-wrap">
                  <span className={'chip ' + (job.setup.gpu && job.setup.gpu.encode ? 'chip-good' : '')}>{job.setup.gpu && job.setup.gpu.encode ? 'NVENC encode' : 'CPU encode'}</span>
                  <span className={'chip ' + (job.setup.gpu && job.setup.gpu.decode ? 'chip-good' : '')}>{job.setup.gpu && job.setup.gpu.decode ? 'CUDA decode' : 'CPU decode'}</span>
                  <span className="chip mono">
                    overlay {job.setup.region.w}×{job.setup.region.h} @ {job.setup.fps.toFixed(2)} fps
                  </span>
                  {job.setup.passes > 1 && <span className="chip mono">{job.setup.passes} widget folders</span>}
                  {mode === 'png' && <span className="chip mono">from frame {job.setup.startNumber}</span>}
                </div>
              )}
            </div>
          )}
          {log && (
            <pre className="mono text-[11px] whitespace-pre-wrap card mt-2 max-h-48 overflow-auto" style={{ color: 'var(--muted)' }}>
              {log}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}

function fmtEta(s) {
  s = Math.round(s || 0);
  if (s < 60) return s + ' s';
  return Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
}
