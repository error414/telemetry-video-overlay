/**
 * Worker running the auto sync computations (tracking a few hundred frames takes
 * seconds and parsing a Gyroflow project ~1 s — neither may block the UI). Messages:
 *   in : { msgId, type: 'video',    ...input of runVideoGyroSync (frames transferred) }
 *        { msgId, type: 'gyroflow', ...input of runGyroflowSync (camera arrays transferred) }
 *        { msgId, type: 'gyroflow:load', text }   → loadGyroflow(text)
 *   out: { msgId, progress: { fraction, phase } } … then { msgId, result, transfer } or { msgId, error }
 */
import { runVideoGyroSync, runGyroflowSync } from './autoSync.js';
import { loadGyroflow } from './gyroflow.js';

self.onmessage = async (e) => {
  const m = e.data;
  const onProgress = (fraction, phase) => self.postMessage({ msgId: m.msgId, progress: { fraction, phase } });
  try {
    let result;
    let transfer = [];
    if (m.type === 'video') result = runVideoGyroSync({ ...m, onProgress });
    else if (m.type === 'gyroflow') result = runGyroflowSync({ ...m, onProgress });
    else if (m.type === 'gyroflow:load') {
      result = await loadGyroflow(m.text);
      transfer = [result.camera.t.buffer, result.camera.v.buffer];
    } else throw new Error(`unknown sync job "${m.type}"`);
    self.postMessage({ msgId: m.msgId, result }, transfer);
  } catch (err) {
    self.postMessage({ msgId: m.msgId, error: String((err && err.message) || err) });
  }
};
