/** Small math helpers shared by the scene. No dependencies, allocation-free. */

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 0..1 ramp between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Like smoothstep but with zero first and second derivatives at both ends. */
export function smootherstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Deterministic 1D hash in 0..1 — used for per-particle variation. */
export function hash1(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Cheap value noise in 0..1, smooth across the integer lattice. */
export function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u);
}

/** Two octaves of value noise; enough for flicker and smoke drift. */
export function fbm1(x: number) {
  return noise1(x) * 0.65 + noise1(x * 2.7 + 13.4) * 0.35;
}

/** Exponential approach that is stable at any frame rate. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Formats seconds as a T-minus / T-plus mission clock. */
export function formatClock(seconds: number) {
  const sign = seconds < 0 ? '-' : '+';
  const s = Math.abs(seconds);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `T${sign}${mm}:${ss}`;
}