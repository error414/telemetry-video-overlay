// Example widgets seeded into the library. Every example starts with a SETTINGS block –
// change values there (colors, sizes, units, arrow style…). They can be deleted from the
// Library tab and are refreshed automatically when EXAMPLES_VERSION changes.

// Bump when examples change: the library's "Example:" entries are refreshed automatically.
export const EXAMPLES_VERSION = 27;

export const EXAMPLE_WIDGETS = [
  {
    name: 'Example: Big number',
    columns: 'GPS_speed (m/s)',
    w: 320,
    h: 110,
    opacity: 1,
    code: `function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var LABEL      = 'SPEED';      // small caption above the value ('' = none)
  var UNIT       = 'km/h';       // unit text after the value
  var MULTIPLIER = 3.6;          // value * MULTIPLIER (m/s -> km/h = 3.6; 1 = as is)
  var DIGITS     = 0;            // decimal places
  var COLOR      = '#ffffff';    // text color
  var LABEL_COLOR= 'rgba(255,255,255,.75)';
  var FONT       = 'Arial, sans-serif';
  var SIZE       = 64;           // value font size at the default 320x110 size; scales with the widget
  var SHADOW     = '0 0 8px rgba(0,0,0,.9)';  // text shadow ('' = none)
  var BG         = 'transparent';// box background, e.g. 'rgba(0,0,0,.4)'
  var RADIUS     = 8;            // box corner radius at the default size; scales with the widget
  var ALIGN      = 'left';       // 'left' | 'center' | 'right'
  var SHOW_MAX   = false;        // show whole-flight maximum under the value
  // -------------------------------
  var scale = Math.min(ctx.width / 320, ctx.height / 110);  // all sizes scale with the widget (settings are for the default 320x110)
  var fs = SIZE * scale, radius = RADIUS * scale;
  var v = values[0];
  var txt = (typeof v === 'number') ? (v * MULTIPLIER).toFixed(DIGITS) : '--';
  var st = SHOW_MAX ? ctx.stats(ctx.columns[0]) : null;
  // CSS hooks: #bignum (box), .label, .value, .unit, .max
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
    opacity: 0.9,
    code: `function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var LABEL      = 'THR';        // label text ('' = none)
  var MIN        = 1000;         // value that maps to 0 %   (null = whole-flight minimum)
  var MAX        = 2000;         // value that maps to 100 % (null = whole-flight maximum)
  var SHOW_VALUE = 'percent';    // 'percent' | 'raw' | 'none'
  var DIGITS     = 0;
  var SMOOTH_MS  = 300;          // moving-average window (ms) that filters out quick small spikes (0 = off)
  var BAR_COLOR  = 'linear-gradient(90deg,#3f3,#ff3,#f33)'; // css color or gradient (for vertical direction use 0deg)
  var GRADIENT_SPAN = 'gauge';   // 'gauge' = gradient spans the whole gauge and the fill just reveals it; 'fill' = gradient squeezes into the filled part
  var BG         = 'rgba(0,0,0,.5)';
  var BORDER_COLOR = '#fff';
  var BORDER_WIDTH = 2;          // at the default 300x40 size; scales with the widget
  var RADIUS     = 6;            // corner radius at the default size; scales with the widget
  var TEXT_COLOR = '#fff';
  var FONT       = 'Arial';      // font family
  var FONT_SIZE  = 18;           // text size at the default 300x40 size; scales with the widget
  var FONT_BOLD  = true;
  var DIRECTION  = 'horizontal'; // 'horizontal' | 'vertical'
  // -------------------------------
  var scale = Math.min(ctx.width, ctx.height) / 40;  // sizes scale with the bar thickness (settings are for the default 300x40)
  var st = (MIN === null || MAX === null) ? ctx.stats(ctx.columns[0]) : null;
  if (MIN === null) MIN = st ? st.min : 0;
  if (MAX === null) MAX = st ? st.max : 1;
  if (MAX === MIN) MAX = MIN + 1;
  var v = values[0];
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
  // CSS hooks: #gauge (box), .fill, .text
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
    opacity: 0.9,
    code: `function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var WINDOW_MS  = 20000;        // how much history to show (ms)
  var SMOOTH_MS  = 300;          // moving-average window (ms) smoothing the line and the value (0 = off)
  var LABEL      = 'ALT';        // label ('' = column name)
  var MULTIPLIER = 1;            // value scaling (cm -> m = 0.01)
  var DIGITS     = 1;
  var UNIT       = 'm';
  var LINE_COLOR = '#00ff00';    // line color below the first threshold
  var LINE_WIDTH = 2;            // at the default 400x150 size; scales with the widget
  var THRESHOLDS = [[100, '#4da6ff'], [200, '#ff4040']]; // [value, color] pairs (in display units, after MULTIPLIER), ascending; colors the line and the value; [] = off
  var FILL_ALPHA = 0.15;         // opacity of the area under the line (the area follows the line color; 0 = no area)
  var BG         = 'rgba(0,0,0,.4)';
  var RADIUS     = 8;            // corner radius at the default size; scales with the widget
  var TEXT_COLOR = '#fff';
  var FONT_SIZE  = 14;           // text size at the default 400x150 size; scales with the widget
  var SCALE      = 'flight';     // 'flight' = fixed axis from whole-flight min/max (no jumping),
                                 // 'window' = autoscale to visible history, 'fixed' = use MIN/MAX
  var MIN        = 0;            // used when SCALE = 'fixed'
  var MAX        = 100;
  var SHOW_GRID  = true;
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
    if (typeof values[0] === 'number' && (!pts.length || pts[pts.length - 1].t < time)) pts.push({ t: time, v: values[0] });
  }
  // pts overhang the window (a sample before the start, the current value / smoothing tail
  // at the end); replace the overhang with points interpolated exactly at the window edges,
  // otherwise both line ends visibly jump by one sample as points enter and leave the window
  (function () {
    var t0 = time - WINDOW_MS, t1 = time, out = [], i, p, q;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      if (p.t < t0) {
        q = pts[i + 1];
        if (q && q.t > t0 && typeof p.v === 'number' && typeof q.v === 'number')
          out.push({ t: t0, v: p.v + (q.v - p.v) * (t0 - p.t) / (q.t - p.t) });
      } else if (p.t > t1) {
        q = pts[i - 1];
        if (q && q.t < t1 && typeof p.v === 'number' && typeof q.v === 'number')
          out.push({ t: t1, v: q.v + (p.v - q.v) * (t1 - q.t) / (p.t - q.t) });
        break;
      } else out.push(p);
    }
    pts = out;
  })();
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
  var v = values[0];
  if (SMOOTH_MS > 0 && typeof v === 'number' && pts.length) v = pts[pts.length - 1].v;  // show the smoothed value too
  var vcol = (typeof v === 'number') ? colFor(v * MULTIPLIER) : TEXT_COLOR;
  var txt = (LABEL || ctx.columns[0]) + ': <tspan class="value" fill="' + vcol + '">' + (typeof v === 'number' ? (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT : '--') + '</tspan>';
  // CSS hooks: #graph (svg), .grid, .area, .line, .label, .value
  return '<svg id="graph" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + grid + area + line
    + '<text class="label" x="' + (8 * scale).toFixed(1) + '" y="' + (fsz + 4 * scale).toFixed(1) + '" fill="' + TEXT_COLOR + '" font-family="Arial" font-size="' + fsz.toFixed(1) + '" style="text-shadow:0 0 4px #000">' + txt + '</text></svg>';
}`,
  },
  {
    name: 'Example: Flight graph (whole flight)',
    columns: 'GPS_speed (km/h)',
    w: 520,
    h: 160,
    opacity: 0.95,
    code: `function (values, time, ctx) {
  // Whole-flight area chart with a marker at the current time (like "Speed vs Time").
  // Use an altitude column for an altitude profile.
  // ---------- SETTINGS ----------
  var TITLE       = 'Speed vs Time';  // caption under the chart ('' = none)
  var UNIT        = 'km/h';
  var MULTIPLIER  = 1;               // value scaling (3.6 = m/s -> km/h, 0.01 = cm -> m)
  var DIGITS      = 1;
  var FILL_COLOR  = 'rgba(80,160,255,.85)';
  var LINE_COLOR  = 'rgba(255,255,255,.9)';
  var LINE_WIDTH  = 1;               // at the default 520x160 size; scales with the widget (like all sizes below)
  var MARKER_COLOR= '#e03030';       // vertical bar at current time
  var MARKER_WIDTH= 4;
  var DOT         = true;            // dot on the curve at current time
  var DOT_COLOR   = '#ffffff';
  var DOT_SIZE    = 5;
  var TEXT_COLOR  = '#ffffff';
  var FONT        = 'Arial';
  var FONT_SIZE   = 13;              // axis / title text size
  var VALUE_SIZE  = 22;              // current value label size
  var GRID_LINES  = 4;               // horizontal grid lines (0 = none)
  var GRID_COLOR  = 'rgba(255,255,255,.6)';
  var AXIS_LABELS = true;            // numbers on the left
  var BASELINE    = 'zero';          // 'zero' = axis starts at 0, 'min' = at flight minimum
  var MIN         = null;            // fixed axis min/max (null = from the flight)
  var MAX         = null;
  var BG          = 'transparent';   // e.g. 'rgba(0,0,0,.35)'
  var SHADOW      = true;            // text shadow for readability over video
  var MAX_POINTS  = 600;             // curve resolution
  var SMOOTH_MS   = 1000;            // moving-average window (ms) smoothing the curve and the value (0 = off)
  // -------------------------------
  var col = ctx.columns[0], W = ctx.width, H = ctx.height, s = ctx.state;
  var scale = Math.min(W / 520, H / 160);  // sizes scale with the widget (settings are for the default 520x160)
  var fsz = FONT_SIZE * scale, vsz = VALUE_SIZE * scale, lw = LINE_WIDTH * scale;
  // top leaves room for the ascenders of the topmost axis number so it is not clipped
  var left = AXIS_LABELS ? fsz * 3.2 : 6 * scale, bottom = TITLE ? fsz + 10 * scale : 6 * scale, top = Math.max(6 * scale, fsz * 0.6), right = 8 * scale;
  var cw = W - left - right, ch = H - top - bottom;
  // cache key includes every setting the cached curve depends on, so editing them takes effect
  var key = col + '|' + MAX_POINTS + '|' + SMOOTH_MS;
  if (s.key !== key) {
    var raw = ctx.all(col, MAX_POINTS);
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
    s.pts = raw; s.key = key; s.st = ctx.stats(col);
  }
  var pts = s.pts, st = s.st;
  if (!pts.length || !st) return '<div style="color:#fff;font:12px Arial">no data for ' + col + '</div>';
  var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if (t1 === t0) t1 = t0 + 1;
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
  var v = values[0], inRange = time >= t0 && time <= t1;
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
  // CSS hooks: #flightgraph (svg), .grid, .axis, .area, .line, .marker, .dot, .value, .title
  return '<svg id="flightgraph" width="' + W + '" height="' + H + '" style="background:' + BG + '">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Altitude profile',
    columns: 'BaroAlt (m)',
    w: 520,
    h: 140,
    opacity: 0.95,
    code: `function (values, time, ctx) {
  // Altitude over the whole flight with a dot moving along the profile.
  // ---------- SETTINGS ----------
  var MULTIPLIER  = 1;               // value scaling (0.01 = cm -> m)
  var UNIT        = 'm';
  var DIGITS      = 0;
  var LABEL       = 'ALT';           // caption in the top-left corner ('' = none)
  var FILL_TOP    = 'rgba(120,200,120,.9)';   // gradient top color
  var FILL_BOTTOM = 'rgba(40,90,40,.6)';      // gradient bottom color
  var LINE_COLOR  = '#ffffff';
  var LINE_WIDTH  = 1.5;             // at the default 520x140 size; scales with the widget (like all sizes below)
  var DOT_COLOR   = '#ff3030';
  var DOT_SIZE    = 6;
  var TEXT_COLOR  = '#ffffff';
  var FONT        = 'Arial';
  var FONT_SIZE   = 14;
  var SHOW_MINMAX = true;            // print flight min/max in the corner
  var BG          = 'rgba(0,0,0,.35)';
  var RADIUS      = 8;
  var MAX_POINTS  = 600;
  var SMOOTH_MS   = 1000;            // moving-average window (ms) smoothing the profile and the value (0 = off)
  // -------------------------------
  var col = ctx.columns[0], W = ctx.width, H = ctx.height, s = ctx.state;
  var scale = Math.min(W / 520, H / 140);  // sizes scale with the widget (settings are for the default 520x140)
  var fsz = FONT_SIZE * scale, pad = 8 * scale;
  // cache key includes every setting the cached curve depends on, so editing them takes effect
  var key = col + '|' + MAX_POINTS + '|' + SMOOTH_MS;
  if (s.key !== key) {
    var raw = ctx.all(col, MAX_POINTS);
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
    s.pts = raw; s.key = key; s.st = ctx.stats(col);
  }
  var pts = s.pts, st = s.st;
  if (!pts.length || !st) return '<div style="color:#fff;font:12px Arial">no data for ' + col + '</div>';
  var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if (t1 === t0) t1 = t0 + 1;
  var min = st.min, max = st.max; if (max === min) max = min + 1;
  function X(t) { return pad + (t - t0) / (t1 - t0) * (W - 2 * pad); }
  function Y(v) { return H - pad - (v - min) / (max - min) * (H - 2 * pad - fsz); }
  var d = '', first = true;
  pts.forEach(function (p) { if (typeof p.v !== 'number') return; d += (first ? 'M' : 'L') + X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); first = false; });
  var area = d + 'L' + X(t1).toFixed(1) + ',' + (H - pad).toFixed(1) + 'L' + X(t0).toFixed(1) + ',' + (H - pad).toFixed(1) + 'Z';
  var id = 'g' + Math.abs(W * 31 + H);
  var svg = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + FILL_TOP + '"/><stop offset="1" stop-color="' + FILL_BOTTOM + '"/></linearGradient></defs>';
  svg += '<path class="area" d="' + area + '" fill="url(#' + id + ')"/><path class="line" d="' + d + '" fill="none" stroke="' + LINE_COLOR + '" stroke-width="' + (LINE_WIDTH * scale).toFixed(2) + '"/>';
  var v = values[0], sh = 'text-shadow:0 0 3px #000;';
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
  // CSS hooks: #profile (svg), .area, .line, .dot, .value, .label, .minmax
  return '<svg id="profile" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: RC sticks',
    columns: 'rcCommand[0], rcCommand[1], rcCommand[2], rcCommand[3]',
    w: 260,
    h: 130,
    opacity: 0.9,
    code: `function (values, time, ctx) {
  // Transmitter sticks: columns = roll, pitch, yaw, throttle (INAV rcCommand[0..3]).
  // ---------- SETTINGS ----------
  var MODE        = 2;               // 1 or 2 (Mode 2: left stick = throttle/yaw, right = pitch/roll)
  var MIN         = -500;            // stick range for roll/pitch/yaw (INAV rcCommand is -500..500)
  var MAX         = 500;
  var CENTER      = 0;               // center value for roll/pitch/yaw
  var THR_MIN     = 1000;            // throttle range (1000..2000)
  var THR_MAX     = 2000;
  var INVERT_PITCH= false;           // flip pitch direction if needed
  var INVERT_ROLL = false;
  var INVERT_YAW  = false;
  var BG          = 'rgba(0,0,0,.45)';
  var BORDER      = 'rgba(255,255,255,.6)';
  var GRID        = 'rgba(255,255,255,.2)';
  var STICK_COLOR = '#f2a93b';
  var STICK_SIZE  = 9;               // at the default 260x130 size; scales with the widget
  var TRAIL       = true;            // short trail of the stick movement
  var TRAIL_MS    = 600;
  var TRAIL_COLOR = 'rgba(242,169,59,.5)';
  var LABELS      = true;            // T/Y/P/R labels
  var LABEL_COLOR = 'rgba(255,255,255,.7)';
  var LABEL_SIZE  = 10;              // label font size at the default 260x130 size; scales with the widget
  var LABEL_FONT  = 'Arial';         // label font family
  var LABEL_BOLD  = false;
  var RADIUS      = 8;               // corner radius at the default size; scales with the widget
  var GAP         = 10;              // gap between the two boxes at the default size; scales with the widget
  // -------------------------------
  // Elements carry ids/classes so the widget's CSS tab can restyle them:
  //   #box-left / #box-right (rect.box), .grid, .trail, .stick, .label
  var W = ctx.width, H = ctx.height;
  var scale = Math.min(H, W / 2) / 125;  // all sizes scale with the widget (settings are for the default 260x130)
  var gap = GAP * scale, stickR = STICK_SIZE * scale, labelSize = LABEL_SIZE * scale, radius = RADIUS * scale;
  var lineW = Math.max(1, 1.5 * scale);  // box border + stick outline width
  var gridW = Math.max(0.5, scale);      // divider (grid) line width
  var size = Math.min(H, (W - gap) / 2), pad = stickR + 2 * scale;
  var x0 = (W - (2 * size + gap)) / 2, y0 = (H - size) / 2;
  function norm(v, lo, hi) { v = typeof v === 'number' ? v : (lo + hi) / 2; return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); }
  var roll = norm(values[0], MIN, MAX), pitch = norm(values[1], MIN, MAX), yaw = norm(values[2], MIN, MAX), thr = norm(values[3], THR_MIN, THR_MAX);
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
    opacity: 0.9,
    code: `function (values, time, ctx) {
  // ---------- SETTINGS ----------
  // columns: 0 = latitude, 1 = longitude, 2 = heading (optional)
  var MAP_STYLE   = 'osm';          // 'osm' | 'carto-dark' | 'carto-light' | 'none'  (CARTO may show "API key required" tiles for some networks)
  var MAP_OPACITY = 0.55;           // map tile opacity (0..1) – keep low to be unobtrusive
  var MAP_GRAY    = true;           // desaturate the map
  var MODE        = 'follow';       // 'fit' = whole flight fits the box, 'follow' = follow aircraft at ZOOM
  var ZOOM        = 17;             // zoom for 'follow' mode (max 19)
  var ROTATE_MAP  = false;          // 'follow' mode: rotate the map so heading points up
  var SMOOTH_MS   = 500;            // smoothing window in ms for position & heading (0 = off)
  var BG          = 'rgba(0,0,0,.45)';
  var RADIUS      = 10;
  var BORDER      = '1px solid rgba(255,255,255,.4)';
  var PADDING     = 10;             // px kept free around the track in 'fit' mode
  var TRACK_COLOR = 'rgba(255,255,255,.9)';
  var TRACK_WIDTH = 2;
  var TRAIL_COLOR = '#00ffff';      // already-flown part of the track ('' = same as TRACK_COLOR)
  var TRAIL_WIDTH = 3;
  var ARROW_STYLE = 'dot';          // 'arrow' | 'plane' | 'chevron' | 'dot'
  var ARROW_SIZE  = 25;
  var ARROW_COLOR = '#ff3030';
  var ARROW_STROKE= '#ffffff';
  var HEADING_UNIT= 'deg';          // 'deg' | 'decideg' (value/10) | 'rad'
  var HEADING_OFFSET = -90;         // add degrees if the arrow points the wrong way
  var SHOW_ATTRIBUTION = true;      // tile providers require attribution
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
  if (!s.path) { // load the whole track once
    var lat = ctx.all(ctx.columns[0], 4000), lon = ctx.all(ctx.columns[1], 4000);
    var n = Math.min(lat.length, lon.length), i;
    s.path = []; s.minLat = 90; s.maxLat = -90; s.minLon = 180; s.maxLon = -180;
    for (i = 0; i < n; i++) {
      var la = lat[i].v, lo = lon[i].v;
      if (typeof la !== 'number' || typeof lo !== 'number' || (Math.abs(la) < 0.001 && Math.abs(lo) < 0.001)) continue;
      s.path.push({ t: lat[i].t, lat: la, lon: lo });
      if (la < s.minLat) s.minLat = la; if (la > s.maxLat) s.maxLat = la; if (lo < s.minLon) s.minLon = lo; if (lo > s.maxLon) s.maxLon = lo;
    }
    s.proj = {};
  }
  if (s.fitW !== W || s.fitH !== H || s.fitPad !== PADDING) { // (re)compute fit zoom when the box is resized
    s.fitW = W; s.fitH = H; s.fitPad = PADDING; s.fitZoom = 1;
    for (var z = 19; z >= 1; z--) {
      var a = px(s.maxLat, s.minLon, z), b = px(s.minLat, s.maxLon, z);
      if (b[0] - a[0] <= W - 2 * PADDING && b[1] - a[1] <= H - 2 * PADDING) { s.fitZoom = z; break; }
    }
  }
  if (!s.path.length) return '<div style="width:100%;height:100%;background:' + BG + ';border-radius:' + RADIUS + 'px;color:#fff;font:12px Arial;display:flex;align-items:center;justify-content:center">no GPS data</div>';
  var lat0 = values[0], lon0 = values[1], hasPos = typeof lat0 === 'number' && typeof lon0 === 'number' && !(Math.abs(lat0) < 0.001 && Math.abs(lon0) < 0.001);
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
  var hd = values[2];
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
  if (hasPos && trail.length) { var tip = px(lat0, lon0, zoom); trail.push((tip[0] - ox).toFixed(1) + ',' + (tip[1] - oy).toFixed(1)); }
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
  // CSS hooks: #map (box), .tiles, .tile, .status, svg.overlay, .track, .trail, .arrow, .attribution
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
    opacity: 0.9,
    code: `function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var HEADING_UNIT = 'deg';        // 'deg' | 'decideg' | 'rad'
  var HEADING_OFFSET = -90;        // add degrees if the compass points the wrong way
  var STYLE        = 'tape';       // 'tape' (sliding ribbon) | 'rose' (rotating rose)
  var COLOR        = '#fff';
  var ACCENT       = '#ff3030';    // needle / center mark
  var BG           = 'rgba(0,0,0,.45)';
  var RADIUS       = 8;            // at the default 220x60 size; scales with the widget (like all sizes below)
  var FONT_SIZE    = 14;
  var DEG_PER_PX   = 1;            // tape: degrees per pixel at the default size (smaller = wider view)
  // -------------------------------
  var hd = values[0]; if (typeof hd !== 'number') hd = 0;
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
  // CSS hooks: #compass (svg), .rose, .tick, .tick-major, .tick-label, .needle, .heading, .heading-bg
  return '<svg id="compass" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Compass 3D',
    columns: 'heading',
    w: 280,
    h: 170,
    opacity: 0.92,
    code: `function (values, time, ctx) {
  // 3D compass: a perspective compass ring lying flat, rotating under a fixed marker (column = heading).
  // ---------- SETTINGS ----------
  var HEADING_UNIT = 'deg';        // 'deg' | 'decideg' (value/10) | 'rad'
  var HEADING_OFFSET = -90;        // add degrees if the ring points the wrong way
  var INVERT       = false;        // flip rotation direction if the ring turns the wrong way
  var SMOOTH_MS    = 300;          // heading smoothing window (ms, 0 = off; wrap-safe)
  var TILT_DEG     = 30;           // camera angle above the ring plane (10 = flat/edge-on, 80 = top-down)
  var DEPTH        = 3.2;          // perspective strength (2 = strong, 6 = almost none)
  var COLOR        = '#ffffff';    // ticks / labels / rim
  var NORTH_COLOR  = '#ff5050';    // N label
  var ACCENT       = '#ff3030';    // fixed front marker
  var BG           = 'rgba(0,0,0,.4)';
  var RADIUS       = 8;            // panel corner radius at the default 280x170 size; scales
  var FONT_SIZE    = 15;           // cardinal letters at the default size; scales with the widget
  var SHOW_READOUT = true;         // big degrees + cardinal in the middle
  // -------------------------------
  var W = ctx.width, H = ctx.height, scale = Math.min(W / 280, H / 170);
  var fsz = FONT_SIZE * scale, lw = Math.max(1, 1.5 * scale);
  var names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  function toDeg(v) { return HEADING_UNIT === 'decideg' ? v / 10 : HEADING_UNIT === 'rad' ? v * 180 / Math.PI : v; }
  // heading with triangular-weighted circular mean (the 359->0 wrap breaks plain averaging)
  var hv = values[0], hasData = typeof hv === 'number', hd = hasData ? toDeg(hv) : 0;
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
  // CSS hooks: #compass3d (svg), .band, .rim, .tick, .tick-major, .cardinal, .north, .marker, .readout, .readout-cardinal
  return '<svg id="compass3d" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + (RADIUS * scale).toFixed(1) + 'px">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Attitude horizon',
    columns: 'attitude[0], attitude[1]',
    w: 240,
    h: 240,
    opacity: 0.95,
    code: `function (values, time, ctx) {
  // Artificial horizon: columns = roll, pitch (INAV attitude[0], attitude[1] in decidegrees).
  // ---------- SETTINGS ----------
  var ANGLE_UNIT    = 'decideg';   // 'deg' | 'decideg' (value/10) | 'rad'
  var INVERT_ROLL   = false;       // flip roll if the horizon tilts the wrong way
  var INVERT_PITCH  = false;       // flip pitch direction
  var SMOOTH_MS     = 200;         // smoothing window for roll & pitch (ms, 0 = off)
  var DEG_PER_PX    = 0.45;        // pitch ladder density (deg per pixel at the default 240x240 size)
  var LADDER_STEP   = 10;          // degrees between numbered ladder lines
  var SKY_TOP       = '#2f6fb2';   // sky gradient top
  var SKY_HORIZON   = '#7db4e0';   // sky at the horizon
  var GROUND_HORIZON= '#9a6b3f';   // ground at the horizon
  var GROUND_BOTTOM = '#5d3f22';   // ground gradient bottom
  var LINE_COLOR    = '#ffffff';   // horizon + ladder lines
  var POINTER_COLOR = '#ff3030';   // roll pointer triangle
  var WINGS_COLOR   = '#f2a93b';   // fixed aircraft symbol
  var RING_COLOR    = 'rgba(255,255,255,.55)'; // outer ring
  var RING_WIDTH    = 2;           // at the default 240x240 size; scales with the widget
  var BG            = 'rgba(0,0,0,.35)';       // disc behind the instrument
  var FONT_SIZE     = 11;          // ladder / readout text at the default size; scales
  var SHOW_VALUES   = true;        // numeric roll/pitch readout at the bottom
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
  var hasData = typeof values[0] === 'number' || typeof values[1] === 'number';
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
  // CSS hooks: #horizon (svg), .bg, .ball, .sky, .ground, .horizon-line, .ladder, .ladder-label, .roll-tick, .roll-pointer, .wings, .wings-outline, .wings-dot, .ring, .readout
  return '<svg id="horizon" width="' + W + '" height="' + H + '">' + svg + '</svg>';
}`,
  },
];
