---
name: widget
description: Create or modify an overlay widget for this Telemetry Overlay app (JS function returning HTML, driven by INAV blackbox CSV columns). Use when the user asks for a new widget, gauge, graph, map, indicator, or wants an existing example widget changed.
---

# Creating a widget

A widget is one JavaScript function stored as a string. The app compiles it with
`new Function` and calls it for every rendered frame (preview and export):

```js
function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var COLOR = '#ffffff';
  // -------------------------------
  return '<div style="color:' + COLOR + '">' + ctx.fmt(values[0], 1) + '</div>';
}
```

Widget record (what the library / project JSON stores):

| field | meaning |
|---|---|
| `name` | display name; built-in examples are prefixed `Example: ` |
| `columns` | comma-separated CSV header names → `values[0], values[1], …` |
| `x, y, w, h` | box in video pixels (export uses the source resolution, e.g. 3840×2160) |
| `opacity` | 0–1, applied to the whole box |
| `code` | the function source |
| `css` | optional stylesheet for this widget only — every selector is auto-prefixed with the box id (`#w-<id>`), `:root` = the box; applied in preview and export |

Give elements in the returned HTML stable `id`s / `class`es (e.g. `class="label"`, `id="box-left"`)
so users can restyle them from the CSS tab without touching the code. The editor's preview shows
`tag#id.class` on hover. Remember SVG text/shapes use `fill`/`stroke`, not `color`/`background`,
and are positioned with `transform: translate(10px, -4px)` (px units required) — `margin`,
`left`/`top` do nothing inside `<svg>`. Avoid putting a `transform` attribute on elements users are
likely to nudge (CSS `transform` replaces the attribute); wrap them in a `<g>` instead.

## Runtime API (`src/widgetRuntime.js` is the source of truth)

| | |
|---|---|
| `values[i]` | current value of column *i* — numeric columns are linearly interpolated; `undefined` outside telemetry range |
| `time` | telemetry time, integer **ms** (video time + sync offset) |
| `ctx.videoTime` | video time in seconds |
| `ctx.width`, `ctx.height` | box size in px — always size drawings from these, never hard-code |
| `ctx.columns` | the column names array |
| `ctx.get(name)` / `ctx.raw(name)` | any column by name, interpolated / last sample (use `raw` for flags & strings) |
| `ctx.range(name, fromMs, toMs, maxPoints)` | history window `[{t, v}]` (t in ms) |
| `ctx.all(name, maxPoints)` | the whole flight `[{t, v}]` — profiles, tracks |
| `ctx.stats(name)` | `{min, max, mean, count, tMin, tMax}` for the whole flight (cached) — use for stable axis scaling |
| `ctx.duration` | telemetry length in ms |
| `ctx.state` | plain object persisting between calls **per widget** — cache anything expensive here |
| `ctx.fmt(v, digits)` | number → string, `'--'` for missing |
| `ctx.image(url)` | returns a `data:` URL once loaded, `undefined` while loading, `null` on failure; the widget re-renders automatically when it arrives; works in export |

## Rules that keep widgets working in export

Export renders the HTML through an SVG `<foreignObject>` into a canvas, so:

1. **Return a string of HTML.** Inline styles or a `<style>` tag; inline `<svg>` is ideal for gauges/graphs.
2. **No external resources** — no web fonts, no remote `<img src="https://…">`, no `<link>`. Use `ctx.image(url)` for anything remote (it becomes a data URI) or embed data URIs directly.
3. **Well-formed markup** — close every tag, quote every attribute (`<img … />`, `<br/>`). The HTML is converted to XHTML; sloppy markup renders blank in export even if the preview looks fine.
4. **Never throw.** Guard `typeof v === 'number'` before math; return `''` or a small message when data is missing. Compile/runtime errors show up as a red box but the frame still exports.
5. **Be fast.** The function runs at video fps (often 60–120 fps in export). Cache projections, paths, whole-flight arrays in `ctx.state`, keyed by what they depend on (e.g. zoom, `ctx.width/height`, column name) and recompute only when that changes.
6. Plain ES5-style code (`var`, string concatenation) is the house style — it stays readable for non-programmers editing the SETTINGS block. Modern syntax works too.

## Conventions for the SETTINGS block

- First thing in the function, delimited by `// ---------- SETTINGS ----------` / `// ---`.
- `UPPER_CASE` names, one per line, each with a short comment listing allowed values.
- Typical knobs: colors, `BG`, `RADIUS`, `FONT`, `FONT_SIZE`, `LABEL`, `UNIT`, `MULTIPLIER`, `DIGITS`, `MIN`/`MAX` with `null` meaning "from `ctx.stats`", style enums (`'arrow' | 'plane' | 'dot'`), unit enums (`'deg' | 'decideg' | 'rad'`).
- Scaling: prefer `ctx.stats(col)` over the visible window so axes don't jump; offer `SCALE = 'flight' | 'window' | 'fixed'` when relevant.

## INAV blackbox column names (after `blackbox_decode`)

Headers depend on the decoder unit options (Files tab). Common ones:

| data | header |
|---|---|
| time | `time (us)` (the time column itself is not exposed as a value) |
| sticks | `rcCommand[0..3]` = roll, pitch, yaw (≈ −500…500 around 0), throttle |
| motors | `motor[0..n]` |
| attitude | `attitude[0..2]` roll/pitch/yaw in **decidegrees** (`/10`) |
| simulated IMU | `roll`, `pitch`, `heading` (degrees, only with "Simulate IMU") |
| altitude | `BaroAlt (cm)` or `(m)`, `navPos[2]`, `GPS_altitude` |
| GPS | `GPS_numSat`, `GPS_coord[0]` lat, `GPS_coord[1]` lon, `GPS_speed (m/s)` / `(km/h)`, `GPS_ground_course` |
| battery | `vbat (V)`, `amperage (A)`, `energyCumulative (mAh)` |
| flags | `flightModeFlags (flags)`, `stateFlags (flags)`, `failsafePhase (flags)` — strings, use `ctx.raw` |

Duplicate names across CSV files can be disambiguated as `file.csv:column`. When unsure, pick a plausible default and say so — the user can fix the Columns field with the autocomplete.

## Where to put the widget

- **One-off for the user:** give them the code block to paste into *Edit code*, or write an importable JSON file
  `{"app":"telemetry-overlay","type":"widgets","version":1,"widgets":[{name, columns, w, h, opacity, code}]}`
  (Library → Import…).
- **Built-in example:** add an entry to `EXAMPLE_WIDGETS` in `src/examples.js` (name prefixed `Example: `) **and bump `EXAMPLES_VERSION`** — the library refreshes example entries automatically on next start. Widgets already placed on a video are independent copies and are not updated.

## Verify before handing over

Run the smoke test in this skill folder — it executes every example (or a JSON file of widgets) in Node with synthetic telemetry and a fake `ctx`, at several times, and fails on exceptions or empty output:

```
node .claude/skills/widget/test-widgets.mjs              # all src/examples.js entries
node .claude/skills/widget/test-widgets.mjs my.json      # widgets from an export/import JSON
```

Then, if the app is running, add the widget from the Library and check the preview. For map/tile widgets confirm the "loading map…" note disappears.
