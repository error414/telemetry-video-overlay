// Icons
// -----
// Three families, all single-colour line icons on a 24×24 grid, drawn with `currentColor` so they
// take the colour of the text around them:
//
//   UI_ICONS      the app's own controls (steps, buttons); path data only, rendered by Icon.jsx
//   GROUP_ICONS   settings-group icons; a widget's settings definition names one per group
//                 ({ "group": { "name", "icon", "items" } }), groupIcon(name) picks a matching one
//   WIDGET_ICONS  one icon per built-in widget (examples.js) — a widget record stores the icon as an
//                 SVG string in its `icon` field so user widgets and import files carry their own
//
// Pure module (no DOM, no React) so the widget skill's Node tools can import it.

const ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body) => `<svg ${ATTRS}>${body}</svg>`;

/** UI icons: inner SVG markup only (Icon.jsx wraps it). */
export const UI_ICONS = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  telemetry: '<path d="M3 17l5-6 4 3 5-8 4 4"/><path d="M3 21h18"/>',
  sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M4 21v-4h4M20 3v4h-4"/>',
  widgets: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  export: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  check: '<path d="M5 12l4 4L19 7"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
  delete: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  more: '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  open: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v2H3z"/><path d="M3 11h19l-2 8H5z"/>',
  layouts: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/>',
  library: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l4 1-3.5 14.5-4-1z"/>',
  tune: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/>',
  warning: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5h.01"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  grid: '<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16"/>',
  magnet: '<path d="M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0zM5 8h4M15 8h4"/>',
  move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
  upload: '<path d="M12 16V5M8 9l4-4 4 4M4 17v3h16v-3"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M4 17v3h16v-3"/>',
  newFile: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2"/>',
  auto: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z"/>',
  motion: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 11l6-3v8l-6-3"/>',
  gyro: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/>',
  hand: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7M16 12V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.3L3 13a1.5 1.5 0 0 1 2.6-1.5L7 13"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  circleCheck: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  play: '<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  stepBack: '<path d="M6 5v14M18 5v14L8 12z" fill="currentColor" stroke="none"/>',
  stepForward: '<path d="M18 5v14M6 5v14l10-7z" fill="currentColor" stroke="none"/>',
  volume: '<path d="M4 9h3l4-3v12l-4-3H4z" fill="currentColor" stroke="none"/><path d="M14 9a4 4 0 0 1 0 6M16.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  volumeOff: '<path d="M4 9h3l4-3v12l-4-3H4z" fill="currentColor" stroke="none"/><path d="M15 9l5 6M20 9l-5 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  flag: '<path d="M5 21V4M5 4h13l-3 4 3 4H5"/>',
  reset: '<path d="M4 4v6h6"/><path d="M4.5 14a8 8 0 1 0 1.7-6.4L4 10"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  drag: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  in: '<path d="M6 4v16M6 12h12M14 8l4 4-4 4"/>',
  out: '<path d="M18 4v16M18 12H6M10 8l-4 4 4 4"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
};

/** Settings-group icons as complete SVG strings (the form shows them next to the group name). */
export const GROUP_ICONS = {
  data: svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'),
  value: svg('<path d="M9 4L7 20M17 4l-2 16M4 9h16M4 15h16"/>'),
  text: svg('<path d="M5 7V5h14v2M12 5v14M9 19h6"/>'),
  labels: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none"/>'),
  box: svg('<rect x="4" y="4" width="16" height="16" rx="3"/>'),
  axis: svg('<path d="M4 4v16h16M4 8h3M4 12h3M4 16h3M8 20v-3M12 20v-3M16 20v-3"/>'),
  scale: svg('<path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4"/>'),
  line: svg('<path d="M3 16c3 0 4-8 7-8s4 8 7 8 4-6 4-6"/>'),
  marker: svg('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>'),
  look: svg('<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.3 0-2.3 1.5-2.3H17a4 4 0 0 0 4-4 8.5 8.5 0 0 0-9-9.5z"/><circle cx="7.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.5" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>'),
  bar: svg('<path d="M5 20v-8h3v8M10.5 20V5h3v15M16 20v-11h3v11M3 20h18"/>'),
  sticks: svg('<circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M7 8v8M3 12h8M17 8v8M13 12h8"/>'),
  map: svg('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
  aircraft: svg('<path d="M12 3l2 7h7l-2 2h-5l-1 5 2 2v1l-3-1-3 1v-1l2-2-1-5H5l-2-2h7z"/>'),
  view: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  ladder: svg('<path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8"/>'),
  peak: svg('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),
  animation: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>'),
  range: svg('<path d="M4 6v12M20 6v12M4 12h16M8 9l-3 3 3 3M16 9l3 3-3 3"/>'),
  heading: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.3 5-5 2.3 2.3-5z" fill="currentColor" stroke="none"/>'),
  angles: svg('<path d="M4 20L18 6M4 20h16M10 20a6 6 0 0 0-1.8-4.3"/>'),
  gauge: svg('<circle cx="12" cy="12" r="8"/><path d="M12 12l4-5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>'),
  idle: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>'),
  arrows: svg('<path d="M4 12h16M14 6l6 6-6 6M10 6l-6 6 6 6"/>'),
  border: svg('<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="4 3"/>'),
  position: svg('<path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3"/>'),
  icon: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8l1.2 2.6 2.8.4-2 2 .5 2.8L12 14.5 9.5 15.8l.5-2.8-2-2 2.8-.4z" fill="currentColor" stroke="none"/>'),
  tune: svg(UI_ICONS.tune),
};

/**
 * Icon for a settings group by its name: "Look" -> palette, "Axis" -> axes, "Peak hold" -> peak…
 * Returns the SVG string (GROUP_ICONS.tune when nothing matches). Used by the examples and by the
 * widget skill's tools to stamp icons into definitions.
 */
const GROUP_RULES = [
  [/peak|hold/, 'peak'],
  [/idle/, 'idle'],
  [/anim/, 'animation'],
  [/icon|symbol|glyph|pictogram/, 'icon'],
  [/scale|tick|ruler/, 'scale'],
  [/sticks?|gimbal/, 'sticks'],
  [/data|source|column|input|smooth|filter/, 'data'],
  [/value|number|digit|readout/, 'value'],
  [/range|limit|min|max|threshold|clip/, 'range'],
  [/label|caption/, 'labels'],
  [/text|font|unit/, 'text'],
  [/border|frame/, 'border'],
  [/position|placement|offset/, 'position'],
  [/box|panel|background|layout|size/, 'box'],
  [/axis|axes|grid/, 'axis'],
  [/line|curve|trail|profile|graph|history|track/, 'line'],
  [/needle|pointer|cursor|indicator/, 'gauge'],
  [/arrow/, 'arrows'],
  [/marker|dot/, 'marker'],
  [/look|colou?r|style|appearance|theme|fill/, 'look'],
  [/bar|dial|ring/, 'bar'],
  [/map|tile|zoom/, 'map'],
  [/aircraft|plane|craft|vehicle/, 'aircraft'],
  [/view|3d|camera|perspective|ball|sphere/, 'view'],
  [/ladder|pitch/, 'ladder'],
  [/heading|compass|yaw/, 'heading'],
  [/angle|attitude|roll|bank/, 'angles'],
];
export function groupIconKey(name) {
  const n = String(name || '').toLowerCase();
  for (const [re, key] of GROUP_RULES) if (re.test(n)) return key;
  return 'tune';
}
export function groupIcon(name) {
  return GROUP_ICONS[groupIconKey(name)];
}

/** One icon per built-in widget (examples.js) and for the importable widgets in widgets/. */
export const WIDGET_ICONS = {
  generic: svg(UI_ICONS.widgets),
  big_number: svg('<path d="M4 9l2-1.2V16M10 9.5a2 2 0 0 1 4 .3c0 2-4 3.8-4 6.2h4M17 8h4l-2.2 3.2a2.2 2.2 0 1 1-1.8 3.6"/>'),
  bar_gauge: svg('<rect x="3" y="9" width="18" height="6" rx="2"/><rect x="5" y="11" width="8" height="2" fill="currentColor" stroke="none"/>'),
  line_graph: svg('<path d="M3 17l4-5 4 3 5-8 5 4M3 21h18"/>'),
  flight_graph: svg('<path d="M3 18c3 0 4-9 7-9s4 5 7 5 3-3 4-3M3 21h18M13 14v7"/><circle cx="13" cy="14" r="1.6" fill="currentColor" stroke="none"/>'),
  altitude_profile: svg('<path d="M3 19l5-9 4 5 3-6 6 10zM3 21h18"/>'),
  rc_sticks: svg('<rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/><circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  gps_map: svg('<path d="M3 8l6-2 6 2 6-2v12l-6 2-6-2-6 2z"/><path d="M12 14s-3-2.6-3-5a3 3 0 0 1 6 0c0 2.4-3 5-3 5z" fill="currentColor" stroke="none"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.3 5-5 2.3 2.3-5z" fill="currentColor" stroke="none"/>'),
  compass_3d: svg('<ellipse cx="12" cy="14" rx="9" ry="4.5"/><path d="M12 4l3 7-3-1.5L9 11z" fill="currentColor" stroke="none"/><path d="M12 9.5V14"/>'),
  attitude_horizon: svg('<circle cx="12" cy="12" r="9"/><path d="M3.5 13.5c4-3 13-3 17 0M9 12h6M12 12v2"/>'),
  artificial_horizon: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v3M5 16c4 2 10 2 14 0M8 12h8"/>'),
  airbus_speed: svg('<rect x="7" y="3" width="8" height="18" rx="1"/><path d="M7 7h3M7 11h3M7 15h3M7 19h3"/><path d="M15 12l5-2.5v5z" fill="currentColor" stroke="none"/>'),
  airbus_alt: svg('<rect x="9" y="3" width="8" height="18" rx="1"/><path d="M14 7h3M14 11h3M14 15h3M14 19h3"/><path d="M9 12l-5-2.5v5z" fill="currentColor" stroke="none"/>'),
  airbus_rpm: svg('<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-6"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/><path d="M4 16h16"/>'),
  rpm_dial: svg('<path d="M6.34 17.66A8 8 0 1 1 17.66 17.66"/><path d="M12 12l4.5-5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M18.5 8.5l1.5-1"/>'),
  half_circle_bar: svg('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M4 16a8 8 0 0 1 3.4-6.5" stroke-width="4"/><path d="M4 16h16"/>'),
  strength: svg('<path d="M4 20v-3M8.5 20v-7M13 20v-11M17.5 20V5" stroke-width="2.6"/>'),
  flight_mode: svg('<path d="M5 21V4M5 4h13l-3 4 3 4H5"/>'),
};

/**
 * A stored icon is user-supplied markup; accept only a plain inline <svg> without scripts, event
 * handlers or external references. Returns the string or null.
 */
export function safeIconSvg(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!/^<svg[\s>]/i.test(t) || !/<\/svg>\s*$/i.test(t)) return null;
  if (/<script|on\w+\s*=|javascript:|<foreignObject|href\s*=|url\(/i.test(t)) return null;
  return t;
}
