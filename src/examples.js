// Example widgets seeded into the library. Every example starts with a SETTINGS block –
// change values there (colors, sizes, units, arrow style…). They can be deleted from the
// Library tab and are refreshed automatically when EXAMPLES_VERSION changes.

// Bump when examples change: the library's "Example:" entries are refreshed automatically.
export const EXAMPLES_VERSION = 10;

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
  var SIZE       = 64;           // value font size (px)
  var SHADOW     = '0 0 8px rgba(0,0,0,.9)';  // text shadow ('' = none)
  var BG         = 'transparent';// box background, e.g. 'rgba(0,0,0,.4)'
  var RADIUS     = 8;            // box corner radius (px)
  var ALIGN      = 'left';       // 'left' | 'center' | 'right'
  var SHOW_MAX   = false;        // show whole-flight maximum under the value
  // -------------------------------
  var v = values[0];
  var txt = (typeof v === 'number') ? (v * MULTIPLIER).toFixed(DIGITS) : '--';
  var st = SHOW_MAX ? ctx.stats(ctx.columns[0]) : null;
  // CSS hooks: #bignum (box), .label, .value, .unit, .max
  return '<div id="bignum" class="box" style="width:100%;height:100%;box-sizing:border-box;padding:4px 10px;background:' + BG
    + ';border-radius:' + RADIUS + 'px;font-family:' + FONT + ';color:' + COLOR + ';text-shadow:' + SHADOW + ';text-align:' + ALIGN + '">'
    + (LABEL ? '<div class="label" style="font-size:' + Math.round(SIZE * 0.28) + 'px;color:' + LABEL_COLOR + ';letter-spacing:2px">' + LABEL + '</div>' : '')
    + '<div class="value" style="font-size:' + SIZE + 'px;font-weight:bold;line-height:1">' + txt
    + ' <span class="unit" style="font-size:' + Math.round(SIZE * 0.35) + 'px;font-weight:normal">' + UNIT + '</span></div>'
    + (st ? '<div class="max" style="font-size:' + Math.round(SIZE * 0.25) + 'px;color:' + LABEL_COLOR + '">max ' + (st.max * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</div>' : '')
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
  var BAR_COLOR  = 'linear-gradient(90deg,#3f3,#ff3,#f33)'; // css color or gradient
  var BG         = 'rgba(0,0,0,.5)';
  var BORDER     = '2px solid #fff';
  var RADIUS     = 6;
  var TEXT_COLOR = '#fff';
  var FONT       = 'bold 18px Arial';
  var DIRECTION  = 'horizontal'; // 'horizontal' | 'vertical'
  // -------------------------------
  var st = (MIN === null || MAX === null) ? ctx.stats(ctx.columns[0]) : null;
  if (MIN === null) MIN = st ? st.min : 0;
  if (MAX === null) MAX = st ? st.max : 1;
  if (MAX === MIN) MAX = MIN + 1;
  var v = values[0];
  var p = Math.max(0, Math.min(1, ((typeof v === 'number' ? v : MIN) - MIN) / (MAX - MIN)));
  var text = LABEL + (SHOW_VALUE === 'percent' ? ' ' + (p * 100).toFixed(DIGITS) + '%' : SHOW_VALUE === 'raw' ? ' ' + ctx.fmt(v, DIGITS) : '');
  var fill = DIRECTION === 'vertical'
    ? 'position:absolute;left:0;bottom:0;width:100%;height:' + (p * 100).toFixed(1) + '%'
    : 'position:absolute;left:0;top:0;height:100%;width:' + (p * 100).toFixed(1) + '%';
  // CSS hooks: #gauge (box), .fill, .text
  return '<div id="gauge" class="box" style="position:relative;width:100%;height:100%;box-sizing:border-box;background:' + BG + ';border:' + BORDER + ';border-radius:' + RADIUS + 'px;overflow:hidden">'
    + '<div class="fill" style="' + fill + ';background:' + BAR_COLOR + '"></div>'
    + '<div class="text" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:' + TEXT_COLOR + ';font:' + FONT + ';text-shadow:0 0 4px #000">' + text + '</div>'
    + '</div>';
}`,
  },
  {
    name: 'Example: Line graph (history)',
    columns: 'BaroAlt (cm)',
    w: 400,
    h: 150,
    opacity: 0.9,
    code: `function (values, time, ctx) {
  // ---------- SETTINGS ----------
  var WINDOW_MS  = 20000;        // how much history to show (ms)
  var LABEL      = 'ALT';        // label ('' = column name)
  var MULTIPLIER = 0.01;         // value scaling (cm -> m = 0.01)
  var DIGITS     = 1;
  var UNIT       = 'm';
  var LINE_COLOR = '#00ff00';
  var LINE_WIDTH = 2;
  var FILL       = 'rgba(0,255,0,.15)';  // area under the line ('' = none)
  var BG         = 'rgba(0,0,0,.4)';
  var RADIUS     = 8;
  var TEXT_COLOR = '#fff';
  var FONT_SIZE  = 14;
  var SCALE      = 'flight';     // 'flight' = fixed axis from whole-flight min/max (no jumping),
                                 // 'window' = autoscale to visible history, 'fixed' = use MIN/MAX
  var MIN        = 0;            // used when SCALE = 'fixed'
  var MAX        = 100;
  var SHOW_GRID  = true;
  // -------------------------------
  var pts = ctx.range(ctx.columns[0], time - WINDOW_MS, time, 300);
  var W = ctx.width, H = ctx.height, pad = 6;
  var min, max;
  if (SCALE === 'fixed') { min = MIN; max = MAX; }
  else if (SCALE === 'flight') { var st = ctx.stats(ctx.columns[0]); min = st ? st.min : 0; max = st ? st.max : 1; }
  else {
    min = Infinity; max = -Infinity;
    pts.forEach(function (p) { if (typeof p.v === 'number') { if (p.v < min) min = p.v; if (p.v > max) max = p.v; } });
  }
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (max === min) max = min + 1;
  var coords = [];
  pts.forEach(function (p) {
    if (typeof p.v !== 'number') return;
    var x = (p.t - (time - WINDOW_MS)) / WINDOW_MS * W;
    var y = H - pad - (p.v - min) / (max - min) * (H - 2 * pad);
    coords.push(x.toFixed(1) + ',' + y.toFixed(1));
  });
  var grid = '';
  if (SHOW_GRID) for (var i = 1; i < 4; i++) grid += '<line class="grid" x1="0" x2="' + W + '" y1="' + (H * i / 4) + '" y2="' + (H * i / 4) + '" stroke="rgba(255,255,255,.15)"/>';
  var area = (FILL && coords.length) ? '<polygon class="area" points="' + coords[0].split(',')[0] + ',' + H + ' ' + coords.join(' ') + ' ' + coords[coords.length - 1].split(',')[0] + ',' + H + '" fill="' + FILL + '"/>' : '';
  var v = values[0];
  var txt = (LABEL || ctx.columns[0]) + ': ' + (typeof v === 'number' ? (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT : '--');
  // CSS hooks: #graph (svg), .grid, .area, .line, .label
  return '<svg id="graph" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + RADIUS + 'px">' + grid + area
    + '<polyline class="line" points="' + coords.join(' ') + '" fill="none" stroke="' + LINE_COLOR + '" stroke-width="' + LINE_WIDTH + '"/>'
    + '<text class="label" x="8" y="' + (FONT_SIZE + 4) + '" fill="' + TEXT_COLOR + '" font-family="Arial" font-size="' + FONT_SIZE + '" style="text-shadow:0 0 4px #000">' + txt + '</text></svg>';
}`,
  },
  {
    name: 'Example: Flight graph (whole flight)',
    columns: 'GPS_speed (m/s)',
    w: 520,
    h: 160,
    opacity: 0.95,
    code: `function (values, time, ctx) {
  // Whole-flight area chart with a marker at the current time (like "Speed vs Time").
  // Use an altitude column for an altitude profile.
  // ---------- SETTINGS ----------
  var TITLE       = 'Speed vs Time';  // caption under the chart ('' = none)
  var UNIT        = 'km/h';
  var MULTIPLIER  = 3.6;             // m/s -> km/h; use 0.01 for cm -> m
  var DIGITS      = 1;
  var FILL_COLOR  = 'rgba(80,160,255,.85)';
  var LINE_COLOR  = 'rgba(255,255,255,.9)';
  var LINE_WIDTH  = 1;
  var MARKER_COLOR= '#e03030';       // vertical bar at current time
  var MARKER_WIDTH= 4;
  var DOT         = true;            // dot on the curve at current time
  var DOT_COLOR   = '#ffffff';
  var DOT_SIZE    = 5;
  var TEXT_COLOR  = '#ffffff';
  var FONT        = 'Arial';
  var FONT_SIZE   = 13;
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
  // -------------------------------
  var col = ctx.columns[0], W = ctx.width, H = ctx.height, s = ctx.state;
  var left = AXIS_LABELS ? FONT_SIZE * 3.2 : 6, bottom = TITLE ? FONT_SIZE + 10 : 6, top = 6, right = 8;
  var cw = W - left - right, ch = H - top - bottom;
  if (!s.pts || s.col !== col) { s.pts = ctx.all(col, MAX_POINTS); s.col = col; s.st = ctx.stats(col); }
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
    svg += '<line class="grid" x1="' + left + '" x2="' + (W - right) + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID_COLOR + '" stroke-width="1"/>';
    if (AXIS_LABELS) svg += '<text class="axis" x="' + (left - 6) + '" y="' + (y + FONT_SIZE * 0.35) + '" text-anchor="end" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + FONT_SIZE + '" font-weight="bold" style="' + sh + '">' + val.toFixed(DIGITS) + '</text>';
  }
  svg += '<path class="area" d="' + area + '" fill="' + FILL_COLOR + '"/><path class="line" d="' + d + '" fill="none" stroke="' + LINE_COLOR + '" stroke-width="' + LINE_WIDTH + '"/>';
  var v = values[0], inRange = time >= t0 && time <= t1;
  if (inRange) {
    var mx = X(time), my = typeof v === 'number' ? Y(v) : top + ch;
    svg += '<line class="marker" x1="' + mx + '" x2="' + mx + '" y1="' + my + '" y2="' + (top + ch) + '" stroke="' + MARKER_COLOR + '" stroke-width="' + MARKER_WIDTH + '"/>';
    if (DOT && typeof v === 'number') svg += '<circle class="dot" cx="' + mx + '" cy="' + my + '" r="' + DOT_SIZE + '" fill="' + DOT_COLOR + '" stroke="' + MARKER_COLOR + '" stroke-width="2"/>';
    var label = typeof v === 'number' ? (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT : '--';
    var lx = mx + 8, anchor = 'start'; if (mx > W - right - VALUE_SIZE * 4) { lx = mx - 8; anchor = 'end'; }
    svg += '<text class="value" x="' + lx + '" y="' + Math.max(top + VALUE_SIZE, my - 6) + '" text-anchor="' + anchor + '" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + VALUE_SIZE + '" font-weight="bold" style="' + sh + '">' + label + '</text>';
  }
  if (TITLE) svg += '<text class="title" x="' + (left + cw / 2) + '" y="' + (H - 4) + '" text-anchor="middle" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + FONT_SIZE + '" font-weight="bold" style="' + sh + '">' + TITLE + '</text>';
  // CSS hooks: #flightgraph (svg), .grid, .axis, .area, .line, .marker, .dot, .value, .title
  return '<svg id="flightgraph" width="' + W + '" height="' + H + '" style="background:' + BG + '">' + svg + '</svg>';
}`,
  },
  {
    name: 'Example: Altitude profile',
    columns: 'BaroAlt (cm)',
    w: 520,
    h: 140,
    opacity: 0.95,
    code: `function (values, time, ctx) {
  // Altitude over the whole flight with a dot moving along the profile.
  // ---------- SETTINGS ----------
  var MULTIPLIER  = 0.01;            // cm -> m
  var UNIT        = 'm';
  var DIGITS      = 0;
  var FILL_TOP    = 'rgba(120,200,120,.9)';   // gradient top color
  var FILL_BOTTOM = 'rgba(40,90,40,.6)';      // gradient bottom color
  var LINE_COLOR  = '#ffffff';
  var DOT_COLOR   = '#ff3030';
  var DOT_SIZE    = 6;
  var TEXT_COLOR  = '#ffffff';
  var FONT        = 'Arial';
  var FONT_SIZE   = 14;
  var SHOW_MINMAX = true;            // print flight min/max in the corner
  var BG          = 'rgba(0,0,0,.35)';
  var RADIUS      = 8;
  var MAX_POINTS  = 600;
  // -------------------------------
  var col = ctx.columns[0], W = ctx.width, H = ctx.height, s = ctx.state, pad = 8;
  if (!s.pts || s.col !== col) { s.pts = ctx.all(col, MAX_POINTS); s.col = col; s.st = ctx.stats(col); }
  var pts = s.pts, st = s.st;
  if (!pts.length || !st) return '<div style="color:#fff;font:12px Arial">no data for ' + col + '</div>';
  var t0 = pts[0].t, t1 = pts[pts.length - 1].t; if (t1 === t0) t1 = t0 + 1;
  var min = st.min, max = st.max; if (max === min) max = min + 1;
  function X(t) { return pad + (t - t0) / (t1 - t0) * (W - 2 * pad); }
  function Y(v) { return H - pad - (v - min) / (max - min) * (H - 2 * pad - FONT_SIZE); }
  var d = '', first = true;
  pts.forEach(function (p) { if (typeof p.v !== 'number') return; d += (first ? 'M' : 'L') + X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); first = false; });
  var area = d + 'L' + X(t1).toFixed(1) + ',' + (H - pad) + 'L' + X(t0).toFixed(1) + ',' + (H - pad) + 'Z';
  var id = 'g' + Math.abs(W * 31 + H);
  var svg = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + FILL_TOP + '"/><stop offset="1" stop-color="' + FILL_BOTTOM + '"/></linearGradient></defs>';
  svg += '<path class="area" d="' + area + '" fill="url(#' + id + ')"/><path class="line" d="' + d + '" fill="none" stroke="' + LINE_COLOR + '" stroke-width="1.5"/>';
  var v = values[0], sh = 'text-shadow:0 0 3px #000;';
  if (typeof v === 'number' && time >= t0 && time <= t1) {
    var x = X(time), y = Y(v);
    svg += '<circle class="dot" cx="' + x + '" cy="' + y + '" r="' + DOT_SIZE + '" fill="' + DOT_COLOR + '" stroke="#fff" stroke-width="2"/>';
    var lx = x + 10, anchor = 'start'; if (x > W - 80) { lx = x - 10; anchor = 'end'; }
    svg += '<text class="value" x="' + lx + '" y="' + (y - 8) + '" text-anchor="' + anchor + '" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + (FONT_SIZE * 1.3) + '" font-weight="bold" style="' + sh + '">' + (v * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</text>';
  }
  if (SHOW_MINMAX) svg += '<text class="minmax" x="' + (W - pad) + '" y="' + (FONT_SIZE + 2) + '" text-anchor="end" fill="' + TEXT_COLOR + '" font-family="' + FONT + '" font-size="' + FONT_SIZE + '" style="' + sh + '">min ' + (min * MULTIPLIER).toFixed(DIGITS) + ' / max ' + (max * MULTIPLIER).toFixed(DIGITS) + ' ' + UNIT + '</text>';
  // CSS hooks: #profile (svg), .area, .line, .dot, .value, .minmax
  return '<svg id="profile" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + RADIUS + 'px">' + svg + '</svg>';
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
  var STICK_SIZE  = 9;
  var TRAIL       = true;            // short trail of the stick movement
  var TRAIL_MS    = 600;
  var TRAIL_COLOR = 'rgba(242,169,59,.5)';
  var LABELS      = true;            // T/Y/P/R labels
  var LABEL_COLOR = 'rgba(255,255,255,.7)';
  var LABEL_SIZE  = 10;              // label font size (px)
  var LABEL_FONT  = 'Arial';         // label font family
  var LABEL_BOLD  = false;
  var RADIUS      = 8;
  var GAP         = 10;              // px between the two boxes
  // -------------------------------
  // Elements carry ids/classes so the widget's CSS tab can restyle them:
  //   #box-left / #box-right (rect.box), .grid, .trail, .stick, .label
  var W = ctx.width, H = ctx.height, size = Math.min(H, (W - GAP) / 2), pad = STICK_SIZE + 2;
  var x0 = (W - (2 * size + GAP)) / 2, y0 = (H - size) / 2;
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
    var g = '<g id="' + id + '" class="stickbox"><rect class="box" x="' + bx + '" y="' + y0 + '" width="' + size + '" height="' + size + '" rx="' + RADIUS + '" fill="' + BG + '" stroke="' + BORDER + '" stroke-width="1.5"/>';
    g += '<line class="grid" x1="' + (bx + size / 2) + '" x2="' + (bx + size / 2) + '" y1="' + y0 + '" y2="' + (y0 + size) + '" stroke="' + GRID + '"/>';
    g += '<line class="grid" x1="' + bx + '" x2="' + (bx + size) + '" y1="' + (y0 + size / 2) + '" y2="' + (y0 + size / 2) + '" stroke="' + GRID + '"/>';
    if (tr.length > 1) g += '<polyline class="trail" points="' + tr.map(function (p) { return (bx + pad + p[0] * (size - 2 * pad)).toFixed(1) + ',' + (y0 + size - pad - p[1] * (size - 2 * pad)).toFixed(1); }).join(' ') + ' ' + cx.toFixed(1) + ',' + cy.toFixed(1) + '" fill="none" stroke="' + TRAIL_COLOR + '" stroke-width="2" stroke-linecap="round"/>';
    g += '<circle class="stick" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + STICK_SIZE + '" fill="' + STICK_COLOR + '" stroke="#000" stroke-width="1.5"/>';
    var fw = LABEL_BOLD ? ' font-weight="bold"' : '';
    if (LABELS) g += '<text class="label label-top" x="' + (bx + 5) + '" y="' + (y0 + LABEL_SIZE + 2) + '" fill="' + LABEL_COLOR + '" font-family="' + LABEL_FONT + '" font-size="' + LABEL_SIZE + '"' + fw + '>' + lab[0] + '</text><text class="label label-bottom" x="' + (bx + size - 5) + '" y="' + (y0 + size - 5) + '" text-anchor="end" fill="' + LABEL_COLOR + '" font-family="' + LABEL_FONT + '" font-size="' + LABEL_SIZE + '"' + fw + '>' + lab[1] + '</text>';
    return g + '</g>';
  }
  var svg = box('box-left', x0, left, trail.l, MODE === 1 ? ['PITCH', 'YAW'] : ['THR', 'YAW']) + box('box-right', x0 + size + GAP, right, trail.r, MODE === 1 ? ['THR', 'ROLL'] : ['PITCH', 'ROLL']);
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
  var MODE        = 'fit';          // 'fit' = whole flight fits the box, 'follow' = follow aircraft at ZOOM
  var ZOOM        = 16;             // zoom for 'follow' mode (max 19)
  var ROTATE_MAP  = false;          // 'follow' mode: rotate the map so heading points up
  var BG          = 'rgba(0,0,0,.45)';
  var RADIUS      = 10;
  var BORDER      = '1px solid rgba(255,255,255,.4)';
  var PADDING     = 20;             // px kept free around the track in 'fit' mode
  var TRACK_COLOR = 'rgba(255,255,255,.9)';
  var TRACK_WIDTH = 2;
  var TRAIL_COLOR = '#00ffff';      // already-flown part of the track ('' = same as TRACK_COLOR)
  var TRAIL_WIDTH = 3;
  var ARROW_STYLE = 'arrow';        // 'arrow' | 'plane' | 'chevron' | 'dot'
  var ARROW_SIZE  = 18;
  var ARROW_COLOR = '#ff3030';
  var ARROW_STROKE= '#ffffff';
  var HEADING_UNIT= 'deg';          // 'deg' | 'decideg' (value/10) | 'rad'
  var HEADING_OFFSET = 0;           // add degrees if the arrow points the wrong way
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
  var zoom = MODE === 'follow' ? Math.min(19, ZOOM) : s.fitZoom;
  var c;
  if (MODE === 'follow' && hasPos) c = px(lat0, lon0, zoom);
  else { var a1 = px(s.maxLat, s.minLon, zoom), b1 = px(s.minLat, s.maxLon, zoom); c = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2]; }
  var ox = c[0] - W / 2, oy = c[1] - H / 2;
  // heading
  var hd = values[2];
  if (typeof hd === 'number') { if (HEADING_UNIT === 'decideg') hd /= 10; else if (HEADING_UNIT === 'rad') hd = hd * 180 / Math.PI; hd += HEADING_OFFSET; }
  else { // fall back to direction of travel
    var idx = -1; for (var k = 0; k < s.path.length; k++) if (s.path[k].t <= time) idx = k; else break;
    if (idx > 0) { var p1 = px(s.path[idx - 1].lat, s.path[idx - 1].lon, zoom), p2 = px(s.path[idx].lat, s.path[idx].lon, zoom); hd = Math.atan2(p2[0] - p1[0], -(p2[1] - p1[1])) * 180 / Math.PI; } else hd = 0;
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
  var STYLE        = 'tape';       // 'tape' (sliding ribbon) | 'rose' (rotating rose)
  var COLOR        = '#fff';
  var ACCENT       = '#ff3030';    // needle / center mark
  var BG           = 'rgba(0,0,0,.45)';
  var RADIUS       = 8;
  var FONT_SIZE    = 14;
  var DEG_PER_PX   = 1;            // tape: degrees per pixel (smaller = wider view)
  // -------------------------------
  var hd = values[0]; if (typeof hd !== 'number') hd = 0;
  if (HEADING_UNIT === 'decideg') hd /= 10; else if (HEADING_UNIT === 'rad') hd = hd * 180 / Math.PI;
  hd = ((hd % 360) + 360) % 360;
  var W = ctx.width, H = ctx.height, names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' };
  var svg = '';
  if (STYLE === 'rose') {
    var cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 4;
    svg += '<g class="rose" transform="translate(' + cx + ',' + cy + ') rotate(' + (-hd) + ')">';
    for (var a = 0; a < 360; a += 15) {
      var big = a % 90 === 0, len = big ? r * 0.25 : a % 45 === 0 ? r * 0.18 : r * 0.1;
      svg += '<line class="tick' + (big ? ' tick-major' : '') + '" x1="0" y1="' + (-r) + '" x2="0" y2="' + (-r + len) + '" stroke="' + COLOR + '" stroke-width="' + (big ? 2 : 1) + '" transform="rotate(' + a + ')"/>';
      if (names[a] && big) svg += '<text class="tick-label" transform="rotate(' + a + ') translate(0,' + (-r + len + FONT_SIZE) + ')" text-anchor="middle" fill="' + COLOR + '" font-family="Arial" font-size="' + FONT_SIZE + '" font-weight="bold">' + names[a] + '</text>';
    }
    svg += '</g><path class="needle" d="M' + cx + ',' + (cy - r - 2) + ' l-6,-8 l12,0 z" fill="' + ACCENT + '"/>';
    svg += '<text class="heading" x="' + cx + '" y="' + (cy + FONT_SIZE / 2) + '" text-anchor="middle" fill="' + COLOR + '" font-family="Arial" font-size="' + (FONT_SIZE * 1.3) + '" font-weight="bold">' + hd.toFixed(0) + '°</text>';
  } else {
    var mid = W / 2, span = W * DEG_PER_PX / 2;
    var from = Math.ceil((hd - span) / 5) * 5, to = Math.floor((hd + span) / 5) * 5;
    for (var d = from; d <= to; d += 5) {
      var x = mid + (d - hd) / DEG_PER_PX, dd = ((d % 360) + 360) % 360, big2 = dd % 30 === 0;
      svg += '<line class="tick' + (big2 ? ' tick-major' : '') + '" x1="' + x + '" x2="' + x + '" y1="' + (H - 4) + '" y2="' + (H - (big2 ? 16 : 9)) + '" stroke="' + COLOR + '" stroke-width="' + (big2 ? 2 : 1) + '"/>';
      if (big2) svg += '<text class="tick-label" x="' + x + '" y="' + (H - 20) + '" text-anchor="middle" fill="' + COLOR + '" font-family="Arial" font-size="' + FONT_SIZE + '" font-weight="' + (names[dd] ? 'bold' : 'normal') + '">' + (names[dd] || dd) + '</text>';
    }
    svg += '<path class="needle" d="M' + mid + ',' + (H - 2) + ' l-6,-8 l12,0 z" fill="' + ACCENT + '"/>';
    svg += '<rect class="heading-bg" x="' + (mid - 22) + '" y="2" width="44" height="' + (FONT_SIZE + 6) + '" rx="3" fill="' + ACCENT + '"/><text class="heading" x="' + mid + '" y="' + (FONT_SIZE + 3) + '" text-anchor="middle" fill="#fff" font-family="Arial" font-size="' + FONT_SIZE + '" font-weight="bold">' + hd.toFixed(0) + '°</text>';
  }
  // CSS hooks: #compass (svg), .rose, .tick, .tick-major, .tick-label, .needle, .heading, .heading-bg
  return '<svg id="compass" width="' + W + '" height="' + H + '" style="background:' + BG + ';border-radius:' + RADIUS + 'px">' + svg + '</svg>';
}`,
  },
];
