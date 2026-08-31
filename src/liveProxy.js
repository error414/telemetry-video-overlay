// Plays a preview proxy that ffmpeg is still writing (fragmented MP4) through Media Source
// Extensions. A plain <video src> snapshots the file size at open and never sees new data, so
// instead the main process tail-reads the growing file (api.proxyTail) and this module:
//   - indexes the top-level boxes: init segment (ftyp+moov) and each moof+mdat fragment with
//     its start time (tfdt / mdhd timescale) and byte range,
//   - feeds the SourceBuffer a window around the playhead, re-reading fragment bytes from disk
//     on demand — the SourceBuffer quota (~100s of MB) is far below a full 4K proxy, so data
//     well behind the playhead is evicted and re-appended if the user seeks back.
// Every fragment starts on a keyframe (ffmpeg -g ≈ 1s + frag_keyframe), so appending can start
// at any fragment.

const AHEAD = 60; // seconds to keep buffered ahead of the playhead
const BEHIND = 30; // seconds to keep behind it (instant small back-seeks)
const READ_CHUNK = 8 << 20;

function u32(u8, o) {
  return ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
}
function u64(u8, o) {
  return u32(u8, o) * 4294967296 + u32(u8, o + 4);
}
function boxType(u8, o) {
  return String.fromCharCode(u8[o + 4], u8[o + 5], u8[o + 6], u8[o + 7]);
}

// first child box of `type` inside [from, to); returns [payloadFrom, payloadTo] or null
function child(u8, from, to, type) {
  let o = from;
  while (o + 8 <= to) {
    let size = u32(u8, o);
    let hdr = 8;
    if (size === 1) {
      size = u64(u8, o + 8);
      hdr = 16;
    } else if (size === 0) size = to - o;
    if (size < hdr) return null;
    if (boxType(u8, o) === type) return [o + hdr, Math.min(o + size, to)];
    o += size;
  }
  return null;
}

function descend(u8, types) {
  let r = [8, u8.length]; // u8 is a whole box incl. its 8-byte header
  for (const t of types) {
    r = child(u8, r[0], r[1], t);
    if (!r) return null;
  }
  return r;
}

function mdhdTimescale(moov) {
  const r = descend(moov, ['trak', 'mdia', 'mdhd']);
  if (!r) return null;
  const o = r[0];
  return u32(moov, o + (moov[o] === 1 ? 20 : 12));
}

function tfdtTime(moof) {
  const r = descend(moof, ['traf', 'tfdt']);
  if (!r) return null;
  const o = r[0];
  return moof[o] === 1 ? u64(moof, o + 4) : u32(moof, o + 4);
}

function concatU8(a, b) {
  const r = new Uint8Array(a.length + b.length);
  r.set(a);
  r.set(b, a.length);
  return r;
}

export function startLiveProxy(videoEl, filePath, mime, duration, startAt = 0) {
  const ms = new MediaSource();
  const url = URL.createObjectURL(ms);
  let sb = null;
  let stopped = false;

  // sequential box parser over the growing file
  let carry = new Uint8Array(0); // unparsed bytes, always starting on a box boundary
  let parseBase = 0; // file offset of carry[0]
  const initBoxes = []; // raw boxes before the first moof (ftyp, moov, …)
  let initDone = false; // first moof seen → init segment complete
  let initSent = false;
  let durationSet = false;
  let timescale = null;
  let pendingMoof = null; // { off, time } waiting for its mdat
  const frags = []; // { time, off, len } — moof+mdat byte ranges, sorted by time
  let cursor = 0; // next fragment to append
  let busy = false; // a proxyTail read for an append is in flight
  let reading = false;

  function feed(bytes) {
    carry = carry.length ? concatU8(carry, bytes) : bytes;
    let o = 0;
    while (o + 8 <= carry.length) {
      let size = u32(carry, o);
      if (size === 1 && o + 16 > carry.length) break;
      if (size === 1) size = u64(carry, o + 8);
      if (size < 8) {
        console.warn('liveProxy: malformed box, parsing stopped');
        stopped = true;
        break;
      }
      if (o + size > carry.length) break;
      const type = boxType(carry, o);
      const box = carry.subarray(o, o + size);
      const off = parseBase + o;
      if (type === 'moof') {
        initDone = true;
        const t = tfdtTime(box);
        pendingMoof = t == null || !timescale ? null : { off, time: t / timescale };
      } else if (type === 'mdat' && pendingMoof) {
        frags.push({ time: pendingMoof.time, off: pendingMoof.off, len: off + size - pendingMoof.off });
        pendingMoof = null;
      } else if (!initDone) {
        if (type === 'moov') timescale = mdhdTimescale(box) || 90000;
        initBoxes.push(box.slice());
      }
      o += size;
    }
    carry = carry.subarray(o);
    parseBase += o;
  }

  async function read() {
    if (stopped || reading) return;
    reading = true;
    try {
      for (;;) {
        const r = await window.api.proxyTail(filePath, parseBase + carry.length, READ_CHUNK);
        if (stopped || !r.data || !r.data.byteLength) break;
        feed(new Uint8Array(r.data));
        pump();
        if (r.data.byteLength < READ_CHUNK) break;
      }
    } catch {
      // file not there yet (or already remuxed away) — keep polling until stop()
    }
    reading = false;
  }

  function bufferedContains(t) {
    for (let i = 0; i < sb.buffered.length; i++) {
      if (t >= sb.buffered.start(i) - 0.3 && t <= sb.buffered.end(i)) return true;
    }
    return false;
  }

  function search(t) {
    let lo = 0;
    let hi = frags.length - 1;
    let r = 0;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (frags[m].time <= t) {
        r = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    return r;
  }

  // end of fragment i = start of the next one; the newest fragment's end is unknown yet
  const fragEnd = (i) => (i + 1 < frags.length ? frags[i + 1].time : frags[i].time + 10);

  async function pump() {
    if (stopped || !sb || busy) return;
    try {
      // the SourceBuffer throws InvalidStateError on any access once the element's source is
      // swapped (proxy finished / new video) — the outer catch swallows that teardown race
      if (ms.readyState !== 'open' || sb.updating) return;
      const t = videoEl.currentTime;
      if (initSent && !durationSet) {
        durationSet = true;
        ms.duration = duration; // empty_moov carries no duration; needed so seeking anywhere works
      }
      if (sb.buffered.length && sb.buffered.start(0) < t - AHEAD - BEHIND) {
        sb.remove(sb.buffered.start(0), t - BEHIND); // evict far behind the playhead (quota)
        return; // updateend re-pumps
      }
      if (!initSent) {
        if (!initDone) return;
        let init = new Uint8Array(0);
        for (const b of initBoxes) init = concatU8(init, b);
        sb.appendBuffer(init);
        initSent = true;
        return;
      }
      if (!frags.length) return;
      // backward seek out of the buffer (or first pump): jump the cursor to the fragment holding t
      if (!bufferedContains(t) && (cursor >= frags.length || frags[cursor].time > t + 0.01)) cursor = search(t);
      // forward: skip fragments that end before the playhead (seek ahead of the append position)
      while (cursor < frags.length && fragEnd(cursor) <= t - 0.01) cursor++;
      const f = frags[cursor];
      if (!f || f.time >= t + AHEAD) return;
      busy = true;
      let data = null;
      try {
        const r = await window.api.proxyTail(filePath, f.off, f.len);
        if (r.data && r.data.byteLength === f.len) data = r.data;
      } finally {
        busy = false;
      }
      if (stopped || !data || ms.readyState !== 'open' || sb.updating) return;
      try {
        sb.appendBuffer(data);
        cursor++;
      } catch (e) {
        if (e && e.name === 'QuotaExceededError' && sb.buffered.length && t - BEHIND > sb.buffered.start(0)) {
          sb.remove(sb.buffered.start(0), t - BEHIND);
        } else throw e;
      }
    } catch {
      // detached mid-flight or transient append failure — retried or torn down by stop()
    }
  }

  const kick = () => pump();
  ms.addEventListener('sourceopen', () => {
    if (stopped || sb) return;
    URL.revokeObjectURL(url);
    sb = ms.addSourceBuffer(mime);
    sb.addEventListener('updateend', kick);
    pump();
  });
  const onMeta = () => {
    if (startAt > 0.05) videoEl.currentTime = Math.min(startAt, duration || startAt);
  };
  videoEl.addEventListener('loadedmetadata', onMeta, { once: true });
  videoEl.addEventListener('timeupdate', kick); // keeps the AHEAD window filled while playing
  videoEl.addEventListener('seeking', kick);
  const readTimer = setInterval(read, 400);
  videoEl.src = url;
  read();

  return {
    stop() {
      stopped = true;
      clearInterval(readTimer);
      if (sb) sb.removeEventListener('updateend', kick);
      videoEl.removeEventListener('loadedmetadata', onMeta);
      videoEl.removeEventListener('timeupdate', kick);
      videoEl.removeEventListener('seeking', kick);
      URL.revokeObjectURL(url);
    },
  };
}
