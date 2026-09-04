/**
 * Minimal CBOR decoder (RFC 8949) — enough for the serde/ciborium output inside a
 * .gyroflow project: integers, floats, byte and text strings, arrays, maps, tags
 * (dropped), simple values and indefinite-length containers.
 *
 * Maps become JS Maps (keys may be integers, e.g. the quaternion timestamps),
 * arrays become Arrays, byte strings Uint8Array views into the input.
 */
export function decodeCbor(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const td = new TextDecoder();
  const BREAK = Symbol('break');
  let p = 0;

  function item() {
    const b = buf[p++];
    const mt = b >> 5;
    const ai = b & 31;
    let v;
    if (mt === 7 && ai >= 25 && ai <= 27) {
      if (ai === 25) v = half(dv.getUint16(p));
      else if (ai === 26) v = dv.getFloat32(p);
      else v = dv.getFloat64(p);
      p += ai === 25 ? 2 : ai === 26 ? 4 : 8;
      return v;
    }
    if (ai < 24) v = ai;
    else if (ai === 24) v = buf[p++];
    else if (ai === 25) (v = dv.getUint16(p)), (p += 2);
    else if (ai === 26) (v = dv.getUint32(p)), (p += 4);
    else if (ai === 27) (v = Number(dv.getBigUint64(p))), (p += 8);
    else if (ai === 31) v = -1; // indefinite length
    else throw new Error(`CBOR: bad additional info ${ai} at byte ${p - 1}`);

    switch (mt) {
      case 0:
        return v;
      case 1:
        return -1 - v;
      case 2:
      case 3: {
        if (v < 0) {
          const parts = [];
          for (;;) {
            const x = item();
            if (x === BREAK) break;
            parts.push(x);
          }
          return mt === 3 ? parts.join('') : concat(parts);
        }
        const s = buf.subarray(p, p + v);
        p += v;
        return mt === 3 ? td.decode(s) : s;
      }
      case 4: {
        if (v < 0) {
          const a = [];
          for (;;) {
            const x = item();
            if (x === BREAK) break;
            a.push(x);
          }
          return a;
        }
        const a = new Array(v);
        for (let i = 0; i < v; i++) a[i] = item();
        return a;
      }
      case 5: {
        const m = new Map();
        if (v < 0) {
          for (;;) {
            const k = item();
            if (k === BREAK) break;
            m.set(k, item());
          }
          return m;
        }
        for (let i = 0; i < v; i++) {
          const k = item();
          m.set(k, item());
        }
        return m;
      }
      case 6:
        return item(); // tag dropped, content kept
      default:
        if (ai === 20) return false;
        if (ai === 21) return true;
        if (ai === 22) return null;
        if (ai === 23) return undefined;
        if (ai === 31) return BREAK;
        return v;
    }
  }

  function half(h) {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 31;
    const f = h & 1023;
    if (e === 0) return s * 2 ** -14 * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * 2 ** (e - 15) * (1 + f / 1024);
  }

  function concat(parts) {
    let n = 0;
    for (const x of parts) n += x.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const x of parts) out.set(x, o), (o += x.length);
    return out;
  }

  return item();
}
