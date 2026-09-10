# Icons — reference for widget and settings-group icons

Generated from `src/icons.js` by `icons-md.mjs` (do not edit by hand; run the script after changing
`icons.js`). Every icon is a **single-colour line drawing on a 24×24 grid**: `viewBox="0 0 24 24"`,
`fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, round caps and joins, solid parts as
`fill="currentColor" stroke="none"`. No `width`/`height`, no `xmlns`, no colours, no `<style>`,
no scripts, no `href`/`url()` — the app rejects anything else and shows a generic icon instead.

## Settings-group icons (`"icon"` inside `{ "group": { … } }`)

Pick the row whose *group names* match the group you are defining and paste the SVG string as the
group's `icon` (in a JSON file the double quotes are escaped: `\"`). A group name that fits none
of the rows gets a **new** icon drawn in the same style — never leave a group without one.

| key | typical group names | SVG |
|---|---|---|
| `data` | Data | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>` |
| `value` | Value | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L7 20M17 4l-2 16M4 9h16M4 15h16"/></svg>` |
| `text` | Text | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7V5h14v2M12 5v14M9 19h6"/></svg>` |
| `labels` | Labels | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>` |
| `box` | Box | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>` |
| `axis` | Axis | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16M4 8h3M4 12h3M4 16h3M8 20v-3M12 20v-3M16 20v-3"/></svg>` |
| `scale` | Scale, Bank scale, Sticks | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4"/></svg>` |
| `line` | Line, Curve, Trail, Profile, Track | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16c3 0 4-8 7-8s4 8 7 8 4-6 4-6"/></svg>` |
| `marker` | Marker | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/></svg>` |
| `look` | Look, Colors | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.3 0-2.3 1.5-2.3H17a4 4 0 0 0 4-4 8.5 8.5 0 0 0-9-9.5z"/><circle cx="7.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.5" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="7.5" r="1.2" fill="currentColor" stroke="none"/></svg>` |
| `bar` | Bar, Bars, Dial | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20v-8h3v8M10.5 20V5h3v15M16 20v-11h3v11M3 20h18"/></svg>` |
| `sticks` | — | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M7 8v8M3 12h8M17 8v8M13 12h8"/></svg>` |
| `map` | Map | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/></svg>` |
| `aircraft` | Aircraft | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2 7h7l-2 2h-5l-1 5 2 2v1l-3-1-3 1v-1l2-2-1-5H5l-2-2h7z"/></svg>` |
| `view` | View, Ball | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>` |
| `ladder` | Ladder | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8"/></svg>` |
| `peak` | Peak hold | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>` |
| `animation` | Animation | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/></svg>` |
| `range` | Range, Limits | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12M20 6v12M4 12h16M8 9l-3 3 3 3M16 9l3 3-3 3"/></svg>` |
| `heading` | Heading | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.3 5-5 2.3 2.3-5z" fill="currentColor" stroke="none"/></svg>` |
| `angles` | Angles | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L18 6M4 20h16M10 20a6 6 0 0 0-1.8-4.3"/></svg>` |
| `gauge` | Needle | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 12l4-5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>` |
| `idle` | Idle | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>` |
| `arrows` | Arrows | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6M10 6l-6 6 6 6"/></svg>` |
| `border` | Border | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="4 3"/></svg>` |
| `position` | Position | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3"/></svg>` |
| `tune` | — | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/></svg>` |

## Widget icons (`"icon"` of the widget record)

One icon per widget, showing *what it draws* (a dial, a tape, a graph, a map pin…), in the same
style as above. The built-in ones, for reuse and as the reference for the level of detail:

| key | widget | SVG |
|---|---|---|
| `generic` | generic | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>` |
| `big_number` | big number | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l2-1.2V16M10 9.5a2 2 0 0 1 4 .3c0 2-4 3.8-4 6.2h4M17 8h4l-2.2 3.2a2.2 2.2 0 1 1-1.8 3.6"/></svg>` |
| `bar_gauge` | bar gauge | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="2"/><rect x="5" y="11" width="8" height="2" fill="currentColor" stroke="none"/></svg>` |
| `line_graph` | line graph | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l4-5 4 3 5-8 5 4M3 21h18"/></svg>` |
| `flight_graph` | flight graph | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18c3 0 4-9 7-9s4 5 7 5 3-3 4-3M3 21h18M13 14v7"/><circle cx="13" cy="14" r="1.6" fill="currentColor" stroke="none"/></svg>` |
| `altitude_profile` | altitude profile | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l5-9 4 5 3-6 6 10zM3 21h18"/></svg>` |
| `rc_sticks` | rc sticks | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/><circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>` |
| `gps_map` | gps map | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l6-2 6 2 6-2v12l-6 2-6-2-6 2z"/><path d="M12 14s-3-2.6-3-5a3 3 0 0 1 6 0c0 2.4-3 5-3 5z" fill="currentColor" stroke="none"/></svg>` |
| `compass` | compass | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.3 5-5 2.3 2.3-5z" fill="currentColor" stroke="none"/></svg>` |
| `compass_3d` | compass 3d | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="14" rx="9" ry="4.5"/><path d="M12 4l3 7-3-1.5L9 11z" fill="currentColor" stroke="none"/><path d="M12 9.5V14"/></svg>` |
| `attitude_horizon` | attitude horizon | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 13.5c4-3 13-3 17 0M9 12h6M12 12v2"/></svg>` |
| `artificial_horizon` | artificial horizon | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v3M5 16c4 2 10 2 14 0M8 12h8"/></svg>` |
| `airbus_speed` | airbus speed | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="8" height="18" rx="1"/><path d="M7 7h3M7 11h3M7 15h3M7 19h3"/><path d="M15 12l5-2.5v5z" fill="currentColor" stroke="none"/></svg>` |
| `airbus_alt` | airbus alt | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="8" height="18" rx="1"/><path d="M14 7h3M14 11h3M14 15h3M14 19h3"/><path d="M9 12l-5-2.5v5z" fill="currentColor" stroke="none"/></svg>` |
| `airbus_rpm` | airbus rpm | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-6"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/><path d="M4 16h16"/></svg>` |
| `rpm_dial` | rpm dial | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.34 17.66A8 8 0 1 1 17.66 17.66"/><path d="M12 12l4.5-5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M18.5 8.5l1.5-1"/></svg>` |
| `half_circle_bar` | half circle bar | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 0 1 16 0"/><path d="M4 16a8 8 0 0 1 3.4-6.5" stroke-width="4"/><path d="M4 16h16"/></svg>` |
| `strength` | strength | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20v-3M8.5 20v-7M13 20v-11M17.5 20V5" stroke-width="2.6"/></svg>` |
| `flight_mode` | flight mode | `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h13l-3 4 3 4H5"/></svg>` |

## Drawing a new one

- Sketch on a 24×24 grid with 2–3 px margins; 1.8 px strokes; at most ~6 path commands — the icon
  is shown at 18–26 px, detail is lost.
- Prefer the outline of the widget's *shape*: a 270° arc for a dial, a rectangle with ticks for a
  tape, a polyline for a graph, a circle with a horizon line for an attitude indicator.
- One solid element at most (a dot, a marker) as `fill="currentColor" stroke="none"`.
- Check it against a dark and a light background in a plain HTML page before shipping.
