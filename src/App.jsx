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

  // ---- Video ----
  const probeVideo = useCallback(async (p) => {
    const info = await window.api.probe(p);
    const proxy = p.replace(/\.[^.]+$/, '') + '.preview-proxy.mp4';
    if (await window.api.exists(proxy)) info.proxy = proxy;
    return info;
  }, []);

  const [proxyProgress, setProxyProgress] = useState(null);
  useEffect(() => window.api.onProxyProgress(setProxyProgress), []);
  const makeProxy = useCallback(async (kind = 'full') => {
    if (!video) return;
    setProxyProgress(0);
    try {
      const proxy = await window.api.makeProxy(video.path, video.duration, kind);
      if (!proxy) {
        setStatus('Proxy creation cancelled');
        return;
      }
      setVideo((v) => ({ ...v, proxy }));
      setStatus('Preview proxy created: ' + proxy);
    } catch (e) {
      setStatus('Proxy error: ' + e.message);
    } finally {
      setProxyProgress(null);
    }
  }, [video]);

  const openVideo = useCallback(async () => {
    const p = await window.api.openVideo();
    if (!p) return;
    try {
      const info = await probeVideo(p);
      setVideo(info);
      setStatus(`Video: ${info.width}x${info.height} @ ${info.fps.toFixed(3)} fps, ${info.codec}, ${info.duration.toFixed(1)} s`);
    } catch (e) {
      setStatus('Probe error: ' + e.message);
    }
  }, [probeVideo]);

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
          setVideo(await probeVideo(j.video));
        } catch {
          setStatus('Video from project not found: ' + j.video);
        }
      }
    },
    [store, addCsvFiles, updateSource, probeVideo]
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
            setStatus={setStatus}
            onOpenEditor={(id) => {
              setSelectedId(id);
              setEditorOpen(true);
            }}
          />
          <SyncBar video={video} videoRef={videoRef} time={time} setTime={setTime} offset={offset} setOffset={setOffset} store={store} storeVersion={storeVersion} columnNames={columnNames} setStatus={setStatus} />
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
    </div>
  );
}
