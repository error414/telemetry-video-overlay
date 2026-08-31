import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TelemetryStore, parseCsvText, buildSeries, guessTimeColumn, guessTimeUnit } from './telemetry.js';
import { newWidget } from './widgetRuntime.js';
import { EXAMPLE_WIDGETS, EXAMPLES_VERSION } from './examples.js';
import { runExport } from './export.js';
import Stage from './components/Stage.jsx';
import SyncBar from './components/SyncBar.jsx';
import FilesPanel from './components/FilesPanel.jsx';
import WidgetsPanel, { ColumnsInput } from './components/WidgetsPanel.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import ExportPanel, { EXPORT_MODES } from './components/ExportPanel.jsx';
import CodeEditorModal from './components/CodeEditorModal.jsx';

const LIB_KEY = 'telemetry-overlay.widgetLibrary.v1';
const PROJECT_KEY = 'telemetry-overlay.lastProject.v1';
const EXAMPLES_KEY = 'telemetry-overlay.examplesVersion';
export const DEFAULT_BB_OPTIONS = {
  mergeGps: true,
  simulateImu: true,
  datetime: false,
  unitGpsSpeed: 'kph',
  unitHeight: 'm',
  unitRotation: 'deg/s',
  unitAcceleration: 'g',
  unitVbat: 'V',
  unitAmperage: 'A',
  index: '',
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const freshExamples = () => EXAMPLE_WIDGETS.map((w) => ({ ...w, id: uid() }));

function loadLibrary() {
  let lib = null;
  try {
    const raw = localStorage.getItem(LIB_KEY);
    if (raw) lib = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (!Array.isArray(lib)) lib = freshExamples();
  // refresh the built-in examples when they changed in a new app version (user widgets are kept)
  if (Number(localStorage.getItem(EXAMPLES_KEY) || 0) !== EXAMPLES_VERSION) {
    lib = [...lib.filter((w) => !(w.name || '').startsWith('Example:')), ...freshExamples()];
    localStorage.setItem(EXAMPLES_KEY, String(EXAMPLES_VERSION));
  }
  return lib;
}

const TABS = [
  ['files', 'Files'],
  ['widgets', 'Widgets'],
  ['library', 'Library'],
  ['export', 'Export'],
];

export default function App() {
  const storeRef = useRef(new TelemetryStore());
  const store = storeRef.current;
  const [storeVersion, setStoreVersion] = useState(0);
  const bump = () => setStoreVersion((v) => v + 1);

  const [video, setVideo] = useState(null); // probe info
  const [offset, setOffset] = useState(0); // seconds added to video time to get telemetry time
  const [widgets, setWidgets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [library, setLibrary] = useState(loadLibrary);
  const [tab, setTab] = useState('files');
  const [status, setStatus] = useState('');
  // playback problems get a modal on top of the status line — the corner status is easy to miss
  const [playError, setPlayError] = useState(null);
  // once the decoder is known to be broken, lock all video transport (play/step/seek) until a proxy exists
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const showPlayError = useCallback((msg, { block = true } = {}) => {
    setStatus(msg);
    setPlayError(msg);
    if (block) setPlaybackBlocked(true);
  }, []);
  const [editMode, setEditMode] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  // layout grid (video pixels): snap on/off, size, visibility — remembered between sessions
  const [grid, setGrid] = useState(() => {
    try {
      return { snap: true, size: 20, show: true, ...JSON.parse(localStorage.getItem('telemetry-overlay.grid') || '{}') };
    } catch {
      return { snap: true, size: 20, show: true };
    }
  });
  useEffect(() => localStorage.setItem('telemetry-overlay.grid', JSON.stringify(grid)), [grid]);
  const videoRef = useRef(null);
  const [time, setTime] = useState(0);
  // reference resolution the widget layout was designed for; widgets scale to other videos
  const [layout, setLayout] = useState(null);

  useEffect(() => localStorage.setItem(LIB_KEY, JSON.stringify(library)), [library]);

  // ---- CSV sources ----
  const addCsvFiles = useCallback(
    async (paths) => {
      for (const p of paths) {
        try {
          const text = await window.api.readText(p);
          const parsed = parseCsvText(text);
          const timeColumn = guessTimeColumn(parsed.columns);
          const sample = Number(parsed.rows[Math.min(10, parsed.rows.length - 1)]?.[timeColumn]);
          const timeUnit = guessTimeUnit(timeColumn, sample);
          const built = buildSeries(parsed, timeColumn, timeUnit);
          store.sources.push({ id: uid(), path: p, name: p.split(/[\\/]/).pop(), columns: parsed.columns, timeColumn, timeUnit, parsed, ...built });
        } catch (e) {
          setStatus('CSV error: ' + e.message);
        }
      }
      store.rebuild();
      bump();
    },
    [store]
  );

  // ---- INAV blackbox .TXT/.BBL → CSV via bundled blackbox_decode ----
  const [bbOptions, setBbOptions] = useState(() => {
    try {
      return { ...DEFAULT_BB_OPTIONS, ...JSON.parse(localStorage.getItem('telemetry-overlay.bbOptions') || '{}') };
    } catch {
      return DEFAULT_BB_OPTIONS;
    }
  });
  useEffect(() => localStorage.setItem('telemetry-overlay.bbOptions', JSON.stringify(bbOptions)), [bbOptions]);
  const [decoding, setDecoding] = useState(false);
  const decodeBlackbox = useCallback(async () => {
    const files = await window.api.openBlackbox();
    if (!files.length) return;
    setDecoding(true);
    try {
      for (const f of files) {
        setStatus('Decoding ' + f + ' …');
        const r = await window.api.decodeBlackbox(f, bbOptions);
        if (!r.files.length) {
          setStatus('Decoder produced no CSV for ' + f + ': ' + r.log.slice(-300));
          continue;
        }
        await addCsvFiles(r.files);
        setStatus('Decoded ' + r.files.length + ' CSV file(s) from ' + f.split(/[\\/]/).pop());
      }
      setTab('files');
    } catch (e) {
      setStatus('Decode error: ' + e.message);
    } finally {
      setDecoding(false);
    }
  }, [bbOptions, addCsvFiles]);

  const updateSource = useCallback(
    (id, patch) => {
      const s = store.sources.find((x) => x.id === id);
      if (!s) return;
      Object.assign(s, patch);
      Object.assign(s, buildSeries(s.parsed, s.timeColumn, s.timeUnit));
      store.rebuild();
      bump();
    },
    [store]
  );

  const removeSource = useCallback(
    (id) => {
      store.sources = store.sources.filter((x) => x.id !== id);
      store.rebuild();
      bump();
    },
    [store]
  );

  const removeAllSources = useCallback(() => {
    store.sources = [];
    store.rebuild();
    bump();
    setStatus('All telemetry files removed');
  }, [store]);

  // ---- Video ----
  const probeVideo = useCallback(async (p) => {
    const info = await window.api.probe(p);
    const proxy = p.replace(/\.[^.]+$/, '') + '.preview-proxy.mp4';
    if (await window.api.exists(proxy)) info.proxy = proxy;
    return info;
  }, []);

  // Ask the browser up front whether it can decode this file (codec/resolution/fps from ffprobe).
  // Chromium reports supported/smooth without touching the file, so we can warn before the user hits play.
  const warnIfUndecodable = useCallback(async (info) => {
    if (info.proxy || !navigator.mediaCapabilities) return;
    const mime = { h264: 'video/mp4; codecs="avc1.640033"', hevc: 'video/mp4; codecs="hvc1.1.6.L186.B0"', vp9: 'video/webm; codecs="vp09.00.51.08"', av1: 'video/mp4; codecs="av01.0.13M.08"' }[info.codec];
    if (!mime) return;
    try {
      const cap = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: { contentType: mime, width: info.width, height: info.height, framerate: info.fps, bitrate: Math.round(info.width * info.height * info.fps * 0.08) || 8_000_000 },
      });
      const what = `${info.codec} ${info.width}×${info.height} @ ${Math.round(info.fps)} fps`;
      if (!cap.supported) showPlayError(`The player cannot decode this video (${what}) — create a preview proxy in the Files tab.`);
      else if (!cap.smooth) showPlayError(`This video (${what}) is likely too heavy for smooth playback on this machine — create a preview proxy in the Files tab.`, { block: false });
    } catch {
      // capability probe failed → fall back to the runtime stall detection in SyncBar
    }
  }, [showPlayError]);

  const [proxyProgress, setProxyProgress] = useState(null);
  useEffect(() => window.api.onProxyProgress(setProxyProgress), []);
  // the proxy is playable while still being encoded: main announces the growing .part file
  // and the Stage plays it through MSE (liveProxy.js) until the finished proxy takes over
  useEffect(() => window.api.onProxyLive(({ part, codec }) => setVideo((v) => (v ? { ...v, liveProxy: part, liveCodec: codec } : v))), []);
  const makeProxy = useCallback(async (kind = 'full') => {
    if (!video) return;
    setProxyProgress(0);
    try {
      const proxy = await window.api.makeProxy(video.path, video.duration, kind, video.fps);
      if (!proxy) {
        setStatus('Proxy creation cancelled');
        return;
      }
      setVideo((v) => ({ ...v, proxy, liveProxy: null }));
      setStatus('Preview proxy created: ' + proxy);
    } catch (e) {
      setStatus('Proxy error: ' + e.message);
    } finally {
      setVideo((v) => (v && v.proxy ? v : v ? { ...v, liveProxy: null } : v));
      setProxyProgress(null);
    }
  }, [video]);

  const openVideo = useCallback(async () => {
    const p = await window.api.openVideo();
    if (!p) return;
    try {
      const info = await probeVideo(p);
      setVideo(info);
      setPlaybackBlocked(false);
      setLayout((l) => {
        if (widgets.length === 0) return { w: info.width, h: info.height }; // empty project → this video is the reference
        if (l && l.w) return l; // keep the existing reference
        // widgets exist but their reference is unknown (older project) → assume 1080p, fixable in Files
        setStatus('Widget layout reference unknown — assuming 1920×1080. Adjust it in the Files tab if widgets look wrong.');
        return { w: 1920, h: 1080 };
      });
      setStatus(`Video: ${info.width}x${info.height} @ ${info.fps.toFixed(3)} fps, ${info.codec}, ${info.duration.toFixed(1)} s`);
      warnIfUndecodable(info);
    } catch (e) {
      setStatus('Probe error: ' + e.message);
    }
  }, [probeVideo, warnIfUndecodable, widgets.length]);

  // removes the video from the project only — the file (and any proxy) stays on disk
  const removeVideo = useCallback(() => {
    if (proxyProgress != null) window.api.cancelProxy();
    setVideo(null);
    setPlaybackBlocked(false);
    setPlayError(null);
    setTime(0);
    setStatus('Video removed from the project');
  }, [proxyProgress]);

  // ---- Widgets ----
  const updateWidget = useCallback((id, patch) => setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w))), []);
  const addWidget = useCallback((partial) => {
    const w = newWidget(partial);
    setWidgets((ws) => [...ws, w]);
    setSelectedId(w.id);
    setTab('widgets');
  }, []);
  const removeWidget = useCallback((id) => setWidgets((ws) => ws.filter((w) => w.id !== id)), []);

  // ---- Export job (lives here so it survives tab switches) ----
  const [job, setJob] = useState({ mode: 'video', quality: 'bitrate', encoder: 'auto', overlayFps: 30, running: false, progress: null, log: '', result: null, out: null, setup: null });
  const cancelRef = useRef(false);
  const setJobOption = useCallback((patch) => setJob((j) => ({ ...j, ...patch })), []);
  useEffect(() => window.api.onExportLog((s) => setJob((j) => ({ ...j, log: (j.log + s).slice(-4000) }))), []);
  const startExport = useCallback(async () => {
    if (!video || job.running) return;
    const m = EXPORT_MODES.find((x) => x.id === job.mode);
    const base = video.path.replace(/\.[^.]+$/, '');
    let out;
    if (job.mode === 'png') out = await window.api.openDir();
    else {
      const ext = job.mode === 'video' ? video.path.split('.').pop().toLowerCase() : m.ext;
      out = await window.api.saveOutput(base + '_overlay.' + ext, ext);
    }
    if (!out) return;
    cancelRef.current = false;
    setJob((j) => ({ ...j, running: true, log: '', result: null, out, setup: null, progress: { frame: 0, total: 1, fps: 0, eta: 0 } }));
    setStatus('Export running… (tabs are locked until it finishes)');
    try {
      const r = await runExport({
        mode: job.mode,
        out,
        info: video,
        widgets,
        store,
        offset,
        quality: job.quality,
        encoder: job.encoder,
        overlayFps: job.overlayFps,
        lt,
        onStart: (setup) => setJob((j) => ({ ...j, setup })),
        onProgress: (p) => setJob((j) => ({ ...j, progress: p })),
        isCancelled: () => cancelRef.current,
      });
      setJob((j) => ({ ...j, running: false, result: r.cancelled ? 'cancelled' : 'ok' }));
      setStatus(r.cancelled ? 'Export cancelled' : 'Export finished: ' + out);
    } catch (e) {
      setJob((j) => ({ ...j, running: false, result: 'error', log: j.log + '\n' + e.message }));
      setStatus('Export failed — see the Export tab');
    }
  }, [video, job.running, job.mode, job.quality, widgets, store, offset]);
  const cancelExport = useCallback(() => (cancelRef.current = true), []);

  // ---- Project save/load ----
  const projectJson = useCallback(
    () =>
      JSON.stringify(
        {
          app: 'telemetry-overlay',
          version: 1,
          video: video ? video.path : null,
          layout,
          sources: store.sources.map((s) => ({ path: s.path, timeColumn: s.timeColumn, timeUnit: s.timeUnit })),
          offset,
          widgets,
        },
        null,
        2
      ),
    [video, store, offset, widgets]
  );

  const saveProject = useCallback(async () => {
    const p = await window.api.saveJson('Save project', 'overlay-project.json');
    if (!p) return;
    await window.api.writeText(p, projectJson());
    setStatus('Project saved: ' + p);
  }, [projectJson]);

  const loadProjectData = useCallback(
    async (j) => {
      store.sources = [];
      if (j.sources) {
        await addCsvFiles(j.sources.map((s) => s.path));
        for (const cfg of j.sources) {
          const s = store.sources.find((x) => x.path === cfg.path);
          if (s && (s.timeColumn !== cfg.timeColumn || s.timeUnit !== cfg.timeUnit)) updateSource(s.id, { timeColumn: cfg.timeColumn, timeUnit: cfg.timeUnit });
        }
      }
      setOffset(j.offset || 0);
      if (j.layout && j.layout.w) setLayout(j.layout);
      const seen = new Set();
      setWidgets(
        (j.widgets || []).map((w) => {
          const id = w.id && !seen.has(w.id) ? w.id : uid();
          seen.add(id);
          return { ...w, id };
        })
      );
      if (j.video) {
        try {
          const info = await probeVideo(j.video);
          setVideo(info);
          setPlaybackBlocked(false);
          // no reference stored (older project): widgets present → assume 1080p, else this video
          if (!j.layout || !j.layout.w) setLayout((j.widgets || []).length ? { w: 1920, h: 1080 } : { w: info.width, h: info.height });
          warnIfUndecodable(info);
        } catch {
          setStatus('Video from project not found: ' + j.video);
        }
      }
    },
    [store, addCsvFiles, updateSource, probeVideo, warnIfUndecodable]
  );

  const loadProject = useCallback(async () => {
    const p = await window.api.openJson('Open project');
    if (!p) return;
    try {
      await loadProjectData(JSON.parse(await window.api.readText(p)));
      setStatus('Project loaded: ' + p);
    } catch (e) {
      setStatus('Load error: ' + e.message);
    }
  }, [loadProjectData]);

  // autosave the current project in localStorage so a restart keeps the work
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(PROJECT_KEY, projectJson()), 500);
    return () => clearTimeout(t);
  }, [projectJson]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECT_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.video || (j.sources && j.sources.length) || (j.widgets && j.widgets.length)) loadProjectData(j);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // layout transform: reference resolution → current video resolution
  const lt = useMemo(() => {
    if (!video || !layout || !layout.w || (layout.w === video.width && layout.h === video.height)) return { sx: 1, sy: 1, k: 1 };
    const sx = video.width / layout.w;
    const sy = video.height / layout.h;
    return { sx, sy, k: Math.min(sx, sy) };
  }, [video, layout]);

  // bake current scaling into widget coordinates and make this video the new reference
  const rebaseLayout = useCallback(() => {
    if (!video) return;
    setWidgets((ws) => ws.map((w) => ({ ...w, x: Math.round(w.x * lt.sx), y: Math.round(w.y * lt.sy), w: Math.round(w.w * lt.k), h: Math.round(w.h * lt.k) })));
    setLayout({ w: video.width, h: video.height });
    setStatus(`Widget layout rebased to ${video.width}×${video.height}`);
  }, [video, lt]);

  const selected = useMemo(() => widgets.find((w) => w.id === selectedId) || null, [widgets, selectedId]);
  const columnNames = useMemo(() => store.columnNames(), [store, storeVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const locked = job.running;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-2 px-3" style={{ height: 44, background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
        <span className="font-semibold tracking-wide mr-3" style={{ letterSpacing: '0.04em' }}>
          <span style={{ color: 'var(--accent)' }}>▮</span> Telemetry Overlay
        </span>
        <div className="flex items-center gap-1.5">
          <button className="btn" onClick={openVideo} disabled={locked}>
            Open video
          </button>
          <button className="btn" onClick={decodeBlackbox} disabled={decoding || locked}>
            {decoding ? 'Decoding…' : 'Add blackbox log'}
          </button>
          <button className="btn" onClick={async () => addCsvFiles(await window.api.openCsv())} disabled={locked}>
            Add CSV
          </button>
        </div>
        <span className="mx-2" style={{ width: 1, height: 20, background: 'var(--border-strong)' }} />
        <div className="flex items-center gap-1.5">
          <button className="btn" onClick={loadProject} disabled={locked}>
            Open project
          </button>
          <button className="btn" onClick={saveProject}>
            Save project
          </button>
        </div>
        <span className="mx-2" style={{ width: 1, height: 20, background: 'var(--border-strong)' }} />
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} /> Edit layout
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs ml-3" style={{ color: 'var(--muted)' }} title="Snap widget position and size to the grid while dragging">
          <input type="checkbox" checked={grid.snap} onChange={(e) => setGrid((g) => ({ ...g, snap: e.target.checked }))} /> Snap
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }} title="Grid size in video pixels">
          grid
          <input className="input mono" type="number" min={2} max={500} step={1} value={grid.size} style={{ width: 62, padding: '2px 6px' }} onChange={(e) => setGrid((g) => ({ ...g, size: Math.max(2, Number(e.target.value) || 2) }))} />
          px
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={grid.show} onChange={(e) => setGrid((g) => ({ ...g, show: e.target.checked }))} /> Show grid
        </label>
        <span className="ml-auto text-xs truncate max-w-[40%]" style={{ color: locked ? 'var(--accent)' : 'var(--muted)' }}>
          {locked && job.progress ? `Exporting ${Math.round((100 * job.progress.frame) / job.progress.total)}% · ` : ''}
          {status}
        </span>
      </header>

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 flex flex-col min-w-0">
          <Stage
            video={video}
            videoRef={videoRef}
            widgets={widgets}
            store={store}
            storeVersion={storeVersion}
            offset={offset}
            time={time}
            setTime={setTime}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            updateWidget={updateWidget}
            editMode={editMode}
            grid={grid}
            lt={lt}
            setStatus={showPlayError}
            onOpenEditor={(id) => {
              setSelectedId(id);
              setEditorOpen(true);
            }}
          />
          <SyncBar
            video={video}
            videoRef={videoRef}
            time={time}
            setTime={setTime}
            offset={offset}
            setOffset={setOffset}
            store={store}
            storeVersion={storeVersion}
            columnNames={columnNames}
            setStatus={showPlayError}
            disabled={playbackBlocked && !(video && (video.proxy || video.liveProxy))}
            // while the live proxy is still encoding, seeking is capped to the part ffmpeg has written
            seekLimit={video && video.liveProxy && !video.proxy && proxyProgress != null ? Math.max(0, proxyProgress * video.duration - 1) : undefined}
          />
        </main>

        <aside className="w-[430px] flex flex-col min-h-0" style={{ background: 'var(--panel)', borderLeft: '1px solid var(--border)' }}>
          <nav className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            {TABS.map(([k, l]) => {
              const disabled = locked && k !== 'export';
              return (
                <div key={k} className={'tab ' + (tab === k ? 'tab-active' : '') + (disabled ? ' tab-disabled' : '')} title={disabled ? 'Locked while exporting' : ''} onClick={() => !disabled && setTab(k)}>
                  {l}
                  {k === 'export' && locked && <span className="chip chip-accent ml-2">running</span>}
                </div>
              );
            })}
          </nav>
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {tab === 'files' && (
              <FilesPanel
                video={video}
                openVideo={openVideo}
                removeVideo={removeVideo}
                layout={layout}
                setLayout={setLayout}
                lt={lt}
                rebaseLayout={rebaseLayout}
                makeProxy={makeProxy}
                proxyProgress={proxyProgress}
                cancelProxy={() => window.api.cancelProxy()}
                decodeBlackbox={decodeBlackbox}
                decoding={decoding}
                bbOptions={bbOptions}
                setBbOptions={setBbOptions}
                store={store}
                storeVersion={storeVersion}
                addCsvFiles={addCsvFiles}
                updateSource={updateSource}
                removeSource={removeSource}
                removeAllSources={removeAllSources}
              />
            )}
            {tab === 'widgets' && (
              <WidgetsPanel
                widgets={widgets}
                selected={selected}
                setSelectedId={setSelectedId}
                addWidget={addWidget}
                updateWidget={updateWidget}
                removeWidget={removeWidget}
                setWidgets={setWidgets}
                columnNames={columnNames}
                store={store}
                time={time}
                offset={offset}
                openEditor={() => setEditorOpen(true)}
                saveToLibrary={(w) => {
                  setLibrary((l) => [...l, { ...w, id: uid() }]);
                  setStatus('Saved "' + w.name + '" to the library');
                }}
              />
            )}
            {tab === 'library' && <LibraryPanel library={library} setLibrary={setLibrary} addWidget={addWidget} setStatus={setStatus} />}
            {tab === 'export' && <ExportPanel video={video} widgets={widgets} job={job} setJobOption={setJobOption} startExport={startExport} cancelExport={cancelExport} />}
          </div>
        </aside>
      </div>

      {editorOpen && selected && (
        <CodeEditorModal widget={selected} updateWidget={updateWidget} onClose={() => setEditorOpen(false)} store={store} time={time} offset={offset} columnNames={columnNames} ColumnsInput={ColumnsInput} />
      )}

      {playError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,8,11,.72)' }} onMouseDown={(e) => e.target === e.currentTarget && setPlayError(null)}>
          <div className="rounded-lg p-5 flex flex-col gap-4" style={{ width: 'min(92vw, 560px)', background: 'var(--panel)', border: '1px solid var(--border-strong)', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
            <div className="font-semibold text-base">Video playback problem</div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{playError}</div>
            <div className="flex flex-wrap gap-2 justify-end">
              {video && !video.proxy && proxyProgress == null && (
                <>
                  <button
                    className="btn btn-primary"
                    title="Same resolution, frame rate and bit depth, re-encoded on the GPU (NVENC)"
                    onClick={() => {
                      setPlayError(null);
                      setTab('files');
                      makeProxy('full');
                    }}
                  >
                    Create full-quality proxy (GPU)
                  </button>
                  <button
                    className="btn"
                    title="1080p / 30 fps H.264 — small and fast, for weaker machines"
                    onClick={() => {
                      setPlayError(null);
                      setTab('files');
                      makeProxy('light');
                    }}
                  >
                    Light proxy (1080p/30)
                  </button>
                </>
              )}
              <button className="btn" onClick={() => setPlayError(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
