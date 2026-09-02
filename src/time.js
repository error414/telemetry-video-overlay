/** Seconds → "m:ss.mmm" (used by the sync bar and the export panel). */
export function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00.000';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m + ':' + sec.toFixed(3).padStart(6, '0');
}

/** "m:ss.mmm", "ss.mmm" or plain seconds → seconds; NaN when the text is not a time. */
export function parseTime(text) {
  const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d*)?)\s*$/.exec(text || '');
  if (!m) return NaN;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2].replace(',', '.'));
}
