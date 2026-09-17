/**
 * Colours sampled from the reference footage: a bright midday launch, cyan-blue
 * sky, pale haze at the horizon, warm amber exhaust and muted scrub terrain.
 */
import { Color } from 'three';

const c = (hex: string) => new Color(hex);

export const PALETTE = {
  // Sky sampled from the reference: a saturated cyan-blue zenith that washes
  // out to pale haze at the horizon.
  skyZenith: c('#0a8ad2'),
  skyMid: c('#2ba9e0'),
  skyHorizon: c('#c6dfec'),
  haze: c('#c6dfec'),
  sun: c('#fff6e2'),

  terrainNear: c('#5c8546'),
  terrainDry: c('#8a8a5e'),
  terrainFar: c('#7f97a4'),
  concrete: c('#b9b6ad'),
  concreteDark: c('#8e8b83'),
  asphalt: c('#6e6f6c'),

  steel: c('#9aa2a6'),
  steelDark: c('#5f676b'),
  accent: c('#d2452f'),

  rocketWhite: c('#e9eaec'),
  rocketGrey: c('#c3c7cb'),
  rocketDark: c('#33383d'),

  flameCore: c('#fff8e0'),
  flameMid: c('#ffb454'),
  flameOuter: c('#f0703a'),
} as const;

/** Sun direction used by both the sky shader and the key light. */
export const SUN_DIRECTION: [number, number, number] = (() => {
  const v = [0.62, 0.68, 0.39];
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
})();