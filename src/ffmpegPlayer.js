/**
 * FfmpegPlayer — plays the ORIGINAL video file: ffmpeg in the main process decodes it (CUDA when
 * available) and serves raw NV12 frames over loopback HTTP; here they become WebCodecs
 * VideoFrames drawn on a canvas (colour conversion on the GPU).
 *
 * Mimics the subset of the HTMLVideoElement API the app uses (currentTime, play(), pause(),
 * paused, ended, duration) so SyncBar/Stage can treat it like a <video>.
 *
 * Preview frames are scaled to `previewWidth` and capped at `maxFps`; widgets keep using full
 * video coordinates — only the picture behind them is downscaled.
 */
export default class FfmpegPlayer {
  constructor({ file, width, height, fps, duration, canvas, previewWidth = 1920, maxFps = 60, onTime, onStatus }) {
    this.file = file;
    this.duration = duration;
    this.srcFps = fps;
    this.canvas = canvas;
    this.onTime = onTime || (() => {});
    this.onStatus = onStatus || (() => {});
    const scale = Math.min(1, previewWidth / width);
    this.w = Math.round((width * scale) / 2) * 2;
    this.h = Math.round((height * scale) / 2) * 2;
    this.fps = Math.min(fps, maxFps);
    this.frameBytes = (this.w * this.h * 3) / 2;
    this._time = 0;
    this.paused = true;
    this.ended = false;
    this.queue = []; // [{pts, data}]
    this.raf = 0;
    this.stats = { drawn: 0, dropped: 0, stalls: 0 };
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    canvas.width = this.w;
    canvas.height = this.h;
    this._info = window.api.playerInfo();
    this._seekToken = 0;
    this._abort = null;
    this.usingCuda = null;
  }

  get currentTime() {
    return this._time;
  }
  set currentTime(t) {
    this.seek(t);
  }

  async _url(path, params) {
    const { port, token } = await this._info;
    const q = new URLSearchParams({ k: token, file: this.file, w: this.w, h: this.h, ...params });
    return `http://127.0.0.1:${port}${path}?${q}`;
  }

  _draw(data, pts) {
    // NV12 → VideoFrame (colour conversion happens on the GPU when drawn)
    const frame = new VideoFrame(data, { format: 'NV12', codedWidth: this.w, codedHeight: this.h, timestamp: Math.round(pts * 1e6) });
    try {
      this.ctx.drawImage(frame, 0, 0, this.w, this.h);
    } finally {
      frame.close();
    }
    this.stats.drawn++;
  }

  /** Show the exact frame at t while paused. */
  async seek(t) {
    t = Math.max(0, Math.min(this.duration, t));
    const wasPlaying = !this.paused;
    if (wasPlaying) this._stopStream();
    this.paused = true;
    this._time = t;
    this.ended = false;
    this.onTime(t);
    const token = ++this._seekToken;
    try {
      const r = await fetch(await this._url('/frame', { t }));
      const buf = await r.arrayBuffer();
      if (token !== this._seekToken) return; // superseded by a newer seek
      if (buf.byteLength >= this.frameBytes) this._draw(new Uint8Array(buf, 0, this.frameBytes), t);
    } catch (e) {
      this.onStatus('Player: frame fetch failed: ' + e.message);
    }
    if (wasPlaying) this.play();
  }

  async play() {
    if (!this.paused) return;
    if (this.ended || this._time >= this.duration - 1e-3) this._time = 0;
    this.paused = false;
    this.ended = false;
    this.queue = [];
    this.streamEnded = false;
    this.clock = null; // set when the first frame arrives
    const abort = (this._abort = new AbortController());
    this._loop();
    try {
      const res = await fetch(await this._url('/stream', { start: this._time, fps: this.fps }), { signal: abort.signal });
      this.usingCuda = res.headers.get('X-Cuda') === '1';
      const reader = res.body.getReader();
      let pending = new Uint8Array(0);
      let index = 0;
      const start = this._time;
      // read frames; when the queue is full, wait (TCP back-pressure stops ffmpeg upstream)
      for (;;) {
        if (abort.signal.aborted) break;
        if (this.queue.length >= 4) {
          await new Promise((r) => setTimeout(r, 4));
          continue;
        }
        const { value, done } = await reader.read();
        if (done) break;
        let chunk = value;
        if (pending.length) {
          const m = new Uint8Array(pending.length + chunk.length);
          m.set(pending);
          m.set(chunk, pending.length);
          chunk = m;
          pending = new Uint8Array(0);
        }
        let off = 0;
        while (chunk.length - off >= this.frameBytes) {
          this.queue.push({ pts: start + index / this.fps, data: chunk.slice(off, off + this.frameBytes) });
          index++;
          off += this.frameBytes;
        }
        if (off < chunk.length) pending = chunk.slice(off);
      }
    } catch (e) {
      if (e.name !== 'AbortError') this.onStatus('Player: stream failed: ' + e.message);
    }
    if (this._abort === abort) this.streamEnded = true;
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this._stopStream();
    this.onTime(this._time);
  }

  _stopStream() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this._abort) {
      this._abort.abort();
      this._abort = null;
      window.api.playerStop();
    }
    this.queue = [];
  }

  _loop() {
    this.raf = requestAnimationFrame(() => this._tick());
  }

  _tick() {
    if (this.paused) return;
    const now = performance.now();
    if (this.queue.length) {
      if (!this.clock) this.clock = { wall: now, pts: this.queue[0].pts }; // start the clock on the first frame
      const target = this.clock.pts + (now - this.clock.wall) / 1000;
      // take the newest frame that is due; drop older ones
      let due = null;
      while (this.queue.length && this.queue[0].pts <= target + 0.5 / this.fps) {
        if (due) this.stats.dropped++;
        due = this.queue.shift();
      }
      if (due) {
        this._time = due.pts;
        this.onTime(due.pts);
        this._draw(due.data, due.pts);
      }
    } else if (this.streamEnded) {
      // stream finished and everything drawn → end of video
      this.paused = true;
      this.ended = true;
      this._abort = null;
      this._time = this.duration;
      this.onTime(this._time);
      return;
    } else if (this.clock && now - this.clock.wall > 200) {
      // starved: re-base the clock so we don't skip a burst of frames after a stall
      this.stats.stalls++;
      this.clock = null;
    }
    this._loop();
  }

  destroy() {
    this._stopStream();
  }
}
