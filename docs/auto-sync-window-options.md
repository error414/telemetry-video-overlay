# Auto sync — removed "Analysis windows" options (how to bring them back)

On 2026-09-03 the *Analysis windows* section of the Auto sync dialog
(`src/components/AutoSyncDialog.jsx`) was removed at the user's request. The dialog
now always analyses **6 windows of 6 s**, picked by **strongest motion**, searching the
**whole log**. The full version with the options lives in git:

```
git show 8299b2b:src/components/AutoSyncDialog.jsx
```

Everything below is what that section did, so it can be restored piece by piece without
digging through the diff. Nothing in `src/sync/` changed — the computation
(`runVideoGyroSync`, `findOffset` with `search: {min, max}`, `activeWindows`) still
supports all of it.

## The options

| control | state | default | effect |
|---|---|---|---|
| **Strongest motion** (button, mode `auto`) | `windowMode === 'auto'` | on | windows come from `planWindows(candidates, nWindows, dur, len)` — the video is split into `nWindows` equal parts, each part gets its strongest gyro candidates (`ATTEMPTS_PER_WINDOW = 2`); empty parts borrow the strongest unused candidates |
| **Windows** (number 1–6) | `nWindows` (pref `windows`) | 3 | number of parts / windows; 1 = only offset (drift kept), ≥ 2 = offset + drift fit |
| **Length** (number 2–20 s) | `len` (pref `len`) | 6 | window length in seconds, also the length used by `activeWindows` |
| **Start** (`TimeInput`) | `manualStart`, sets `windowMode = 'manual'` | playhead | one manual window starting at that video time — offset only, drift unchanged |
| **At playhead** (button) | `manualStart = clampStart(time)`, `windowMode = 'manual'` | — | same, from the current frame |
| **candidates:** chips | — | — | the top 6 `candidates` as clickable chips; clicking one = manual window there |
| **Search: whole log / near the current offset ± N s** | `searchMode` (`'all'`/`'near'`, pref `searchMode`), `nearSpan` (pref `nearSpan`, default 30) | whole log | `near` passes `search = { min: localOffset(start) − nearSpan, max: localOffset(start) + nearSpan }` to the worker, where `localOffset(t) = sync.offset + sync.drift/1000 · t`; `all` passes `null` |

Hints shown under the controls:

- auto mode, no candidates inside the video: *"No strong gyro motion lands inside the video with the current offset — one window at the playhead is analysed instead."*
- manual mode: *"One manual window measures the offset at that place only; the drift is left as it is."*

## State and plan (from the removed version)

```jsx
const [len, setLen] = useState(() => (prefs.len >= 2 && prefs.len <= 20 ? prefs.len : 6));
const [nWindows, setNWindows] = useState(() => (prefs.windows >= 1 && prefs.windows <= 6 ? prefs.windows : 3));
const [windowMode, setWindowMode] = useState('auto'); // 'auto' = strongest gyro motion, 'manual' = the start field
const [manualStart, setManualStart] = useState(() => Math.max(0, Math.min(dur - 6, time)));
const [searchMode, setSearchMode] = useState(prefs.searchMode === 'near' ? 'near' : 'all');
const [nearSpan, setNearSpan] = useState(prefs.nearSpan > 0 ? prefs.nearSpan : 30);

useEffect(() => {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ axes, len, windows: nWindows, searchMode, nearSpan }));
}, [axes, len, nWindows, searchMode, nearSpan]);

const clampStart = (s) => Math.max(0, Math.min(Math.max(0, dur - len), s));
const localOffset = (t) => sync.offset + ((sync.drift || 0) / 1000) * t;

const plan = useMemo(
  () => (windowMode === 'auto' ? planWindows(candidates, nWindows, dur, len) : [[{ start: clampStart(manualStart) }]]),
  [windowMode, candidates, nWindows, dur, len, manualStart]
);
const shownStart = windowMode === 'auto' ? (plan.length ? plan[0][0].start : clampStart(time)) : manualStart;
```

In `run()`, per candidate:

```jsx
const search = searchMode === 'near' ? { min: localOffset(start) - nearSpan, max: localOffset(start) + nearSpan } : null;
```

## The JSX of the section

```jsx
<section className="bay bay-amber" style={{ marginBottom: 0 }}>
  <header className="bay-head">
    <span className="bay-tick" />
    Analysis windows
    <span className="bay-note">
      {windowMode === 'auto' && plan.length > 1 ? plan.map((p) => fmtTime(p[0].start)).join(' · ') : `${fmtTime(shownStart)} – ${fmtTime(shownStart + len)}`} video
    </span>
  </header>
  <div className="bay-body flex flex-col gap-2">
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <button className={'btn btn-xs' + (windowMode === 'auto' ? ' btn-primary' : '')} disabled={running} onClick={() => setWindowMode('auto')} title="Analyse where the gyro log shows the strongest rotation (mapped to the video through the current offset); with several windows the video is split into equal parts and each part gets its strongest place, so the clock drift can be measured too">
        Strongest motion
      </button>
      <span className="bar-label">Windows</span>
      <input className="input mono" type="number" min={1} max={6} step={1} value={nWindows} disabled={running || windowMode !== 'auto'} style={{ width: 48, padding: '2px 6px' }} onChange={(e) => setNWindows(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} title="How many windows to analyse — 2 or more spread over the video also measure the drift" />
      <span className="bar-label ml-1">Length</span>
      <input className="input mono" type="number" min={2} max={20} step={1} value={len} disabled={running} style={{ width: 56, padding: '2px 6px' }} onChange={(e) => setLen(Math.max(2, Math.min(20, Number(e.target.value) || 6)))} />
      <span className="hint">s</span>
      <span className="bar-label ml-2">Start</span>
      <TimeInput
        value={shownStart}
        disabled={running}
        onCommit={(t) => {
          setManualStart(clampStart(t));
          setWindowMode('manual');
        }}
        title="Video time where a single analysed window begins — typing a value switches to one manual window"
      />
      <button
        className="btn btn-xs"
        disabled={running}
        onClick={() => {
          setManualStart(clampStart(time));
          setWindowMode('manual');
        }}
        title="Analyse one window from the current playhead position (offset only, drift unchanged)"
      >
        At playhead
      </button>
    </div>
    {windowMode === 'auto' && candidates.length > 1 && (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="hint">candidates:</span>
        {candidates.slice(0, 6).map((c, i) => (
          <button key={i} className="chip mono" style={{ cursor: 'pointer' }} disabled={running} onClick={() => { setManualStart(c.start); setWindowMode('manual'); }} title={`Rotation activity ${c.score.toFixed(0)} — click to analyse only this window`}>
            {fmtTime(c.start)}
          </button>
        ))}
      </div>
    )}
    {windowMode === 'auto' && !candidates.length && <div className="hint">No strong gyro motion lands inside the video with the current offset — one window at the playhead is analysed instead.</div>}
    {windowMode === 'manual' && <div className="hint">One manual window measures the offset at that place only; the drift is left as it is.</div>}
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <span className="bar-label">Search</span>
      <label className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
        <input type="radio" name="autosync-search" checked={searchMode === 'all'} disabled={running} onChange={() => setSearchMode('all')} />
        whole log
      </label>
      <label className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
        <input type="radio" name="autosync-search" checked={searchMode === 'near'} disabled={running} onChange={() => setSearchMode('near')} />
        near the current offset ±
        <input className="input mono" type="number" min={1} max={600} step={1} value={nearSpan} disabled={running} style={{ width: 56, padding: '1px 6px' }} onChange={(e) => setNearSpan(Math.max(1, Number(e.target.value) || 30))} />
        s
      </label>
    </div>
  </div>
</section>
```

`TimeInput` (`src/components/TimeInput.jsx`) and `fmtTime` are still in the codebase; the
`TimeInput` import was dropped from the dialog and has to come back with the section.

## Other things that changed at the same time

- The dialog now opens with a **method choice** (video motion vs. Gyroflow data) instead of
  the small segmented switch in the title row; `src/sync/methods.js` has the `gyroflow`
  entry with `available: false`.
- Preferences key `telemetry-overlay.autoSync.v1` now stores only `axes`; the old keys
  (`len`, `windows`, `searchMode`, `nearSpan`) are ignored, so restoring the options just
  means reading them again.
- README "Sync" paragraph: the sentence about the *Windows* setting was replaced by the fixed
  6 × 6 s description.
