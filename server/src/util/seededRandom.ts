/**
 * seededRandom.ts — RNG có seed (deterministic) để sinh bàn cờ + xáo trộn câu hỏi.
 * Cùng seed → cùng kết quả ở mọi lần chạy (yêu cầu "công bằng + tái lập được").
 */

/** Băm chuỗi/số thành seed 32-bit (FNV-1a-ish). */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32: trả về hàm sinh số thực [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trả về số nguyên trong [0, n). */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates shuffle deterministic theo seed (không sửa mảng gốc). */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
