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
import { useConfirm } from './components/ConfirmDialog.jsx';

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

const TAB_ICONS = {
  files: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1" />
      <path d="M4.75 2.75v10.5M11.25 2.75v10.5" />
    </svg>
  ),
  widgets: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.75" y="1.75" width="5" height="5" />
      <rect x="9.25" y="1.75" width="5" height="5" />
      <rect x="1.75" y="9.25" width="5" height="5" />
      <rect x="9.25" y="9.25" width="5" height="5" />
    </svg>
  ),
  library: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3.75 1.75h8.5v12.5L8 11l-4.25 3.25z" />
    </svg>
  ),
  export: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 10.5V2M4.5 5.5 8 2l3.5 3.5" />
      <path d="M2 10.5v3.5h12v-3.5" />
    </svg>
  ),
};

function Toggle({ checked, onChange, title, children }) {
  return (
    <label className={'toggle' + (checked ? ' on' : '')} title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

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
  // yes/no dialog for every remove/delete action
  const [confirm, confirmDialog] = useConfirm();
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
    async (id) => {
      const src = store.sources.find((x) => x.id === id);
      if (!src) return;
      if (!(await confirm(`Remove "${src.name || src.path}" from the project? The file stays on disk.`))) return;
      store.sources = store.sources.filter((x) => x.id !== id);
      store.rebuild();
      bump();
    },
    [store, confirm]
  );

  const removeAllSources = useCallback(async () => {
    if (!(await confirm(`Remove all ${store.sources.length} telemetry files from the project? The files stay on disk.`))) return;
    store.sources = [];
    store.rebuild();
    bump();
    setStatus('All telemetry files removed');
  }, [store, confirm]);

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
  const removeVideo = useCallback(async () => {
    if (!(await confirm('Remove the video from the project? The file (and any proxy) stays on disk.'))) return;
    if (proxyProgress != null) window.api.cancelProxy();
    setVideo(null);
    setPlaybackBlocked(false);
    setPlayError(null);
    setTime(0);
    setStatus('Video removed from the project');
  }, [proxyProgress, confirm]);

  // ---- Widgets ----
  const updateWidget = useCallback((id, patch) => setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w))), []);
  const addWidget = useCallback((partial) => {
    const w = newWidget(partial);
    setWidgets((ws) => [...ws, w]);
    setSelectedId(w.id);
    setTab('widgets');
  }, []);
  const removeWidget = useCallback(
    async (id) => {
      const w = widgets.find((x) => x.id === id);
      if (!w) return;
      if (!(await confirm(`Delete widget "${w.name}"?`))) return;
      setWidgets((ws) => ws.filter((x) => x.id !== id));
    },
    [widgets, confirm]
  );

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
    // storeVersion: store is a stable instance — source add/remove/edit only bumps the version,
    // and without it here the autosave effect below never sees those changes
    [video, store, storeVersion, layout, offset, widgets]
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
      <header className="flex items-center gap-3 px-3" style={{ height: 46, background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
        <span className="wordmark">Telemetry Overlay</span>
        <span style={{ width: 1, height: 20, background: 'var(--border-strong)' }} />
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
        <div className="flex items-center gap-1 ml-auto">
          <button className="btn btn-ghost" onClick={loadProject} disabled={locked}>
            Open project
          </button>
          <button className="btn btn-ghost" onClick={saveProject}>
            Save project
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 flex flex-col min-w-0">
          <div className="stage-toolbar">
            <span className="bar-label">Layout</span>
            <Toggle checked={editMode} onChange={(e) => setEditMode(e.target.checked)} title="Move and resize widgets on the video">
              Edit
            </Toggle>
            <Toggle checked={grid.snap} onChange={(e) => setGrid((g) => ({ ...g, snap: e.target.checked }))} title="Snap widget position and size to the grid while dragging (hold Alt to bypass)">
              Snap
            </Toggle>
            <Toggle checked={grid.show} onChange={(e) => setGrid((g) => ({ ...g, show: e.target.checked }))} title="Show the layout grid over the video">
              Grid
            </Toggle>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }} title="Grid size in video pixels">
              <input className="input mono" type="number" min={2} max={500} step={1} value={grid.size} style={{ width: 56, padding: '2px 6px' }} onChange={(e) => setGrid((g) => ({ ...g, size: Math.max(2, Number(e.target.value) || 2) }))} />
              px
            </label>
            <span className="ml-auto" />
            {video && lt.k !== 1 && (
              <span className="chip chip-warn" title="Widgets were designed for a different resolution — see Widget layout reference in Files">
                layout ×{lt.k.toFixed(2)}
              </span>
            )}
            {video && (video.proxy || video.liveProxy) && (
              <span className="chip chip-tele" title="The preview plays a re-encoded proxy; export always uses the original file">
                proxy preview
              </span>
            )}
          </div>
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
            empty={
              widgets.length ? null : (
                <div className="empty-state">
                  <span className="es-corner" />
                  <span className="es-corner" />
                  <span className="es-corner" />
                  <span className="es-corner" />
                  <div className="es-title">No signal</div>
                  <div className="hint" style={{ textAlign: 'center', maxWidth: 340 }}>
                    Open flight footage, then add a blackbox log or CSV telemetry. Your last project is restored automatically.
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap justify-center">
                    <button className="btn btn-primary" onClick={openVideo}>
                      Open video…
                    </button>
                    <button className="btn" onClick={decodeBlackbox} disabled={decoding}>
                      {decoding ? 'Decoding…' : 'Decode blackbox…'}
                    </button>
                    <button className="btn" onClick={async () => addCsvFiles(await window.api.openCsv())}>
                      Add CSV…
                    </button>
                  </div>
                </div>
              )
            }
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
                  {TAB_ICONS[k]}
                  {l}
                  {k === 'export' && locked && <span className="chip chip-accent ml-1">●</span>}
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
            {tab === 'library' && <LibraryPanel library={library} setLibrary={setLibrary} addWidget={addWidget} setStatus={setStatus} confirm={confirm} />}
            {tab === 'export' && <ExportPanel video={video} widgets={widgets} job={job} setJobOption={setJobOption} startExport={startExport} cancelExport={cancelExport} />}
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        {locked && job.progress && <span className="chip chip-accent">export {Math.round((100 * job.progress.frame) / job.progress.total)}%</span>}
        <span className="truncate" style={{ flex: 1, minWidth: 0, color: locked ? 'var(--accent)' : undefined }}>{status}</span>
        {video && (
          <span className="readout">
            {video.width}×{video.height} · {video.fps.toFixed(2)} fps · {video.codec}
          </span>
        )}
        {store.sources.length > 0 && (
          <span className="readout" style={{ color: 'var(--tele)' }} title="Loaded telemetry sources">
            {store.sources.length} src
          </span>
        )}
        <span className="readout" title="Telemetry time = video time + offset">
          t <b>{(time + offset).toFixed(3)}</b> s
        </span>
        <span className="readout" title="Telemetry offset — adjust in the sync bar or with [ and ] keys">
          offset <b>{offset.toFixed(3)}</b> s
        </span>
      </footer>

      {editorOpen && selected && (
        <CodeEditorModal widget={selected} updateWidget={updateWidget} onClose={() => setEditorOpen(false)} store={store} time={time} offset={offset} columnNames={columnNames} ColumnsInput={ColumnsInput} />
      )}

      {confirmDialog}
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
