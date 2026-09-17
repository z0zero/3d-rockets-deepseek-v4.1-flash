/**
 * Mutable mission runtime, shared between the render loop inside the canvas and
 * the DOM overlay outside it. Deliberately a plain object rather than React
 * state: the clock advances every frame and must not trigger re-renders.
 */
import {
  CLOCK_START,
  LOOP_DURATION,
  sampleMission,
  withPhaseProgress,
  wrapClock,
  type MissionSample,
} from './mission';

export interface MissionRuntime {
  /** Monotonic seconds since the sequence started. */
  elapsed: number;
  /** Wrapped mission clock; T-0 is liftoff. */
  clock: number;
  sample: MissionSample;
  playing: boolean;
  /** Playback rate multiplier. */
  speed: number;
  /** Pending scrub target; applied on the next frame. */
  seekTo: number | null;
  /** Set for one frame when the clock jumped, so scenes can reset emitters. */
  didSeek: boolean;
}

export function createRuntime(): MissionRuntime {
  const clock = CLOCK_START;
  return {
    elapsed: 0,
    clock,
    sample: withPhaseProgress(sampleMission(clock)),
    playing: true,
    speed: 1,
    seekTo: null,
    didSeek: false,
  };
}

/** Advances the clock. Called once per frame by the mission driver. */
export function advanceRuntime(runtime: MissionRuntime, delta: number) {
  runtime.didSeek = false;

  if (runtime.seekTo !== null) {
    const target = runtime.seekTo;
    runtime.seekTo = null;
    runtime.clock = target;
    runtime.elapsed = target - CLOCK_START;
    runtime.didSeek = true;
  } else if (runtime.playing) {
    const step = Math.min(delta, 0.05) * runtime.speed;
    runtime.elapsed += step;
    runtime.clock = wrapClock(runtime.elapsed);
  }

  runtime.sample = withPhaseProgress(sampleMission(runtime.clock));
  return runtime.sample;
}

/** Jumps the sequence to a given mission clock time. */
export function seekRuntime(runtime: MissionRuntime, clock: number) {
  runtime.seekTo = clock;
}

/** Restarts the sequence from the beginning. */
export function restartRuntime(runtime: MissionRuntime) {
  runtime.elapsed = 0;
  runtime.clock = CLOCK_START;
  runtime.seekTo = null;
  runtime.didSeek = true;
  runtime.sample = withPhaseProgress(sampleMission(CLOCK_START));
  runtime.playing = true;
}

/** Fraction of the full loop that has elapsed, 0..1. */
export function loopProgress(runtime: MissionRuntime) {
  const wrapped = (runtime.elapsed % LOOP_DURATION + LOOP_DURATION) % LOOP_DURATION;
  return wrapped / LOOP_DURATION;
}

/** Converts a 0..1 loop fraction back into a mission clock time. */
export function progressToClock(progress: number) {
  return CLOCK_START + progress * LOOP_DURATION;
}

export { LOOP_DURATION, CLOCK_START };