/** Promise wrapper around the CSV parsing worker (see csvWorker.js). */
let worker = null;
let seq = 0;
const pending = new Map();

function get() {
  if (!worker) {
    worker = new Worker(new URL('./csvWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { msgId, result, error } = e.data;
      const p = pending.get(msgId);
      if (!p) return;
      pending.delete(msgId);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'CSV worker failed'));
      pending.clear();
    };
  }
  return worker;
}

function call(msg, transfer = []) {
  return new Promise((resolve, reject) => {
    const msgId = ++seq;
    pending.set(msgId, { resolve, reject });
    get().postMessage({ ...msg, msgId }, transfer);
  });
}

export const csvWorker = {
  /**
   * Parse a CSV (Uint8Array of the file's bytes, or a string) and build series;
   * the worker keeps the (decimated) rows under this id. The byte buffer is
   * transferred to the worker, so it is unusable by the caller afterwards.
   */
  parse: (id, data) =>
    typeof data === 'string' ? call({ type: 'parse', id, text: data }) : call({ type: 'parse', id, bytes: data }, [data.buffer]),
  /** Rebuild series of a previously parsed source with a different time column/unit. */
  rebuild: (id, timeColumn, timeUnit) => call({ type: 'rebuild', id, timeColumn, timeUnit }),
  /** Free the raw rows of a removed source. */
  remove: (id) => {
    if (worker) worker.postMessage({ type: 'remove', id });
  },
};
