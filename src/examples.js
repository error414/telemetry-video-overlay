// Example widgets shown read-only in the Library tab (Examples section). Every example starts
// with a SETTINGS block whose values come from the widget's settings (the `settings` definition
// below, editable in the editor's "Settings definition" tab; the app renders a form from it).
// They are read straight from this file, so they are always current.
import { defsToSource as defs } from './widgetSettings.js';

export const EXAMPLE_WIDGETS = [
  {
    name: 'Example: Big number',
    columns: 'GPS_speed (m/s)',
    w: 320,
    h: 110,
    settings: defs([
      { group: { name: 'Value', items: [
        { name: 'Label', type: 'text', default: 'SPEED', description: "small caption above the value ('' = none)" },
        { name: 'Unit', type: 'text', default: 'km/h', description: 'unit text after the value' },
        { name: 'Multiplier', type: 'number', default: 3.6, step: 0.1, description: 'value * MULTIPLIER (m/s -> km/h = 3.6; 1 = as is)' },
        { name: 'Digits', type: 'int', default: 0, min: 0, max: 6, description: 'decimal places' },
        { name: 'Show max', type: 'bool', default: false, description: 'show whole-flight maximum under the value' },
        { name: 'Smoothing ms', type: 'int', default: 300, min: 0, description: 'moving-average window in ms that filters out quick small jumps (0 = off)' },
      ] } },
      { group: { name: 'Text', items: [
        { name: 'Color', type: 'color_picker', default: '#ffffff', description: 'text color' },
        { name: 'Label color', type: 'color_picker', default: 'rgba(255,255,255,.75)' },
        { name: 'Font', type: 'text', default: 'Arial, sans-serif', description: 'font family' },
        { name: 'Size', type: 'int', default: 64, min: 8, description: 'value font size at the default 320x110 size; scales with the widget' },
        { name: 'Shadow', type: 'text', default: '0 0 8px rgba(0,0,0,.9)', description: "CSS text shadow ('' = none)" },
        { name: 'Align', type: 'select', default: 'left', values: ['left', 'center', 'right'], description: "'left' | 'center' | 'right'" },
      ] } },
      { group: { name: 'Box', items: [
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.25)', description: 'box background; alpha 0 = no box' },
        { name: 'Radius', type: 'int', default: 8, min: 0, description: 'box corner radius at the default size; scales with the widget' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // ---------- SETTINGS ----------
  var LABEL       = settings.label.value;        // small caption above the value ('' = none)
  var UNIT        = settings.unit.value;         // unit text after the value
  var MULTIPLIER  = settings.multiplier.value;   // value * MULTIPLIER (m/s -> km/h = 3.6; 1 = as is)
  var DIGITS      = settings.digits.value;       // decimal places
  var COLOR       = settings.color.value;        // text color
  var LABEL_COLOR = settings.label_color.value;
  var FONT        = settings.font.value;
  var SIZE        = settings.size.value;         // value font size at the default 320x110 size; scales with the widget
  var SHADOW      = settings.shadow.value;       // text shadow ('' = none)
  var BG          = settings.background.value;   // box background color + transparency (last number: 0 = invisible, 1 = solid; 'transparent' = none)
  var RADIUS      = settings.radius.value;       // box corner radius at the default size; scales with the widget
  var ALIGN       = settings.align.value;        // 'left' | 'center' | 'right'
  var SHOW_MAX    = settings.show_max.value;     // show whole-flight maximum under the value
  var SMOOTH_MS   = settings.smoothing_ms.value; // moving-average window (ms) that filters out quick small jumps of the value (0 = off)
  // -------------------------------
  var scale = Math.min(ctx.width / 320, ctx.height / 110);  // all sizes scale with the widget (settings are for the default 320x110)
  var fs = SIZE * scale, radius = RADIUS * scale;
  var v = ctx.values[0];
  if (SMOOTH_MS > 0 && typeof v === 'number') {
    // centered moving average: quick small spikes disappear without visible lag
    var pts = ctx.range(ctx.columns[0], time - SMOOTH_MS / 2, time + SMOOTH_MS / 2, 50), sum = 0, n = 0, i;
    for (i = 0; i < pts.length; i++) if (typeof pts[i].v === 'number') { sum += pts[i].v; n++; }
    if (n > 0) v = sum / n;
  }
  var txt = (typeof v === 'number') ? (v * MULTIPLIER).toFixed(DIGITS) : '--';
  var st = SHOW_MAX ? ctx.stats(ctx.columns[0]) : null;
  return '<div id="bignum" class="box" style="width:100%;height:100%;box-sizing:border-box;padding:' + (4 * scale).toFixed(1) + 'px ' + (10 * scale).toFixed(1) + 'px;background:' + BG
    + ';border-radius:' + radius.toFixed(1) + 'px;font-family:' + FONT + ';color:' + COLOR + ';text-shadow:' + SHADOW + ';text-align:' + ALIGN + '">'
    + (LABEL ? '<div class="label" style="font-size:' + (fs * 0.28).toFixed(1) + 'px;color:' + LABEL_COLOR + ';letter-spacing:' + (2 * scale).toFixed(1) + 'px">' + LABEL + '</div>' : '')
    + '<div class="value" style="font-size:' + fs.toFixed(1) + 'px;font-weight:bold;line-height:1">' + txt
    + ' <span class="unit" style="font-size:' + (fs * 0.35).toFixed(1) + 'px;font-weight:normal">' + UNIT + '</span></div>'
    + (st ? '<div class="max" style="font-size:' + (fs * 0.25).toFixed(1) + 'px;color:' + LABEL_COLOR + '">max ' + (st.max * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</div>' : '')
    + '</div>';
}`,
  },
  {
    name: 'Example: Bar gauge',
    columns: 'rcCommand[3]',
    w: 300,
    h: 40,
    settings: defs([
      { group: { name: 'Range', items: [
        { name: 'Auto range', type: 'bool', default: false, description: '0 % / 100 % = whole-flight minimum / maximum instead of Min / Max' },
        { name: 'Min', type: 'int', default: 1000, description: 'value that maps to 0 %' },
        { name: 'Max', type: 'int', default: 2000, description: 'value that maps to 100 %' },
        { name: 'Show value', type: 'select', default: 'percent', values: ['percent', 'raw', 'none'], description: 'text after the label' },
        { name: 'Digits', type: 'int', default: 0, min: 0, max: 6 },
        { name: 'Smoothing ms', type: 'int', default: 300, min: 0, description: 'moving-average window in ms that filters out quick small jumps (0 = off)' },
      ] } },
      { group: { name: 'Bar', items: [
        { name: 'Bar color', type: 'text', default: 'linear-gradient(90deg,#3f3,#ff3,#f33)', description: 'CSS color or gradient of the fill (for vertical direction use 0deg)' },
        { name: 'Gradient span', type: 'select', default: 'gauge', values: { gauge: 'gauge (the fill reveals the gradient)', fill: 'fill (gradient squeezed into the filled part)' }, description: "'gauge' = gradient spans the whole gauge and the fill just reveals it; 'fill' = gradient squeezes into the filled part" },
        { name: 'Direction', type: 'select', default: 'horizontal', values: ['horizontal', 'vertical'], description: "'horizontal' | 'vertical'" },
      ] } },
      { group: { name: 'Text', items: [
        { name: 'Label', type: 'text', default: 'THR', description: "label text ('' = none)" },
        { name: 'Text color', type: 'color_picker', default: '#fff' },
        { name: 'Font', type: 'text', default: 'Arial', description: 'font family' },
        { name: 'Font size', type: 'int', default: 18, min: 6, description: 'text size at the default 300x40 size; scales with the widget' },
        { name: 'Font bold', type: 'bool', default: true },
      ] } },
      { group: { name: 'Box', items: [
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.5)' },
        { name: 'Border color', type: 'color_picker', default: '#fff' },
        { name: 'Border width', type: 'int', default: 2, min: 0, description: 'at the default 300x40 size; scales with the widget' },
        { name: 'Radius', type: 'int', default: 6, min: 0, description: 'corner radius at the default size; scales with the widget' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // ---------- SETTINGS ----------
  var LABEL         = settings.label.value;                                  // label text ('' = none)
  var MIN           = settings.auto_range.value ? null : settings.min.value; // value that maps to 0 %   (null = whole-flight minimum)
  var MAX           = settings.auto_range.value ? null : settings.max.value; // value that maps to 100 % (null = whole-flight maximum)
  var SHOW_VALUE    = settings.show_value.value;                             // 'percent' | 'raw' | 'none'
  var DIGITS        = settings.digits.value;
  var SMOOTH_MS     = settings.smoothing_ms.value;                           // moving-average window (ms) that filters out quick small spikes (0 = off)
  var BAR_COLOR     = settings.bar_color.value;                              // css color or gradient (for vertical direction use 0deg)
  var GRADIENT_SPAN = settings.gradient_span.value;                          // 'gauge' = gradient spans the whole gauge and the fill just reveals it; 'fill' = gradient squeezes into the filled part
  var BG            = settings.background.value;
  var BORDER_COLOR  = settings.border_color.value;
  var BORDER_WIDTH  = settings.border_width.value;                           // at the default 300x40 size; scales with the widget
  var RADIUS        = settings.radius.value;                                 // corner radius at the default size; scales with the widget
  var TEXT_COLOR    = settings.text_color.value;
  var FONT          = settings.font.value;                                   // font family
  var FONT_SIZE     = settings.font_size.value;                              // text size at the default 300x40 size; scales with the widget
  var FONT_BOLD     = settings.font_bold.value;
  var DIRECTION     = settings.direction.value;                              // 'horizontal' | 'vertical'
  // -------------------------------
  var scale = Math.min(ctx.width, ctx.height) / 40;  // sizes scale with the bar thickness (settings are for the default 300x40)
  var st = (MIN === null || MAX === null) ? ctx.stats(ctx.columns[0]) : null;
  if (MIN === null) MIN = st ? st.min : 0;
  if (MAX === null) MAX = st ? st.max : 1;
  if (MAX === MIN) MAX = MIN + 1;
  var v = ctx.values[0];
  if (SMOOTH_MS > 0 && typeof v === 'number') {
    // centered moving average: quick small spikes disappear without visible lag
    var pts = ctx.range(ctx.columns[0], time - SMOOTH_MS / 2, time + SMOOTH_MS / 2, 50), sum = 0, n = 0, i;
    for (i = 0; i < pts.length; i++) if (typeof pts[i].v === 'number') { sum += pts[i].v; n++; }
    if (n > 0) v = sum / n;
  }
  var p = Math.max(0, Math.min(1, ((typeof v === 'number' ? v : MIN) - MIN) / (MAX - MIN)));
  var text = LABEL + (SHOW_VALUE === 'percent' ? ' ' + (p * 100).toFixed(DIGITS) + '%' : SHOW_VALUE === 'raw' ? ' ' + ctx.fmt(v, DIGITS) : '');
  var fill = DIRECTION === 'vertical'
    ? 'position:absolute;left:0;bottom:0;width:100%;height:' + (p * 100).toFixed(1) + '%'
    : 'position:absolute;left:0;top:0;height:100%;width:' + (p * 100).toFixed(1) + '%';
  fill += ';background:' + BAR_COLOR;
  if (GRADIENT_SPAN === 'gauge' && p > 0) {
    // stretch the background over the whole gauge so the fill only reveals it
    fill += DIRECTION === 'vertical'
      ? ';background-size:100% ' + (100 / p).toFixed(2) + '%;background-position:left bottom'
      : ';background-size:' + (100 / p).toFixed(2) + '% 100%;background-position:left top';
  }
  return '<div id="gauge" class="box" style="position:relative;width:100%;height:100%;box-sizing:border-box;background:' + BG + ';border:' + (BORDER_WIDTH * scale).toFixed(1) + 'px solid ' + BORDER_COLOR + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px;overflow:hidden">'
    + '<div class="fill" style="' + fill + '"></div>'
    + '<div class="text" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:' + TEXT_COLOR + ';font:' + (FONT_BOLD ? 'bold ' : '') + (FONT_SIZE * scale).toFixed(1) + 'px ' + FONT + ';text-shadow:0 0 4px #000">' + text + '</div>'
    + '</div>';
}`,
  },
  {
    name: 'Example: Line graph (history)',
    columns: 'BaroAlt (m)',
    w: 400,
    h: 150,
    settings: defs([
      { group: { name: 'Data', items: [
        { name: 'Window ms', type: 'int', default: 20000, min: 500, description: 'how much history to show (ms)' },
        { name: 'Clip to range', type: 'bool', default: false, description: 'draw nothing outside the export range (sync bar in/out points)' },
        { name: 'Smoothing ms', type: 'int', default: 300, min: 0, description: 'moving-average window in ms that filters out quick small jumps (0 = off)' },
        { name: 'Label', type: 'text', default: 'ALT', description: "label ('' = column name)" },
        { name: 'Multiplier', type: 'number', default: 1, step: 0.1, description: 'value scaling (cm -> m = 0.01)' },
        { name: 'Digits', type: 'int', default: 1, min: 0, max: 6 },
        { name: 'Unit', type: 'text', default: 'm' },
      ] } },
      { group: { name: 'Axis', items: [
        { name: 'Scale', type: 'select', default: 'flight', values: { flight: 'flight (fixed axis from whole-flight min/max)', window: 'window (autoscale to the visible history)', fixed: 'fixed (Min / Max)' }, description: 'vertical axis scaling' },
        { name: 'Min', type: 'int', default: 0, description: "axis minimum when Scale = 'fixed'" },
        { name: 'Max', type: 'int', default: 100, description: "axis maximum when Scale = 'fixed'" },
        { name: 'Show grid', type: 'bool', default: true },
      ] } },
      { group: { name: 'Line', items: [
        { name: 'Line color', type: 'color_picker', default: '#00ff00', description: 'line color below the first threshold (thresholds are set in the code)' },
        { name: 'Line width', type: 'number', default: 2, min: 0, step: 0.5, description: 'at the default 400x150 size; scales with the widget' },
        { name: 'Fill alpha', type: 'number', default: 0.15, min: 0, max: 1, step: 0.05, description: 'opacity of the area under the line (0 = no area)' },
      ] } },
      { group: { name: 'Text & box', items: [
        { name: 'Text color', type: 'color_picker', default: '#fff' },
        { name: 'Font size', type: 'int', default: 14, min: 6, description: 'text size at the default 400x150 size; scales with the widget' },
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.4)' },
        { name: 'Radius', type: 'int', default: 8, min: 0, description: 'corner radius at the default size; scales with the widget' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // ---------- SETTINGS ----------
  var WINDOW_MS     = settings.window_ms.value;     // how much history to show (ms)
  var CLIP_TO_RANGE = settings.clip_to_range.value; // true = draw nothing outside the export range (sync bar in/out points)
  var SMOOTH_MS     = settings.smoothing_ms.value;  // moving-average window (ms) smoothing the line and the value (0 = off)
  var LABEL         = settings.label.value;         // label ('' = column name)
  var MULTIPLIER    = settings.multiplier.value;    // value scaling (cm -> m = 0.01)
  var DIGITS        = settings.digits.value;
  var UNIT          = settings.unit.value;
  var LINE_COLOR    = settings.line_color.value;    // line color below the first threshold
  var LINE_WIDTH    = settings.line_width.value;    // at the default 400x150 size; scales with the widget
  var THRESHOLDS = [[100, '#4da6ff'], [200, '#ff4040']]; // [value, color] pairs (in display units, after MULTIPLIER), ascending; colors the line and the value; [] = off
  var FILL_ALPHA    = settings.fill_alpha.value;    // opacity of the area under the line (the area follows the line color; 0 = no area)
  var BG            = settings.background.value;
  var RADIUS        = settings.radius.value;        // corner radius at the default size; scales with the widget
  var TEXT_COLOR    = settings.text_color.value;
  var FONT_SIZE     = settings.font_size.value;     // text size at the default 400x150 size; scales with the widget
  var SCALE         = settings.scale.value;         // 'flight' = fixed axis from whole-flight min/max (no jumping),
  var MIN           = settings.min.value;           // used when SCALE = 'fixed'
  var MAX           = settings.max.value;
  var SHOW_GRID     = settings.show_grid.value;
  // -------------------------------
  var scale = Math.min(ctx.width / 400, ctx.height / 150);  // sizes scale with the widget (settings are for the default 400x150)
  var fsz = FONT_SIZE * scale, lw = LINE_WIDTH * scale;
  var pts;
  if (SMOOTH_MS > 0) {
    // centered moving average over a slightly wider raw window (sliding-window sum, O(n))
    var raw = ctx.range(ctx.columns[0], time - WINDOW_MS - SMOOTH_MS / 2, time + SMOOTH_MS / 2, 340);
    pts = [];
    var lo = 0, hi = 0, sum = 0, cnt = 0, j;
    for (j = 0; j < raw.length; j++) {
      var tj = raw[j].t;
      while (hi < raw.length && raw[hi].t <= tj + SMOOTH_MS / 2) { if (typeof raw[hi].v === 'number') { sum += raw[hi].v; cnt++; } hi++; }
      while (lo < raw.length && raw[lo].t < tj - SMOOTH_MS / 2) { if (typeof raw[lo].v === 'number') { sum -= raw[lo].v; cnt--; } lo++; }
      pts.push({ t: tj, v: cnt > 0 ? sum / cnt : raw[j].v });
    }
  } else {
    pts = ctx.range(ctx.columns[0], time - WINDOW_MS, time, 300);
    // range ends at the last sample <= time; add the interpolated current value so the
    // right end reaches the window edge instead of jumping when a new sample arrives
    if (typeof ctx.values[0] === 'number' && (!pts.length || pts[pts.length - 1].t < time)) pts.push({ t: time, v: ctx.values[0] });
  }
  // pts overhang the window (a sample before the start, the current value / smoothing tail
  // at the end); replace the overhang with points interpolated exactly at the window edges,
  // otherwise both line ends visibly jump by one sample as points enter and leave the window
  function clip(arr, t0, t1) {
    var out = [], i, p, q;
    for (i = 0; i < arr.length; i++) {
      p = arr[i];
      if (p.t < t0) {
        q = arr[i + 1];
        if (q && q.t > t0 && typeof p.v === 'number' && typeof q.v === 'number')
          out.push({ t: t0, v: p.v + (q.v - p.v) * (t0 - p.t) / (q.t - p.t) });
      } else if (p.t > t1) {
        q = arr[i - 1];
        if (q && q.t < t1 && typeof p.v === 'number' && typeof q.v === 'number')
          out.push({ t: t1, v: q.v + (p.v - q.v) * (t1 - q.t) / (p.t - q.t) });
        break;
      } else out.push(p);
    }
    return out;
  }
  pts = clip(pts, time - WINDOW_MS, time);
  var smoothedNow = pts.length ? pts[pts.length - 1].v : undefined;  // smoothed value at the current time
  // and cut the line at the export range edges when asked to
  if (CLIP_TO_RANGE && ctx.exportRange) pts = clip(pts, ctx.exportRange.from, ctx.exportRange.to);
  var W = ctx.width, H = ctx.height, pad = 6 * scale;
  function colFor(dv) { var c = LINE_COLOR, i; for (i = 0; i < THRESHOLDS.length; i++) if (dv >= THRESHOLDS[i][0]) c = THRESHOLDS[i][1]; return c; }
  var min, max;
  if (SCALE === 'fixed') { min = MIN; max = MAX; }
  else if (SCALE === 'flight') { var st = ctx.stats(ctx.columns[0]); min = st ? st.min : 0; max = st ? st.max : 1; }
  else {
    min = Infinity; max = -Infinity;
    pts.forEach(function (p) { if (typeof p.v === 'number') { if (p.v < min) min = p.v; if (p.v > max) max = p.v; } });
  }
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (max === min) max = min + 1;
  var coords = [], segs = [], cur = null, curColor = null;
  pts.forEach(function (p) {
    if (typeof p.v !== 'number') return;
    var x = (p.t - (time - WINDOW_MS)) / WINDOW_MS * W;
    var y = H - pad - (p.v - min) / (max - min) * (H - 2 * pad);
    var pt = x.toFixed(1) + ',' + y.toFixed(1);
    coords.push(pt);
    var c = colFor(p.v * MULTIPLIER);
    if (c !== curColor) { var prev = cur ? cur[cur.length - 1] : null; cur = prev ? [prev] : []; curColor = c; segs.push({ c: c, p: cur }); }
    cur.push(pt);
  });
  var grid = '';
  if (SHOW_GRID) for (var i = 1; i < 4; i++) grid += '<line class="grid" x1="0" x2="' + W + '" y1="' + (H * i / 4) + '" y2="' + (H * i / 4) + '" stroke="rgba(255,255,255,.15)" stroke-width="' + Math.max(0.5, scale).toFixed(2) + '"/>';
  var area = '';
  if (FILL_ALPHA > 0) segs.forEach(function (s) {
    if (s.p.length < 2) return;
    area += '<polygon class="area" points="' + s.p[0].split(',')[0] + ',' + H + ' ' + s.p.join(' ') + ' ' + s.p[s.p.length - 1].split(',')[0] + ',' + H + '" fill="' + s.c + '" fill-opacity="' + FILL_ALPHA + '"/>';
  });
  var line = segs.map(function (s) { return '<polyline class="line" points="' + s.p.join(' ') + '" fill="none" stroke="' + s.c + '" stroke-width="' + lw.toFixed(2) + '" stroke-linejoin="round"/>'; }).join('');
  var v = ctx.values[0];
  if (SMOOTH_MS > 0 && typeof v === 'number' && typeof smoothedNow === 'number') v = smoothedNow;  // show the smoothed value too
  var vcol = (typeof v === 'number') ? colFor(v * MULTIPLIER) : TEXT_COLOR;
  var txt = (LABEL || ctx.columns[0]) + ': <tspan class="value" fill="' + vcol + '">' + (typeof v === 'number' ? (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT : '--') + '</tspan>';
  return '<svg id="graph" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + grid + area + line
    + '<text class="label" x="' + (8 * scale).toFixed(1) + '" y="' + (fsz + 4 * scale).toFixed(1) + '" fill="' + TEXT_COLOR + '" font-family="Arial" font-size="' + fsz.toFixed(1) + '" style="text-shadow:0 0 4px #000">' + txt + '</text></svg>';
}`,
  },
  {
    name: 'Example: Flight graph (whole flight)',
    columns: 'GPS_speed (km/h)',
    w: 520,
    h: 160,
    settings: defs([
      { group: { name: 'Data', items: [
        { name: 'Unit', type: 'text', default: 'km/h' },
        { name: 'Multiplier', type: 'number', default: 1, step: 0.1, description: 'value scaling (3.6 = m/s -> km/h, 0.01 = cm -> m)' },
        { name: 'Digits', type: 'int', default: 1, min: 0, max: 6 },
        { name: 'Max points', type: 'int', default: 600, min: 50, description: 'curve resolution' },
        { name: 'Smoothing ms', type: 'int', default: 1000, min: 0, description: 'moving-average window in ms that filters out quick small jumps (0 = off)' },
        { name: 'Clip to range', type: 'bool', default: false, description: 'show only the export range (sync bar in/out points) instead of the whole flight' },
      ] } },
      { group: { name: 'Axis', items: [
        { name: 'Baseline', type: 'select', default: 'zero', values: { zero: 'zero (axis starts at 0)', min: 'min (axis starts at the flight minimum)' }, description: "'zero' = axis starts at 0, 'min' = at flight minimum" },
        { name: 'Fixed axis', type: 'bool', default: false, description: 'use Min / Max for the axis instead of the flight' },
        { name: 'Min', type: 'int', default: 0, description: 'axis minimum when Fixed axis is on' },
        { name: 'Max', type: 'int', default: 100, description: 'axis maximum when Fixed axis is on' },
        { name: 'Grid lines', type: 'int', default: 4, min: 0, max: 20, description: 'horizontal grid lines (0 = none)' },
        { name: 'Grid color', type: 'color_picker', default: 'rgba(255,255,255,.6)' },
        { name: 'Axis labels', type: 'bool', default: true, description: 'numbers on the left' },
      ] } },
      { group: { name: 'Curve', items: [
        { name: 'Fill color', type: 'color_picker', default: 'rgba(80,160,255,.85)' },
        { name: 'Line color', type: 'color_picker', default: 'rgba(255,255,255,.9)' },
        { name: 'Line width', type: 'number', default: 1, min: 0, step: 0.5, description: 'at the default 520x160 size; scales with the widget (like all sizes below)' },
      ] } },
      { group: { name: 'Marker', items: [
        { name: 'Marker color', type: 'color_picker', default: '#e03030', description: 'vertical bar at current time' },
        { name: 'Marker width', type: 'int', default: 4, min: 0 },
        { name: 'Dot', type: 'bool', default: true, description: 'dot on the curve at current time' },
        { name: 'Dot color', type: 'color_picker', default: '#ffffff' },
        { name: 'Dot size', type: 'int', default: 5, min: 0 },
      ] } },
      { group: { name: 'Text & box', items: [
        { name: 'Title', type: 'text', default: 'Speed vs Time', description: "caption under the chart ('' = none)" },
        { name: 'Text color', type: 'color_picker', default: '#ffffff' },
        { name: 'Font', type: 'text', default: 'Arial' },
        { name: 'Font size', type: 'int', default: 13, min: 6, description: 'axis / title text size' },
        { name: 'Value size', type: 'int', default: 22, min: 6, description: 'current value label size' },
        { name: 'Shadow', type: 'bool', default: true, description: 'text shadow for readability over video' },
        { name: 'Background', type: 'color_picker', default: 'transparent', description: 'box background; alpha 0 = none' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // Whole-flight area chart with a marker at the current time (like "Speed vs Time").
  // Use an altitude column for an altitude profile.
  // ---------- SETTINGS ----------
  var TITLE         = settings.title.value;                                  // caption under the chart ('' = none)
  var UNIT          = settings.unit.value;
  var MULTIPLIER    = settings.multiplier.value;                             // value scaling (3.6 = m/s -> km/h, 0.01 = cm -> m)
  var DIGITS        = settings.digits.value;
  var FILL_COLOR    = settings.fill_color.value;
  var LINE_COLOR    = settings.line_color.value;
  var LINE_WIDTH    = settings.line_width.value;                             // at the default 520x160 size; scales with the widget (like all sizes below)
  var MARKER_COLOR  = settings.marker_color.value;                           // vertical bar at current time
  var MARKER_WIDTH  = settings.marker_width.value;
  var DOT           = settings.dot.value;                                    // dot on the curve at current time
  var DOT_COLOR     = settings.dot_color.value;
  var DOT_SIZE      = settings.dot_size.value;
  var TEXT_COLOR    = settings.text_color.value;
  var FONT          = settings.font.value;
  var FONT_SIZE     = settings.font_size.value;                              // axis / title text size
  var VALUE_SIZE    = settings.value_size.value;                             // current value label size
  var GRID_LINES    = settings.grid_lines.value;                             // horizontal grid lines (0 = none)
  var GRID_COLOR    = settings.grid_color.value;
  var AXIS_LABELS   = settings.axis_labels.value;                            // numbers on the left
  var BASELINE      = settings.baseline.value;                               // 'zero' = axis starts at 0, 'min' = at flight minimum
  var MIN           = settings.fixed_axis.value ? settings.min.value : null; // fixed axis min/max (null = from the flight)
  var MAX           = settings.fixed_axis.value ? settings.max.value : null;
  var BG            = settings.background.value;                             // e.g. 'rgba(0,0,0,.35)'
  var SHADOW        = settings.shadow.value;                                 // text shadow for readability over video
  var MAX_POINTS    = settings.max_points.value;                             // curve resolution
  var SMOOTH_MS     = settings.smoothing_ms.value;                           // moving-average window (ms) smoothing the curve and the value (0 = off)
  var CLIP_TO_RANGE = settings.clip_to_range.value;                          // true = the chart spans only the export range (sync bar in/out points) instead of the whole flight
  // -------------------------------
  var col = ctx.columns[0], W = ctx.width, H = ctx.height, s = ctx.state;
  var scale = Math.min(W / 520, H / 160);  // sizes scale with the widget (settings are for the default 520x160)
  var fsz = FONT_SIZE * scale, vsz = VALUE_SIZE * scale, lw = LINE_WIDTH * scale;
  // top leaves room for the ascenders of the topmost axis number so it is not clipped
  var left = AXIS_LABELS ? fsz * 3.2 : 6 * scale, bottom = TITLE ? fsz + 10 * scale : 6 * scale, top = Math.max(6 * scale, fsz * 0.6), right = 8 * scale;
  var cw = W - left - right, ch = H - top - bottom;
  // cache key includes every setting the cached curve depends on, so editing them takes effect,
  // and ctx.dataVersion, so a widget rendered before the CSV finished loading picks the data up
  var er = (CLIP_TO_RANGE && ctx.exportRange) ? ctx.exportRange : null;
  var key = col + '|' + MAX_POINTS + '|' + SMOOTH_MS + '|' + (er ? er.from + '-' + er.to : 'all') + '|' + ctx.dataVersion;
  if (s.key !== key) {
    var raw = er ? ctx.range(col, er.from, er.to, MAX_POINTS) : ctx.all(col, MAX_POINTS), st0 = ctx.stats(col);
    if (er) { // keep only the export range (ends interpolated exactly at its edges) and scale the axis to it
      var cl = [], mn = Infinity, mx = -Infinity, q, p0, p1;
      for (q = 0; q < raw.length; q++) {
        p0 = raw[q];
        if (p0.t < er.from) { p1 = raw[q + 1]; if (p1 && p1.t > er.from && typeof p0.v === 'number' && typeof p1.v === 'number') cl.push({ t: er.from, v: p0.v + (p1.v - p0.v) * (er.from - p0.t) / (p1.t - p0.t) }); }
        else if (p0.t > er.to) { p1 = raw[q - 1]; if (p1 && p1.t < er.to && typeof p0.v === 'number' && typeof p1.v === 'number') cl.push({ t: er.to, v: p1.v + (p0.v - p1.v) * (er.to - p1.t) / (p0.t - p1.t) }); break; }
        else cl.push(p0);
      }
      for (q = 0; q < cl.length; q++) if (typeof cl[q].v === 'number') { if (cl[q].v < mn) mn = cl[q].v; if (cl[q].v > mx) mx = cl[q].v; }
      raw = cl; st0 = isFinite(mn) ? { min: mn, max: mx } : null;
    }
    if (SMOOTH_MS > 0) {
      // centered moving average (sliding-window sum, O(n))
      var sm = [], lo = 0, hi = 0, sum = 0, cnt = 0, j;
      for (j = 0; j < raw.length; j++) {
        var tj = raw[j].t;
        while (hi < raw.length && raw[hi].t <= tj + SMOOTH_MS / 2) { if (typeof raw[hi].v === 'number') { sum += raw[hi].v; cnt++; } hi++; }
        while (lo < raw.length && raw[lo].t < tj - SMOOTH_MS / 2) { if (typeof raw[lo].v === 'number') { sum -= raw[lo].v; cnt--; } lo++; }
        sm.push({ t: tj, v: cnt > 0 ? sum / cnt : raw[j].v });
      }
      raw = sm;
    }
    s.pts = raw; s.key = key; s.st = st0;
  }
  var pts = s.pts, st = s.st;
  if (!pts.length || !st) return '<div style="color:#fff;font:12px Arial">no data for ' + col + (er ? ' in the export range' : '') + '</div>';
  var t0 = er ? er.from : pts[0].t, t1 = er ? er.to : pts[pts.length - 1].t; if (t1 === t0) t1 = t0 + 1;
  var min = MIN !== null ? MIN : (BASELINE === 'zero' ? Math.min(0, st.min * MULTIPLIER) : st.min * MULTIPLIER);
  var max = MAX !== null ? MAX : st.max * MULTIPLIER; if (max === min) max = min + 1;
  function X(t) { return left + (t - t0) / (t1 - t0) * cw; }
  function Y(v) { return top + ch - (v * MULTIPLIER - min) / (max - min) * ch; }
  var d = '', first = true;
  pts.forEach(function (p) { if (typeof p.v !== 'number') return; d += (first ? 'M' : 'L') + X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); first = false; });
  var area = d ? d + 'L' + X(t1).toFixed(1) + ',' + (top + ch) + 'L' + X(t0).toFixed(1) + ',' + (top + ch) + 'Z' : '';
  var sh = SHADOW ? 'text-shadow:0 0 3px #000,0 0 3px #000;' : '';
  var svg = '';
  for (var i = 0; i <= GRID_LINES; i++) {
    var y = top + ch - ch * i / GRID_LINES, val = min + (max - min) * i / GRID_LINES;
    svg += '<line class="grid" x1="' + left + '" x2="' + (W - right) + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID_COLOR + '" stroke-width="' + Math.max(0.5, scale).toFixed(2) + '"/>';
    if (AXIS_LABELS) svg += '<text class="axis" x="' + (left - 6 * scale).toFixed(1) + '" y="' + (y + fsz * 0.35).toFixed(1) + '" text-anchor="end" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + fsz.toFixed(1) + '" font-weight="bold" style="' + sh + '">' + val.toFixed(DIGITS) + '</text>';
  }
  svg += '<path class="area" d="' + area + '" fill="' + FILL_COLOR + '"/><path class="line" d="' + d + '" fill="none" stroke="' + LINE_COLOR + '" stroke-width="' + lw.toFixed(2) + '"/>';
  var v = ctx.values[0], inRange = time >= t0 && time <= t1;
  if (SMOOTH_MS > 0 && inRange && pts.length > 1) {
    // dot and value label follow the smoothed curve
    var a = 0, b = pts.length - 1, m;
    while (b - a > 1) { m = (a + b) >> 1; if (pts[m].t <= time) a = m; else b = m; }
    var pa = pts[a], pb = pts[b];
    if (typeof pa.v === 'number' && typeof pb.v === 'number') v = pb.t > pa.t ? pa.v + (pb.v - pa.v) * (time - pa.t) / (pb.t - pa.t) : pa.v;
  }
  if (inRange) {
    var mx = X(time), my = typeof v === 'number' ? Y(v) : top + ch;
    svg += '<line class="marker" x1="' + mx + '" x2="' + mx + '" y1="' + my + '" y2="' + (top + ch) + '" stroke="' + MARKER_COLOR + '" stroke-width="' + (MARKER_WIDTH * scale).toFixed(2) + '"/>';
    if (DOT && typeof v === 'number') svg += '<circle class="dot" cx="' + mx + '" cy="' + my + '" r="' + (DOT_SIZE * scale).toFixed(2) + '" fill="' + DOT_COLOR + '" stroke="' + MARKER_COLOR + '" stroke-width="' + (2 * scale).toFixed(2) + '"/>';
    var label = typeof v === 'number' ? (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT : '--';
    var lx = mx + 8 * scale, anchor = 'start'; if (mx > W - right - vsz * 4) { lx = mx - 8 * scale; anchor = 'end'; }
    svg += '<text class="value" x="' + lx.toFixed(1) + '" y="' + Math.max(top + vsz, my - 6 * scale).toFixed(1) + '" text-anchor="' + anchor + '" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + vsz.toFixed(1) + '" font-weight="bold" style="' + sh + '">' + label + '</text>';
  }
  if (TITLE) svg += '<text class="title" x="' + (left + cw / 2).toFixed(1) + '" y="' + (H - 4 * scale).toFixed(1) + '" text-anchor="middle" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + fsz.toFixed(1) + '" font-weight="bold" style="' + sh + '">' + TITLE + '</text>';
  return '<svg id="flightgraph" width="' + W + '" height="' + H + '" style="background:' + BG + '">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Altitude profile',
    columns: 'BaroAlt (m)',
    w: 520,
    h: 140,
    settings: defs([
      { group: { name: 'Data', items: [
        { name: 'Multiplier', type: 'number', default: 1, step: 0.1, description: 'value scaling (0.01 = cm -> m)' },
        { name: 'Unit', type: 'text', default: 'm' },
        { name: 'Digits', type: 'int', default: 0, min: 0, max: 6 },
        { name: 'Max points', type: 'int', default: 600, min: 50 },
        { name: 'Smoothing ms', type: 'int', default: 1000, min: 0, description: 'moving-average window in ms that filters out quick small jumps (0 = off)' },
        { name: 'Clip to range', type: 'bool', default: false, description: 'show only the export range (sync bar in/out points) instead of the whole flight' },
      ] } },
      { group: { name: 'Profile', items: [
        { name: 'Fill top', type: 'color_picker', default: 'rgba(120,200,120,.9)', description: 'gradient top color' },
        { name: 'Fill bottom', type: 'color_picker', default: 'rgba(40,90,40,.6)', description: 'gradient bottom color' },
        { name: 'Line color', type: 'color_picker', default: '#ffffff' },
        { name: 'Line width', type: 'number', default: 1.5, min: 0, step: 0.5, description: 'at the default 520x140 size; scales with the widget (like all sizes below)' },
      ] } },
      { group: { name: 'Marker', items: [
        { name: 'Dot color', type: 'color_picker', default: '#ff3030' },
        { name: 'Dot size', type: 'int', default: 6, min: 0 },
      ] } },
      { group: { name: 'Text & box', items: [
        { name: 'Label', type: 'text', default: 'ALT', description: "caption in the top-left corner ('' = none)" },
        { name: 'Text color', type: 'color_picker', default: '#ffffff' },
        { name: 'Font', type: 'text', default: 'Arial' },
        { name: 'Font size', type: 'int', default: 14, min: 6 },
        { name: 'Show minmax', type: 'bool', default: true, description: 'print flight min/max in the corner' },
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.35)' },
        { name: 'Radius', type: 'int', default: 8, min: 0 },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // Altitude over the whole flight with a dot moving along the profile.
  // ---------- SETTINGS ----------
  var MULTIPLIER    = settings.multiplier.value;    // value scaling (0.01 = cm -> m)
  var UNIT          = settings.unit.value;
  var DIGITS        = settings.digits.value;
  var LABEL         = settings.label.value;         // caption in the top-left corner ('' = none)
  var FILL_TOP      = settings.fill_top.value;      // gradient top color
  var FILL_BOTTOM   = settings.fill_bottom.value;   // gradient bottom color
  var LINE_COLOR    = settings.line_color.value;
  var LINE_WIDTH    = settings.line_width.value;    // at the default 520x140 size; scales with the widget (like all sizes below)
  var DOT_COLOR     = settings.dot_color.value;
  var DOT_SIZE      = settings.dot_size.value;
  var TEXT_COLOR    = settings.text_color.value;
  var FONT          = settings.font.value;
  var FONT_SIZE     = settings.font_size.value;
  var SHOW_MINMAX   = settings.show_minmax.value;   // print flight min/max in the corner
  var BG            = settings.background.value;
  var RADIUS        = settings.radius.value;
  var MAX_POINTS    = settings.max_points.value;
  var SMOOTH_MS     = settings.smoothing_ms.value;  // moving-average window (ms) smoothing the profile and the value (0 = off)
  var CLIP_TO_RANGE = settings.clip_to_range.value; // true = the profile spans only the export range (sync bar in/out points) instead of the whole flight
  // -------------------------------
  var col = ctx.columns[0], W = ctx.width, H = ctx.height, s = ctx.state;
  var scale = Math.min(W / 520, H / 140);  // sizes scale with the widget (settings are for the default 520x140)
  var fsz = FONT_SIZE * scale, pad = 8 * scale;
  // cache key includes every setting the cached curve depends on, so editing them takes effect,
  // and ctx.dataVersion, so a widget rendered before the CSV finished loading picks the data up
  var er = (CLIP_TO_RANGE && ctx.exportRange) ? ctx.exportRange : null;
  var key = col + '|' + MAX_POINTS + '|' + SMOOTH_MS + '|' + (er ? er.from + '-' + er.to : 'all') + '|' + ctx.dataVersion;
  if (s.key !== key) {
    var raw = er ? ctx.range(col, er.from, er.to, MAX_POINTS) : ctx.all(col, MAX_POINTS), st0 = ctx.stats(col);
    if (er) { // keep only the export range (ends interpolated exactly at its edges) and scale the axis to it
      var cl = [], mn = Infinity, mx = -Infinity, q, p0, p1;
      for (q = 0; q < raw.length; q++) {
        p0 = raw[q];
        if (p0.t < er.from) { p1 = raw[q + 1]; if (p1 && p1.t > er.from && typeof p0.v === 'number' && typeof p1.v === 'number') cl.push({ t: er.from, v: p0.v + (p1.v - p0.v) * (er.from - p0.t) / (p1.t - p0.t) }); }
        else if (p0.t > er.to) { p1 = raw[q - 1]; if (p1 && p1.t < er.to && typeof p0.v === 'number' && typeof p1.v === 'number') cl.push({ t: er.to, v: p1.v + (p0.v - p1.v) * (er.to - p1.t) / (p0.t - p1.t) }); break; }
        else cl.push(p0);
      }
      for (q = 0; q < cl.length; q++) if (typeof cl[q].v === 'number') { if (cl[q].v < mn) mn = cl[q].v; if (cl[q].v > mx) mx = cl[q].v; }
      raw = cl; st0 = isFinite(mn) ? { min: mn, max: mx } : null;
    }
    if (SMOOTH_MS > 0) {
      // centered moving average (sliding-window sum, O(n))
      var sm = [], lo = 0, hi = 0, sum = 0, cnt = 0, j;
      for (j = 0; j < raw.length; j++) {
        var tj = raw[j].t;
        while (hi < raw.length && raw[hi].t <= tj + SMOOTH_MS / 2) { if (typeof raw[hi].v === 'number') { sum += raw[hi].v; cnt++; } hi++; }
        while (lo < raw.length && raw[lo].t < tj - SMOOTH_MS / 2) { if (typeof raw[lo].v === 'number') { sum -= raw[lo].v; cnt--; } lo++; }
        sm.push({ t: tj, v: cnt > 0 ? sum / cnt : raw[j].v });
      }
      raw = sm;
    }
    s.pts = raw; s.key = key; s.st = st0;
  }
  var pts = s.pts, st = s.st;
  if (!pts.length || !st) return '<div style="color:#fff;font:12px Arial">no data for ' + col + (er ? ' in the export range' : '') + '</div>';
  var t0 = er ? er.from : pts[0].t, t1 = er ? er.to : pts[pts.length - 1].t; if (t1 === t0) t1 = t0 + 1;
  var min = st.min, max = st.max; if (max === min) max = min + 1;
  function X(t) { return pad + (t - t0) / (t1 - t0) * (W - 2 * pad); }
  function Y(v) { return H - pad - (v - min) / (max - min) * (H - 2 * pad - fsz); }
  var d = '', first = true;
  pts.forEach(function (p) { if (typeof p.v !== 'number') return; d += (first ? 'M' : 'L') + X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); first = false; });
  var area = d + 'L' + X(t1).toFixed(1) + ',' + (H - pad).toFixed(1) + 'L' + X(t0).toFixed(1) + ',' + (H - pad).toFixed(1) + 'Z';
  var id = 'g' + Math.abs(W * 31 + H);
  var svg = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + FILL_TOP + '"/><stop offset="1" stop-color="' + FILL_BOTTOM + '"/></linearGradient></defs>';
  svg += '<path class="area" d="' + area + '" fill="url(#' + id + ')"/><path class="line" d="' + d + '" fill="none" stroke="' + LINE_COLOR + '" stroke-width="' + (LINE_WIDTH * scale).toFixed(2) + '"/>';
  var v = ctx.values[0], sh = 'text-shadow:0 0 3px #000;';
  if (SMOOTH_MS > 0 && time >= t0 && time <= t1 && pts.length > 1) {
    // dot and value label follow the smoothed profile
    var a = 0, b = pts.length - 1, m;
    while (b - a > 1) { m = (a + b) >> 1; if (pts[m].t <= time) a = m; else b = m; }
    var pa = pts[a], pb = pts[b];
    if (typeof pa.v === 'number' && typeof pb.v === 'number') v = pb.t > pa.t ? pa.v + (pb.v - pa.v) * (time - pa.t) / (pb.t - pa.t) : pa.v;
  }
  if (typeof v === 'number' && time >= t0 && time <= t1) {
    var x = X(time), y = Y(v);
    svg += '<circle class="dot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (DOT_SIZE * scale).toFixed(2) + '" fill="' + DOT_COLOR + '" stroke="#fff" stroke-width="' + (2 * scale).toFixed(2) + '"/>';
    var lx = x + 10 * scale, anchor = 'start'; if (x > W - 80 * scale) { lx = x - 10 * scale; anchor = 'end'; }
    svg += '<text class="value" x="' + lx.toFixed(1) + '" y="' + (y - 8 * scale).toFixed(1) + '" text-anchor="' + anchor + '" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + (fsz * 1.3).toFixed(1) + '" font-weight="bold" style="' + sh + '">' + (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</text>';
  }
  if (LABEL) svg += '<text class="label" x="' + pad.toFixed(1) + '" y="' + (fsz + 2 * scale).toFixed(1) + '" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + fsz.toFixed(1) + '" font-weight="bold" style="' + sh + '">' + LABEL + '</text>';
  if (SHOW_MINMAX) svg += '<text class="minmax" x="' + (W - pad).toFixed(1) + '" y="' + (fsz + 2 * scale).toFixed(1) + '" text-anchor="end" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + fsz.toFixed(1) + '" style="' + sh + '">min ' + (min * MULTIPLIER).toFixed(DIGITS) + ' / max ' + (max * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</text>';
  return '<svg id="profile" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: RC sticks',
    columns: 'rcCommand[0], rcCommand[1], rcCommand[2], rcCommand[3]',
    w: 260,
    h: 130,
    settings: defs([
      { group: { name: 'Sticks', items: [
        { name: 'Mode', type: 'select', default: 2, values: { '1': 'Mode 1 (left stick = pitch/yaw, right = throttle/roll)', '2': 'Mode 2 (left stick = throttle/yaw, right = pitch/roll)' }, description: 'transmitter mode' },
        { name: 'Min', type: 'int', default: -500, description: 'stick range minimum for roll/pitch/yaw (INAV rcCommand is -500..500)' },
        { name: 'Max', type: 'int', default: 500, description: 'stick range maximum for roll/pitch/yaw' },
        { name: 'Center', type: 'int', default: 0, description: 'center value for roll/pitch/yaw' },
        { name: 'Throttle min', type: 'int', default: 1000, description: 'throttle range minimum (1000..2000)' },
        { name: 'Throttle max', type: 'int', default: 2000, description: 'throttle range maximum' },
        { name: 'Invert pitch', type: 'bool', default: false, description: 'flip pitch direction if needed' },
        { name: 'Invert roll', type: 'bool', default: false },
        { name: 'Invert yaw', type: 'bool', default: false },
      ] } },
      { group: { name: 'Look', items: [
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.45)' },
        { name: 'Border', type: 'color_picker', default: 'rgba(255,255,255,.6)' },
        { name: 'Grid', type: 'color_picker', default: 'rgba(255,255,255,.2)' },
        { name: 'Stick color', type: 'color_picker', default: '#f2a93b' },
        { name: 'Stick size', type: 'int', default: 9, min: 1, description: 'at the default 260x130 size; scales with the widget' },
        { name: 'Radius', type: 'int', default: 8, min: 0, description: 'corner radius at the default size; scales with the widget' },
        { name: 'Gap', type: 'int', default: 10, min: 0, description: 'gap between the two boxes at the default size; scales with the widget' },
      ] } },
      { group: { name: 'Trail', items: [
        { name: 'Trail', type: 'bool', default: true, description: 'short trail of the stick movement' },
        { name: 'Trail ms', type: 'int', default: 600, min: 0, description: 'trail length in ms' },
        { name: 'Trail color', type: 'color_picker', default: 'rgba(242,169,59,.5)' },
      ] } },
      { group: { name: 'Labels', items: [
        { name: 'Labels', type: 'bool', default: true, description: 'T/Y/P/R labels' },
        { name: 'Label color', type: 'color_picker', default: 'rgba(255,255,255,.7)' },
        { name: 'Label size', type: 'int', default: 10, min: 4, description: 'label font size at the default 260x130 size; scales with the widget' },
        { name: 'Label font', type: 'text', default: 'Arial', description: 'label font family' },
        { name: 'Label bold', type: 'bool', default: false },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // Transmitter sticks: columns = roll, pitch, yaw, throttle (INAV rcCommand[0..3]).
  // ---------- SETTINGS ----------
  var MODE         = settings.mode.value;         // 1 or 2 (Mode 2: left stick = throttle/yaw, right = pitch/roll)
  var MIN          = settings.min.value;          // stick range for roll/pitch/yaw (INAV rcCommand is -500..500)
  var MAX          = settings.max.value;
  var CENTER       = settings.center.value;       // center value for roll/pitch/yaw
  var THR_MIN      = settings.throttle_min.value; // throttle range (1000..2000)
  var THR_MAX      = settings.throttle_max.value;
  var INVERT_PITCH = settings.invert_pitch.value; // flip pitch direction if needed
  var INVERT_ROLL  = settings.invert_roll.value;
  var INVERT_YAW   = settings.invert_yaw.value;
  var BG           = settings.background.value;
  var BORDER       = settings.border.value;
  var GRID         = settings.grid.value;
  var STICK_COLOR  = settings.stick_color.value;
  var STICK_SIZE   = settings.stick_size.value;   // at the default 260x130 size; scales with the widget
  var TRAIL        = settings.trail.value;        // short trail of the stick movement
  var TRAIL_MS     = settings.trail_ms.value;
  var TRAIL_COLOR  = settings.trail_color.value;
  var LABELS       = settings.labels.value;       // T/Y/P/R labels
  var LABEL_COLOR  = settings.label_color.value;
  var LABEL_SIZE   = settings.label_size.value;   // label font size at the default 260x130 size; scales with the widget
  var LABEL_FONT   = settings.label_font.value;   // label font family
  var LABEL_BOLD   = settings.label_bold.value;
  var RADIUS       = settings.radius.value;       // corner radius at the default size; scales with the widget
  var GAP          = settings.gap.value;          // gap between the two boxes at the default size; scales with the widget
  // -------------------------------
  var W = ctx.width, H = ctx.height;
  var scale = Math.min(H, W / 2) / 125;  // all sizes scale with the widget (settings are for the default 260x130)
  var gap = GAP * scale, stickR = STICK_SIZE * scale, labelSize = LABEL_SIZE * scale, radius = RADIUS * scale;
  var lineW = Math.max(1, 1.5 * scale);  // box border + stick outline width
  var gridW = Math.max(0.5, scale);      // divider (grid) line width
  var size = Math.min(H, (W - gap) / 2), pad = stickR + 2 * scale;
  var x0 = (W - (2 * size + gap)) / 2, y0 = (H - size) / 2;
  function norm(v, lo, hi) { v = typeof v === 'number' ? v : (lo + hi) / 2; return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); }
  var roll = norm(ctx.values[0], MIN, MAX), pitch = norm(ctx.values[1], MIN, MAX), yaw = norm(ctx.values[2], MIN, MAX), thr = norm(ctx.values[3], THR_MIN, THR_MAX);
  if (INVERT_ROLL) roll = 1 - roll; if (INVERT_PITCH) pitch = 1 - pitch; if (INVERT_YAW) yaw = 1 - yaw;
  // Mode 2: left = (yaw, throttle), right = (roll, pitch). Mode 1 swaps throttle/pitch.
  var left  = MODE === 1 ? [yaw, pitch] : [yaw, thr];
  var right = MODE === 1 ? [roll, thr]  : [roll, pitch];
  var trail = { l: [], r: [] };
  if (TRAIL) {
    var cols = ctx.columns, n = 12, i, tt;
    for (i = 0; i < n; i++) {
      tt = time - TRAIL_MS + TRAIL_MS * i / n;
      var r0 = ctx.range(cols[0], tt, tt + 1, 1)[0], p0 = ctx.range(cols[1], tt, tt + 1, 1)[0], y0v = ctx.range(cols[2], tt, tt + 1, 1)[0], t0v = ctx.range(cols[3], tt, tt + 1, 1)[0];
      if (!r0 || !p0 || !y0v || !t0v) continue;
      var rr = norm(r0.v, MIN, MAX), pp = norm(p0.v, MIN, MAX), yy = norm(y0v.v, MIN, MAX), th = norm(t0v.v, THR_MIN, THR_MAX);
      if (INVERT_ROLL) rr = 1 - rr; if (INVERT_PITCH) pp = 1 - pp; if (INVERT_YAW) yy = 1 - yy;
      trail.l.push(MODE === 1 ? [yy, pp] : [yy, th]); trail.r.push(MODE === 1 ? [rr, th] : [rr, pp]);
    }
  }
  function box(id, bx, pos, tr, lab) {
    var cx = bx + pad + pos[0] * (size - 2 * pad), cy = y0 + size - pad - pos[1] * (size - 2 * pad);
    var g = '<g id="' + id + '" class="stickbox"><rect class="box" x="' + bx + '" y="' + y0 + '" width="' + size + '" height="' + size + '" rx="' + radius.toFixed(1) + '" fill="' + BG + '" stroke="' + BORDER + '" stroke-width="' + lineW.toFixed(2) + '"/>';
    g += '<line class="grid" x1="' + (bx + size / 2) + '" x2="' + (bx + size / 2) + '" y1="' + y0 + '" y2="' + (y0 + size) + '" stroke="' + GRID + '" stroke-width="' + gridW.toFixed(2) + '"/>';
    g += '<line class="grid" x1="' + bx + '" x2="' + (bx + size) + '" y1="' + (y0 + size / 2) + '" y2="' + (y0 + size / 2) + '" stroke="' + GRID + '" stroke-width="' + gridW.toFixed(2) + '"/>';
    if (tr.length > 1) g += '<polyline class="trail" points="' + tr.map(function (p) { return (bx + pad + p[0] * (size - 2 * pad)).toFixed(1) + ',' + (y0 + size - pad - p[1] * (size - 2 * pad)).toFixed(1); }).join(' ') + ' ' + cx.toFixed(1) + ',' + cy.toFixed(1) + '" fill="none" stroke="' + TRAIL_COLOR + '" stroke-width="' + (2 * scale).toFixed(2) + '" stroke-linecap="round"/>';
    g += '<circle class="stick" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + stickR.toFixed(1) + '" fill="' + STICK_COLOR + '" stroke="#000" stroke-width="' + lineW.toFixed(2) + '"/>';
    var fw = LABEL_BOLD ? ' font-weight="bold"' : '';
    if (LABELS) g += '<text class="label label-top" x="' + (bx + 5 * scale).toFixed(1) + '" y="' + (y0 + labelSize + 2 * scale).toFixed(1) + '" fill="' + LABEL_COLOR + '" font-family="' + LABEL_FONT + '" font-size="' + labelSize.toFixed(1) + '"' + fw + '>' + lab[0] + '</text><text class="label label-bottom" x="' + (bx + size - 5 * scale).toFixed(1) + '" y="' + (y0 + size - 5 * scale).toFixed(1) + '" text-anchor="end" fill="' + LABEL_COLOR + '" font-family="' + LABEL_FONT + '" font-size="' + labelSize.toFixed(1) + '"' + fw + '>' + lab[1] + '</text>';
    return g + '</g>';
  }
  var svg = box('box-left', x0, left, trail.l, MODE === 1 ? ['PITCH', 'YAW'] : ['THR', 'YAW']) + box('box-right', x0 + size + gap, right, trail.r, MODE === 1 ? ['THR', 'ROLL'] : ['PITCH', 'ROLL']);
  return '<svg id="sticks" width="' + W + '" height="' + H + '">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: GPS map',
    columns: 'GPS_coord[0], GPS_coord[1], heading',
    w: 300,
    h: 300,
    settings: defs([
      { group: { name: 'Map', items: [
        { name: 'Map style', type: 'select', default: 'osm', values: { osm: 'OpenStreetMap', 'carto-dark': 'CARTO dark', 'carto-light': 'CARTO light', none: 'no map' }, description: 'tile provider (CARTO may show "API key required" tiles for some networks)' },
        { name: 'Map opacity', type: 'number', default: 0.55, min: 0, max: 1, step: 0.05, description: 'map tile opacity – keep low to be unobtrusive' },
        { name: 'Map grayscale', type: 'bool', default: true, description: 'desaturate the map' },
        { name: 'Mode', type: 'select', default: 'follow', values: { fit: 'fit (whole flight fits the box)', follow: 'follow (follow the aircraft at Zoom)' }, description: "'fit' = whole flight fits the box, 'follow' = follow aircraft at ZOOM" },
        { name: 'Zoom', type: 'int', default: 17, min: 1, max: 19, description: "zoom for 'follow' mode" },
        { name: 'Rotate map', type: 'bool', default: false, description: "'follow' mode: rotate the map so heading points up" },
        { name: 'Padding', type: 'int', default: 10, min: 0, description: "px kept free around the track in 'fit' mode" },
        { name: 'Show attribution', type: 'bool', default: true, description: 'tile providers require attribution' },
        { name: 'Clip to range', type: 'bool', default: false, description: 'show only the export range (sync bar in/out points) instead of the whole flight' },
      ] } },
      { group: { name: 'Track', items: [
        { name: 'Track color', type: 'color_picker', default: 'rgba(255,255,255,.9)' },
        { name: 'Track width', type: 'number', default: 2, min: 0, step: 0.5 },
        { name: 'Trail color', type: 'color_picker', default: '#00ffff', description: "already-flown part of the track ('' = same as the track)" },
        { name: 'Trail width', type: 'number', default: 3, min: 0, step: 0.5 },
        { name: 'Smoothing ms', type: 'int', default: 500, min: 0, description: 'smoothing window in ms for position & heading (0 = off)' },
      ] } },
      { group: { name: 'Aircraft', items: [
        { name: 'Arrow style', type: 'select', default: 'dot', values: ['arrow', 'plane', 'chevron', 'dot'], description: "'arrow' | 'plane' | 'chevron' | 'dot'" },
        { name: 'Arrow size', type: 'int', default: 25, min: 2 },
        { name: 'Arrow color', type: 'color_picker', default: '#ff3030' },
        { name: 'Arrow stroke', type: 'color_picker', default: '#ffffff' },
        { name: 'Heading unit', type: 'select', default: 'deg', values: ['deg', 'decideg', 'rad'], description: "unit of the heading column ('decideg' = value / 10, INAV attitude[2])" },
        { name: 'Heading offset', type: 'int', default: -90, description: 'degrees added if the arrow points the wrong way' },
      ] } },
      { group: { name: 'Box', items: [
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.45)' },
        { name: 'Radius', type: 'int', default: 10, min: 0 },
        { name: 'Border width', type: 'int', default: 1, min: 0 },
        { name: 'Border color', type: 'color_picker', default: 'rgba(255,255,255,.4)' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // ---------- SETTINGS ----------
  // columns: 0 = latitude, 1 = longitude, 2 = heading (optional)
  var MAP_STYLE        = settings.map_style.value;                                                // 'osm' | 'carto-dark' | 'carto-light' | 'none'  (CARTO may show "API key required" tiles for some networks)
  var MAP_OPACITY      = settings.map_opacity.value;                                              // map tile opacity (0..1) – keep low to be unobtrusive
  var MAP_GRAY         = settings.map_grayscale.value;                                            // desaturate the map
  var MODE             = settings.mode.value;                                                     // 'fit' = whole flight fits the box, 'follow' = follow aircraft at ZOOM
  var ZOOM             = settings.zoom.value;                                                     // zoom for 'follow' mode (max 19)
  var ROTATE_MAP       = settings.rotate_map.value;                                               // 'follow' mode: rotate the map so heading points up
  var SMOOTH_MS        = settings.smoothing_ms.value;                                             // smoothing window in ms for position & heading (0 = off)
  var BG               = settings.background.value;
  var RADIUS           = settings.radius.value;
  var BORDER           = settings.border_width.value + 'px solid ' + settings.border_color.value;
  var PADDING          = settings.padding.value;                                                  // px kept free around the track in 'fit' mode
  var TRACK_COLOR      = settings.track_color.value;
  var TRACK_WIDTH      = settings.track_width.value;
  var TRAIL_COLOR      = settings.trail_color.value;                                              // already-flown part of the track ('' = same as TRACK_COLOR)
  var TRAIL_WIDTH      = settings.trail_width.value;
  var ARROW_STYLE      = settings.arrow_style.value;                                              // 'arrow' | 'plane' | 'chevron' | 'dot'
  var ARROW_SIZE       = settings.arrow_size.value;
  var ARROW_COLOR      = settings.arrow_color.value;
  var ARROW_STROKE     = settings.arrow_stroke.value;
  var HEADING_UNIT     = settings.heading_unit.value;                                             // 'deg' | 'decideg' (value/10) | 'rad'
  var HEADING_OFFSET   = settings.heading_offset.value;                                           // add degrees if the arrow points the wrong way
  var SHOW_ATTRIBUTION = settings.show_attribution.value;                                         // tile providers require attribution
  var CLIP_TO_RANGE    = settings.clip_to_range.value;                                            // true = only the part of the track inside the export range (sync bar in/out points) is drawn and fitted
  // -------------------------------
  var TILES = {
    'osm':         ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap'],
    'carto-dark':  ['https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', '© OpenStreetMap © CARTO'],
    'carto-light': ['https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', '© OpenStreetMap © CARTO']
  };
  var W = ctx.width, H = ctx.height, TS = 256;
  var s = ctx.state;
  function px(lat, lon, z) { // Web-Mercator pixel coords at zoom z
    var n = Math.pow(2, z) * TS, r = lat * Math.PI / 180;
    return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
  }
  // the track is loaded once and again whenever the telemetry files (ctx.dataVersion), the
  // columns or the export range change — a widget rendered before the CSV finished loading
  // would otherwise keep an empty track forever
  var er = (CLIP_TO_RANGE && ctx.exportRange) ? ctx.exportRange : null;
  var pathKey = ctx.columns[0] + '|' + ctx.columns[1] + '|' + (er ? er.from + '-' + er.to : 'all') + '|' + ctx.dataVersion;
  if (s.pathKey !== pathKey) {
    var lat = er ? ctx.range(ctx.columns[0], er.from, er.to, 4000) : ctx.all(ctx.columns[0], 4000);
    var lon = er ? ctx.range(ctx.columns[1], er.from, er.to, 4000) : ctx.all(ctx.columns[1], 4000);
    var n = Math.min(lat.length, lon.length), i;
    s.pathKey = pathKey; s.path = []; s.minLat = 90; s.maxLat = -90; s.minLon = 180; s.maxLon = -180;
    for (i = 0; i < n; i++) {
      var la = lat[i].v, lo = lon[i].v;
      if (typeof la !== 'number' || typeof lo !== 'number' || (Math.abs(la) < 0.001 && Math.abs(lo) < 0.001)) continue;
      if (er && (lat[i].t < er.from || lat[i].t > er.to)) continue;
      s.path.push({ t: lat[i].t, lat: la, lon: lo });
      if (la < s.minLat) s.minLat = la; if (la > s.maxLat) s.maxLat = la; if (lo < s.minLon) s.minLon = lo; if (lo > s.maxLon) s.maxLon = lo;
    }
    s.proj = {}; s.fitW = -1; // projected coords and the fit zoom depend on the track
  }
  if (s.fitW !== W || s.fitH !== H || s.fitPad !== PADDING) { // (re)compute fit zoom when the box is resized
    s.fitW = W; s.fitH = H; s.fitPad = PADDING; s.fitZoom = 1;
    for (var z = 19; z >= 1; z--) {
      var a = px(s.maxLat, s.minLon, z), b = px(s.minLat, s.maxLon, z);
      if (b[0] - a[0] <= W - 2 * PADDING && b[1] - a[1] <= H - 2 * PADDING) { s.fitZoom = z; break; }
    }
  }
  if (!s.path.length) return '<div style="width:100%;height:100%;background:' + BG + ';border-radius:' + RADIUS + 'px;color:#fff;font:12px Arial;display:flex;align-items:center;justify-content:center">no GPS data' + (er ? ' in the export range' : '') + '</div>';
  var lat0 = ctx.values[0], lon0 = ctx.values[1], hasPos = typeof lat0 === 'number' && typeof lon0 === 'number' && !(Math.abs(lat0) < 0.001 && Math.abs(lon0) < 0.001);
  function idxAt(t) { var a = 0, b = s.path.length - 1, m; while (a < b) { m = (a + b) >> 1; if (s.path[m].t < t) a = m + 1; else b = m; } return a; }
  function smoothPos(t, la0, lo0) { // triangular-weighted average of track samples around t (deterministic, so seeking/export stay consistent)
    var half = SMOOTH_MS, p = s.path, sum = 0, la = 0, lo = 0, i, w;
    if (!half) return null;
    for (i = idxAt(t - half); i < p.length && p[i].t <= t + half; i++) {
      w = 1 - Math.abs(p[i].t - t) / half; if (w <= 0) continue;
      sum += w; la += p[i].lat * w; lo += p[i].lon * w;
    }
    if (typeof la0 === 'number' && typeof lo0 === 'number') { sum += 1; la += la0; lo += lo0; }
    return sum ? { lat: la / sum, lon: lo / sum } : null;
  }
  var sm = hasPos ? smoothPos(time, lat0, lon0) : null;
  if (sm) { lat0 = sm.lat; lon0 = sm.lon; }
  var zoom = MODE === 'follow' ? Math.min(19, ZOOM) : s.fitZoom;
  var c;
  if (MODE === 'follow' && hasPos) c = px(lat0, lon0, zoom);
  else { var a1 = px(s.maxLat, s.minLon, zoom), b1 = px(s.minLat, s.maxLon, zoom); c = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2]; }
  var ox = c[0] - W / 2, oy = c[1] - H / 2;
  // heading
  var hd = ctx.values[2];
  function toDeg(v) { return HEADING_UNIT === 'decideg' ? v / 10 : HEADING_UNIT === 'rad' ? v * 180 / Math.PI : v; }
  if (typeof hd === 'number') {
    hd = toDeg(hd);
    if (SMOOTH_MS) { // circular (vector) average so the 359->0 wrap doesn't spin the arrow
      var hsam = ctx.range(ctx.columns[2], time - SMOOTH_MS, time + SMOOTH_MS, 200) || [], sx = 0, sy = 0, wsum = 0;
      for (var h2 = 0; h2 < hsam.length; h2++) {
        if (typeof hsam[h2].v !== 'number') continue;
        var hw = 1 - Math.abs(hsam[h2].t - time) / SMOOTH_MS; if (hw <= 0) continue;
        var hr = toDeg(hsam[h2].v) * Math.PI / 180;
        sx += Math.cos(hr) * hw; sy += Math.sin(hr) * hw; wsum += hw;
      }
      if (wsum) hd = Math.atan2(sy, sx) * 180 / Math.PI;
    }
    hd += HEADING_OFFSET;
  } else { // fall back to direction of travel (over the smoothed track when smoothing is on)
    var dtH = Math.max(SMOOTH_MS, 250), q1 = smoothPos(time - dtH), q2 = smoothPos(time + dtH);
    if (q1 && q2 && (q1.lat !== q2.lat || q1.lon !== q2.lon)) {
      var pp1 = px(q1.lat, q1.lon, zoom), pp2 = px(q2.lat, q2.lon, zoom);
      hd = Math.atan2(pp2[0] - pp1[0], -(pp2[1] - pp1[1])) * 180 / Math.PI;
    } else {
      var idx = -1; for (var k = 0; k < s.path.length; k++) if (s.path[k].t <= time) idx = k; else break;
      if (idx > 0) { var p1 = px(s.path[idx - 1].lat, s.path[idx - 1].lon, zoom), p2 = px(s.path[idx].lat, s.path[idx].lon, zoom); hd = Math.atan2(p2[0] - p1[0], -(p2[1] - p1[1])) * 180 / Math.PI; } else hd = 0;
    }
  }
  var rot = (MODE === 'follow' && ROTATE_MAP) ? -hd : 0;
  // tiles
  var tiles = '';
  if (MAP_STYLE !== 'none' && TILES[MAP_STYLE]) {
    var url = TILES[MAP_STYLE][0], maxT = Math.pow(2, zoom);
    var ext = rot ? Math.ceil(Math.max(W, H) * 0.42) : 0; // extra tiles when rotating
    var tx0 = Math.floor((ox - ext) / TS), tx1 = Math.floor((ox + W + ext) / TS), ty0 = Math.floor((oy - ext) / TS), ty1 = Math.floor((oy + H + ext) / TS);
    var filt = MAP_GRAY ? 'filter:grayscale(1);' : '';
    var failed = 0, loading = 0;
    for (var tx = tx0; tx <= tx1; tx++) for (var ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= maxT) continue;
      var wx = ((tx % maxT) + maxT) % maxT;
      var src = ctx.image(url.replace('{z}', zoom).replace('{x}', wx).replace('{y}', ty));
      if (src) tiles += '<img class="tile" src="' + src + '" style="position:absolute;left:' + (tx * TS - ox) + 'px;top:' + (ty * TS - oy) + 'px;width:' + TS + 'px;height:' + TS + 'px;' + filt + '"/>';
      else if (src === null) failed++; else loading++;
    }
    if (failed) tiles += '<div class="status status-error" style="position:absolute;left:4px;top:4px;font:10px Arial;color:#f88;text-shadow:0 0 2px #000">' + failed + ' map tiles failed to load (offline?)</div>';
    else if (loading) tiles += '<div class="status status-loading" style="position:absolute;left:4px;top:4px;font:10px Arial;color:#ccc;text-shadow:0 0 2px #000">loading map…</div>';
  }
  // track (projected coords cached per zoom)
  var key = 'z' + zoom;
  if (!s.proj[key]) s.proj[key] = s.path.map(function (p) { var q = px(p.lat, p.lon, zoom); return [q[0], q[1], p.t]; });
  var pr = s.proj[key], full = [], trail = [];
  for (var j = 0; j < pr.length; j++) {
    var str = (pr[j][0] - ox).toFixed(1) + ',' + (pr[j][1] - oy).toFixed(1);
    full.push(str); if (pr[j][2] <= time) trail.push(str);
  }
  if (hasPos && trail.length && (!er || time <= er.to)) { var tip = px(lat0, lon0, zoom); trail.push((tip[0] - ox).toFixed(1) + ',' + (tip[1] - oy).toFixed(1)); }
  var svg = '<polyline class="track" points="' + full.join(' ') + '" fill="none" stroke="' + TRACK_COLOR + '" stroke-width="' + TRACK_WIDTH + '" stroke-linejoin="round"/>';
  if (TRAIL_COLOR && trail.length > 1) svg += '<polyline class="trail" points="' + trail.join(' ') + '" fill="none" stroke="' + TRAIL_COLOR + '" stroke-width="' + TRAIL_WIDTH + '" stroke-linejoin="round"/>';
  if (hasPos) {
    var q = px(lat0, lon0, zoom), ax = q[0] - ox, ay = q[1] - oy, r = ARROW_SIZE / 2, shape;
    if (ARROW_STYLE === 'dot') shape = '<circle r="' + (r * 0.6) + '"/>';
    else if (ARROW_STYLE === 'chevron') shape = '<path d="M0,' + (-r) + ' L' + r + ',' + r + ' L0,' + (r * 0.4) + ' L' + (-r) + ',' + r + ' Z"/>';
    else if (ARROW_STYLE === 'plane') shape = '<path d="M0,' + (-r) + ' L' + (r * 0.25) + ',' + (-r * 0.3) + ' L' + r + ',' + (r * 0.25) + ' L' + r + ',' + (r * 0.5) + ' L' + (r * 0.25) + ',' + (r * 0.2) + ' L' + (r * 0.2) + ',' + (r * 0.75) + ' L' + (r * 0.45) + ',' + r + ' L' + (-r * 0.45) + ',' + r + ' L' + (-r * 0.2) + ',' + (r * 0.75) + ' L' + (-r * 0.25) + ',' + (r * 0.2) + ' L' + (-r) + ',' + (r * 0.5) + ' L' + (-r) + ',' + (r * 0.25) + ' L' + (-r * 0.25) + ',' + (-r * 0.3) + ' Z"/>';
    else shape = '<path d="M0,' + (-r) + ' L' + (r * 0.7) + ',' + r + ' L0,' + (r * 0.55) + ' L' + (-r * 0.7) + ',' + r + ' Z"/>';
    svg += '<g class="arrow" transform="translate(' + ax.toFixed(1) + ',' + ay.toFixed(1) + ') rotate(' + (hd - rot).toFixed(1) + ')" fill="' + ARROW_COLOR + '" stroke="' + ARROW_STROKE + '" stroke-width="1.5" stroke-linejoin="round">' + shape + '</g>';
  }
  var attr = (SHOW_ATTRIBUTION && MAP_STYLE !== 'none' && TILES[MAP_STYLE]) ? '<div class="attribution" style="position:absolute;right:4px;bottom:2px;font:9px Arial;color:rgba(255,255,255,.7);text-shadow:0 0 2px #000">' + TILES[MAP_STYLE][1] + '</div>' : '';
  var tr = rot ? 'transform:rotate(' + rot + 'deg);transform-origin:' + (W / 2) + 'px ' + (H / 2) + 'px;' : '';
  return '<div id="map" class="box" style="position:relative;width:100%;height:100%;overflow:hidden;box-sizing:border-box;background:' + BG + ';border-radius:' + RADIUS + 'px;border:' + BORDER + '">'
    + '<div class="tiles" style="position:absolute;inset:0;opacity:' + MAP_OPACITY + ';' + tr + '">' + tiles + '</div>'
    + '<svg class="overlay" width="' + W + '" height="' + H + '" style="position:absolute;left:0;top:0;' + tr + '">' + svg + '</svg>' + attr + '</div>';
}`,
  },
  {
    name: 'Example: Compass / heading',
    columns: 'heading',
    w: 220,
    h: 60,
    settings: defs([
      { group: { name: 'Heading', items: [
        { name: 'Heading unit', type: 'select', default: 'deg', values: ['deg', 'decideg', 'rad'], description: "unit of the heading column ('decideg' = value / 10, INAV attitude[2])" },
        { name: 'Heading offset', type: 'int', default: -90, description: 'degrees added if the compass points the wrong way' },
        { name: 'Style', type: 'select', default: 'tape', values: { tape: 'tape (sliding ribbon)', rose: 'rose (rotating rose)' }, description: "'tape' (sliding ribbon) | 'rose' (rotating rose)" },
        { name: 'Degrees per px', type: 'number', default: 1, min: 0.1, step: 0.1, description: 'tape: degrees per pixel at the default size (smaller = wider view)' },
      ] } },
      { group: { name: 'Look', items: [
        { name: 'Color', type: 'color_picker', default: '#fff' },
        { name: 'Accent', type: 'color_picker', default: '#ff3030', description: 'needle / center mark' },
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.45)' },
        { name: 'Radius', type: 'int', default: 8, min: 0, description: 'at the default 220x60 size; scales with the widget (like all sizes below)' },
        { name: 'Font size', type: 'int', default: 14, min: 6 },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // ---------- SETTINGS ----------
  var HEADING_UNIT   = settings.heading_unit.value;   // 'deg' | 'decideg' | 'rad'
  var HEADING_OFFSET = settings.heading_offset.value; // add degrees if the compass points the wrong way
  var STYLE          = settings.style.value;          // 'tape' (sliding ribbon) | 'rose' (rotating rose)
  var COLOR          = settings.color.value;
  var ACCENT         = settings.accent.value;         // needle / center mark
  var BG             = settings.background.value;
  var RADIUS         = settings.radius.value;         // at the default 220x60 size; scales with the widget (like all sizes below)
  var FONT_SIZE      = settings.font_size.value;
  var DEG_PER_PX     = settings.degrees_per_px.value; // tape: degrees per pixel at the default size (smaller = wider view)
  // -------------------------------
  var hd = ctx.values[0]; if (typeof hd !== 'number') hd = 0;
  if (HEADING_UNIT === 'decideg') hd /= 10; else if (HEADING_UNIT === 'rad') hd = hd * 180 / Math.PI;
  hd = ((hd + HEADING_OFFSET) % 360 + 360) % 360;
  var W = ctx.width, H = ctx.height, names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' };
  var scale = Math.min(W / 220, H / 60);  // sizes scale with the widget (settings are for the default 220x60)
  var fsz = FONT_SIZE * scale;
  var svg = '';
  if (STYLE === 'rose') {
    var cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 4 * scale;
    svg += '<g class="rose" transform="translate(' + cx + ',' + cy + ') rotate(' + (-hd) + ')">';
    for (var a = 0; a < 360; a += 15) {
      var big = a % 90 === 0, len = big ? r * 0.25 : a % 45 === 0 ? r * 0.18 : r * 0.1;
      svg += '<line class="tick' + (big ? ' tick-major' : '') + '" x1="0" y1="' + (-r).toFixed(1) + '" x2="0" y2="' + (-r + len).toFixed(1) + '" stroke="' + COLOR + '" stroke-width="' + ((big ? 2 : 1) * scale).toFixed(2) + '" transform="rotate(' + a + ')"/>';
      if (names[a] && big) svg += '<text class="tick-label" transform="rotate(' + a + ') translate(0,' + (-r + len + fsz).toFixed(1) + ')" text-anchor="middle" fill="' + COLOR + '" font-family="Arial" font-size="' + fsz.toFixed(1) + '" font-weight="bold">' + names[a] + '</text>';
    }
    svg += '</g><path class="needle" d="M' + cx + ',' + (cy - r - 2 * scale).toFixed(1) + ' l' + (-6 * scale).toFixed(1) + ',' + (-8 * scale).toFixed(1) + ' l' + (12 * scale).toFixed(1) + ',0 z" fill="' + ACCENT + '"/>';
    svg += '<text class="heading" x="' + cx + '" y="' + (cy + fsz / 2).toFixed(1) + '" text-anchor="middle" fill="' + COLOR + '" font-family="Arial" font-size="' + (fsz * 1.3).toFixed(1) + '" font-weight="bold">' + hd.toFixed(0) + '°</text>';
  } else {
    var px = DEG_PER_PX / scale;  // keep the same visible span at any widget size
    var mid = W / 2, span = W * px / 2;
    var from = Math.ceil((hd - span) / 5) * 5, to = Math.floor((hd + span) / 5) * 5;
    for (var d = from; d <= to; d += 5) {
      var x = mid + (d - hd) / px, dd = ((d % 360) + 360) % 360, big2 = dd % 30 === 0;
      svg += '<line class="tick' + (big2 ? ' tick-major' : '') + '" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (H - 4 * scale).toFixed(1) + '" y2="' + (H - (big2 ? 16 : 9) * scale).toFixed(1) + '" stroke="' + COLOR + '" stroke-width="' + ((big2 ? 2 : 1) * scale).toFixed(2) + '"/>';
      if (big2) svg += '<text class="tick-label" x="' + x.toFixed(1) + '" y="' + (H - 20 * scale).toFixed(1) + '" text-anchor="middle" fill="' + COLOR + '" font-family="Arial" font-size="' + fsz.toFixed(1) + '" font-weight="' + (names[dd] ? 'bold' : 'normal') + '">' + (names[dd] || dd) + '</text>';
    }
    svg += '<path class="needle" d="M' + mid + ',' + (H - 2 * scale).toFixed(1) + ' l' + (-6 * scale).toFixed(1) + ',' + (-8 * scale).toFixed(1) + ' l' + (12 * scale).toFixed(1) + ',0 z" fill="' + ACCENT + '"/>';
    svg += '<rect class="heading-bg" x="' + (mid - 22 * scale).toFixed(1) + '" y="' + (2 * scale).toFixed(1) + '" width="' + (44 * scale).toFixed(1) + '" height="' + (fsz + 6 * scale).toFixed(1) + '" rx="' + (3 * scale).toFixed(1) + '" fill="' + ACCENT + '"/><text class="heading" x="' + mid + '" y="' + (fsz + 3 * scale).toFixed(1) + '" text-anchor="middle" fill="#fff" font-family="Arial" font-size="' + fsz.toFixed(1) + '" font-weight="bold">' + hd.toFixed(0) + '°</text>';
  }
  return '<svg id="compass" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Compass 3D',
    columns: 'heading',
    w: 280,
    h: 170,
    settings: defs([
      { group: { name: 'Heading', items: [
        { name: 'Heading unit', type: 'select', default: 'deg', values: ['deg', 'decideg', 'rad'], description: "unit of the heading column ('decideg' = value / 10, INAV attitude[2])" },
        { name: 'Heading offset', type: 'int', default: -90, description: 'degrees added if the ring points the wrong way' },
        { name: 'Invert', type: 'bool', default: false, description: 'flip rotation direction if the ring turns the wrong way' },
        { name: 'Smoothing ms', type: 'int', default: 300, min: 0, description: 'heading smoothing window (ms, 0 = off; wrap-safe)' },
      ] } },
      { group: { name: 'View', items: [
        { name: 'Tilt degrees', type: 'int', default: 30, min: 10, max: 80, description: 'camera angle above the ring plane (10 = flat/edge-on, 80 = top-down)' },
        { name: 'Depth', type: 'number', default: 3.2, min: 1.5, max: 10, step: 0.1, description: 'perspective strength (2 = strong, 6 = almost none)' },
        { name: 'Show readout', type: 'bool', default: true, description: 'big degrees + cardinal in the middle' },
      ] } },
      { group: { name: 'Look', items: [
        { name: 'Color', type: 'color_picker', default: '#ffffff', description: 'ticks / labels / rim' },
        { name: 'North color', type: 'color_picker', default: '#ff5050', description: 'N label' },
        { name: 'Accent', type: 'color_picker', default: '#ff3030', description: 'fixed front marker' },
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.4)' },
        { name: 'Radius', type: 'int', default: 8, min: 0, description: 'panel corner radius at the default 280x170 size; scales' },
        { name: 'Font size', type: 'int', default: 15, min: 6, description: 'cardinal letters at the default size; scales with the widget' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // 3D compass: a perspective compass ring lying flat, rotating under a fixed marker (column = heading).
  // ---------- SETTINGS ----------
  var HEADING_UNIT   = settings.heading_unit.value;   // 'deg' | 'decideg' (value/10) | 'rad'
  var HEADING_OFFSET = settings.heading_offset.value; // add degrees if the ring points the wrong way
  var INVERT         = settings.invert.value;         // flip rotation direction if the ring turns the wrong way
  var SMOOTH_MS      = settings.smoothing_ms.value;   // heading smoothing window (ms, 0 = off; wrap-safe)
  var TILT_DEG       = settings.tilt_degrees.value;   // camera angle above the ring plane (10 = flat/edge-on, 80 = top-down)
  var DEPTH          = settings.depth.value;          // perspective strength (2 = strong, 6 = almost none)
  var COLOR          = settings.color.value;          // ticks / labels / rim
  var NORTH_COLOR    = settings.north_color.value;    // N label
  var ACCENT         = settings.accent.value;         // fixed front marker
  var BG             = settings.background.value;
  var RADIUS         = settings.radius.value;         // panel corner radius at the default 280x170 size; scales
  var FONT_SIZE      = settings.font_size.value;      // cardinal letters at the default size; scales with the widget
  var SHOW_READOUT   = settings.show_readout.value;   // big degrees + cardinal in the middle
  // -------------------------------
  var W = ctx.width, H = ctx.height, scale = Math.min(W / 280, H / 170);
  var fsz = FONT_SIZE * scale, lw = Math.max(1, 1.5 * scale);
  var names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  function toDeg(v) { return HEADING_UNIT === 'decideg' ? v / 10 : HEADING_UNIT === 'rad' ? v * 180 / Math.PI : v; }
  // heading with triangular-weighted circular mean (the 359->0 wrap breaks plain averaging)
  var hv = ctx.values[0], hasData = typeof hv === 'number', hd = hasData ? toDeg(hv) : 0;
  if (hasData && SMOOTH_MS > 0) {
    var sam = ctx.range(ctx.columns[0], time - SMOOTH_MS, time + SMOOTH_MS, 120) || [], sx = 0, sy = 0, ws = 0, k;
    for (k = 0; k < sam.length; k++) {
      if (typeof sam[k].v !== 'number') continue;
      var wq = 1 - Math.abs(sam[k].t - time) / SMOOTH_MS; if (wq <= 0) continue;
      var rr = toDeg(sam[k].v) * Math.PI / 180;
      sx += Math.cos(rr) * wq; sy += Math.sin(rr) * wq; ws += wq;
    }
    if (ws) hd = Math.atan2(sy, sx) * 180 / Math.PI;
  }
  hd = ((hd + HEADING_OFFSET) % 360 + 360) % 360;
  if (INVERT) hd = (360 - hd) % 360;
  // 3D projection: ring lies in a horizontal plane, camera TILT_DEG above it, DEPTH controls perspective.
  // a = bearing relative to the current heading; a=0 is the point closest to the viewer (front).
  var DF = Math.max(1.5, DEPTH), E = TILT_DEG * Math.PI / 180, sinE = Math.sin(E), cosE = Math.cos(E);
  var topPad = fsz * 0.6 + 6 * scale, botPad = 16 * scale;
  var pF = DF / (DF - cosE), pB = DF / (DF + cosE);  // perspective at the front / back of the outer rim
  var R = Math.max(5, Math.min((W / 2 - 12 * scale) / 1.06, (H - topPad - botPad) / (sinE * (pF + pB))));
  var cx = W / 2, cy = topPad + sinE * R * pB;
  function pt(a, rad) { // perspective depends on the point's true depth: cos(a) * (rad/R)
    var r2 = a * Math.PI / 180, p = DF / (DF - Math.cos(r2) * cosE * (rad / R));
    return [cx + Math.sin(r2) * rad * p, cy + Math.cos(r2) * sinE * rad * p, p];
  }
  function alpha(p) { return (0.32 + 0.68 * (p - pB) / (pF - pB)).toFixed(2); }
  // rim band (outer + inner projected circles)
  var outer = '', inner = '', a, q;
  for (a = 0; a <= 360; a += 5) {
    q = pt(a, R); outer += (a ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1);
    q = pt(360 - a, R * 0.84); inner += (a ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1);
  }
  var svg = '<path class="band" d="' + outer + 'Z ' + inner + 'Z" fill-rule="evenodd" fill="rgba(255,255,255,.07)"/>'
    + '<path class="rim" d="' + outer + 'Z" fill="none" stroke="' + COLOR + '" stroke-opacity=".45" stroke-width="' + lw.toFixed(2) + '" stroke-linejoin="round"/>';
  // ticks + billboarded labels, painted back-to-front so near covers far
  var items = [], b, rel, p1, p2, major, lab;
  for (b = 0; b < 360; b += 15) {
    rel = b - hd; major = b % 45 === 0;
    p1 = pt(rel, major ? R * 0.78 : R * 0.86); p2 = pt(rel, R);
    var el = '<line class="tick' + (major ? ' tick-major' : '') + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1)
      + '" stroke="' + COLOR + '" stroke-opacity="' + alpha(p2[2]) + '" stroke-width="' + ((major ? 2 : 1) * scale * p2[2]).toFixed(2) + '"/>';
    if (major) {
      lab = names[b]; var card = b % 90 === 0;
      var lp = pt(rel, R * 0.58), lf = fsz * (card ? 1 : 0.72) * lp[2];
      el += '<text class="cardinal' + (b === 0 ? ' north' : '') + '" x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + lf * 0.35).toFixed(1) + '" text-anchor="middle" fill="' + (b === 0 ? NORTH_COLOR : COLOR)
        + '" fill-opacity="' + alpha(lp[2]) + '" font-family="Arial" font-size="' + lf.toFixed(1) + '"' + (card ? ' font-weight="bold"' : '') + ' style="text-shadow:0 0 3px #000">' + lab + '</text>';
    }
    items.push([p2[2], el]);
  }
  items.sort(function (u, v) { return u[0] - v[0]; });
  for (k = 0; k < items.length; k++) svg += items[k][1];
  // fixed front marker just outside the near rim, pointing at the current heading
  var fr = pt(0, R);
  svg += '<path class="marker" d="M' + cx.toFixed(1) + ',' + (fr[1] + 3 * scale).toFixed(1)
    + ' l' + (-7 * scale).toFixed(1) + ',' + (11 * scale).toFixed(1) + ' l' + (14 * scale).toFixed(1) + ',0 z" fill="' + ACCENT + '" stroke="#fff" stroke-width="' + (1.5 * scale).toFixed(2) + '"/>';
  if (SHOW_READOUT) {
    var txt = hasData ? hd.toFixed(0) + '\\u00B0' : '--';
    var card2 = hasData ? names[(Math.round(hd / 45) * 45) % 360] : '';
    svg += '<text class="readout" x="' + cx.toFixed(1) + '" y="' + (cy + fsz * 0.35).toFixed(1) + '" text-anchor="middle" fill="' + COLOR
      + '" font-family="Arial" font-size="' + (fsz * 1.7).toFixed(1) + '" font-weight="bold" style="text-shadow:0 0 4px #000,0 0 4px #000">' + txt + '</text>'
      + '<text class="readout-cardinal" x="' + cx.toFixed(1) + '" y="' + (cy + fsz * 1.5).toFixed(1) + '" text-anchor="middle" fill="rgba(255,255,255,.75)"'
      + ' font-family="Arial" font-size="' + (fsz * 0.85).toFixed(1) + '" style="text-shadow:0 0 3px #000">' + card2 + '</text>';
  }
  return '<svg id="compass3d" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Attitude horizon',
    columns: 'attitude[0], attitude[1]',
    w: 240,
    h: 240,
    settings: defs([
      { group: { name: 'Angles', items: [
        { name: 'Angle unit', type: 'select', default: 'decideg', values: ['deg', 'decideg', 'rad'], description: "unit of the roll/pitch columns ('decideg' = value / 10, INAV attitude[])" },
        { name: 'Invert roll', type: 'bool', default: false, description: 'flip roll if the horizon tilts the wrong way' },
        { name: 'Invert pitch', type: 'bool', default: false, description: 'flip pitch direction' },
        { name: 'Smoothing ms', type: 'int', default: 200, min: 0, description: 'smoothing window for roll & pitch (ms, 0 = off)' },
      ] } },
      { group: { name: 'Ladder', items: [
        { name: 'Degrees per px', type: 'number', default: 0.45, min: 0.05, step: 0.05, description: 'pitch ladder density (deg per pixel at the default 240x240 size)' },
        { name: 'Ladder step', type: 'int', default: 10, min: 5, max: 90, description: 'degrees between numbered ladder lines' },
        { name: 'Line color', type: 'color_picker', default: '#ffffff', description: 'horizon + ladder lines' },
        { name: 'Font size', type: 'int', default: 11, min: 6, description: 'ladder / readout text at the default size; scales' },
        { name: 'Show values', type: 'bool', default: true, description: 'numeric roll/pitch readout at the bottom' },
      ] } },
      { group: { name: 'Colors', items: [
        { name: 'Sky top', type: 'color_picker', default: '#2f6fb2', description: 'sky gradient top' },
        { name: 'Sky horizon', type: 'color_picker', default: '#7db4e0', description: 'sky at the horizon' },
        { name: 'Ground horizon', type: 'color_picker', default: '#9a6b3f', description: 'ground at the horizon' },
        { name: 'Ground bottom', type: 'color_picker', default: '#5d3f22', description: 'ground gradient bottom' },
        { name: 'Pointer color', type: 'color_picker', default: '#ff3030', description: 'roll pointer triangle' },
        { name: 'Wings color', type: 'color_picker', default: '#f2a93b', description: 'fixed aircraft symbol' },
        { name: 'Ring color', type: 'color_picker', default: 'rgba(255,255,255,.55)', description: 'outer ring' },
        { name: 'Ring width', type: 'int', default: 2, min: 0, description: 'at the default 240x240 size; scales with the widget' },
        { name: 'Background', type: 'color_picker', default: 'rgba(0,0,0,.35)', description: 'disc behind the instrument' },
      ] } },
    ]),
    code: `function (settings, time, ctx) {
  // Artificial horizon: columns = roll, pitch (INAV attitude[0], attitude[1] in decidegrees).
  // ---------- SETTINGS ----------
  var ANGLE_UNIT     = settings.angle_unit.value;     // 'deg' | 'decideg' (value/10) | 'rad'
  var INVERT_ROLL    = settings.invert_roll.value;    // flip roll if the horizon tilts the wrong way
  var INVERT_PITCH   = settings.invert_pitch.value;   // flip pitch direction
  var SMOOTH_MS      = settings.smoothing_ms.value;   // smoothing window for roll & pitch (ms, 0 = off)
  var DEG_PER_PX     = settings.degrees_per_px.value; // pitch ladder density (deg per pixel at the default 240x240 size)
  var LADDER_STEP    = settings.ladder_step.value;    // degrees between numbered ladder lines
  var SKY_TOP        = settings.sky_top.value;        // sky gradient top
  var SKY_HORIZON    = settings.sky_horizon.value;    // sky at the horizon
  var GROUND_HORIZON = settings.ground_horizon.value; // ground at the horizon
  var GROUND_BOTTOM  = settings.ground_bottom.value;  // ground gradient bottom
  var LINE_COLOR     = settings.line_color.value;     // horizon + ladder lines
  var POINTER_COLOR  = settings.pointer_color.value;  // roll pointer triangle
  var WINGS_COLOR    = settings.wings_color.value;    // fixed aircraft symbol
  var RING_COLOR     = settings.ring_color.value;     // outer ring
  var RING_WIDTH     = settings.ring_width.value;     // at the default 240x240 size; scales with the widget
  var BG             = settings.background.value;     // disc behind the instrument
  var FONT_SIZE      = settings.font_size.value;      // ladder / readout text at the default size; scales
  var SHOW_VALUES    = settings.show_values.value;    // numeric roll/pitch readout at the bottom
  // -------------------------------
  var W = ctx.width, H = ctx.height, size = Math.min(W, H), scale = size / 240;
  var cx = W / 2, cy = H / 2, rw = RING_WIDTH * scale, r = size / 2 - 2 * rw;
  var s = ctx.state;
  var uid = s.uid || (s.uid = 'ah' + Math.random().toString(36).slice(2, 8));
  function toDeg(v) { return ANGLE_UNIT === 'decideg' ? v / 10 : ANGLE_UNIT === 'rad' ? v * 180 / Math.PI : v; }
  function angleAt(col) { // triangular-weighted circular mean around \`time\` (wrap-safe)
    var v = ctx.get(col);
    if (typeof v !== 'number') return 0;
    if (!(SMOOTH_MS > 0)) return toDeg(v);
    var sam = ctx.range(col, time - SMOOTH_MS, time + SMOOTH_MS, 120) || [], sx = 0, sy = 0, ws = 0, k2, w2, rr;
    for (k2 = 0; k2 < sam.length; k2++) {
      if (typeof sam[k2].v !== 'number') continue;
      w2 = 1 - Math.abs(sam[k2].t - time) / SMOOTH_MS; if (w2 <= 0) continue;
      rr = toDeg(sam[k2].v) * Math.PI / 180;
      sx += Math.cos(rr) * w2; sy += Math.sin(rr) * w2; ws += w2;
    }
    return ws ? Math.atan2(sy, sx) * 180 / Math.PI : toDeg(v);
  }
  var hasData = typeof ctx.values[0] === 'number' || typeof ctx.values[1] === 'number';
  var roll = angleAt(ctx.columns[0]), pitch = angleAt(ctx.columns[1]);
  if (INVERT_ROLL) roll = -roll;
  if (INVERT_PITCH) pitch = -pitch;
  var k = scale / DEG_PER_PX;                 // px per degree (visual density constant at any size)
  var fsz = FONT_SIZE * scale, lw = Math.max(1, 1.5 * scale);
  var dy = pitch * k;                         // pitch up -> horizon moves down
  var svg = '<defs>'
    + '<linearGradient id="' + uid + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + SKY_TOP + '"/><stop offset="1" stop-color="' + SKY_HORIZON + '"/></linearGradient>'
    + '<linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + GROUND_HORIZON + '"/><stop offset="1" stop-color="' + GROUND_BOTTOM + '"/></linearGradient>'
    + '<clipPath id="' + uid + 'c"><circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '"/></clipPath>'
    + '</defs>';
  svg += '<circle class="bg" cx="' + cx + '" cy="' + cy + '" r="' + (r + rw).toFixed(1) + '" fill="' + BG + '"/>';
  // rotating horizon ball (clipped to the instrument circle)
  svg += '<g clip-path="url(#' + uid + 'c)"><g class="ball" transform="rotate(' + (-roll).toFixed(2) + ' ' + cx + ' ' + cy + ')">';
  var big = 4 * r;
  svg += '<rect class="sky" x="' + (cx - big / 2).toFixed(1) + '" y="' + (cy + dy - big).toFixed(1) + '" width="' + big + '" height="' + big.toFixed(1) + '" fill="url(#' + uid + 's)"/>';
  svg += '<rect class="ground" x="' + (cx - big / 2).toFixed(1) + '" y="' + (cy + dy).toFixed(1) + '" width="' + big + '" height="' + big.toFixed(1) + '" fill="url(#' + uid + 'g)"/>';
  svg += '<line class="horizon-line" x1="' + (cx - big / 2).toFixed(1) + '" x2="' + (cx + big / 2).toFixed(1) + '" y1="' + (cy + dy).toFixed(1) + '" y2="' + (cy + dy).toFixed(1) + '" stroke="' + LINE_COLOR + '" stroke-width="' + lw.toFixed(2) + '"/>';
  // pitch ladder: minor line every 5 deg, numbered line every LADDER_STEP
  var span = (r * 0.72) / k, p, ly, half, major; // keep the ladder clear of the roll scale
  for (p = -90; p <= 90; p += 5) {
    if (p === 0 || Math.abs(pitch - p) > span) continue;
    major = p % LADDER_STEP === 0;
    half = (major ? 26 : 13) * scale;
    ly = cy + (pitch - p) * k;
    svg += '<line class="ladder" x1="' + (cx - half).toFixed(1) + '" x2="' + (cx + half).toFixed(1) + '" y1="' + ly.toFixed(1) + '" y2="' + ly.toFixed(1) + '" stroke="' + LINE_COLOR + '" stroke-width="' + (major ? lw : lw * 0.6).toFixed(2) + '"' + (p < 0 ? ' stroke-dasharray="' + (4 * scale).toFixed(1) + ' ' + (3 * scale).toFixed(1) + '"' : '') + '/>';
    if (major) {
      svg += '<text class="ladder-label" x="' + (cx - half - 5 * scale).toFixed(1) + '" y="' + (ly + fsz * 0.35).toFixed(1) + '" text-anchor="end" fill="' + LINE_COLOR + '" font-family="Arial" font-size="' + fsz.toFixed(1) + '">' + Math.abs(p) + '</text>'
        + '<text class="ladder-label" x="' + (cx + half + 5 * scale).toFixed(1) + '" y="' + (ly + fsz * 0.35).toFixed(1) + '" fill="' + LINE_COLOR + '" font-family="Arial" font-size="' + fsz.toFixed(1) + '">' + Math.abs(p) + '</text>';
    }
  }
  svg += '</g></g>';
  // fixed roll scale on top of the ball + pointer moving with the roll
  var a, ticks = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
  for (var i = 0; i < ticks.length; i++) {
    a = ticks[i];
    var len = (a % 30 === 0 ? 10 : 6) * scale;
    svg += '<g class="roll-tick" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"><line x1="' + cx + '" x2="' + cx + '" y1="' + (cy - r).toFixed(1) + '" y2="' + (cy - r + len).toFixed(1) + '" stroke="' + LINE_COLOR + '" stroke-width="' + (a === 0 ? lw * 1.4 : lw * 0.8).toFixed(2) + '"/></g>';
  }
  svg += '<g class="roll-pointer" transform="rotate(' + (-roll).toFixed(2) + ' ' + cx + ' ' + cy + ')">'
    + '<path d="M' + cx + ',' + (cy - r + 12 * scale).toFixed(1) + ' l' + (-6 * scale).toFixed(1) + ',' + (10 * scale).toFixed(1) + ' l' + (12 * scale).toFixed(1) + ',0 z" fill="' + POINTER_COLOR + '" stroke="#fff" stroke-width="' + (scale).toFixed(2) + '"/></g>';
  // fixed aircraft symbol (black underlay keeps it readable on any ball color)
  var wing = 'M' + (cx - 52 * scale).toFixed(1) + ',' + cy + ' h' + (34 * scale).toFixed(1) + ' l' + (8 * scale).toFixed(1) + ',' + (8 * scale).toFixed(1)
    + ' M' + (cx + 52 * scale).toFixed(1) + ',' + cy + ' h' + (-34 * scale).toFixed(1) + ' l' + (-8 * scale).toFixed(1) + ',' + (8 * scale).toFixed(1);
  svg += '<path class="wings-outline" d="' + wing + '" fill="none" stroke="#000" stroke-width="' + (5 * scale).toFixed(2) + '" stroke-linecap="round"/>'
    + '<path class="wings" d="' + wing + '" fill="none" stroke="' + WINGS_COLOR + '" stroke-width="' + (3 * scale).toFixed(2) + '" stroke-linecap="round"/>'
    + '<circle class="wings-dot" cx="' + cx + '" cy="' + cy + '" r="' + (3 * scale).toFixed(1) + '" fill="' + WINGS_COLOR + '" stroke="#000" stroke-width="' + scale.toFixed(2) + '"/>';
  svg += '<circle class="ring" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="none" stroke="' + RING_COLOR + '" stroke-width="' + rw.toFixed(2) + '"/>';
  if (SHOW_VALUES) {
    var txt = hasData ? 'R ' + roll.toFixed(0) + '\\u00B0 P ' + pitch.toFixed(0) + '\\u00B0' : '--';
    svg += '<text class="readout" x="' + cx + '" y="' + (cy + r * 0.82 + fsz * 0.35).toFixed(1) + '" text-anchor="middle" fill="#fff" font-family="Arial" font-size="' + fsz.toFixed(1) + '" font-weight="bold" style="text-shadow:0 0 3px #000,0 0 3px #000">' + txt + '</text>';
  }
  return '<svg id="horizon" width="' + W + '" height="' + H + '">' + svg + '</svg>';
}`,
  },
];
