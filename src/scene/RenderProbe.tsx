/**
 * Development-only render probe. Publishes a `window.__ascent` handle so the
 * browser verification harness can seek the mission clock and read live
 * renderer counters. No-ops in production builds.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { totalLiveParticles } from '../fx/particles';
import { directCamera } from '../mission/cameraDirector';
import { useMission } from '../mission/MissionContext';

export function RenderProbe() {
  const mission = useMission();
  const gl = useThree((state) => state.gl);
  const fps = useRef(0);
  const window_ = useRef({ frames: 0, time: 0 });

  useFrame((_, delta) => {
    const acc = window_.current;
    acc.frames += 1;
    acc.time += delta;
    if (acc.time >= 0.5) {
      fps.current = Math.round(acc.frames / acc.time);
      acc.frames = 0;
      acc.time = 0;
    }
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    window.__ascent = {
      runtime: mission,
      stats: () => ({
        fps: fps.current,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        particles: totalLiveParticles(),
        phase: mission.sample.phase.id,
        shot: directCamera(mission.sample).shotLabel,
        clock: mission.clock,
        playing: mission.playing,
      }),
    };

    return () => {
      delete window.__ascent;
    };
  }, [gl, mission]);

  return null;
}