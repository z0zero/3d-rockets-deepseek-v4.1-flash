/**
 * Camera director.
 *
 * The camera is a weighted blend of a handful of hand-authored shots. Each shot
 * is a pure function of the mission sample, so tracking shots can follow the
 * rocket while static shots stay put. Crossfades are complementary smoothsteps
 * centred on each shot boundary, which makes the transitions between the
 * ground-level launch view and the upward tracking shots continuous.
 */
import { fbm1, smoothstep } from '../lib/math';
import type { MissionSample } from './mission';

export interface CameraState {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  /** Dominant shot after blending. */
  shotId: string;
  shotLabel: string;
}

type Vec3Tuple = [number, number, number];

interface Shot {
  id: string;
  label: string;
  /** Mission clock second at which this shot becomes active. */
  from: number;
  /** Crossfade duration centred on the boundary entering this shot. */
  blend: number;
  fov: number;
  /** Camera position; a function of the mission sample for tracking shots. */
  position: (m: MissionSample) => Vec3Tuple;
  /** Point the camera aims at. */
  lookAt: (m: MissionSample) => Vec3Tuple;
}

const staticPosition =
  (x: number, y: number, z: number): ((m: MissionSample) => Vec3Tuple) =>
  () => [x, y, z];

const staticLook =
  (x: number, y: number, z: number): ((m: MissionSample) => Vec3Tuple) =>
  () => [x, y, z];

/**
 * The shot list. Read top to bottom it is the intended edit:
 * establishing wide, push in, low hero angle on ignition, wide as the pad is
 * engulfed, then a ground track that hands off to a rising tracking shot and
 * finally a distant wide as the vehicle becomes a speck in the sky.
 */
export const SHOTS: Shot[] = [
  {
    id: 'ESTABLISH',
    label: 'Wide — launch complex',
    from: -12,
    blend: 0,
    fov: 38,
    position: staticPosition(62, 24, 92),
    lookAt: staticLook(0, 24, 0),
  },
  {
    id: 'TOWER',
    label: 'Medium — vehicle on pad',
    from: -7.6,
    blend: 2.2,
    fov: 40,
    position: staticPosition(30, 13, 45),
    lookAt: staticLook(0, 20, 0),
  },
  {
    id: 'ENGINE',
    label: 'Low angle — engine section',
    from: -3.4,
    blend: 1.2,
    fov: 45,
    position: staticPosition(17, 2.4, 26),
    lookAt: staticLook(0, 12, 0),
  },
  {
    id: 'PAD_WIDE',
    label: 'Wide — pad and deluge',
    from: 1.6,
    blend: 1.6,
    fov: 43,
    position: staticPosition(48, 9, 64),
    lookAt: staticLook(0, 28, 0),
  },
  {
    id: 'TRACK_GROUND',
    label: 'Ground track',
    from: 6.2,
    blend: 1.8,
    fov: 40,
    position: staticPosition(40, 10, 54),
    lookAt: (m) => [0, m.rocketY + m.velocity * 0.18, 0],
  },
  {
    id: 'TRACK_RISE',
    label: 'Rising track',
    from: 10.6,
    blend: 2.2,
    fov: 40,
    position: (m) => [30, m.rocketY * 0.5 + 18, 26],
    lookAt: (m) => [0, m.rocketY + m.velocity * 0.1, 0],
  },
  {
    id: 'HIGH_WIDE',
    label: 'High wide',
    from: 15.2,
    blend: 2.4,
    fov: 36,
    position: (m) => [110, m.rocketY * 0.55 + 40, 130],
    lookAt: (m) => [0, m.rocketY, 0],
  },
  {
    id: 'SKY',
    label: 'Upper atmosphere',
    from: 19.6,
    blend: 2.6,
    fov: 30,
    // Kept below the vehicle looking up, so the frame is dominated by open sky.
    position: (m) => [205, m.rocketY * 0.8 + 25, 255],
    lookAt: (m) => [0, m.rocketY - 6, 0],
  },
];

const BOUNDARY_BLEND = SHOTS.map((s) => s.blend);

function weightFor(index: number, t: number) {
  let w = 1;

  if (index > 0) {
    const boundary = SHOTS[index].from;
    const d = BOUNDARY_BLEND[index] || 1;
    w *= smoothstep(boundary - d / 2, boundary + d / 2, t);
  }

  if (index < SHOTS.length - 1) {
    const boundary = SHOTS[index + 1].from;
    const d = BOUNDARY_BLEND[index + 1] || 1;
    w *= 1 - smoothstep(boundary - d / 2, boundary + d / 2, t);
  }

  return w;
}

/** Blends the shot list into a single camera state for the given sample. */
export function directCamera(m: MissionSample): CameraState {
  const t = m.t;

  let total = 0;
  let px = 0;
  let py = 0;
  let pz = 0;
  let lx = 0;
  let ly = 0;
  let lz = 0;
  let fov = 0;
  let best = 0;
  let bestWeight = -1;

  for (let i = 0; i < SHOTS.length; i++) {
    const w = weightFor(i, t);
    if (w <= 0.0001) continue;

    const shot = SHOTS[i];
    const p = shot.position(m);
    const l = shot.lookAt(m);

    px += p[0] * w;
    py += p[1] * w;
    pz += p[2] * w;
    lx += l[0] * w;
    ly += l[1] * w;
    lz += l[2] * w;
    fov += shot.fov * w;
    total += w;

    if (w > bestWeight) {
      bestWeight = w;
      best = i;
    }
  }

  if (total <= 0.0001) {
    const shot = SHOTS[SHOTS.length - 1];
    const p = shot.position(m);
    const l = shot.lookAt(m);
    return { position: p, lookAt: l, fov: shot.fov, shotId: shot.id, shotLabel: shot.label };
  }

  px /= total;
  py /= total;
  pz /= total;
  lx /= total;
  ly /= total;
  lz /= total;
  fov /= total;

  // Handheld drift plus engine-driven shake. Shake is deliberately applied to
  // both the eye and the aim so the frame rattles instead of merely sliding.
  const shake = m.shake;
  const ts = t * 9.5;
  const amplitude = shake * 1.5;
  const dx = (fbm1(ts) - 0.5) * 2 * amplitude;
  const dy = (fbm1(ts + 41.3) - 0.5) * 2 * amplitude;
  const dz = (fbm1(ts + 91.7) - 0.5) * 2 * amplitude;

  const drift = 0.35;
  const hx = (fbm1(t * 0.23 + 7.1) - 0.5) * 2 * drift;
  const hy = (fbm1(t * 0.19 + 3.7) - 0.5) * 2 * drift;

  const shot = SHOTS[best];
  return {
    position: [px + dx + hx, py + dy + hy, pz + dz],
    lookAt: [lx + dx * 0.55, ly + dy * 0.55, lz + dz * 0.55],
    fov,
    shotId: shot.id,
    shotLabel: shot.label,
  };
}