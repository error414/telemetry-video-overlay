/**
 * Video ↔ telemetry time. sync = {offset, drift}: offset in seconds, drift in
 * milliseconds of telemetry gained per second of video (the two clocks run at
 * slightly different rates — DJI vs flight controller was measured at 0.5 ms/s).
 *   telemetry = video × (1 + drift / 1000) + offset
 * A plain number is accepted as an offset with no drift.
 */
export const syncScale = (sync) => 1 + (typeof sync === 'object' && sync ? sync.drift || 0 : 0) / 1000;
export const syncOffset = (sync) => (typeof sync === 'number' ? sync : (sync && sync.offset) || 0);
export const toTele = (videoSec, sync) => videoSec * syncScale(sync) + syncOffset(sync);
export const toVideo = (teleSec, sync) => (teleSec - syncOffset(sync)) / syncScale(sync);

/** Seconds → "m:ss.mmm" (used by the sync bar and the export panel). */
export function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00.000';
  const sign = s < 0 ? '-' : '';
  const a = Math.abs(s);
  const m = Math.floor(a / 60);
  const sec = a - m * 60;
  return sign + m + ':' + sec.toFixed(3).padStart(6, '0');
}

/** "m:ss.mmm", "ss.mmm" or plain seconds → seconds; NaN when the text is not a time. */
export function parseTime(text) {
  const m = /^\s*(?:(\d+):)?(\d+(?:[.,]\d*)?)\s*$/.exec(text || '');
  if (!m) return NaN;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2].replace(',', '.'));
}
