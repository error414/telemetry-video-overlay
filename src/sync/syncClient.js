/** Promise wrapper around syncWorker.js — one job at a time, cancel = terminate. */
let worker = null;
let seq = 0;
let current = null; // { msgId, resolve, reject, onProgress }

function get() {
  if (!worker) {
    worker = new Worker(new URL('./syncWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { msgId, progress, result, error } = e.data;
      if (!current || current.msgId !== msgId) return;
      if (progress) {
        if (current.onProgress) current.onProgress(progress);
        return;
      }
      const job = current;
      current = null;
      if (error) job.reject(new Error(error));
      else job.resolve(result);
    };
    worker.onerror = (e) => {
      if (current) current.reject(new Error(e.message || 'sync worker failed'));
      current = null;
    };
  }
  return worker;
}

/**
 * Run the video × gyro sync in the worker. `input` is what runVideoGyroSync takes
 * (frames: Uint8Array — its buffer is transferred, so it is unusable afterwards).
 */
export function runSyncInWorker(input, onProgress) {
  if (current) throw new Error('A sync analysis is already running');
  return new Promise((resolve, reject) => {
    const msgId = ++seq;
    current = { msgId, resolve, reject, onProgress };
    const frames = input.frames.byteOffset === 0 && input.frames.byteLength === input.frames.buffer.byteLength ? input.frames : new Uint8Array(input.frames);
    get().postMessage({ ...input, frames, msgId, type: 'run' }, [frames.buffer]);
  });
}

/** Abort the running analysis (the worker is thrown away; the next run starts a fresh one). */
export function cancelSync() {
  if (!current) return;
  const job = current;
  current = null;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  job.reject(new Error('cancelled'));
}
