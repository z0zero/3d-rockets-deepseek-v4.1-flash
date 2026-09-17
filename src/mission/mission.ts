/**
 * The launch timeline. Everything in the scene is a pure function of the mission
 * clock, so the sequence is deterministic, scrubbable, and easy to reason about.
 *
 * T-0 is liftoff. The clock starts at `CLOCK_START` and the loop restarts after
 * `CLOCK_END` plus the hold at the end of the sequence.
 */
import { clamp, lerp, smootherstep, smoothstep } from '../lib/math';

/** Metres of real altitude represented by one world unit (HUD readouts only). */
export const METERS_PER_UNIT = 60;

export const ROCKET = {
  height: 30,
  radius: 1.7,
  /** Height of the launch mount above the pad deck. */
  padTop: 6,
  /** Maximum altitude reached at main engine cutoff. */
  burnAltitude: 536,
} as const;

export const CLOCK_START = -12;
export const CLOCK_END = 22.5;
/** Seconds the final wide sky shot is held before the sequence loops. */
export const CLOCK_HOLD = 4;
export const LOOP_DURATION = CLOCK_END - CLOCK_START + CLOCK_HOLD;

export type PhaseId =
  | 'PRELAUNCH'
  | 'IGNITION'
  | 'LIFTOFF'
  | 'ASCENT'
  | 'HIGH_ASCENT'
  | 'COAST';

export interface Phase {
  id: PhaseId;
  label: string;
  /** Clock second at which the phase begins. */
  start: number;
}

export const PHASES: Phase[] = [
  { id: 'PRELAUNCH', label: 'Pre-launch', start: CLOCK_START },
  { id: 'IGNITION', label: 'Ignition', start: -6.5 },
  { id: 'LIFTOFF', label: 'Liftoff', start: 0 },
  { id: 'ASCENT', label: 'Ascent', start: 4 },
  { id: 'HIGH_ASCENT', label: 'High ascent', start: 11 },
  { id: 'COAST', label: 'MECO / coast', start: 16.5 },
];

export interface MissionSample {
  /** Mission elapsed time in seconds; negative before liftoff. */
  t: number;
  phase: Phase;
  /** Progress through the current phase, 0..1. */
  phaseProgress: number;
  /** Engine throttle, 0..1. */
  throttle: number;
  /** Height of the rocket base above its stowed position, in world units. */
  altitude: number;
  /** Vertical speed in world units per second. */
  velocity: number;
  /** Vertical acceleration in world units per second squared. */
  acceleration: number;
  /** Structural shudder while the vehicle is held down, 0..1. */
  shudder: number;
  /** Camera shake amplitude, 0..1. */
  shake: number;
  /** Pad deluge / exhaust smoke emission strength, 0..1. */
  padSmoke: number;
  /** Engine exhaust trail emission strength, 0..1. */
  trailSmoke: number;
  /** Cryogenic venting before ignition, 0..1. */
  venting: number;
  /** Flame length multiplier. */
  flame: number;
  /** Metres above the pad, for the HUD. */
  altitudeMeters: number;
  /** Speed in km/h, for the HUD. */
  speedKmh: number;
  /** Y position of the rocket's centre. */
  rocketY: number;
  /** Y position of the engine nozzle exit plane. */
  nozzleY: number;
  /** Whether the loop has finished and the final shot is being held. */
  holding: boolean;
}

const BURN_END = 16.5;
const LIFT_A = 0.9; // slow initial climb while clearing the tower
const LIFT_END = 4;
const MAIN_A = 6.2; // sustained acceleration to MECO
const COAST_A = -3;

/**
 * Vertical motion profile: a gentle initial climb, sustained acceleration to
 * MECO, then a ballistic coast.
 */
function verticalProfile(t: number) {
  if (t <= 0) return { altitude: 0, velocity: 0, acceleration: 0 };

  if (t < LIFT_END) {
    return {
      altitude: 0.5 * LIFT_A * t * t,
      velocity: LIFT_A * t,
      acceleration: LIFT_A,
    };
  }

  const altAt = 0.5 * LIFT_A * LIFT_END * LIFT_END;
  const vAt = LIFT_A * LIFT_END;
  const d = t - LIFT_END;

  if (t < BURN_END) {
    return {
      altitude: altAt + vAt * d + 0.5 * MAIN_A * d * d,
      velocity: vAt + MAIN_A * d,
      acceleration: MAIN_A,
    };
  }

  const burnD = BURN_END - LIFT_END;
  const altBurn = altAt + vAt * burnD + 0.5 * MAIN_A * burnD * burnD;
  const vBurn = vAt + MAIN_A * burnD;
  const c = t - BURN_END;
  return {
    altitude: altBurn + vBurn * c + 0.5 * COAST_A * c * c,
    velocity: Math.max(0, vBurn + COAST_A * c),
    acceleration: COAST_A,
  };
}

function phaseAt(t: number): Phase {
  let current = PHASES[0];
  for (const p of PHASES) if (t >= p.start) current = p;
  return current;
}

/**
 * Samples the whole vehicle state at a given mission clock time.
 * `clock` may run past `CLOCK_END`; the caller wraps it with `wrapClock`.
 */
export function sampleMission(clock: number): MissionSample {
  const t = Math.max(clock, CLOCK_START);
  const { altitude, velocity, acceleration } = verticalProfile(t);

  // Engine spool-up: turbopumps ramp, then thrust stabilises on the hold-downs.
  const spool = smootherstep(-7.2, -1.4, t);
  const throttle =
    t >= BURN_END ? clamp(1 - smoothstep(BURN_END, BURN_END + 1.6, t)) : clamp(spool);

  // A brief igniter charge burns before the main engines reach full thrust.
  // Kept separate from throttle so spool-up stays strictly monotonic and the
  // flame does not visibly shrink on the pad.
  const igniter = smoothstep(-5.4, -4.9, t) * (1 - smoothstep(-4.9, -3.6, t));

  const held = t < 0;
  const shudder = held ? smoothstep(-5.2, -1.2, t) : 0;

  // Strongest shake on the pad, easing as the vehicle climbs away.
  const distanceFalloff = 1 - smoothstep(0, 90, altitude);
  const shake = clamp(throttle * (0.35 + 0.65 * distanceFalloff)) * (0.15 + 0.85 * holdingShake(t));

  // Deluge water and blast smoke. Both fade out well after the vehicle is gone.
  const deluge = smoothstep(-6.2, -1.5, t) * 0.55 * (1 - smoothstep(9, 22, t));
  const blast = smoothstep(-1.5, 1.6, t) * 0.75 * (1 - smoothstep(6, 18, t));
  const padSmoke = clamp(deluge + blast);

  const trailSmoke = clamp(throttle * (1 - smoothstep(280, 520, altitude)));

  const venting = clamp((1 - smoothstep(-7.5, -5.4, t)) * smoothstep(CLOCK_START, CLOCK_START + 1.5, t));
  const flame =
    clamp(throttle * 0.55 + smoothstep(-1.6, 0.4, t) * 0.75 + igniter * 0.18) *
    (1 - smoothstep(BURN_END, BURN_END + 1.2, t));

  const rocketY = ROCKET.padTop + ROCKET.height / 2 + altitude;
  const nozzleY = ROCKET.padTop + altitude;

  return {
    t,
    phase: phaseAt(t),
    phaseProgress: 0,
    throttle,
    altitude,
    velocity,
    acceleration,
    shudder,
    shake,
    padSmoke,
    trailSmoke,
    venting,
    flame,
    altitudeMeters: altitude * METERS_PER_UNIT,
    speedKmh: velocity * METERS_PER_UNIT * 3.6,
    rocketY,
    nozzleY,
    holding: clock > CLOCK_END,
  };
}

/** Small helper so the shake value stays readable above. */
function holdingShake(t: number) {
  return 1 - smoothstep(BURN_END - 1, BURN_END + 2, t) * 0.85;
}

/** Wraps a monotonically increasing time into the looping mission clock. */
export function wrapClock(elapsed: number) {
  const wrapped = elapsed % LOOP_DURATION;
  return CLOCK_START + wrapped;
}

/** Fills in phase progress once the phase is known. */
export function withPhaseProgress(sample: MissionSample): MissionSample {
  const index = PHASES.indexOf(sample.phase);
  const next = PHASES[index + 1];
  const end = next ? next.start : CLOCK_END;
  const span = Math.max(0.001, end - sample.phase.start);
  return { ...sample, phaseProgress: clamp((sample.t - sample.phase.start) / span) };
}

/** Human readable mission clock, e.g. `T-00:04` or `T+00:12`. */
export function missionClockLabel(t: number) {
  const sign = t < 0 ? '-' : '+';
  const s = Math.abs(t);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `T${sign}${mm}:${ss}`;
}

/** Eases one number toward another; re-exported for scene components. */
export { lerp };