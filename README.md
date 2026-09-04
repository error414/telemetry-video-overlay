# Blackbox overlay for INAV

Desktop app (Electron + React + Tailwind) that overlays user-written HTML/JS widgets driven by
INAV blackbox CSV telemetry onto a video, and exports the result with the bundled ffmpeg.
No compilation step – `npm start` runs it.

## Run

```
npm install
npm start
```

ffmpeg / ffprobe come from the `ffmpeg-static` / `ffprobe-static` npm packages (downloaded
into `node_modules` on install), nothing else needs to be installed.

## Release

`npm run dist` builds the Windows installer and portable exe into `release/`.

Releases are published by GitHub Actions (`.github/workflows/release.yml`): push a version
tag and the workflow builds and creates a GitHub release with the installer / portable exe
attached (auto-generated notes). The tag must equal `v` + the `version` in `package.json`
and its commit must be on `main`; the `pre-push` hook in `.githooks/` (enabled by
`npm install`) refuses to push a tag that does not, and the workflow checks it again.

```
npm version 0.4.0          # bumps package.json + package-lock.json, commits, creates tag v0.4.0
git push origin main --follow-tags
```

A tag with a suffix (`v0.4.0-beta.1`) is published as a pre-release.

## Workflow

1. **Open video** (mp4/mov/mkv …). It is probed with ffprobe (resolution, fps, codec, bitrate).
2. **Add blackbox log (.TXT)** – decodes a raw INAV log with the bundled `blackbox_decode`
   (`bin/blackbox-tools/`, from [iNavFlight/blackbox-tools](https://github.com/iNavFlight/blackbox-tools)
   v9.0.0, Windows x64). CSVs are written next to the log and loaded automatically; a log with
   several flights yields one CSV per flight (remove unneeded ones in *Files*). Decoder options
   (merge GPS, simulate IMU roll/pitch/heading, units) are in the *Files* tab.
   **Add CSV** still works for CSVs you decoded elsewhere (`LOG.01.csv` *and* `LOG.01.gps.csv`).
   The time column and unit (µs/ms/s) are auto-detected and can be changed in the *Files* tab.
   All files share one time base (blackbox `time (us)`), so no per-file alignment is needed.
   Logs denser than 120 Hz are thinned while loading (a 500 Hz log keeps every 4th sample →
   125 Hz): widgets render at most 120 fps, so more samples only cost memory and load time.
   The *Files* tab shows the detected rate and the step; GPS files (≤ 25 Hz) are kept whole.
   Whole-flight statistics (`ctx.stats` min/max/mean) are computed from the kept samples, so a
   spike shorter than the step (e.g. under 8 ms for a 500 Hz log) may read slightly lower.
   *Camera HEVC files* (e.g. DJI 4K/120 10-bit) are often rejected by Chromium's decoder
   (`PIPELINE_ERROR_DECODE`) even though the GPU could decode them — DJI's low-latency
   encoder uses HEVC *tiles*, which Chromium's D3D11 pipeline doesn't accept. In *Files* click
   **Create full-quality proxy (GPU)** – a same-resolution/fps NVENC re-encode (~1.5 min for a
   3.5 min 4K/120 clip) that plays at full 120 fps in the app – or **Light proxy** (1080p/30)
   for weaker machines. The preview already plays *while* the proxy is being encoded (the
   growing fragmented MP4 is streamed into the player via MSE; seeking ahead of the encoded
   part waits until ffmpeg gets there). Export always uses the original file.
3. **Widgets** tab – create a widget. Settings: name, columns, x/y/w/h, opacity, code.
   *Columns* is a comma-separated text field; each entry must match a CSV header exactly
   (the field has autocomplete; the column list is also in the *Files* tab, click to copy).
   Drag / resize widgets directly on the preview (“Edit layout” checkbox).
4. **Sync** – the bar under the video: play/scrub the video, then adjust *Telemetry offset*
   (buttons, number field, `[` / `]` keys). The blue graph shows one telemetry column over
   the video timeline and moves with the offset – align a visible event (throttle-up, launch)
   with the same moment in the video. "Telemetry start = here" sets the offset so the first
   telemetry sample is at the current frame.
   *Auto sync…* finds offset and drift automatically. It first asks for the method:
   *Gyroflow project* or *Video motion × gyro*.
   The Gyroflow method reads the camera's own gyro (DJI O3/O4, GoPro…) from a `.gyroflow`
   project saved for this video (open the video in Gyroflow, *Export project*; the file next
   to the video is picked up automatically), matches it against the blackbox gyro in ten
   10-second windows and is done in about two seconds; stabilised footage is fine here.
   The video method decodes six 6-second windows of the original video spread over its
   length (each sixth at its strongest gyro motion), tracks the camera rotation in them
   (optical flow) and searches the whole gyro log for the place that rotates the same way.
   Pick the three gyro rate columns (INAV: `gyroADC[0..2]`, any order and unit – only the
   magnitude of the rotation is compared, so the camera mounting does not matter) and apply
   the result if the traces in the dialog line up (match close to 1). It needs unstabilised
   footage (RockSteady / HorizonSteady off) and keeps the manual controls as they are – it
   only proposes numbers.
   *Drift* – camera and flight controller keep their own clocks and they run at slightly
   different rates (0.5 ms per second was measured on a DJI O3 + H7 pair, i.e. 0.3 s over a
   10-minute flight). The drift field in the sync bar is the correction in milliseconds of
   telemetry per second of video; Auto sync measures it from the windows spread over the
   video.
   *Export range* – by default the whole video is exported; to export only a part, set the
   in/out points: `I` / `O` keys or "In = here" / "Out = here" at the playhead, drag the amber
   markers on the timeline, or type a timecode. The part outside the range is dimmed. While a
   proxy is still being encoded the points can only be placed inside the already encoded part
   (same limit as seeking). The range is saved with the project.
5. **Library** – "Save to library" stores a widget inside the app; Import/Export as JSON.
   Projects (video path, CSV paths, offset, widgets) can be saved/opened too, and the last
   state is restored on restart.
6. **Export**
   * *Video + overlay* – re-encodes with the same codec family (h264 → libx264, hevc → libx265),
     same resolution/fps, either at the source bitrate or CRF 17; audio and metadata copied.
   * *Overlay only · PNG sequence* – transparent 8-bit RGBA PNG per frame at the source frame
     rate. *Image size* is the video size by default, or an integer multiple of it up to 4K UHD
     (3840×2160) – widgets are rendered natively at that size, not upscaled. You pick a
     location; the files go into a `[video name]_overlay` folder there as `overlay_000123.png`
     (if that folder already exists, `_1`, `_2`, … is appended so an earlier export is never overwritten). Frames are numbered by the source frame index (frame 0 = video
     start), so a cut export starts at the in point's frame number and the sequence drops onto
     the original timeline without re-aligning. *Each widget separately* writes one sub-folder
     per visible widget (named after the widget; widgets sharing a name get `_1`, `_2`, `_3`),
     each holding a full-frame sequence of just that widget.
   * Only the export range from the sync bar is rendered (video mode cuts the source with
     frame-accurate `-ss`/`-t`; the PNG sequence starts at the in point).

## Widget API

```js
function (values, time, ctx) {
  return '<div style="font:bold 40px sans-serif;color:#fff">' + ctx.fmt(values[0], 1) + '</div>';
}
```

| arg | meaning |
|---|---|
| `values` | array of the current values of the columns listed in the widget's *Columns* field, same order. Numeric columns are linearly interpolated. `undefined` outside telemetry range. |
| `time` | telemetry time in integer milliseconds (video time × (1 + drift) + offset) |
| `ctx.videoTime` | video time in seconds |
| `ctx.width`, `ctx.height` | widget box size |
| `ctx.columns` | column names |
| `ctx.get(name)` / `ctx.raw(name)` | any column by name, interpolated / last sample |
| `ctx.range(name, fromMs, toMs, maxPoints)` | history `[{t, v}]` for graphs / tracks |
| `ctx.state` | object that persists between calls (cache expensive things) |
| `ctx.fmt(v, digits)` | number formatting helper |
| `ctx.all(name, maxPoints)` | the whole flight as `[{t, v}]` (altitude profiles, tracks) |
| `ctx.stats(name)` | whole-flight `{min, max, mean, count, tMin, tMax}` — use it for stable axis scaling |
| `ctx.duration` | telemetry length in ms |
| `ctx.exportRange` | `{from, to}` — the export range (sync bar in/out points, or the whole video) in telemetry ms; `null` without a video. The example graphs / GPS map have a `CLIP_TO_RANGE` setting that limits them to it |
| `ctx.dataVersion` | changes whenever telemetry files are added, removed or rebuilt — put it in `ctx.state` cache keys |
| `ctx.image(url)` | loads an image (map tile, icon) and returns a `data:` URL once cached, `undefined` while loading (the widget re-renders automatically). Works in export too. |

The example widgets in the Library all start with a `SETTINGS` block (colors, units,
sizes, arrow style, map style…). *Example: GPS map* shows a dimmed OSM/CARTO base map under
the track with a heading arrow (columns: lat, lon, heading). *Restore examples* in the
Library brings back the current versions.

**Layout reference:** widget positions/sizes are stored for the resolution of the video they were
designed on. Loading a video with a different resolution scales the whole layout automatically
(positions, sizes and fonts) so widgets look the same; the *Files* tab shows the scale factor and
a *Rebase* button that converts coordinates to the current video. Saved in the project.

**CSS per widget:** every widget also has a CSS field (Widgets tab, or the *CSS* tab in the
editor popup). Selectors are scoped to that widget automatically (`:root` = the widget box), so
`.label { fill: #ffd166 }` restyles only this widget — in preview and export. Hover the editor
preview to see the element under the cursor as `tag#id.class` (click copies it).

The returned HTML goes into an absolutely positioned box with the widget's opacity.
Inline CSS, `<style>` and inline `<svg>` all work. External resources (web fonts, remote
images) are not available during export – embed them as `data:` URIs.

Duplicate column names across files can be disambiguated with `file.csv:column`.

## Export performance

* **GPU** – with an NVIDIA card the video mode uses `hevc_nvenc` / `h264_nvenc` for encoding and
  CUDA for decoding (auto-detected with a short probe; falls back to libx264/libx265 on CPU).
  Selectable in the Export tab (*Encoder*).
* **Overlay region** – only the rectangle covering the widgets is rendered and sent to ffmpeg,
  not the whole 4K frame.
* **Overlay frame rate** – widgets can be rendered at 30 fps (default) while the video keeps its own
  frame rate; ffmpeg repeats the last overlay frame in between. 4K/120 fps HEVC goes from
  ~18 fps to ~100 fps on a Ryzen 7 + GeForce.

## How export works

Every frame is rendered with the same widget code into an offscreen canvas (SVG
`foreignObject`) at video resolution and piped as raw RGBA into ffmpeg, which overlays it on
the source video (or encodes it alone with alpha). Expect ~20–60 frames/s of rendering
depending on widget complexity.

## License

This project is licensed under the GNU General Public License v3.0 – see [LICENSE](LICENSE).
