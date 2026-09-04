/**
 * basE91 decoder (Joachim Henke's encoding, the `base91` Rust crate Gyroflow uses
 * for the gyro data embedded in a .gyroflow project). 13/14-bit groups over a
 * 91-character alphabet; whitespace or foreign characters are skipped.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const DECODE = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET.charCodeAt(i)] = i;

/** @param {string} text @returns {Uint8Array} */
export function decodeBase91(text) {
  const out = new Uint8Array(Math.ceil((text.length * 14) / 16) + 2); // 2 chars → ≤ 14 bits
  let n = 0;
  let bits = 0;
  let nbits = 0;
  let v = -1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const c = code < 128 ? DECODE[code] : -1;
    if (c < 0) continue;
    if (v < 0) {
      v = c;
      continue;
    }
    v += c * 91;
    bits |= v << nbits;
    nbits += (v & 8191) > 88 ? 13 : 14;
    do {
      out[n++] = bits & 255;
      bits >>>= 8;
      nbits -= 8;
    } while (nbits > 7);
    v = -1;
  }
  if (v >= 0) out[n++] = (bits | (v << nbits)) & 255;
  return out.subarray(0, n);
}
