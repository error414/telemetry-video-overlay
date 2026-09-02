import { parseCsv, buildSeries } from './telemetry.js';

/**
 * CSV parsing worker. Papa.parse + buildSeries over a big blackbox CSV take
 * seconds — running them here keeps the UI thread responsive. The file arrives
 * as raw bytes (transferred, not copied) and is streamed through Papa as a Blob
 * in 10 MB chunks, so a 150 MB log never exists as one string. Rows are
 * decimated to ~120 Hz while streaming (see parseCsv). The kept rows stay in
 * this map (keyed by source id) so a time column/unit change can rebuild the
 * series without re-reading the file; only the compact series (mostly
 * Float64Arrays) are cloned to the UI.
 */
const parsedById = new Map();

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'remove') {
    parsedById.delete(m.id);
    return;
  }
  try {
    if (m.type === 'parse') {
      const input = m.bytes ? new Blob([m.bytes]) : m.text;
      const parsed = await parseCsv(input);
      parsedById.set(m.id, parsed);
      const { columns, timeColumn, timeUnit, sourceRate, step, totalRows } = parsed;
      const built = buildSeries(parsed, timeColumn, timeUnit);
      self.postMessage({ msgId: m.msgId, result: { columns, timeColumn, timeUnit, sourceRate, step, totalRows, ...built } });
    } else if (m.type === 'rebuild') {
      const parsed = parsedById.get(m.id);
      if (!parsed) throw new Error('source data no longer in worker — remove the file and add it again');
      self.postMessage({ msgId: m.msgId, result: buildSeries(parsed, m.timeColumn, m.timeUnit) });
    }
  } catch (err) {
    self.postMessage({ msgId: m.msgId, error: String((err && err.message) || err) });
  }
};
