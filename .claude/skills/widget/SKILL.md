---
name: widget
description: Create or modify an overlay widget for this Telemetry Overlay app (JS function returning HTML, driven by INAV blackbox CSV columns). Self-contained — everything needed (runtime API, design language, template, test runner) is in this file; no need to read the app source. Use when the user asks for a new widget, gauge, graph, map, indicator, or wants an existing example widget changed.
---

# Creating a widget

This file is the complete contract. Do **not** read the app source to build a widget — everything
the runtime provides and expects is documented here. (`src/widgetRuntime.js` and `src/examples.js`
exist if you ever need to go deeper, but a widget built purely from this file is correct.)

## The contract

A widget is **one JavaScript function stored as a string**. The app compiles it with `new Function`
and calls it for **every rendered frame** (live preview and export, often 60–120 fps). It must
return an HTML string; that string is placed inside an absolutely-positioned box.

```js
function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var COLOR = '#ffffff';   // text color
  // -------------------------------
  return '<div style="color:' + COLOR + '">' + ctx.fmt(values[0], 1) + '</div>';
}
```

Arrow functions and bare bodies (using `values`/`time`/`ctx`) also compile, but the
`function (values, time, ctx) { … }` form is the house style.

Widget record (what the library / project JSON stores):

| field | meaning |
|---|---|
| `name` | display name; built-in examples are prefixed `Example: ` |
| `columns` | comma-separated CSV header names → `values[0], values[1], …` |
| `x, y, w, h` | box in **layout-reference pixels** (usually 1920×1080; the whole layout auto-scales to other video resolutions) |
| `opacity` | 0–1, applied to the whole box (house default 0.9–0.95) |
| `code` | the function source |
| `css` | optional per-widget stylesheet — selectors are auto-scoped to this widget's box; `:root`/`:host` = the box. Users restyle widgets here, so give your elements stable `id`/`class` hooks |

## Runtime API

| | |
|---|---|
| `values[i]` | current value of column *i* — numeric columns are **linearly interpolated** between samples; `undefined` outside the telemetry time range |
| `time` | telemetry time, integer **milliseconds** (video time + sync offset) |
| `ctx.videoTime` | video time in seconds |
| `ctx.width`, `ctx.height` | current box size in px — size **everything** from these, never hard-code |
| `ctx.columns` | the column names array (parsed from `columns`) |
| `ctx.get(name)` | any column by name, interpolated |
| `ctx.raw(name)` | any column by name, last sample, **no interpolation** — required for strings/flags |
| `ctx.range(name, fromMs, toMs, maxPoints)` | history window as `[{t, v}]`, `t` in ms, capped at `maxPoints` |
| `ctx.all(name, maxPoints)` | the whole flight `[{t, v}]` — for profiles, tracks |
| `ctx.stats(name)` | `{min, max, mean, count, tMin, tMax}` for the whole flight (cached by the app) — use for stable axis scaling |
| `ctx.duration` | telemetry length in ms |
| `ctx.state` | plain object persisting between calls **per placed widget**; survives code edits — cache expensive work here (see Caching) |
| `ctx.fmt(v, digits)` | number → string, `'--'` for missing values |
| `ctx.image(url)` | async image loader: returns a `data:` URL once loaded, `undefined` while loading, `null` on failure; the widget re-renders automatically when the image arrives; the data URL works in export (this is the **only** way to use remote images) |

## Hard rules (a widget that breaks these fails in export)

Export renders the returned HTML through an SVG `<foreignObject>` into a canvas:

1. **Return a string.** No DOM access, no `document`/`window`, no timers, no event handlers,
   no `<script>` — only the returned markup exists. The function must be deterministic in
   `(values, time, ctx)` so seeking and export give identical frames (no `Math.random()` per
   frame, no `Date.now()`; a random id generated **once** into `ctx.state` is fine).
2. **No external resources.** No web fonts, no `<link>`, no `<img src="https://…">`. Remote
   images only via `ctx.image(url)`. Fonts: system families only (`Arial`, `Helvetica`,
   `sans-serif`, `monospace`, `Segoe UI`, …).
3. **Well-formed markup.** Close every tag, quote every attribute, self-close voids
   (`<img … />`, `<br/>`). The HTML is converted to XHTML — sloppy markup renders **blank in
   export** while looking fine in preview.
4. **Unique SVG defs ids.** In export all widgets are composed into one SVG document, so
   `<defs>` ids (`linearGradient`, `clipPath`, filters) collide across widgets. Generate a
   unique id once: `var uid = ctx.state.uid || (ctx.state.uid = 'u' + Math.random().toString(36).slice(2, 8));`
5. **Never throw.** Guard `typeof v === 'number'` before math. Outside the telemetry range all
   `values` are `undefined` — return a sensible placeholder (`'--'`, empty graph), not an error.
6. **Be fast.** Runs at video fps. Anything O(flight length) — projections, smoothing over
   `ctx.all`, path strings for the whole flight — belongs in `ctx.state`, computed once.

## Design language — what makes a widget look good here

Widgets float over drone video: sky one second, dark forest the next. The house look
(consistent with the built-in examples):

- **Panel:** translucent dark box `rgba(0,0,0,.35–.5)`, `border-radius: 8px` (scaled), optional
  `1–2px` white-ish border `rgba(255,255,255,.4–.6)`. Panel-less widgets (big numbers, HUD
  tapes) rely on text shadow instead.
- **Text:** white `#fff`, `Arial`; secondary text `rgba(255,255,255,.7–.75)`; every piece of
  text gets `text-shadow: 0 0 4px #000` (double it — `0 0 3px #000,0 0 3px #000` — when there
  is no panel behind it). Labels are short UPPERCASE with slight `letter-spacing`.
- **Type hierarchy:** one dominant value (bold, ~64px at default size), unit at ~0.35× of the
  value size and normal weight, label at ~0.28×. Numbers use `.toFixed(DIGITS)` — never let
  float noise through.
- **Accents:** orange `#f2a93b` (app accent — sticks, highlights), red `#e03030`/`#ff3030`
  (markers, needles, current-position dots), white strokes around colored shapes
  (`stroke="#fff"` 1.5–2px) so they read on any background. Gradients for fills
  (`linear-gradient(90deg,#3f3,#ff3,#f33)` for good→bad gauges; area fills at
  `fill-opacity` ~0.15, or a top/bottom `linearGradient`).
- **Structure lines:** grid `rgba(255,255,255,.15–.2)`, line charts ~2px stroke,
  `stroke-linejoin="round"`.
- **Layout:** whole-widget `opacity` 0.9–0.95; keep ~40px from frame edges at 1920×1080;
  typical sizes — value box 320×110, bar 300×40, graph 400–520×140–160, map 300×300,
  compass 220×60. Inner padding ≥ 6px (scaled); leave headroom above the tallest text so
  ascenders aren't clipped: `var top = Math.max(6 * scale, fsz * 0.6);`.
- **Inline SVG is the tool of choice** for gauges, graphs, tapes, roses, maps. Give the root
  `<svg>` numeric `width`/`height` (= `ctx.width`/`ctx.height`), not percentages. Remember SVG
  text/shapes use `fill`/`stroke` (not `color`/`background`) and move with `transform`, not
  margins. Don't put a `transform` **attribute** on elements users may nudge from the CSS tab
  (CSS transform replaces the attribute) — wrap them in a `<g>` instead.
- **CSS hooks:** give every meaningful element a stable `id`/`class` (`class="label"`,
  `id="box-left"`) and end the code with a one-line comment listing them, e.g.
  `// CSS hooks: #gauge (box), .fill, .text`. The editor shows `tag#id.class` on hover.

ES5 style (`var`, string concatenation) is the house style — non-programmers edit the SETTINGS
block, keep the rest readable too. Modern syntax compiles but don't use backtick templates with
`${}` inside single-quoted strings the user may paste into JSON.

## SETTINGS block conventions

- First thing in the function, delimited by `// ---------- SETTINGS ----------` / `// ---`.
- `UPPER_CASE` names, one per line, each with a short comment listing allowed values.
- Typical knobs: `LABEL`, `UNIT`, `MULTIPLIER` (unit conversion: m/s→km/h = 3.6, cm→m = 0.01),
  `DIGITS`, colors, `BG`, `RADIUS`, `FONT`, `FONT_SIZE`, `SMOOTH_MS`, `MIN`/`MAX` with `null`
  meaning "from `ctx.stats`", style enums (`'arrow' | 'plane' | 'dot'`), unit enums
  (`'deg' | 'decideg' | 'rad'` — INAV attitude comes in decidegrees).
- Sizes in SETTINGS are "at the default WxH" — note it in the comment
  (`// at the default 400x150 size; scales with the widget`).
- Scaling mode when relevant: `SCALE = 'flight' | 'window' | 'fixed'` — default `'flight'`
  (axes from `ctx.stats`, no jumping).

## Sizing, smoothing, caching (include in every widget)

- **Scale with the widget.** Derive `var scale = Math.min(ctx.width / DEFW, ctx.height / DEFH);`
  (DEFW×DEFH = the widget's default `w×h`) and multiply **every** pixel size by it — fonts,
  strokes, radii, paddings, offsets. For density knobs (e.g. tape `DEG_PER_PX`) **divide** by
  `scale` so the widget looks identical, just bigger. For elements keyed to one dimension
  (bar thickness) scale from that dimension: `Math.min(ctx.width, ctx.height) / DEFH`.
- **Smooth noisy data.** Baro, current, GPS speed are noisy — offer `SMOOTH_MS` (centered
  moving average, `0 = off`; snippet below). The displayed value and marker/dot must follow the
  **smoothed** curve, not the raw sample. For headings/angles use the circular mean snippet
  (the 359→0 wrap breaks plain averaging).
- **Cache in `ctx.state`, keyed by everything the cache depends on.** `ctx.state` survives code
  edits, so a cache checked only against the column ignores settings changes until restart:

  ```js
  var s = ctx.state, key = col + '|' + MAX_POINTS + '|' + SMOOTH_MS;
  if (s.key !== key) { s.pts = expensive(); s.st = ctx.stats(col); s.key = key; }
  ```

- **Pin scrolling-graph line ends to the window edges.** Raw samples make both ends pop as
  points enter/leave the window; keep one overhanging sample per side and interpolate points
  exactly at the window edges (snippet below).

## Reference template — a complete, correct widget

Use this as the skeleton for any "value + label" widget; it demonstrates every convention
(SETTINGS, scale, guards, panel, hierarchy, shadows, CSS hooks):

```js
function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var LABEL      = 'SPEED';      // small caption above the value ('' = none)
  var UNIT       = 'km/h';       // unit text after the value
  var MULTIPLIER = 3.6;          // value * MULTIPLIER (m/s -> km/h = 3.6; 1 = as is)
  var DIGITS     = 0;            // decimal places
  var COLOR      = '#ffffff';    // value color
  var LABEL_COLOR= 'rgba(255,255,255,.75)';
  var FONT       = 'Arial, sans-serif';
  var SIZE       = 64;           // value font size at the default 320x110 size; scales with the widget
  var SHADOW     = '0 0 8px rgba(0,0,0,.9)';  // text shadow ('' = none)
  var BG         = 'transparent';// box background, e.g. 'rgba(0,0,0,.4)'
  var RADIUS     = 8;            // corner radius at the default size; scales with the widget
  var ALIGN      = 'left';       // 'left' | 'center' | 'right'
  var SHOW_MAX   = false;        // show whole-flight maximum under the value
  // -------------------------------
  var scale = Math.min(ctx.width / 320, ctx.height / 110);
  var fs = SIZE * scale;
  var v = values[0];
  var txt = (typeof v === 'number') ? (v * MULTIPLIER).toFixed(DIGITS) : '--';
  var st = SHOW_MAX ? ctx.stats(ctx.columns[0]) : null;
  // CSS hooks: #bignum (box), .label, .value, .unit, .max
  return '<div id="bignum" class="box" style="width:100%;height:100%;box-sizing:border-box;padding:'
    + (4 * scale).toFixed(1) + 'px ' + (10 * scale).toFixed(1) + 'px;background:' + BG
    + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px;font-family:' + FONT + ';color:' + COLOR
    + ';text-shadow:' + SHADOW + ';text-align:' + ALIGN + '">'
    + (LABEL ? '<div class="label" style="font-size:' + (fs * 0.28).toFixed(1) + 'px;color:' + LABEL_COLOR
      + ';letter-spacing:' + (2 * scale).toFixed(1) + 'px">' + LABEL + '</div>' : '')
    + '<div class="value" style="font-size:' + fs.toFixed(1) + 'px;font-weight:bold;line-height:1">' + txt
    + ' <span class="unit" style="font-size:' + (fs * 0.35).toFixed(1) + 'px;font-weight:normal">' + UNIT + '</span></div>'
    + (st ? '<div class="max" style="font-size:' + (fs * 0.25).toFixed(1) + 'px;color:' + LABEL_COLOR
      + '">max ' + (st.max * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</div>' : '')
    + '</div>';
}
```

The built-in examples (Library tab / `src/examples.js`) cover more shapes if the user asks to
mimic one: bar gauge (gradient fill, `GRADIENT_SPAN`), line graph (scrolling window),
flight graph & altitude profile (whole flight + current-time marker), RC sticks (two SVG boxes
+ trail), GPS map (Web-Mercator tiles via `ctx.image`), compass (tape/rose).

## Reusable snippets (verified)

**Centered moving average** — O(n) sliding-window sum over `[{t, v}]`:

```js
function smooth(raw, SMOOTH_MS) {
  var out = [], lo = 0, hi = 0, sum = 0, cnt = 0, j;
  for (j = 0; j < raw.length; j++) {
    var tj = raw[j].t;
    while (hi < raw.length && raw[hi].t <= tj + SMOOTH_MS / 2) { if (typeof raw[hi].v === 'number') { sum += raw[hi].v; cnt++; } hi++; }
    while (lo < raw.length && raw[lo].t < tj - SMOOTH_MS / 2) { if (typeof raw[lo].v === 'number') { sum -= raw[lo].v; cnt--; } lo++; }
    out.push({ t: tj, v: cnt > 0 ? sum / cnt : raw[j].v });
  }
  return out;
}
```

**Value at `time` from a cached curve** — binary search + interpolation (so dot/label follow
the smoothed curve):

```js
var a = 0, b = pts.length - 1, m;
while (b - a > 1) { m = (a + b) >> 1; if (pts[m].t <= time) a = m; else b = m; }
var pa = pts[a], pb = pts[b];
var v = (typeof pa.v === 'number' && typeof pb.v === 'number' && pb.t > pa.t)
  ? pa.v + (pb.v - pa.v) * (time - pa.t) / (pb.t - pa.t) : pa.v;
```

**Pin scrolling-window ends** — after collecting `pts` overhanging the window `[t0, t1]`:

```js
var out = [], i, p, q;
for (i = 0; i < pts.length; i++) {
  p = pts[i];
  if (p.t < t0) { q = pts[i + 1]; if (q && q.t > t0 && typeof p.v === 'number' && typeof q.v === 'number') out.push({ t: t0, v: p.v + (q.v - p.v) * (t0 - p.t) / (q.t - p.t) }); }
  else if (p.t > t1) { q = pts[i - 1]; if (q && q.t < t1 && typeof p.v === 'number' && typeof q.v === 'number') out.push({ t: t1, v: q.v + (p.v - q.v) * (t1 - q.t) / (p.t - q.t) }); break; }
  else out.push(p);
}
pts = out;
```

**Circular mean for headings** (359→0 wrap-safe, triangular weights around `time`):

```js
var sam = ctx.range(col, time - SMOOTH_MS, time + SMOOTH_MS, 200) || [], sx = 0, sy = 0, ws = 0, k;
for (k = 0; k < sam.length; k++) {
  if (typeof sam[k].v !== 'number') continue;
  var w = 1 - Math.abs(sam[k].t - time) / SMOOTH_MS; if (w <= 0) continue;
  var r = sam[k].v * Math.PI / 180;
  sx += Math.cos(r) * w; sy += Math.sin(r) * w; ws += w;
}
if (ws) hd = Math.atan2(sy, sx) * 180 / Math.PI;
```

**Web-Mercator projection** (GPS → pixels at zoom `z`, 256px tiles):

```js
function px(lat, lon, z) {
  var n = Math.pow(2, z) * 256, r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
}
```

**Direction markers** (SVG paths centered on 0,0, pointing up, `r = SIZE / 2`; rotate with
`<g transform="translate(x,y) rotate(deg)">`):

```js
var dot     = '<circle r="' + (r * 0.6) + '"/>';
var arrow   = '<path d="M0,' + (-r) + ' L' + (r * 0.7) + ',' + r + ' L0,' + (r * 0.55) + ' L' + (-r * 0.7) + ',' + r + ' Z"/>';
var chevron = '<path d="M0,' + (-r) + ' L' + r + ',' + r + ' L0,' + (r * 0.4) + ' L' + (-r) + ',' + r + ' Z"/>';
```

**Map tiles** — OSM `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (attribution
`© OpenStreetMap` required), CARTO `https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png`.
Load through `ctx.image` only; show a small "loading map…" note while any tile returns
`undefined` and a failure note when `null`.

## INAV blackbox columns — complete reference (after `blackbox_decode`)

Verified against INAV firmware `src/main/blackbox/blackbox.c` (field definition arrays) and
INAV `blackbox-tools` `src/blackbox_decode.c` + `src/units.h` (CSV formatting). INAV only —
Betaflight logs differ.

**How the CSV header is formed:** a column gets a ` (unit)` suffix **only** when a decoder
`--unit-*` option applies to it (`vbat (V)`, `time (us)`, `BaroAlt (cm)`, `GPS_speed (m/s)`).
Every other column is dumped **raw with no suffix** — e.g. `attitude[2]` stays in decidegrees
and is never converted by the decoder.

**Decoder unit options** (Files tab exposes some of these; defaults marked):

| option | values (default first) | raw unit in log | conversion |
|---|---|---|---|
| `--unit-frame-time` | `us`, ms, s | µs | ms = /1000, s = /1e6 |
| `--unit-vbat` | `V`, mV, raw | 0.01 V (centivolts) | V = /100, mV = ×10 |
| `--unit-amperage` | `A`, mA, raw | 0.01 A | A = /100, mA = ×10 |
| `--unit-height` (`BaroAlt` only) | `cm`, m, ft | cm | m = /100, ft = /100 × 3.28084 |
| `--unit-gps-speed` | `m/s`, km/h, mi/h, raw | cm/s | m/s = /100, km/h = /100 × 3.6 |
| `--unit-rotation` (`gyroADC[]` only) | `raw`, deg/s, rad/s | raw ADC | via log-header `gyroScale` |
| `--unit-acceleration` (`accSmooth[]` only) | `raw`, g, m/s2 | raw ADC (`acc_1G` = 1 g) | g via `acc_1G`, m/s² = g × 9.80665 |
| `--unit-flags` | `flags` (text names), raw | bitfield | — |

**Main frame fields** (per loop iteration; presence depends on FC config):

| columns | unit / range |
|---|---|
| `loopIteration`, `time` | counter; µs |
| `axisRate[0..2]`, `axisP/I/D/F[0..2]`, `fwAltP/I/D/Out`, `fwPosP/I/D/Out`, `mcPosAxisP[0..2]`, `mcVelAxisP/I/D/FF/Out[0..2]`, `mcSurfaceP/I/D/Out` | internal PID values, raw |
| `rcData[0..3]` | µs, 1000–2000 |
| `rcCommand[0..3]` | roll/pitch/yaw ≈ ±500 around 0, throttle 1000–2000 |
| `vbat`, `amperage` | raw 0.01 V / 0.01 A → default CSV `vbat (V)`, `amperage (A)` |
| `magADC[0..2]`, `gyroRaw[0..2]` | raw ADC |
| `BaroAlt` | cm (→ `(cm)`/`(m)`/`(ft)` per option) |
| `AirSpeed` | cm/s (pitot) |
| `surfaceRaw` | cm, rangefinder without tilt correction |
| `rssi` | 0–1023 |
| `gyroADC[0..2]` | raw ADC (→ deg/s / rad/s per option) |
| `gyroPeakRoll/Pitch/Yaw[0..2]` | Hz (dynamic notch peaks) |
| `accSmooth[0..2]` | raw ADC, `acc_1G` = 1 g (→ g / m/s² per option) |
| `accVib` | vibration level, raw |
| **`attitude[0..2]`** | roll, pitch, yaw in **decidegrees** (/10 → deg); never converted |
| `debug[0..7]` | depends on debug mode |
| `motor[0..7]`, `servo[0..33]` | µs |
| `navState`, `navFlags` | enum; bitfield |
| `navEPH`, `navEPV`, `navPos[0..2]`, `navTgtPos[0..2]`, `navSurf` | cm |
| `navVel[0..2]`, `navTgtVel[0..2]` | cm/s |
| `navTgtHdg` | centidegrees (/100 → deg) |
| `navAcc[0..2]` | cm/s² |

**GPS fields** (merged into the main CSV with `--merge-gps` — the app uses this; otherwise a
separate `.gps.csv`):

| column | raw → CSV |
|---|---|
| `GPS_fixType`, `GPS_numSat` | enum (0–3); count |
| `GPS_coord[0]` lat, `GPS_coord[1]` lon | 1e7 deg → CSV **degrees**, 7 decimals |
| `GPS_altitude` | logged as `llh.alt / 100` → **meters**, integer, no suffix |
| `GPS_speed` | cm/s → per `--unit-gps-speed`, suffixed `(m/s)` / `(km/h)` |
| **`GPS_ground_course`** | decidegrees → CSV **degrees**, 1 decimal, **no suffix** |
| `GPS_hdop` | dimensionless ×100 |
| `GPS_eph`, `GPS_epv` | cm |
| `GPS_velned[0..2]` | cm/s (NED) |
| `GPS_home_lat`, `GPS_home_lon` | added by decoder, degrees |

**Slow frame fields** (change rarely; value holds between samples):
`activeWpNumber`; `flightModeFlags`, `activeFlightModeFlags`, `stateFlags`, `failsafePhase`
(text names by default — strings, use `ctx.raw`; `flightModeFlags2` is merged into
`flightModeFlags`); `rxSignalReceived`, `rxFlightChannelsValid` (0/1); `rxUpdateRate` (Hz);
`hwHealthStatus` (packed bits); `powerSupplyImpedance` (mΩ); `sagCompensatedVBat`
(**stays 0.01 V — decoder converts only `vbat`**); `wind[0..2]` (cm/s NED);
`mspOverrideFlags`; `IMUTemperature`, `baroTemperature`, `sens0..7Temp` (0.1 °C, invalid =
−1250); `escRPM` (rpm); `escTemperature` (°C).

**Columns added by the decoder itself:** `roll`, `pitch`, `heading` (degrees, `--simulate-imu`);
`energyCumulative (mAh)` (whenever amperage is logged); `currentVirtual` +
`energyCumulativeVirtual (mAh)` (`--simulate-current-meter`); `dateTime` (`--datetime`).

**Practical takeaways:** `attitude[]` is the one angle column still in decidegrees in the CSV
(hence `HEADING_UNIT = 'decideg'`), while `GPS_ground_course` and simulated `heading` are
already in degrees. Duplicate names across CSV files can be disambiguated as
`file.csv:column`. When unsure, pick a plausible default and say so — the user fixes the
Columns field with autocomplete.

## Where to put the widget

- **One-off for the user:** give them the code block to paste into *Edit code*, or write an
  importable JSON file (Library → Import…):
  `{"app":"telemetry-overlay","type":"widgets","version":1,"widgets":[{name, columns, w, h, opacity, code}]}`
- **Built-in example:** add an entry to `EXAMPLE_WIDGETS` in `src/examples.js` (name prefixed
  `Example: `) **and bump `EXAMPLES_VERSION`** — the library refreshes example entries on next
  start. Widgets already placed on a video are independent copies and are not updated.

## Verify before handing over (always)

Run the smoke test in this skill folder — it executes widgets in Node with synthetic telemetry
and a fake `ctx`, at several times **including out-of-range** and at two widget sizes, and fails
on exceptions, non-string/empty output, or http URLs in the output:

```
node .claude/skills/widget/test-widgets.mjs                                # all src/examples.js entries
node .claude/skills/widget/test-widgets.mjs my.json                        # widgets from an export/import JSON
node .claude/skills/widget/test-widgets.mjs my.js --columns "BaroAlt (m)"  # one bare function in a .js file
```

The test cannot judge looks — after it passes, mentally check the output HTML for: text shadow
present, sizes multiplied by `scale`, panel/contrast, `--` placeholder when data is missing.
Then, if the app is running, add the widget from the Library and check the preview. For
map/tile widgets confirm the "loading map…" note disappears.
