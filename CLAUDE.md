# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Blackbox overlay for INAV": an Electron + Vite + React (Tailwind v4) desktop app that overlays
user-written HTML/JS widgets, driven by INAV blackbox CSV telemetry, onto a video and exports the
result with the bundled ffmpeg. Overlay only: no video editing/trimming, no predefined widgets
(only read-only examples), widgets are code-first.

### Documentation layout

- `README.md`: short user-facing intro (purpose, 5-step workflow, links to the manuals, AI
  disclaimer, screenshot, licence). Keep its Workflow section in step with UI changes; details
  belong in `manual/`, not here.
- `manual/*.md`: user manuals, one topic per file, written for pilots (not developers) and
  referring to UI labels as they appear in the app (**Sync** drawer, **Start = here**, **Library**
  tab, ...). Currently `widgets.md` (what a widget is, Library/Examples flow, `/widget` skill) and
  `synchronisation.md` (offset/drift, manual sync, both auto sync methods). When a UI label,
  button or dialog they mention changes, update the manual in the same commit; add a new file
  for a new user-facing topic and link it from the README "Manuals" line.
- `images/`: screenshots referenced by README and the manuals (`Screenshot_1.png` overview,
  `_2` widget editor, `_3` sync bar / auto sync). Retake them when the UI they show changes.
- `docs/`: developer notes (measured drifts, auto sync window options), not linked from README.
- The widget API reference lives in the `widget` skill (`.claude/skills/widget/`) and in the
  in-app **API reference** tab of the widget editor, not in README or `manual/`.

### Why it exists and the workflow

Single-purpose tool: it exists to put telemetry widgets into a video, nothing else. Every
feature serves this one linear workflow:

1. Open video (ffprobe, preview proxy).
2. Open blackbox (`.csv` or raw `.txt`/`.bbl`/`.bfl`/`.log` decoded by `blackbox_decode`; multiple files allowed).
3. Synchronise video and telemetry: either manually (offset/drift in the sync bar) or with
   auto sync (optical flow or Gyroflow project, see `src/sync/`).
4. Add and edit widgets (own code in the editor, or copies of the read-only examples), place
   them on the stage.
5. Export: burn into a video with ffmpeg, or write a PNG frame sequence.

Anything outside this path (editing, trimming, effects, non-INAV formats) is out of scope.

## Commands

- `npm start` (= `npm run dev`): vite on port 5173 (strict) + Electron. No compile step.
- `npx vite build`: quickest syntax/bundle check of the renderer (writes `dist/`, gitignored).
- `npm run dist`: `vite build` + electron-builder Windows installer/portable into `release/`.
- No test runner and no lint script exist. Verification is done by driving the real app
  (see below) or by importing modules directly in Node (`src/sync/*`, `src/telemetry.js`,
  `src/time.js` are pure and Node-friendly).
- Release: `npm version x.y.z && git push origin main --follow-tags`. The `.githooks/pre-push`
  hook and `.github/workflows/release.yml` both refuse a `vX.Y.Z` tag whose version differs from
  `package.json` or whose commit is not on `main`.

### Driving the app for verification

Start an isolated dev server on another port (`npx vite --port 5199 --strictPort`), launch
`node_modules/electron/dist/electron.exe` with env `VITE_DEV_SERVER_URL=http://localhost:5199`
through playwright-core `_electron.launch`, then seed state via `localStorage` and reload.
Port 5173 is the user's own dev origin with their autosaved project; never point tests at it.
Native file dialogs cannot be stubbed (`window.api` is a frozen contextBridge object), so seed
`telemetry-overlay.lastProject.v1` / `.widgetLibrary.v1` / `.layouts.v1` instead. The startup
dialog appears whenever a stored project exists; click "Continue previous session" first.
Autosave of the project is debounced 500 ms, wait before reading it back.

## Architecture

### Process split

- `electron/main.cjs`: all native work behind `ipcMain.handle`: file dialogs, `fs` reads/writes,
  ffprobe (`video:probe`), preview proxies (`video:makeProxy`, fragmented MP4 that can be played
  while still encoding), `blackbox_decode` from `bin/blackbox-tools`, gray-frame extraction for
  auto sync, GPU detection (NVENC/CUDA probe), and the ffmpeg export pipe.
- `electron/preload.cjs`: exposes exactly one object, `window.api`. Every renderer feature that
  needs the OS goes through it; add a handler in `main.cjs` and a wrapper here together.
- Export frames bypass the contextBridge: `openFramePort()` hands a `MessagePort` to the main
  process and `src/export.js` posts raw RGBA buffers through it (contextBridge value copies cost
  ~30 ms per 1080p frame). Keep that channel for anything bulk.

### Renderer state (src/App.jsx)

`App.jsx` owns all project state (video info, telemetry store, widgets, sync, export range,
library, layouts, tab) and passes it down as props; there is no store library. Persistence is
localStorage only:

- `telemetry-overlay.lastProject.v1`: autosaved project (debounced), offered by `StartupDialog`.
- `telemetry-overlay.widgetLibrary.v1`: the user's own widgets only. Examples are rendered
  straight from `src/examples.js` and are never stored; an old `examplesVersion` marker
  triggers a one-time cleanup of seeded "Example:" copies.
- `telemetry-overlay.layouts.v1`: saved layouts = full widget copies + `layout: {w,h}`.
- Names are unique in the library and in layouts: saving/importing under an existing name
  replaces the entry after `confirm()` (the `useConfirm` hook from `ConfirmDialog.jsx`; all
  destructive actions go through it).

Project JSON (`projectJson()`) is also the "Save project" file format; `loadProjectData`
re-adds CSV sources through the worker and rescales widgets.

### Time model

`telemetry time = video time × (1 + drift/1000) + offset` (`src/time.js`: `toTele`, `toVideo`).
`sync` is `{offset, drift}` everywhere. Anything that maps video ↔ telemetry must use these
helpers, never add the offset by hand. `docs/synchronise.md` records the measured drifts and how
auto sync (`src/sync/`, runs in `syncWorker.js`) fits offset + drift from cross-correlated
gyro windows; `src/sync/methods.js` is the registry of sync methods.

### Telemetry

CSV parsing runs in `src/csvWorker.js` (Papa streaming, decimated to ~120 Hz, raw rows stay in
the worker so a time-column change rebuilds without re-reading). `TelemetryStore`
(`src/telemetry.js`) is a single mutable instance held in a ref; it merges columns from all
sources (first file wins, `file.csv:column` disambiguates) and bumps `revision` on rebuild.
Because the instance never changes identity, `App` keeps a `storeVersion` counter and passes it
to anything that must re-render on source changes.

### Widget runtime (src/widgetRuntime.js)

A widget is `{id, name, columns, x, y, w, h, visible, settings, config, code}` where
`code` is a function `(settings, time, ctx) -> HTML string`, `settings` is the source text of the
settings definition (JSON array of `{name, type, default, description, values, min, max, step}`,
types `text | int | number | color_picker | bool | select`, optionally wrapped in
`{group: {name, items: [...]}}` = collapsible section of the form, collapsed by default; edited in
the editor's **Settings definition** tab) and `config` holds the values the user changed in the generated form
(`{key: value}`, key = name in snake_case; missing = definition default). `src/widgetSettings.js`
(pure, Node-friendly) parses the definition (JSON or JS literal, cached per string) and builds
the `settings` object handed to the code: `settings.<key>.value`. `SettingsForm.jsx` renders the
form (Widgets tab and editor), `ColorInput.jsx` is the in-app rgba colour popover (react-colorful)
also used by the code editor's colour swatches. `renderWidget()` compiles (cached per code
string), builds `ctx` (`values` of the listed columns, `range`/`all`/`stats` history, `state`
persisted per widget id, `image()` data-URL cache, `exportRange`, `dataVersion`) and never
throws. There is no per-widget CSS or whole-widget opacity any more: `cleanWidget()` drops those
older fields and guarantees `settings`/`config` wherever a record enters the app (stored library and
layouts, project files, widget/layout imports, `newWidget`). The same function renders the live stage
(`Stage.jsx`, inside shadow roots via `ShadowHtml.jsx`), the editor preview, and export frames
(`composeFrameSvg` → SVG `foreignObject` → canvas → RGBA), so widget HTML must be XHTML-safe
(`toXhtml`) and must not rely on external resources.

Widget coordinates are in pixels of the current video; `layout: {w,h}` records that space and
`rescaleWidgets` (App.jsx) converts when a differently sized video or layout is loaded
(`EMPTY_STAGE` 1280×720 while no video is loaded).

`src/examples.js` holds the built-in examples; each has a `settings` definition and starts with
a `SETTINGS` block of `var X = settings.x.value;` lines. When adding or changing one, keep that
convention and run `node .claude/skills/widget/test-widgets.mjs` (see the `widget` skill for the
authoring guide).

### Export (src/export.js)

`runExport` renders only the union rectangle of visible widgets (`widgetRegion`), optionally at
a lower overlay fps than the video, pipelines up to 3 frames in flight, and streams RGBA to
ffmpeg in the main process (`buildArgs` in main.cjs picks NVENC/CUDA or CPU codecs). PNG mode
writes a numbered per-frame sequence (optionally one folder per widget, integer upscale up to 4K).

## UI conventions (src/index.css)

Dark "ground station" look with two hues: amber `--accent` = machine state/controls/selection,
teal `--tele` = telemetry data. Sidebar panels group content into `.bay` modules
(`bay-amber`/`bay-tele`/`bay-mixed`, `.bay-head` strip with `.bay-tick`, `.bay-note` readout,
`btn-xs` actions; `.bay-toggle` + `.bay-drawer` for collapsible ones). `.section-title` is
deprecated in panels. Condensed caps labels use `--font-cond`, readouts `--font-mono`.

Define list-row components at module top level, never inline inside a panel's render: the
whole app re-renders every animation frame during playback, and an inline component remounts
each frame so its buttons swallow clicks.

## Gotchas

- Working copy files use CRLF (`core.autocrlf=true`); scripts that rewrite files should keep it.
- Vite dev server listens on `::1`; wait for it with `fetch('http://localhost:5199/')`, a TCP
  connect to 127.0.0.1 hangs.
- The `dist/` and `release/` folders are excluded from the vite watcher on purpose
  (electron-builder rename fails otherwise).
