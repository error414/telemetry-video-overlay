# Telemetry Overlay

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
   *Camera HEVC files* (e.g. DJI 4K/120 10-bit) are often rejected by Chromium's decoder
   (`PIPELINE_ERROR_DECODE`) even though the GPU could decode them. In *Files* click
   **Create full-quality proxy (GPU)** – a same-resolution/fps NVENC re-encode (~3 min for a
   3.5 min 4K/120 clip) that plays at full 120 fps in the app – or **Light proxy** (1080p/30)
   for weaker machines. Export always uses the original file.
3. **Widgets** tab – create a widget. Settings: name, columns, x/y/w/h, opacity, code.
   *Columns* is a comma-separated text field; each entry must match a CSV header exactly
   (the field has autocomplete; the column list is also in the *Files* tab, click to copy).
   Drag / resize widgets directly on the preview (“Edit layout” checkbox).
4. **Sync** – the bar under the video: play/scrub the video, then adjust *Telemetry offset*
   (buttons, number field, `[` / `]` keys). The blue graph shows one telemetry column over
   the video timeline and moves with the offset – align a visible event (throttle-up, launch)
   with the same moment in the video. "Telemetry start = here" sets the offset so the first
   telemetry sample is at the current frame.
5. **Library** – "Save to library" stores a widget inside the app; Import/Export as JSON.
   Projects (video path, CSV paths, offset, widgets) can be saved/opened too, and the last
   state is restored on restart.
6. **Export**
   * *Video + overlay* – re-encodes with the same codec family (h264 → libx264, hevc → libx265),
     same resolution/fps, either at the source bitrate or CRF 17; audio and metadata copied.
   * *Overlay only with alpha* – ProRes 4444 `.mov`, VP9 `.webm`, or PNG sequence.
     Yes, alpha export is possible; ProRes 4444 is what NLEs (Premiere/Resolve/FCP) accept best.

## Widget API

```js
function (values, time, ctx) {
  return '<div style="font:bold 40px sans-serif;color:#fff">' + ctx.fmt(values[0], 1) + '</div>';
}
```

| arg | meaning |
|---|---|
| `values` | array of the current values of the columns listed in the widget's *Columns* field, same order. Numeric columns are linearly interpolated. `undefined` outside telemetry range. |
| `time` | telemetry time in integer milliseconds (video time + offset) |
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
| `ctx.image(url)` | loads an image (map tile, icon) and returns a `data:` URL once cached, `undefined` while loading (the widget re-renders automatically). Works in export too. |

The example widgets in the Library all start with a `SETTINGS` block (colors, units,
sizes, arrow style, map style…). *Example: GPS map* shows a dimmed OSM/CARTO base map under
the track with a heading arrow (columns: lat, lon, heading). *Restore examples* in the
Library brings back the current versions.

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
