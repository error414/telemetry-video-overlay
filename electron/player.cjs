/**
 * ffmpeg-backed frame server for the preview player.
 *
 * ffmpeg decodes the ORIGINAL file (CUDA decode + scale_cuda when available), and writes raw
 * NV12 frames to stdout. They are served to the renderer over a loopback HTTP server:
 *   GET /frame?t=SEC&w=&h=            one frame (seek / frame step)
 *   GET /stream?start=SEC&w=&h=&fps=  continuous frames from `start`
 * HTTP instead of IPC: no structured-clone copies, and TCP gives natural back-pressure
 * (a paused renderer simply stops reading; ffmpeg blocks on its pipe).
 */
const { spawn } = require('child_process');
const http = require('http');
const crypto = require('crypto');

module.exports = function registerPlayer(ipcMain, ffmpegPath, canCudaDecode) {
  const token = crypto.randomBytes(12).toString('hex'); // only our renderer knows the URL
  const cudaCache = {};
  let current = null; // active stream process (one at a time)

  async function cudaFor(file) {
    if (!(file in cudaCache)) cudaCache[file] = await canCudaDecode(file);
    return cudaCache[file];
  }

  function ffArgs({ file, t, w, h, fps, cuda, single }) {
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
    let vf;
    if (cuda) {
      args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda');
      vf = (fps ? `fps=${fps},` : '') + `scale_cuda=${w}:${h}:format=nv12,hwdownload,format=nv12`;
    } else {
      vf = (fps ? `fps=${fps},` : '') + `scale=${w}:${h}:flags=fast_bilinear`;
    }
    args.push('-ss', String(Math.max(0, t || 0)), '-i', file, '-map', '0:v:0', '-an', '-sn');
    if (single) args.push('-frames:v', '1');
    args.push('-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'nv12', 'pipe:1');
    return args;
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.searchParams.get('k') !== token) {
      res.writeHead(403);
      return res.end();
    }
    const file = u.searchParams.get('file');
    const w = Number(u.searchParams.get('w'));
    const h = Number(u.searchParams.get('h'));
    let cuda = await cudaFor(file);

    if (u.pathname === '/frame') {
      const t = Number(u.searchParams.get('t') || 0);
      const run = (useCuda) =>
        new Promise((resolve) => {
          const p = spawn(ffmpegPath, ffArgs({ file, t, w, h, cuda: useCuda, single: true }), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
          const chunks = [];
          let err = '';
          p.stdout.on('data', (d) => chunks.push(d));
          p.stderr.on('data', (d) => (err += d));
          p.on('close', () => resolve({ buf: Buffer.concat(chunks), err }));
        });
      let r = await run(cuda);
      if (r.buf.length < (w * h * 3) / 2 && cuda && r.err) {
        cudaCache[file] = false; // GPU filter chain failed for this file → CPU path from now on
        r = await run(false);
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Frame-Bytes': String((w * h * 3) / 2) });
      return res.end(r.buf.subarray(0, (w * h * 3) / 2));
    }

    if (u.pathname === '/stream') {
      if (current) {
        try {
          current.kill();
        } catch {
          /* ignore */
        }
        current = null;
      }
      const start = Number(u.searchParams.get('start') || 0);
      const fps = Number(u.searchParams.get('fps') || 0);
      const proc = spawn(ffmpegPath, ffArgs({ file, t: start, w, h, fps, cuda }), { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      current = proc;
      let err = '';
      proc.stderr.on('data', (d) => (err = (err + d).slice(-1000)));
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Frame-Bytes': String((w * h * 3) / 2), 'X-Cuda': cuda ? '1' : '0' });
      proc.stdout.pipe(res); // TCP back-pressure propagates to ffmpeg
      const cleanup = () => {
        if (current === proc) current = null;
        try {
          proc.kill();
        } catch {
          /* ignore */
        }
      };
      req.on('close', cleanup);
      proc.on('close', (code) => {
        if (code && err) res.setHeader ? null : null;
        res.end();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const ready = new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

  ipcMain.handle('player:info', async () => ({ port: await ready, token }));
  ipcMain.handle('player:stop', () => {
    if (current) {
      try {
        current.kill();
      } catch {
        /* ignore */
      }
      current = null;
    }
  });
};
