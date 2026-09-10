import React from 'react';
import StepScreen from './StepScreen.jsx';
import RangeControls from '../components/RangeControls.jsx';
import Icon from '../components/Icon.jsx';
import { exportSpan, pngScaleOptions } from '../export.js';
import { fmtTime } from '../time.js';

export const EXPORT_MODES = [
  { id: 'video', label: 'Video + overlay', sub: 'Same codec, resolution and frame rate as the source', ext: 'mp4', icon: 'film' },
  { id: 'png', label: 'Overlay only · PNG sequence', sub: 'Transparent PNG per frame into a [video]_overlay folder — works everywhere', ext: '', icon: 'image' },
];

function fmtEta(s) {
  s = Math.round(s || 0);
  if (s < 60) return s + ' s';
  return Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
}

/** Step 4 — choose the part of the video and the output format, render with ffmpeg. */
export default function ExportStep({ app }) {
  const { video, widgets, job, setJobOption, startExport, cancelExport, range, setRange } = app;
  const { mode, quality, running, progress, log, result } = job;
  const span = video ? exportSpan(range, video.duration, video.fps) : null;
  const scaleOptions = pngScaleOptions(video);
  const visibleCount = widgets.filter((w) => w.visible !== false).length;
  return (
    <StepScreen app={app} rangeMode="edit">
      {(player) => (
        <>
          {(!video || !visibleCount) && (
            <div className="banner warn" style={{ marginBottom: 16 }}>
              <Icon name="warning" />
              <span>{!video ? 'Open a video in the Files step first.' : 'Add at least one visible widget in the Widgets step.'}</span>
            </div>
          )}
          <div className="card">
            <div className="card-head accent">
              <Icon name="clock" />
              <span className="card-title">Range</span>
              <span className="card-meta">{span ? (span.full ? 'whole video · ' + fmtTime(video.duration) : fmtTime(span.start) + ' – ' + fmtTime(span.end)) : '—'}</span>
            </div>
            <RangeControls player={player} range={range} setRange={setRange} />
          </div>

          <div className="card">
            <div className="card-head">
              <Icon name="export" />
              <span className="card-title">Output</span>
              <span className="card-meta">{(EXPORT_MODES.find((m) => m.id === mode) || {}).ext || 'png seq'}</span>
            </div>
            <div className="stack">
              <div className="stack" style={{ gap: 8 }}>
                {EXPORT_MODES.map((m) => (
                  <button key={m.id} className={'choice' + (mode === m.id ? ' on' : '')} disabled={running} onClick={() => setJobOption({ mode: m.id })} role="radio" aria-checked={mode === m.id}>
                    <Icon name={m.icon} />
                    <span>
                      <span className="choice-title">{m.label}</span>
                      <span className="choice-sub">{m.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              {mode === 'video' && (
                <>
                  <div className="stack" style={{ gap: 6 }}>
                    <label className="flex items-center gap-3 cursor-pointer text-sm">
                      <input type="radio" checked={quality === 'bitrate'} disabled={running} onChange={() => setJobOption({ quality: 'bitrate' })} />
                      <span>
                        Match source bitrate {video && video.bitrate ? <span className="mono hint">({(video.bitrate / 1e6).toFixed(1)} Mbit/s)</span> : <span className="hint">(unknown → uses CRF)</span>}
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer text-sm">
                      <input type="radio" checked={quality === 'crf'} disabled={running} onChange={() => setJobOption({ quality: 'crf' })} />
                      <span>Constant quality (CRF 17 / x265 20) — visually lossless, larger file</span>
                    </label>
                    <div className="hint">Audio and metadata are copied from the source without re-encoding.</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="label mt-0">Encoder</span>
                      <select className="input input-sm" value={job.encoder} disabled={running} onChange={(e) => setJobOption({ encoder: e.target.value })}>
                        <option value="auto">GPU when available (NVENC + CUDA)</option>
                        <option value="cpu">CPU only (libx264 / libx265)</option>
                      </select>
                    </label>
                    <label>
                      <span className="label mt-0">Overlay frame rate</span>
                      <select className="input input-sm" value={job.overlayFps} disabled={running} onChange={(e) => setJobOption({ overlayFps: Number(e.target.value) })}>
                        <option value={0}>Same as video{video ? ` (${video.fps.toFixed(2)})` : ''}</option>
                        <option value={60}>60 fps</option>
                        <option value={30}>30 fps</option>
                        <option value={25}>25 fps</option>
                      </select>
                    </label>
                  </div>
                  <div className="hint">Widgets are rendered only for the area they cover and at the overlay frame rate; the video keeps its full resolution and frame rate. 30 fps is plenty for telemetry and renders ~4× faster on 120 fps footage.</div>
                </>
              )}
              {mode === 'png' && (
                <>
                  <label className="block">
                    <span className="label mt-0">Image size</span>
                    <select className="input input-sm" value={scaleOptions.includes(job.pngScale) ? job.pngScale : 1} disabled={running || !video} onChange={(e) => setJobOption({ pngScale: Number(e.target.value) })}>
                      {scaleOptions.map((k) => (
                        <option key={k} value={k}>
                          {video ? `${video.width * k}×${video.height * k}` : 'video size'}
                          {k === 1 ? ' (same as video)' : ` (${k}×)`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-sm">
                    <input type="checkbox" checked={!!job.perWidget} disabled={running} onChange={(e) => setJobOption({ perWidget: e.target.checked })} />
                    Each widget separately (a sub-folder per widget)
                  </label>
                  <div className="hint">
                    8-bit RGBA PNG @ {video ? `${video.fps.toFixed(3)} fps` : 'source frame rate'}; widgets are rendered natively at the chosen size (multiples of the video up to 4K UHD). Files are numbered by the source frame index (frame 0 = video start), so a cut export starts at the in point's frame number. Widgets sharing a name get _1, _2, _3 folders.
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Icon name="auto" />
              <span className="card-title">Render</span>
              <span className="card-meta">{running ? (progress ? Math.round((100 * progress.frame) / progress.total) + '%' : 'starting…') : result === 'ok' ? 'finished' : result === 'cancelled' ? 'cancelled' : result ? 'failed' : 'idle'}</span>
            </div>
            <div className="stack">
              <div className="flex gap-2">
                <button className="btn btn-filled" disabled={!video || running || !visibleCount} onClick={startExport}>
                  <Icon name="export" />
                  Export…
                </button>
                {running && (
                  <button className="btn btn-danger" onClick={cancelExport}>
                    Cancel
                  </button>
                )}
              </div>
              {(running || progress) && progress && (
                <div className="card card-high" style={{ padding: 12 }}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">{running ? 'Rendering…' : result === 'ok' ? 'Finished' : result === 'cancelled' ? 'Cancelled' : 'Failed'}</span>
                    <span className={'chip chip-sm ' + (running ? 'chip-accent' : result === 'ok' ? 'chip-good' : result === 'cancelled' ? '' : 'chip-bad')}>{Math.round((100 * progress.frame) / progress.total)}%</span>
                  </div>
                  <div className="progress">
                    <div style={{ width: (100 * progress.frame) / progress.total + '%' }} />
                  </div>
                  <div className="mono text-xs mt-2" style={{ color: 'var(--on-surface-variant)' }}>
                    frame {progress.frame} / {progress.total} · {progress.fps.toFixed(1)} fps · {running ? 'ETA ' + fmtEta(progress.eta) : 'done'}
                  </div>
                  {job.out && <div className="hint mt-1 break-all">{job.out}</div>}
                  {job.setup && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      <span className={'chip chip-sm ' + (job.setup.gpu && job.setup.gpu.encode ? 'chip-good' : '')}>{job.setup.gpu && job.setup.gpu.encode ? 'NVENC encode' : 'CPU encode'}</span>
                      <span className={'chip chip-sm ' + (job.setup.gpu && job.setup.gpu.decode ? 'chip-good' : '')}>{job.setup.gpu && job.setup.gpu.decode ? 'CUDA decode' : 'CPU decode'}</span>
                      <span className="chip chip-sm mono">
                        overlay {job.setup.region.w}×{job.setup.region.h} @ {job.setup.fps.toFixed(2)} fps
                      </span>
                      {job.setup.passes > 1 && <span className="chip chip-sm mono">{job.setup.passes} widget folders</span>}
                      {mode === 'png' && <span className="chip chip-sm mono">from frame {job.setup.startNumber}</span>}
                    </div>
                  )}
                </div>
              )}
              {log && (
                <pre className="mono text-[11px] whitespace-pre-wrap card card-high max-h-48 overflow-auto m-0" style={{ color: 'var(--on-surface-variant)', padding: 12 }}>
                  {log}
                </pre>
              )}
            </div>
          </div>
        </>
      )}
    </StepScreen>
  );
}
