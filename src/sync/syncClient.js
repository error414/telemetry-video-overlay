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
 * Run one job in the worker: `type` selects the computation (see syncWorker.js),
 * `input` is its argument object, `transfer` lists ArrayBuffers to hand over
 * instead of copying (they are unusable on this side afterwards).
 */
export function runSyncJob(type, input, onProgress, transfer = []) {
  if (current) throw new Error('A sync analysis is already running');
  return new Promise((resolve, reject) => {
    const msgId = ++seq;
    current = { msgId, resolve, reject, onProgress };
    get().postMessage({ ...input, msgId, type }, transfer);
  });
}

/** The video × gyro sync (frames: Uint8Array — its buffer is transferred). */
export function runSyncInWorker(input, onProgress) {
  const frames = input.frames.byteOffset === 0 && input.frames.byteLength === input.frames.buffer.byteLength ? input.frames : new Uint8Array(input.frames);
  return runSyncJob('video', { ...input, frames }, onProgress, [frames.buffer]);
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
