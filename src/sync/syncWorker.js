/**
 * Worker running the auto sync computation (tracking a few hundred frames takes
 * seconds — it must not block the UI). Messages:
 *   in : { msgId, type: 'run', ...input of runVideoGyroSync (frames transferred) }
 *   out: { msgId, progress: { fraction, phase } } … then { msgId, result } or { msgId, error }
 */
import { runVideoGyroSync } from './autoSync.js';

self.onmessage = (e) => {
  const m = e.data;
  if (m.type !== 'run') return;
  try {
    const result = runVideoGyroSync({
      ...m,
      onProgress: (fraction, phase) => self.postMessage({ msgId: m.msgId, progress: { fraction, phase } }),
    });
    self.postMessage({ msgId: m.msgId, result });
  } catch (err) {
    self.postMessage({ msgId: m.msgId, error: String((err && err.message) || err) });
  }
};
