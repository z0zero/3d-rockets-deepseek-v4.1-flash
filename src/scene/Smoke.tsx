/**
 * Smoke systems driven by the mission timeline: cryogenic venting before
 * ignition, the deluge cloud that engulfs the pad, and the exhaust trail that
 * is left behind as the vehicle climbs.
 *
 * Three pools with different characters rather than one generic emitter keeps
 * each effect tunable and the draw calls low.
 */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, NormalBlending } from 'three';
import { clamp, hash1, smoothstep } from '../lib/math';
import { useMission } from '../mission/MissionContext';
import { ParticleField, type SpawnConfig } from '../fx/particles';
import { smokeTexture } from '../fx/textures';
import type { MissionSample } from '../mission/mission';

/** Accumulator so emission rate is independent of frame rate. */
class Emitter {
  private carry = 0;

  emit(count: number, spawn: (index: number) => void) {
    this.carry += count;
    const whole = Math.floor(this.carry);
    this.carry -= whole;
    for (let i = 0; i < whole; i++) spawn(i);
  }

  reset() {
    this.carry = 0;
  }
}

export function Smoke() {
  const mission = useMission();

  const pad = useMemo(
    () => new ParticleField({ capacity: 720, texture: smokeTexture(), blending: NormalBlending, opacity: 0.95 }),
    [],
  );
  const trail = useMemo(
    () => new ParticleField({ capacity: 520, texture: smokeTexture(), blending: NormalBlending, opacity: 0.9 }),
    [],
  );
  const vent = useMemo(
    () => new ParticleField({ capacity: 140, texture: smokeTexture(), blending: NormalBlending, opacity: 0.55 }),
    [],
  );

  const padEmitter = useMemo(() => new Emitter(), []);
  const trailEmitter = useMemo(() => new Emitter(), []);
  const ventEmitter = useMemo(() => new Emitter(), []);

  const pools = useMemo(() => [pad, trail, vent], [pad, trail, vent]);

  useEffect(
    () => () => {
      pools.forEach((field) => field.dispose());
    },
    [pools],
  );

  // Pre-allocated colour scratch pairs: (birth, death) per effect.
  const colors = useMemo(
    () => ({
      padWarm: [new Color('#f0c39a'), new Color('#d9dcdd')] as [Color, Color],
      padCool: [new Color('#e4e7e8'), new Color('#cfd3d6')] as [Color, Color],
      trailWarm: [new Color('#f6d0a4'), new Color('#dcdfe1')] as [Color, Color],
      trailCool: [new Color('#e8eaec'), new Color('#d2d6d9')] as [Color, Color],
      vent: [new Color('#f2f5f7'), new Color('#e8ecef')] as [Color, Color],
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const sample = mission.sample;
    const time = state.clock.elapsedTime;

    if (mission.didSeek) {
      padEmitter.reset();
      trailEmitter.reset();
      ventEmitter.reset();
      pad.clear();
      trail.clear();
      vent.clear();
    }

    emitPadSmoke(pad, padEmitter, sample, dt, colors.padWarm, colors.padCool);
    emitTrail(trail, trailEmitter, sample, dt, colors.trailWarm, colors.trailCool);
    emitVent(vent, ventEmitter, sample, dt, colors.vent);

    pad.update(dt, time);
    trail.update(dt, time);
    vent.update(dt, time);
  });

  return (
    <group>
      <primitive object={pad.mesh} />
      <primitive object={trail.mesh} />
      <primitive object={vent.mesh} />
    </group>
  );
}

/**
 * The deluge cloud: water and steam blasted outward from the trench, growing
 * into a wall of smoke that hides the pad as the vehicle leaves.
 */
function emitPadSmoke(
  field: ParticleField,
  emitter: Emitter,
  sample: MissionSample,
  dt: number,
  warm: [Color, Color],
  cool: [Color, Color],
) {
  const strength = sample.padSmoke;
  if (strength <= 0.01) return;

  // Rate peaks just after ignition then falls away as the vehicle climbs.
  const rate = strength * 150;
  const heat = clamp(1 - sample.altitude / 120);

  emitter.emit(rate * dt, () => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 16;
    const speed = 7 + Math.random() * 20;

    // Smoke is thrown outward and up from the trench mouth.
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    const vy = 1.5 + Math.random() * 5;

    const hot = Math.random() < heat * 0.75;
    const palette = hot ? warm : cool;

    const config: SpawnConfig = {
      x: Math.cos(angle) * radius * 0.4,
      y: 0.8 + Math.random() * 3.5,
      z: Math.sin(angle) * radius * 0.4,
      vx,
      vy,
      vz,
      life: 6 + Math.random() * 8,
      size: [3.5 + Math.random() * 3, 26 + Math.random() * 22],
      color: palette,
      alpha: [0.5 + Math.random() * 0.25, 0],
      drag: 0.55,
      buoyancy: 0.9 + Math.random() * 1.3,
      turbulence: 1.6,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.5,
    };
    field.spawn(config);
  });

  // A dense column rising directly under the vehicle while it is low.
  const columnStrength = smoothstep(-2, 0.5, sample.t) * (1 - smoothstep(30, 110, sample.altitude));
  if (columnStrength > 0.02) {
    emitter.emit(70 * columnStrength * dt, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 6;
      const config: SpawnConfig = {
        x: Math.cos(angle) * radius,
        y: 1 + Math.random() * 4,
        z: Math.sin(angle) * radius,
        vx: Math.cos(angle) * (2 + Math.random() * 5),
        vy: 6 + Math.random() * 12,
        vz: Math.sin(angle) * (2 + Math.random() * 5),
        life: 4 + Math.random() * 5,
        size: [3, 18 + Math.random() * 10],
        color: heat > 0.4 ? warm : cool,
        alpha: [0.55, 0],
        drag: 0.8,
        buoyancy: 2.5,
        turbulence: 2.2,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.7,
      };
      field.spawn(config);
    });
  }
}

/** Exhaust trail emitted at the nozzle and left behind in world space. */
function emitTrail(
  field: ParticleField,
  emitter: Emitter,
  sample: MissionSample,
  dt: number,
  warm: [Color, Color],
  cool: [Color, Color],
) {
  const strength = sample.trailSmoke;
  if (strength <= 0.01) return;

  const rate = strength * 110;
  const plumeLength = 6 + sample.flame * 16;
  const heat = clamp(1 - sample.altitude / 400);

  emitter.emit(rate * dt, () => {
    const along = Math.random() * plumeLength * 0.8;
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.6 + along * 0.09;

    const config: SpawnConfig = {
      x: Math.cos(angle) * spread,
      y: sample.nozzleY - along,
      z: Math.sin(angle) * spread,
      vx: (Math.random() - 0.5) * 6,
      vy: -4 - Math.random() * 8,
      vz: (Math.random() - 0.5) * 6,
      life: 4 + Math.random() * 5,
      size: [2 + Math.random() * 2, 14 + Math.random() * 12],
      color: Math.random() < heat * 0.7 ? warm : cool,
      alpha: [0.45 + Math.random() * 0.2, 0],
      drag: 0.6,
      buoyancy: 0.4,
      turbulence: 1.4,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.6,
    };
    field.spawn(config);
  });
}

/** Thin cryogenic vapour drifting off the vehicle before ignition. */
function emitVent(
  field: ParticleField,
  emitter: Emitter,
  sample: MissionSample,
  dt: number,
  palette: [Color, Color],
) {
  const strength = sample.venting;
  if (strength <= 0.02) return;

  const rate = strength * 26;
  for (const side of [1, -1]) {
    emitter.emit(rate * dt * 0.5, (i) => {
      const seed = hash1(i + side * 13.7);
      const config: SpawnConfig = {
        x: side * 2.1,
        y: sample.nozzleY + 12 + seed * 6,
        z: (seed - 0.5) * 3,
        vx: side * (1.2 + seed * 1.6),
        vy: 0.6 + seed * 0.8,
        vz: (seed - 0.5) * 1.2,
        life: 2.2 + seed * 2,
        size: [0.5, 3.5 + seed * 2],
        color: palette,
        alpha: [0.4, 0],
        drag: 1.4,
        buoyancy: 0.6,
        turbulence: 0.8,
        rotation: seed * Math.PI * 2,
        spin: (seed - 0.5) * 0.4,
      };
      field.spawn(config);
    });
  }
}